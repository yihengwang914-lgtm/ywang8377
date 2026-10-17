const COURSEWARE_ENDPOINT=SUPABASE_URL+'/functions/v1/courselex-glm-import';
let UPLOAD_JOB_KEY='',UPLOAD_RESULT_KEY='',uploadJob=null,uploadResult=null,uploadFile=null,uploadBusy=false,uploadPollRunning=false,uploadStatusText='',uploadStatusKind='',uploadConfigured=null;
let uploadCourse=currentCourse,uploadWeek=currentWeek;
function readUploadStorage(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
function resetUploadAccount(uid){UPLOAD_JOB_KEY='courselex-glm-job:'+uid;UPLOAD_RESULT_KEY='courselex-glm-result:'+uid;uploadJob=uid?readUploadStorage(UPLOAD_JOB_KEY):null;uploadResult=uid?readUploadStorage(UPLOAD_RESULT_KEY):null;uploadFile=null;uploadBusy=false;uploadPollRunning=false;uploadStatusText='';uploadStatusKind='';uploadCourse=uploadJob?.course||currentCourse;uploadWeek=uploadJob?.week||currentWeek}
function showUpload(){
 document.body?.classList?.remove('assistantMode');
 if(!session)return showAuth();if(!Object.keys(COURSES).length)return showCourses();if(!COURSES[uploadCourse])uploadCourse=currentCourse;uploadWeek=Math.min(uploadWeek,weekCount(uploadCourse));window._view={type:'upload'};
 app.innerHTML=`<div class="sectionHead"><button class="back" onclick="showHome()">← 返回首页</button><h1>上传课件，自动生成词库</h1></div><section class="panel uploadPanel"><div class="lexIntro"><img src="assets/brand/courselex-mark.png" alt="" width="36" height="36"><div><strong>莱克 Lex · 自动整理</strong><p>选课程、选周次、上传课件，整理完成后自动入库。</p></div></div>
 <form onsubmit="uploadCourseware(event)"><div class="uploadFields"><div><label for="uploadCourse">课程</label><select id="uploadCourse" onchange="uploadCourse=this.value;uploadWeek=1;showUpload()">${Object.keys(COURSES).map(c=>`<option value="${esc(c)}" ${c===uploadCourse?'selected':''}>${esc(courseLabel(c))} · ${esc(COURSES[c])}</option>`).join('')}</select></div><div><label for="uploadWeek">Week</label><select id="uploadWeek" onchange="uploadWeek=Number(this.value)">${Array.from({length:weekCount(uploadCourse)},(_,i)=>i+1).map(w=>`<option value="${w}" ${w===Number(uploadWeek)?'selected':''}>Week ${w}</option>`).join('')}</select></div></div>
 <div class="uploadFile"><label for="coursewareFile">选择课件</label><input id="coursewareFile" type="file" accept=".pdf,.pptx,.docx,.txt" onchange="selectCourseware(this.files[0])"><p id="uploadFilename" class="uploadHint"></p></div><p class="meta">支持 PDF、PPTX、DOCX、TXT，单份不超过 10 MB / 100 页。只整理可读取的文字，图片与图表内文字请先 OCR；AI 释义请结合课件核对。</p>
 <label class="uploadConsent uploadHint"><input id="uploadConsent" type="checkbox" required> 同意将读取到的课件文字发送给DeepSeek AI 整理。请确认你有权使用该课件，避免上传个人敏感信息。</label><p class="uploadHint">使用 DeepSeek 整理，受每日上传额度和站内测试预算限制。处理中可刷新恢复，无需重复上传。</p>
 <div class="uploadActions"><button id="uploadSubmit" class="primary" type="submit">整理并加入词库</button><button id="uploadResume" class="secondary" type="button" onclick="pollCourseware()" hidden>继续检查</button><button id="uploadCheck" class="linkbtn" type="button" onclick="checkUploadService()">检查连接</button></div></form><div id="uploadConnection" class="uploadHint" role="status"></div><div id="uploadStatus" class="notice" role="status" aria-live="polite"></div><div id="uploadResults"></div><div class="uploadActions"><button class="secondary" onclick="showOwnAI(uploadCourse,uploadWeek)">用自己的 AI 整理后导入</button></div></section>`;
 refreshUploadState();checkUploadService();
}
function selectCourseware(file){uploadFile=file||null;refreshUploadState()}
function setUploadStatus(text,kind=''){uploadStatusText=text;uploadStatusKind=kind;refreshUploadState()}
function refreshUploadState(){
 const el=document.getElementById('uploadStatus');if(!el)return;el.textContent=uploadStatusText|| (uploadJob?'存在尚未完成的整理任务，点击“继续检查”即可恢复。':'');el.className='notice '+uploadStatusKind;
 for(const id of ['uploadCourse','uploadWeek','coursewareFile','uploadConsent','uploadCheck'])document.getElementById(id).disabled=uploadBusy;
 const submit=document.getElementById('uploadSubmit');submit.disabled=uploadBusy||Boolean(uploadJob)||uploadConfigured!==true;submit.textContent=uploadBusy?'正在整理…':'整理并加入词库';document.getElementById('uploadResume').hidden=!uploadJob||uploadBusy;document.getElementById('uploadFilename').textContent=uploadFile?'已选择：'+uploadFile.name:'';renderUploadResult();
}
async function coursewareRequest(body){
 const epoch=accountEpoch;const {data:{session:active}}=await authClient.auth.getSession();if(!active||!session||active.user.id!==session.user.id)throw Error('请重新登录。');
 let response;try{response=await fetch(COURSEWARE_ENDPOINT,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+active.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(body.action==='chat'||body.action==='learning_answer'?150000:75000)})}catch{throw Error('连接中断；已创建的任务可稍后继续检查。')}
 const data=await response.json();if(epoch!==accountEpoch)throw Error('账号已切换。');if(!response.ok){const e=Error(data.error||'整理失败。');e.status=response.status;e.retryable=data.retryable;e.thread_id=data.thread_id;throw e}return data;
}
async function checkUploadService(){
 const epoch=accountEpoch;try{const r=await fetch(COURSEWARE_ENDPOINT,{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(15000)});const data=await r.json();if(epoch!==accountEpoch)return;uploadConfigured=r.ok&&data.configured===true}catch{if(epoch!==accountEpoch)return;uploadConfigured=false}
 const el=document.getElementById('uploadConnection');if(el)el.textContent=uploadConfigured?'免费整理服务已连接。':'自动整理暂时不可用，可以先用自己的 AI 整理后导入。';refreshUploadState();
}
async function uploadCourseware(event){
 event.preventDefault();if(uploadBusy||uploadJob)return;const file=uploadFile,course=uploadCourse,week=Number(uploadWeek);if(!document.getElementById('uploadConsent').checked)return setUploadStatus('请先勾选课件整理说明。','error');if(!file)return setUploadStatus('请先选择课件。','error');
 const epoch=accountEpoch;uploadBusy=true;uploadResult=null;sessionStorage.removeItem(UPLOAD_RESULT_KEY);setUploadStatus('正在读取课件文字…');
 try{const text=await readCoursewareText(file);if(epoch!==accountEpoch)return;const parts=splitCoursewareText(text);setUploadStatus('正在创建整理任务…');const prepared=await coursewareRequest({action:'prepare',course,week,filename:file.name,parts});if(epoch!==accountEpoch)return;uploadJob=prepared;sessionStorage.setItem(UPLOAD_JOB_KEY,JSON.stringify(prepared));uploadBusy=false;await pollCourseware()}catch(e){if(epoch!==accountEpoch)return;uploadBusy=false;setUploadStatus(e.message,'error')}
}
async function pollCourseware(){
 if(!uploadJob||uploadPollRunning)return;const epoch=accountEpoch;uploadPollRunning=true;uploadBusy=true;
 try{for(let attempt=0;attempt<160;attempt++){
  if(epoch!==accountEpoch)return;setUploadStatus('莱克正在整理课件'+(uploadJob.total?'，共 '+uploadJob.total+' 段':'')+'，请勿重复上传…');const result=await coursewareRequest({action:'next',job:uploadJob.job});if(epoch!==accountEpoch)return;
  if(result.status==='completed'){uploadResult=result;sessionStorage.setItem(UPLOAD_RESULT_KEY,JSON.stringify(result));uploadJob=null;sessionStorage.removeItem(UPLOAD_JOB_KEY);const synced=await loadCloud();if(epoch!==accountEpoch)return;setUploadStatus('已新增 '+result.inserted+' 个词，跳过 '+result.skipped+' 个已有词汇。'+(synced?'已同步到当前课程与 Week。':'已保存，可稍后刷新同步。'),'success');return}
  setUploadStatus('已整理 '+result.done+' / '+result.total+' 段，词库将在全部完成后保存。');await new Promise(resolve=>setTimeout(resolve,2500));
 }setUploadStatus('课件仍在整理，请稍后点击“继续检查”。')}catch(e){if(epoch!==accountEpoch)return;if([403,404,422].includes(e.status)){uploadJob=null;sessionStorage.removeItem(UPLOAD_JOB_KEY)}setUploadStatus(e.message,'error')}finally{if(epoch===accountEpoch){uploadBusy=false;uploadPollRunning=false;refreshUploadState()}}
}
function renderUploadResult(){const el=document.getElementById('uploadResults');if(!el)return;if(!uploadResult){el.innerHTML='';return}const r=uploadResult;el.innerHTML=`<h3>${esc(courseLabel(r.course))} · Week ${Number(r.week)}</h3><p class="meta">${esc(r.coverage_note||'')}</p><div class="uploadActions"><button class="secondary" onclick="showWeek('${esc(r.course)}',${Number(r.week)})">去本周学习</button><button class="secondary" onclick="showManager('${esc(r.course)}',${Number(r.week)})">核对词库</button></div>${r.terms.map(t=>`<details><summary>${esc(t.english)} · ${esc(t.chinese)}</summary><p>${esc(t.source)}：${esc(t.quote)}</p></details>`).join('')}`}
