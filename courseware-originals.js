// Private PDF originals and a bounded single-page viewer. No model calls.
let originalPdfState=null,originalPdfSerial=0;
const ORIGINAL_PDF_LIMIT=20*1024*1024;
function validOriginalPath(path,uid,source){return /^[a-f0-9-]{36}$/i.test(uid)&&/^[a-f0-9-]{36}$/i.test(source)&&new RegExp('^'+uid+'/'+source+'/[a-f0-9-]{36}\\.pdf$','i').test(path||'')}
async function openOriginalPdf(data){
 if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
 const pdfjs=await import('./vendor/pdf-4.10.38.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/courselex-pdf-worker.mjs';
 return pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false}).promise;
}
async function originalStorage(path,options={}){
 const uid=session?.user.id,epoch=accountEpoch,{data,error}=await authClient.auth.getSession();if(error||!uid||data.session?.user.id!==uid)throw Error('请重新登录');
 const r=await fetch(SUPABASE_URL+'/storage/v1/object/'+path,{...options,headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+data.session.access_token,...options.headers}});
 if(session?.user.id!==uid||epoch!==accountEpoch)throw Error('账号已切换');if(!r.ok)throw Error('原始PDF读取或保存失败（'+r.status+'）');return r;
}
async function attachOriginalPdf(file,source){
 const uid=session?.user.id;if(!uid||!source?.id||source.user_id&&source.user_id!==uid)throw Error('课件不属于当前账号');

 if(!file||!file.name.toLowerCase().endsWith('.pdf')||file.size<5||file.size>ORIGINAL_PDF_LIMIT)throw Error('请选择20 MB以内的原始PDF');
 const bytes=await file.arrayBuffer(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(source.original_path){if(source.original_sha256===sha256)return source;throw Error('同名课件已有不同原始PDF，请保留旧版并使用新文件名上传')}if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('文件不是有效PDF');
 const pdf=await openOriginalPdf(bytes.slice(0));let pages;try{pages=pdf.numPages;if(pages<1||pages>100)throw Error('PDF需为1至100页')}finally{await pdf.destroy()}
 if(session?.user.id!==uid)throw Error('账号已切换');
 const path=uid+'/'+source.id+'/'+crypto.randomUUID()+'.pdf';
 await originalStorage('sinq-courseware/'+path,{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:new Blob([bytes],{type:'application/pdf'})});
 const result=await sb('rpc/attach_courseware_original',{method:'POST',body:JSON.stringify({p_source:source.id,p_path:path,p_pages:pages,p_bytes:file.size,p_sha256:sha256})});return {...source,...result};
}
async function saveUploadedOriginal(file,course,week){
 if(!file?.file||!file.path?.toLowerCase().endsWith('.pdf'))return;
 const rows=await sb('rpc/resolve_courseware_source',{method:'POST',body:JSON.stringify({p_course:course,p_week:week,p_text:splitCoursewareText(file.text).join('\n')})});
 if(!rows.length)throw Error('课件文字已保存，原始PDF尚未关联');await attachOriginalPdf(file.file,rows[0]);file.originalSaved=true;
}
function originalPdfAttachControl(){return '<label class="readerViewToggle">添加原始PDF<input id="coursewareOriginalFile" class="srOnly" type="file" accept="application/pdf,.pdf" onchange="attachVisibleOriginal(this.files[0]);this.value=\'\'"></label>'}
async function attachVisibleOriginal(file){
 if(!file)return;const id=readingPane.id,uid=session?.user.id,course=workspaceScope(),status=document.getElementById('readingStatus');
 try{if(status)status.textContent='正在私有保存原始PDF…';const [source]=await sb('user_learning_sources?id=eq.'+id+'&course_id=eq.'+course+'&select=id,user_id,original_path,original_sha256');if(!source)throw Error('请先选择课件');await attachOriginalPdf(file,source);if(session?.user.id!==uid||readingPane.id!==id||workspaceScope()!==course)return;readingPane.pdf=true;readingPane.key='';readingPane.html='';await loadReadingPane();if(status)status.textContent='原始PDF已保存到账号'}catch(e){if(session?.user.id===uid&&status)status.textContent=e.message}
}
function resetOriginalPdf(){originalPdfSerial++;const previous=originalPdfState;originalPdfState=null;if(previous?.pdf)void previous.pdf.destroy().catch(()=>{})}
function originalPdfScale(width,height,available,pixelRatio=1){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('PDF页面尺寸无效');return Math.min(2,2200/Math.max(width,height),Math.max(.1,Math.max(200,Number(available)||600)/width)*Math.min(3,Math.max(1,Number(pixelRatio)||1)))}
async function renderOriginalPdf(row,content,controls){
 const uid=session?.user.id,id=row.id,serial=++originalPdfSerial;
 if(!validOriginalPath(row.original_path,uid,id))throw Error('原始PDF路径无效');
 if(originalPdfState?.uid!==uid||originalPdfState?.id!==id){const previous=originalPdfState;originalPdfState=null;if(previous?.pdf)await previous.pdf.destroy();const r=await originalStorage('authenticated/sinq-courseware/'+row.original_path);const pdf=await openOriginalPdf(await r.arrayBuffer());if(serial!==originalPdfSerial||session?.user.id!==uid||readingPane.id!==id){await pdf.destroy();return}originalPdfState={uid,id,pdf}}
 const state=originalPdfState;if(!state)return;
 const page=Math.min(state.pdf.numPages,Math.max(1,Number(readingPane.page)||1));readingPane.page=page;
 controls.insertAdjacentHTML('beforeend',renderStudyPicker('originalPdfPage','课件页码',String(page),Array.from({length:state.pdf.numPages},(_,i)=>({value:String(i+1),label:'第 '+(i+1)+' 页'})),chooseOriginalPdfPage));
 content.innerHTML='<article class="readerSlides"><figure id="lecturePage'+page+'"><figcaption>原始PDF · 第 '+page+' / '+state.pdf.numPages+' 页</figcaption><canvas aria-label="课件第 '+page+' 页"></canvas></figure></article>';
 const canvas=content.querySelector('canvas'),p=await state.pdf.getPage(page),base=p.getViewport({scale:1}),scale=originalPdfScale(base.width,base.height,(content.clientWidth||Math.min(1000,Math.max(360,window.innerWidth-48)))-32,window.devicePixelRatio),viewport=p.getViewport({scale});
 if(serial!==originalPdfSerial||session?.user.id!==uid||readingPane.id!==id||!canvas.isConnected)return;
 canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width='100%';canvas.style.height='auto';
 await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 if(serial!==originalPdfSerial||session?.user.id!==uid||readingPane.id!==id)return;
 content.onscroll=trackReadingScroll;content.scrollTop=readingPane.scroll||0;if(typeof applyReadingResumePosition==='function')applyReadingResumePosition(content);if(typeof saveReadingResume==='function')saveReadingResume();
}
function chooseOriginalPdfPage(value){const page=Number(value);if(!Number.isInteger(page)||page<1||page>100)return;readingPane.page=page;readingPane.scroll=0;readingPane.anchor={page,ratio:0};readingPane.restoreAnchor=false;readingPane.key='';readingPane.html='';loadReadingPane()}
