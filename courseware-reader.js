async function readCoursewareText(file){
 if(!file||file.size===0||file.size>10*1024*1024)throw Error('请选择不超过 10 MB 的课件。');
 const extension=file.name.split('.').pop().toLowerCase();let text='';
 if(extension==='txt')text=await file.text();
 else if(extension==='pdf'){
  if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
  const pdfjs=await import('./vendor/pdf-4.10.38.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf-worker-4.10.38.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{
   if(pdf.numPages>100)throw Error('课件超过 100 页，请拆分文件后上传。');
   for(let page=1;page<=pdf.numPages;page++){
    const content=await (await pdf.getPage(page)).getTextContent();const words=content.items.map(item=>item.str||'').join(' ').trim();
    if(!words)throw Error('第 '+page+' 页无法读取文字，可能是扫描页。请先 OCR 转成可搜索 PDF，或使用自己的 AI 整理。');
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
   const xml=await entry.async('string');if(xml.length>5*1024*1024)throw Error('课件页面内容过大，请拆分。');
   const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('课件内容损坏，请重新导出。');
   const words=[...doc.getElementsByTagNameNS('*','t')].map(el=>el.textContent).join(' ').trim();
   if(!words)throw Error('课件第 '+(index+1)+' 段没有可读取的文字。图片课件请先 OCR 或用自己的 AI 整理。');
   text+='\n['+(extension==='pptx'?'Slide '+(index+1):'Document')+']\n'+words;if(text.length>192000)throw Error('课件文字过多，请拆分。');
  }
 }else throw Error('支持 PDF、PPTX、DOCX、TXT；旧版 PPT / DOC 请先转换。');
 text=text.replace(/\u0000/g,'').trim();if(!text)throw Error('课件没有可读取的文字。');if(text.length>192000)throw Error('课件文字过多，请拆分。');return text;
}
function splitCoursewareText(text){
 const parts=[];let rest=text;
 while(rest.length){let end=Math.min(6000,rest.length);if(end<rest.length){const boundary=Math.max(rest.lastIndexOf('\n',end),rest.lastIndexOf(' ',end));if(boundary>3000)end=boundary}parts.push(rest.slice(0,end));rest=rest.slice(end).trimStart()}
 if(parts.length>32)throw Error('课件文字过多，请拆分。');return parts;
}
