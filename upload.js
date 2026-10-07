const COURSEWARE_ENDPOINT=SUPABASE_URL+'/functions/v1/courseware-import';
const UPLOAD_JOB_KEY='semesterCoursewareJob',UPLOAD_RESULT_KEY='semesterCoursewareResult';
function readUploadStorage(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
let uploadJob=readUploadStorage(UPLOAD_JOB_KEY),uploadResult=readUploadStorage(UPLOAD_RESULT_KEY);
let uploadFile=null,uploadBusy=false,uploadPollRunning=false,uploadStatusText='',uploadStatusKind='',uploadConfigured=null;
let uploadCourse=currentCourse,uploadWeek=currentWeek;
function showUpload(){
 window._view={type:'upload'};
 app.innerHTML=`<div class="sectionHead"><button class="back" onclick="showHome()">← 返回首页</button><div><div class="code">Semester Vocabulary</div><h1>上传课件</h1></div></div>
 <section class="panel uploadPanel"><h2>让课件变成你的词库</h2><p class="meta">AI 整理专业术语和中文释义，按课程与 Week 自动入库。</p>
 <form id="uploadForm" onsubmit="uploadCourseware(event)"><div class="uploadFields">
 <div><label for="uploadCourse">课程</label><select id="uploadCourse" onchange="uploadCourse=this.value">${Object.keys(COURSES).map(c=>`<option value="${c}" ${c===uploadCourse?'selected':''}>${c} · ${COURSES[c]}</option>`).join('')}</select></div>
 <div><label for="uploadWeek">Week</label><select id="uploadWeek" onchange="uploadWeek=Number(this.value)">${Array.from({length:13},(_,i)=>i+1).map(w=>`<option value="${w}" ${w===Number(uploadWeek)?'selected':''}>Week ${w}</option>`).join('')}</select></div></div>
 <div class="uploadFile"><label for="coursewareFile">选择课件</label><input id="coursewareFile" type="file" accept=".pdf,.pptx,.docx,.txt" onchange="selectCourseware(this.files[0])"><p id="uploadFilename" class="uploadHint"></p><p class="uploadHint">支持 PDF、PPTX、DOCX、TXT，单个文件不超过 10 MB。<br>含图片、扫描页或图表的课件，建议先转成 PDF。</p></div>
 <label for="uploadPassword">上传口令</label><input id="uploadPassword" type="password" autocomplete="off" maxlength="512" placeholder="输入你的上传口令">
 <p class="uploadHint">课件将发送至 OpenAI 分析，可能产生 API 费用。只提取课件中的专业术语，已有词汇自动跳过。</p>
 <div class="uploadActions"><button id="uploadSubmit" class="primary" type="submit">整理并加入词库</button><button id="uploadCheck" class="linkbtn" type="button" onclick="checkUploadService()">检查连接</button><button id="uploadResume" class="secondary" type="button" onclick="pollCourseware()" hidden>继续检查</button></div>
 </form><div id="uploadConnection" class="uploadHint" role="status"></div><div id="uploadStatus" class="uploadStatus" role="status" aria-live="polite"></div><div id="uploadResults" class="uploadResults"></div></section>`;
 refreshUploadState();checkUploadService();
}
function selectCourseware(file){
 uploadFile=file||null;
 const el=document.getElementById('uploadFilename');if(el)el.textContent=uploadFile?'已选择：'+uploadFile.name:'';
}
function setUploadStatus(text,kind=''){uploadStatusText=text;uploadStatusKind=kind;refreshUploadState()}
function refreshUploadState(){
 const status=document.getElementById('uploadStatus');if(!status)return;
 status.className='uploadStatus '+uploadStatusKind;
 status.innerHTML=uploadBusy?`<div class="uploadProgress"><span class="uploadSpinner" aria-hidden="true"></span><span>${esc(uploadStatusText)}</span></div>`:esc(uploadStatusText);
 for(const id of ['uploadCourse','uploadWeek','coursewareFile','uploadPassword','uploadCheck']){const el=document.getElementById(id);if(el)el.disabled=uploadBusy;}
 const submit=document.getElementById('uploadSubmit');submit.disabled=uploadBusy||Boolean(uploadJob)||uploadConfigured===false;submit.textContent=uploadBusy?'正在整理…':'整理并加入词库';
 const resume=document.getElementById('uploadResume');resume.hidden=!uploadJob||uploadBusy;
 const filename=document.getElementById('uploadFilename');if(filename)filename.textContent=uploadFile?'已选择：'+uploadFile.name:'';
 if(uploadJob&&!uploadBusy&&!uploadStatusText)status.textContent=`${uploadJob.filename} 的分析任务尚未完成。点击“继续检查”，无需重复上传。`;
 renderUploadResult();
}
async function coursewareRequest(body,{token='',timeout=70000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const isForm=body instanceof FormData;
  const response=await fetch(COURSEWARE_ENDPOINT,{method:'POST',headers:{apikey:SUPABASE_KEY,...(isForm?{'x-upload-token':token}:{'Content-Type':'application/json'})},body:isForm?body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json();if(!response.ok){const e=new Error(data.error||'处理失败，请稍后重试。');e.status=response.status;throw e;}return data;
 }catch(e){if(e.name==='AbortError')throw new Error('连接超时。如果已经创建任务，请点击“继续检查”；请勿连续重复上传。');throw e;}finally{clearTimeout(timer);}
}
async function checkUploadService(){
 const target=document.getElementById('uploadConnection');if(!target)return;
 target.textContent='正在检查上传服务…';
 try{
  const response=await fetch(COURSEWARE_ENDPOINT,{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error();const data=await response.json();uploadConfigured=data.configured===true;
  const el=document.getElementById('uploadConnection');if(el)el.textContent=uploadConfigured?'上传服务已连接。':'上传功能尚未启用，请完成后台 AI 配置后，再点击“检查连接”。';
 }catch{uploadConfigured=false;const el=document.getElementById('uploadConnection');if(el)el.textContent='暂时无法连接上传服务，请稍后点击“检查连接”。';}
 refreshUploadState();
}
async function uploadCourseware(event){
 event.preventDefault();if(uploadBusy||uploadJob)return;
 const file=uploadFile,course=uploadCourse,week=Number(uploadWeek),token=document.getElementById('uploadPassword').value;
 if(!file)return setUploadStatus('请先选择课件。','error');
 if(!/\.(pdf|pptx|docx|txt)$/i.test(file.name))return setUploadStatus('请选择 PDF、PPTX、DOCX 或 TXT 文件。','error');
 if(!file.size||file.size>10*1024*1024)return setUploadStatus('课件不能为空，且不能超过 10 MB。','error');
 if(!token)return setUploadStatus('请输入上传口令。','error');
 if(!Object.hasOwn(COURSES,course)||!Number.isInteger(week)||week<1||week>13)return setUploadStatus('请选择课程和 Week。','error');
 uploadBusy=true;uploadResult=null;sessionStorage.removeItem(UPLOAD_RESULT_KEY);setUploadStatus('正在上传 '+file.name+'…');
 try{
  const form=new FormData();form.append('file',file,file.name);form.append('course',course);form.append('week',String(week));
  const result=await coursewareRequest(form,{token});
  uploadJob={job:result.job,filename:result.filename,course:result.course,week:result.week};sessionStorage.setItem(UPLOAD_JOB_KEY,JSON.stringify(uploadJob));
  const pw=document.getElementById('uploadPassword');if(pw)pw.value='';
  uploadBusy=false;await pollCourseware();
 }catch(e){uploadBusy=false;setUploadStatus(e.message||'上传失败，请检查网络后重试。','error');}
}
async function pollCourseware(){
 if(!uploadJob||uploadPollRunning)return;
 uploadPollRunning=true;uploadBusy=true;const started=Date.now();
 try{
  for(let attempt=0;attempt<180;attempt++){
   setUploadStatus(`正在整理 ${uploadJob.filename} → ${uploadJob.course} · Week ${uploadJob.week}。已等待 ${Math.floor((Date.now()-started)/1000)} 秒，请勿重复上传。`);
   const result=await coursewareRequest({action:'poll',job:uploadJob.job});
   if(result.status==='completed'){
    uploadResult=result;sessionStorage.setItem(UPLOAD_RESULT_KEY,JSON.stringify(result));uploadJob=null;sessionStorage.removeItem(UPLOAD_JOB_KEY);
    const synced=await loadCloud();uploadBusy=false;
    setUploadStatus(`已整理 ${result.extracted} 个术语，新增 ${result.inserted} 个，跳过 ${result.skipped} 个已有词汇。已保存到 ${result.course} · Week ${result.week}。${synced?'':'词汇已保存；当前页面同步失败，可稍后点击“同步”。'}`,'success');
    return;
   }
   await new Promise(resolve=>setTimeout(resolve,3000));
  }
  uploadBusy=false;setUploadStatus('课件仍在分析，稍后点击“继续检查”，无需重新上传。');
 }catch(e){
  uploadBusy=false;
  if([401,403,404,422,502].includes(e.status)){uploadJob=null;sessionStorage.removeItem(UPLOAD_JOB_KEY);}
  setUploadStatus(e.message||'网络连接中断。点击“继续检查”可继续已有任务。','error');
 }finally{uploadBusy=false;uploadPollRunning=false;refreshUploadState();}
}
function renderUploadResult(){
 const el=document.getElementById('uploadResults');if(!el)return;
 if(!uploadResult){el.innerHTML='';return;}
 const r=uploadResult;
 el.innerHTML=`<h3>${esc(r.course)} · Week ${Number(r.week)} 的整理结果</h3><p class="uploadHint">${esc(r.filename)} · ${Number(r.extracted)} 个术语</p><p class="uploadHint">${esc(r.coverage_note||'')}</p>${(r.warnings||[]).map(w=>`<p class="uploadHint">${esc(w)}</p>`).join('')}
 <div class="uploadActions"><button class="secondary" onclick="showWeek('${esc(r.course)}',${Number(r.week)})">去本周学习</button><button class="linkbtn" onclick="showManager('${esc(r.course)}',${Number(r.week)})">查看本周词库</button></div>
 ${(r.terms||[]).map(t=>`<details><summary><b>${esc(t.english)}</b><span class="zh">${esc(t.chinese)}</span></summary><p class="uploadHint">出处：${esc(t.source)}</p><blockquote>${esc(t.quote)}</blockquote></details>`).join('')}`;
}
