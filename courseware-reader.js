async function readCoursewareText(file,{ocr,onProgress=()=>{}}={}){
 if(!file||file.size===0||file.size>20*1024*1024)throw Error('请选择不超过 20 MB 的课件。');
 const extension=file.name.split('.').pop().toLowerCase();let text='';
 if(extension==='txt')text=await file.text();
 else if(extension==='pdf'){
  if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
  const pdfjs=await import('./vendor/pdf-4.10.38.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/courselex-pdf-worker.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{
   if(pdf.numPages>100)throw Error('课件超过 100 页，请拆分文件后上传。');
   for(let page=1;page<=pdf.numPages;page++){
    const pageObject=await pdf.getPage(page);onProgress('读取第 '+page+' / '+pdf.numPages+' 页');const content=await pageObject.getTextContent();let words=content.items.map(item=>item.str||'').join(' ').trim();
    // A genuinely empty page must not reject an otherwise usable lecture.
    if(!words){const drawingOps=new Set(Object.entries(pdfjs.OPS).filter(([name])=>/^(paint|showText|showSpacedText|nextLineShowText|nextLineSetSpacingShowText|stroke|closeStroke|fill|eoFill|closeFillStroke|closeEOFillStroke|shadingFill|constructPath)/.test(name)).map(([,op])=>op));if(!(await pageObject.getOperatorList()).fnArray.some(op=>drawingOps.has(op)))continue;}
    if(words.length<12&&ocr){
     const viewport=pageObject.getViewport({scale:1});const scale=Math.min(2,1400/Math.max(viewport.width,viewport.height));const v=pageObject.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await pageObject.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
     onProgress('识别图片页 '+page+' / '+pdf.numPages);words=await ocr(canvas.toDataURL('image/jpeg',0.8),page);canvas.width=canvas.height=0;
    }
    if(!words)throw Error('第 '+page+' 页没有可读内容，请检查是否为空白或加密页面。');
    text+='\n[Page '+page+']\n'+words;if(text.length>192000)throw Error('课件文字过多，请拆分文件后上传。');
   }
  }finally{await pdf.destroy()}
 }else if(['pptx','docx'].includes(extension)){
  if(!window.JSZip){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/jszip-3.10.1.js';script.onload=resolve;script.onerror=()=>reject(Error('课件读取组件加载失败，请稍后重试。'));document.head.append(script)})}
  const zip=await JSZip.loadAsync(await file.arrayBuffer());let entries=Object.keys(zip.files).filter(name=>extension==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(name):name==='word/document.xml');
  entries.sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1]||0)-Number(b.match(/slide(\d+)/)?.[1]||0));
  if(!entries.length||entries.length>100)throw Error('课件内容无效或页数过多，请重新导出或拆分。');
  let bytes=0;
  for(const [index,name] of entries.entries()){
   const entry=zip.files[name];bytes+=entry._data?.uncompressedSize||0;if(bytes>20*1024*1024)throw Error('课件解压后的内容过大，请拆分。');
   const xml=new TextDecoder().decode(await boundedArchiveBytes(entry,5*1024*1024));if(xml.length>5*1024*1024)throw Error('课件页面内容过大，请拆分。');
   const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('课件内容损坏，请重新导出。');
   let words=[...doc.getElementsByTagNameNS('*','t')].map(el=>el.textContent).join(' ').trim();
   if(!words&&extension==='pptx'&&!['sp','pic','graphicFrame','cxnSp','contentPart'].some(tag=>doc.getElementsByTagNameNS('*',tag).length))continue;
   if(words.length<12&&ocr){
    const relName=extension==='pptx'?name.replace('slides/','slides/_rels/')+'.rels':'word/_rels/document.xml.rels';const relEntry=zip.files[relName];
    if(relEntry){const rels=new DOMParser().parseFromString(new TextDecoder().decode(await boundedArchiveBytes(relEntry,1024*1024)),'application/xml');const ids=[...doc.getElementsByTagNameNS('*','blip')].map(el=>el.getAttribute('r:embed'));for(const id of ids){const rel=[...rels.getElementsByTagName('Relationship')].find(el=>el.getAttribute('Id')===id);const target=rel?.getAttribute('Target');if(!target||rel.getAttribute('TargetMode')==='External')continue;const mediaName=new URL(target,'https://local.invalid/'+name).pathname.slice(1);const media=zip.files[mediaName];if(!media||!/\.(png|jpe?g)$/i.test(mediaName)||(media._data?.uncompressedSize||0)>10*1024*1024)continue;const image=await coursewareBitmap(new Blob([await boundedArchiveBytes(media,10*1024*1024)]));if(image.width>150&&image.height>100){const scale=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.ceil(image.width*scale);canvas.height=Math.ceil(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);words+='\n'+await ocr(canvas.toDataURL('image/jpeg',0.8),index+1);canvas.width=canvas.height=0;}image.close();}}
   }
   if(!words)throw Error('课件第 '+(index+1)+' 段没有可读取的文字。图片课件请先 OCR 或用自己的 AI 整理。');
   text+='\n['+(extension==='pptx'?'Slide '+(index+1):'Document')+']\n'+words;if(text.length>192000)throw Error('课件文字过多，请拆分。');
  }
 }else if(extension==='ppt'){
  await loadMaterialScript('vendor/cfb-1.2.2.js','CFB');const container=CFB.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});const entry=CFB.find(container,'PowerPoint Document');if(!entry)throw Error('无法读取此 PPT，请另存为 PPTX 或 PDF。');const bytes=new Uint8Array(entry.content);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let records=0;
  function scan(start,end,depth){if(depth>30)throw Error('PPT 文件结构异常。');for(let offset=start;offset+8<=end;){if(++records>100000)throw Error('PPT 文件结构过大。');const version=view.getUint16(offset,true)&15,type=view.getUint16(offset+2,true),size=view.getUint32(offset+4,true),next=offset+8+size;if(next>end||next<=offset)break;if(version===15)scan(offset+8,next,depth+1);else if(type===4000||type===4008){text+='\n'+new TextDecoder(type===4000?'utf-16le':'windows-1252').decode(bytes.subarray(offset+8,next));}offset=next;}}
  scan(0,bytes.length,0);if(!text.trim())throw Error('此旧版 PPT 没有可读取的文字，请另存为 PDF 后上传，扫描 PDF 可自动识别。');
 }else if(['png','jpg','jpeg','webp'].includes(extension)){
  if(!ocr)throw Error('请从首页上传图片课件，莱克会尝试自动识别。');const bitmap=await coursewareBitmap(file);const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);onProgress('识别图片课件');text=await ocr(canvas.toDataURL('image/jpeg',0.8),1);bitmap.close();canvas.width=canvas.height=0;
 }else throw Error('支持 ZIP、PDF、PPTX、PPT、DOCX、TXT 和常见图片。');
 text=text.replace(/\u0000/g,'').trim();if(!text)throw Error('课件没有可读取的文字。');if(text.length>192000)throw Error('课件文字过多，请拆分。');return text;
}
function splitCoursewareText(text){
 const parts=[];let rest=text;
 while(rest.length){let end=Math.min(9000,rest.length);if(end<rest.length){const boundary=Math.max(rest.lastIndexOf('\n',end),rest.lastIndexOf(' ',end));if(boundary>4500)end=boundary}parts.push(rest.slice(0,end));rest=rest.slice(end).trimStart()}
 if(parts.length>32)throw Error('课件文字过多，请拆分。');return parts;
}
async function loadMaterialScript(src,globalName){if(window[globalName])return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('读取组件加载失败，请检查网络后重试。'));document.head.append(s)})}
function inferMaterialWeek(name){const match=name.match(/(?:^|[^A-Za-z0-9])(?:week|wk|w|lecture|lec|session|第)\s*[-_ .]*0*(\d{1,2})(?!\d)/i);const n=Number(match?.[1]);return n>=1&&n<=52?n:0}
async function unpackMaterials(selected){
 let files=[],ignored=[];let expanded=0;const supported=/\.(pdf|pptx|ppt|docx|txt|png|jpe?g|webp)$/i;
 for(const file of selected){
  if(/\.zip$/i.test(file.name)){
   if(file.size>80*1024*1024)throw Error('压缩包超过 80 MB，请分成两包上传。');await loadMaterialScript('vendor/jszip-3.10.1.js','JSZip');let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer())}catch{throw Error('压缩包无法打开，请使用未加密的 ZIP。')}
   const entries=Object.values(zip.files);if(entries.length>2000)throw Error('压缩包文件过多，请只打包课程资料。');
   for(const entry of entries){if(entry.dir||/(^|\/)(__MACOSX|\.)/.test(entry.name))continue;if(!supported.test(entry.name)){ignored.push(entry.name);continue}const size=entry._data?.uncompressedSize||0;expanded+=size;if(size>20*1024*1024||expanded>200*1024*1024)throw Error('解压后课件过大，请分批上传。');if(files.length>=60)throw Error('每批最多 60 个课件，请分批上传。');const bytes=await boundedArchiveBytes(entry,20*1024*1024);if(bytes.length>size)expanded+=bytes.length-size;if(expanded>200*1024*1024)throw Error('解压后的资料超过安全读取范围，请分批上传。');files.push({file:new File([bytes],entry.name.split('/').pop()),path:entry.name})}
  }else if(supported.test(file.name))files.push({file,path:file.name});else ignored.push(file.name);
 }
 if(files.length>60)throw Error('每批最多 60 个课件。');if(!files.length)throw Error('没有找到 PDF、PPT、PPTX、DOCX 或 TXT 课件。');
 const unique=[],seen=new Set();let duplicates=0;for(const item of files){if(item.file.size>20*1024*1024)throw Error(item.path+' 超过 20 MB。');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await item.file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(seen.has(hash)){duplicates++;continue}seen.add(hash);unique.push({...item,hash})}
 return {files:unique,ignored,duplicates};
}
function boundedArchiveBytes(entry,max){return new Promise((resolve,reject)=>{let size=0,finished=false;const chunks=[];const stream=entry.internalStream('uint8array');stream.on('data',chunk=>{if(finished)return;size+=chunk.length;if(size>max){finished=true;stream.pause();reject(Error('压缩包中的文件解压后过大，请使用原始课件。'));return}chunks.push(chunk)}).on('error',error=>{finished=true;reject(error)}).on('end',()=>{if(finished)return;finished=true;const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}resolve(result)}).resume()})}
async function coursewareBitmap(blob){if(typeof createImageBitmap==='function')return createImageBitmap(blob);const url=URL.createObjectURL(blob),image=new Image();image.src=url;try{await image.decode();image.width=image.naturalWidth;image.height=image.naturalHeight;image.close=()=>URL.revokeObjectURL(url);return image}catch{URL.revokeObjectURL(url);throw Error('此图片无法读取，请转为 JPG 或 PDF。')}}
