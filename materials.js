let vocabularyStudyOptions=null;
let materialState=null,materialSelection=[],materialBusy=false,materialMessage='',materialPanelOpen=false,materialAutoResume=false,materialDraftTerms=null,materialRetryTimer=null,assistantConversation=[],assistantBusy=false,assistantConversationKey='',assistantScope='all',materialResetSerial=0;
function materialDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('courselex-materials-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('batches');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveMaterialState(){if(!materialState)return;try{const db=await materialDB();await new Promise((resolve,reject)=>{const t=db.transaction('batches','readwrite');t.objectStore('batches').put(materialState,materialState.uid);t.oncomplete=resolve;t.onerror=reject});db.close()}catch{materialState.localUnavailable=true}}
function restoreMaterialBatch(uid,local,remote){
 let state=local&&local.uid===uid&&Date.now()-local.started<86400000?local:null;
 if(remote?.batch&&Array.isArray(remote.manifest)&&Array.isArray(remote.plan)&&remote.plan.length){
  const cloudOnly=!state||state.batch!==remote.batch;
  if(cloudOnly)state={uid,batch:remote.batch,started:Date.now(),stage:'learning',files:remote.manifest.map(f=>({path:f.name,file:null})),ignored:[],duplicates:0,hint:''};
  for(const entry of remote.plan){const file=state.files[entry.index];if(!file)continue;file.plan=entry;const job=remote.jobs?.find(j=>j.file_index===entry.index);if(job){file.job=job.id;if(job.status==='completed'&&job.result){file.result=job.result;file.error='';if(!file.originalError){file.file=null;file.text=''}file.status=file.originalError||'完成'}}else if(cloudOnly&&entry.include!==false)file.error='这份文件还没有上传完成，请重新选择原文件或压缩包。';}
  if(cloudOnly||state.stage!=='reading'&&state.stage!=='organizing')state.stage=state.files.some(f=>f.plan?.include!==false&&!f.result&&!f.error)?'learning':'finished';
 }
 if(state)for(const file of state.files)if(file.error&&(/AI (?:词表|未返回|返回的词汇)/.test(file.error)||/未被 AI 接受|1301/.test(file.error))){file.error='';file.status='等待重新整理';state.stage='learning'}
 return state;
}
async function resetMaterialsAccount(uid){
 const serial=++materialResetSerial;vocabularyStudyOptions=null;if(typeof resetLearningAccount==='function')resetLearningAccount();if(materialRetryTimer){clearTimeout(materialRetryTimer);materialRetryTimer=null}materialState=null;materialSelection=[];materialBusy=false;materialMessage='';materialAutoResume=false;materialDraftTerms=null;assistantBusy=false;assistantConversation=[];assistantConversationKey=uid?'courselex-chat:'+uid:'';assistantScope=uid?sessionStorage.getItem('courselex-scope:'+uid)||'all':'all';if(!uid)return;
 const epoch=accountEpoch;let local,remote;
 try{const db=await materialDB();local=await new Promise((resolve,reject)=>{const r=db.transaction('batches').objectStore('batches').get(uid);r.onsuccess=()=>resolve(r.result);r.onerror=reject});db.close()}catch{}
 try{remote=await coursewareRequest({action:'resume'})}catch{}
 if(epoch!==accountEpoch||serial!==materialResetSerial||session?.user.id!==uid)return;
 materialState=restoreMaterialBatch(uid,local,remote);if(materialState){await saveMaterialState();if(epoch===accountEpoch&&serial===materialResetSerial&&window._view?.type==='home')showHome()}
}
function saveAssistantConversation(){if(!assistantConversationKey)return;try{sessionStorage.setItem(assistantConversationKey,JSON.stringify(assistantConversation.slice(-12)))}catch{}}
function assistantGreeting(){return materialMessage||(words.length?'今天想学什么？你可以直接说“复习 COM5101 Week 3 的生词”，也可以问我该怎么安排。':'把课件或 Canvas ZIP 发给我，也可以先问我怎么开始。')}
function renderAssistantConversation(){return typeof renderLearningConversation==='function'?renderLearningConversation():undefined}
function showAssistant(){return typeof renderStudyAssistant==='function'?renderStudyAssistant():showAuth()}
function clearLexConversation(){return clearLearningConversation()}
function sendLexPrompt(text){const prompt=document.getElementById('materialPrompt');if(!prompt)return;prompt.value=text;prompt.form.requestSubmit()}
function setAssistantScope(value){return changeLearningScope(value)}
function renderMaterialAttachments(){const el=document.getElementById('materialAttachments');if(el)el.innerHTML=materialSelection.map((f,i)=>`<span class="attachmentChip"><span>${esc(f.name)}</span><button type="button" aria-label="移除 ${esc(f.name)}" onclick="removeMaterialSelection(${i})">×</button></span>`).join('');const button=document.getElementById('materialSend');if(button){button.classList.toggle('uploadSend',Boolean(materialSelection.length));button.setAttribute('aria-label',materialSelection.length?'上传并整理':'发送');button.innerHTML=materialSelection.length?'上传并整理':lexIcon('send')}const note=document.getElementById('materialConsent');if(note){note.hidden=!materialSelection.length;note.textContent='上传后，课件内容将由DeepSeek AI 处理，保存在你的账号。'}}
function selectMaterials(files){if(materialBusy)return;for(const file of Array.from(files))if(!materialSelection.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))materialSelection.push(file);renderMaterialAttachments()}
function removeMaterialSelection(index){if(materialBusy)return;materialSelection.splice(index,1);renderMaterialAttachments()}
function renderMaterialNotice(){const el=document.getElementById('materialNotice');if(!el)return;el.textContent=materialMessage;el.hidden=!materialMessage||/^老师课件已准备好/.test(materialMessage)||Boolean(materialState&&materialState.stage!=='finished'&&materialBusy)}
function materialStatus(message){materialMessage=message;renderMaterialNotice();renderMaterialProgress()}
function showAssistantChoices(message,choices){
 if(typeof renderLearningActionChoices==='function'){learningActionChoices={message,choices};materialStatus(message);renderLearningActionChoices();return}
 materialStatus(message);const area=document.getElementById('materialProgress');if(!area)return;area.replaceChildren();const wrap=document.createElement('div');wrap.className='assistantChoices';
 for(const choice of choices){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=choice.label;button.onclick=choice.action;wrap.append(button)}area.append(wrap)
}
function showAssistantHelp(){
 showAssistantChoices('可以直接告诉我想学什么，也可以先选一个操作。',[{label:'快速筛选',action:showStudyFilter},{label:'开始今日任务',action:()=>startDailyStudy()},{label:'只复习生词',action:()=>startDailyStudy(true)},{label:'我的学习资料',action:showMaterialsLibrary}])
}
function showStudyFilter(){
 const available=courseRows.filter(course=>!course.archived&&!course.is_shared_template&&words.some(word=>word.course===course.id));
 if(!available.length)return showAssistantChoices('还没有可筛选的词。先上传课件或导入词表，我会自动整理。',[{label:'查看上传方法',action:showMaterialsHelp},{label:'导入已有词表',action:showQuickWordImport}]);
 showAssistantChoices('可以。先选一门课程，接着可以选择周次。',[...available.map(course=>({label:course.code?course.code+' · '+course.name:course.name,action:()=>showStudyFilterWeeks(course.id)})),{label:'全部课程 · 今日 20 词',action:()=>startDailyStudy()},{label:'只复习生词',action:()=>startDailyStudy(true)}])
}
function showStudyFilterWeeks(courseId){
 const course=courseRows.find(item=>item.id===courseId);if(!course)return showStudyFilter();const courseWords=words.filter(word=>word.course===courseId),weeks=[...new Set(courseWords.map(word=>Number(word.week)).filter(week=>Number.isFinite(week)&&week>0))].sort((a,b)=>a-b);
 showAssistantChoices('已选择 '+(course.code||course.name)+'。请选择学习范围。',[{label:'全部周次 · 20 词',action:()=>startDailyStudy(false,{course:courseId,count:20})},...weeks.map(week=>({label:'Week '+week+' · '+courseWords.filter(word=>Number(word.week)===week).length+' 词',action:()=>startDailyStudy(false,{course:courseId,week,count:20})})),{label:'← 返回选课程',action:showStudyFilter}])
}
function obviousReadingMaterial(path){const name=String(path||'');return /(^|[\\/_ .-])(readings?|articles?|papers?|journals?|books?|chapters?|references?|bibliography|supplementary|commentary|report|课外阅读|阅读材料|参考资料|参考文献|论文|书籍|报告)([\\/_ .-]|$)/i.test(name)||/general comment\s+no\.?|instructions?\s+for|group\s+list|\([12]\d{3}\)/i.test(name)}
function renderMaterialProgress(){
 const el=document.getElementById('materialProgress');if(!el||!materialState)return;const scroll=el.scrollTop,open=[...(el.querySelectorAll?.('details[open]')||[])].map(d=>d.dataset.file!==undefined?'[data-file=\"'+d.dataset.file+'\"]':d.classList.contains('fileList')?'.fileList':d.classList.contains('finishedReport')?'.finishedReport':null).filter(Boolean);const state=materialState,done=state.files.filter(f=>f.result).length,originalPending=state.files.filter(f=>f.originalError).length,failed=state.files.filter(f=>f.error).length,checked=state.files.filter(f=>f.text||f.error||f.prefilterKind).length,skipped=state.files.filter(f=>f.plan?.include===false).length,included=state.files.filter(f=>!f.plan||f.plan.include!==false).length,reading=state.stage==='reading',headline=reading?'正在检查资料 · '+checked+' / '+state.files.length+' 份':(state.stage==='finished'?'资料整理完成':state.files.some(f=>f.job)?'课件可学习 · 词汇整理':'资料已保留')+' · '+done+' / '+included+' 份课件'+(skipped?' · 已跳过 '+skipped+' 份非课件':'');
 el.innerHTML=`<div class="batchSummary"><strong>${headline}</strong><progress max="${Math.max(1,reading?state.files.length:included)}" value="${reading?checked:Math.min(included,done+failed)}"></progress><details class="fileList"><summary>查看识别结果（共 ${state.files.length} 份${failed?'，'+failed+' 份需处理':''}）</summary>${state.files.map((f,index)=>`<details data-file="${index}" class="materialFile ${f.plan?.include===false||f.prefilterKind==='reading'?'materialSkipped':''}"><summary><span>${f.result?'✓':f.error?'!':f.plan?.include===false||f.prefilterKind==='reading'?'—':'·'}</span> ${esc(f.path)} <small>${f.result?f.result.inserted+' 个新词':f.error?'需处理':f.plan?.include===false||f.prefilterKind==='reading'?(f.plan?.kind==='reading'||f.prefilterKind==='reading'?'阅读材料 · 已跳过':'无法确认 · 已跳过'):f.status||'等待检查'}</small></summary>${f.plan?`<p>${esc(f.plan.reason||'')} ${f.plan.name?'· '+esc(f.plan.name)+' · '+(f.plan.week_known?'Week '+f.plan.week:'未标明周次，已放到课程开头'):''}</p>`:''}${f.plan?.include===false?`<button class="secondary materialOverride" onclick="includeMaterialFile(${index})">这是老师课件，加入整理</button>`:''}${f.originalError?`<p class="danger">${esc(f.originalError)}</p>${f.file?`<button class="secondary" onclick="retryMaterialOriginal(${index})">重试保存原始PDF（不调用AI）</button>`:'<p>请在课件阅读区选择“添加原始PDF”，补选原文件。</p>'}`:''}${f.error?`<p class="danger">${esc(f.error)}</p>`:''}${f.result?'<p>已保存，可在对话里讲解、整理重点、练习或背词。</p>':''}</details>`).join('')}</details>${state.ignored?.length?`<details><summary>已跳过 ${state.ignored.length} 个其他格式文件</summary><p>${state.ignored.map(esc).join('<br>')}</p></details>`:''}${state.duplicates?`<p>已跳过 ${state.duplicates} 个内容完全相同的重复文件。</p>`:''}${state.stage!=='finished'&&!materialBusy?'<button class="secondary" onclick="continueMaterials()">继续整理</button><button class="linkbtn" onclick="finishMaterialBatch()">结束这批资料</button>':''}${state.stage!=='finished'&&state.files.some(f=>f.job)?'<p class="batchReady">课件已可问答，无需等待词汇整理完成。</p>':''}${state.stage==='finished'&&done?'<button class="secondary" onclick="startDailyStudy(false,assistantScope===\'all\'?{}:{course:assistantScope})">背这门课的词</button>':''}${state.stage==='finished'&&failed?'<p class="meta">失败的文件不影响其余资料；修正后可单独重新上传。</p>':''}</div>`;
 if(state.stage==='finished'){const added=state.files.reduce((sum,f)=>sum+(f.result?.inserted||0),0);el.innerHTML=`<details class="finishedReport"><summary>已整理 ${done} 份 · 新增 ${added} 个词${failed?' · '+failed+' 份需处理':''}${originalPending?' · '+originalPending+' 份原文待保存':''} <span>查看报告</span></summary>${el.innerHTML}</details>`}
 else if(words.length&&materialBusy&&!document.querySelector('.dailyActions'))el.insertAdjacentHTML('beforeend','<button class="primary" onclick="startDailyStudy()">先背已经整理好的词</button>');
 for(const selector of open){const detail=el.querySelector?.(selector);if(detail)detail.open=true}if(state.stage==='finished'){const syllabus=state.files.findIndex(f=>f.text&&/syllabus|course[ _-]outline|课程大纲|教学大纲/i.test(f.name));if(syllabus>=0)el.innerHTML+=`<button class="newChat" onclick="importBatchSyllabus(${syllabus})">发现课程大纲 · 整理到日历 ↗</button>`;}el.scrollTop=scroll;
}
async function submitMaterials(event){
 event.preventDefault();if(assistantBusy||materialBusy&&materialSelection.length)return;const hint=document.getElementById('materialPrompt').value.trim();if(!materialSelection.length){if(!hint)return showAssistantHelp();if(/[|\t]/.test(hint)){try{materialDraftTerms=parseOwnTerms(hint);materialStatus('已识别 '+materialDraftTerms.length+' 个词。直接导入，不调用 AI。');document.getElementById('materialProgress').innerHTML='<button class="primary" onclick="importQuickWords()">确认导入词表</button>';return}catch(e){return materialStatus(e.message)}}return chatWithLex(hint)}
 if(materialState&&materialState.stage!=='finished'){materialStatus('先点“继续整理”完成上一批资料，或在进度下方结束这一批，再上传新的课件。');return}
 const epoch=accountEpoch;materialResetSerial++;materialBusy=true;materialStatus('正在打开资料包，检查文件和重复内容…');
 try{const {files,ignored,duplicates}=await unpackMaterials(materialSelection);if(epoch!==accountEpoch)return;for(const file of files)if(obviousReadingMaterial(file.path)){file.prefilterKind='reading';file.status='阅读材料，已先跳过'}const started=await materialRequest({action:'start',files:files.map(f=>({name:f.path,size:f.file.size}))});if(epoch!==accountEpoch)return;materialState={uid:session.user.id,batch:started.batch,started:Date.now(),stage:'reading',files,ignored,duplicates,hint};materialSelection=[];await saveMaterialState();materialBusy=false;await continueMaterials()}catch(e){if(epoch!==accountEpoch)return;materialBusy=false;materialStatus(e.message);showAssistant()}
}
async function chatWithLex(hint){return chatLearning(hint)}
function applyLexAction(action={}){if(action.type==='choose_course')return showLearningCourseChoices();if(action.type==='quick_filter')return showStudyFilter();if(action.type==='show_materials')return showMaterialsLibrary();if(action.type==='show_upload_help')return showMaterialsHelp();if(action.type==='start_study'){const pieces=[action.course||'',action.week?'Week '+action.week:'',action.count?String(action.count)+'个词':'',action.unknown_only?'生词':''];return startStudyRequest(pieces.filter(Boolean).join(' '))}}
async function continueMaterials(){
 if(materialBusy||!materialState)return;const state=materialState,epoch=accountEpoch;state.autoPaused=false;materialBusy=true;showAssistant();
 try{
  if(state.stage==='reading'){
   for(const file of state.files)if(obviousReadingMaterial(file.path)){file.prefilterKind='reading';file.status='阅读材料，已先跳过'}
   for(const [index,file] of state.files.entries()){if(epoch!==accountEpoch)return;if(file.prefilterKind==='reading'||file.text||file.error)continue;file.status='正在读取';materialStatus('正在检查 '+(index+1)+' / '+state.files.length+'：'+file.path);
    try{file.text=await readCoursewareText(file.file,{ocr:async image=>{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image))),b=>b.toString(16).padStart(2,'0')).join('');file.ocrCache=file.ocrCache||{};if(file.ocrCache[hash])return file.ocrCache[hash];const r=await materialRequest({action:'ocr',batch:state.batch,file:index,image});file.ocrCache[hash]=r.text;await saveMaterialState();return r.text},onProgress:text=>materialStatus(file.path+' · '+text)});file.status='文字已读取'}catch(e){if(e.status===409)throw e;if([429,503,504,401].includes(e.status)){file.status='等待继续';await saveMaterialState();throw e}file.error=readableMaterialError(e);file.status='需处理'}
    await saveMaterialState();renderMaterialProgress();
   }
   if(epoch!==accountEpoch)return;state.stage='organizing';await saveMaterialState();
  }
  if(state.stage==='organizing'){
   materialStatus('正在区分老师课件和课外阅读，并识别课程与周次…');const metadata=state.files.map((f,index)=>({index,preview:(f.text||'').slice(0,800),week:inferMaterialWeek(f.path)})).filter(f=>!state.files[f.index].error);
   if(metadata.length){const {plan}=await materialRequest({action:'organize',batch:state.batch,files:metadata,hint:state.hint});if(epoch!==accountEpoch)return;for(const entry of plan)state.files[entry.index].plan=entry}
   state.stage='learning';await saveMaterialState();if(typeof loadLearningHistory==='function')loadLearningHistory(true);
  }
  // Make the detected course available before the slower glossary is finished.
  await loadCloud();if(epoch!==accountEpoch)return;
  const batchCourses=[...new Set(state.files.filter(f=>f.plan?.include!==false&&f.plan?.course).map(f=>f.plan.course))];
  if(batchCourses.length===1&&!hasExplicitCourseScope()&&!learningThread?.messages.length&&!assistantBusy&&assistantScope!==batchCourses[0])changeLearningScope(batchCourses[0]);
  const pending=state.files.map((file,index)=>({file,index})).filter(({file})=>!file.error&&!file.result&&file.plan&&file.plan.include!==false),includedTotal=state.files.filter(file=>file.plan&&file.plan.include!==false).length;let nextFile=0,retryError=null;
  // Save teaching text before glossary inference, so the conversation becomes available early.
  let registerIndex=0;async function registerSource(){for(;;){const item=pending[registerIndex++];if(!item||epoch!==accountEpoch)return;const {file,index}=item;if(file.job)continue;try{const prepared=await materialRequest({action:'prepare',course:file.plan.course,week:file.plan.week,filename:file.path.split('/').pop(),parts:splitCoursewareText(file.text),batch:state.batch,file_index:index});file.job=prepared.job;file.status='课件已保存，可开始问答';await saveMaterialState();if(typeof refreshLearningSources==='function')await refreshLearningSources()}catch(e){if([429,503,504,401].includes(e.status)||!e.status)throw e;file.error=e.message}}}
  await Promise.all([registerSource(),registerSource(),registerSource()]);
  materialStatus('课件已可学习，词汇正在继续整理。可以直接让莱克讲解，不必等词库完成。');
  async function processFile(){for(;;){const item=pending[nextFile++];if(!item)return;const {file,index}=item;
   if(epoch!==accountEpoch)return;while(assistantBusy){await new Promise(resolve=>setTimeout(resolve,500));if(epoch!==accountEpoch)return}file.status='正在生成词库';materialStatus('两份课件并行整理中 · '+state.files.filter(f=>f.result).length+' / '+includedTotal+' 已完成');renderMaterialProgress();
   try{
    if(!file.job){const prepared=await materialRequest({action:'prepare',course:file.plan.course,week:file.plan.week,filename:file.path.split('/').pop(),parts:splitCoursewareText(file.text),batch:state.batch,file_index:index});file.job=prepared.job;await saveMaterialState()}
    for(let attempt=0;attempt<160;attempt++){if(epoch!==accountEpoch)return;const r=await materialRequest({action:'next',job:file.job});if(r.status==='completed'){file.result=r;await completeMaterialOriginal(file,r);break}file.status='正在整理 '+r.done+' / '+r.total+' 段';renderMaterialProgress();await new Promise(resolve=>setTimeout(resolve,Math.max(100,Math.min(2500,r.poll_after_ms||2500))))}
    if(!file.result)throw Error('整理仍在进行，可稍后继续。');
   }catch(e){if(e.status===409)throw e;if([429,503,504,401].includes(e.status)||!e.status){file.status='等待继续';retryError=retryError||e}else file.error=e.message}
   await saveMaterialState();renderMaterialProgress();
  }}
  await Promise.all([processFile(),processFile()]);if(retryError)throw retryError;
  if(epoch!==accountEpoch)return;state.stage='finished';await saveMaterialState();await loadCloud();coursewareRequest({action:'learning_prepare',scope:assistantScope}).catch(()=>{});const completed=state.files.filter(f=>f.result).length,skipped=state.files.filter(f=>f.plan?.include===false).length;materialStatus(completed?'老师课件已准备好'+(skipped?'，并跳过 '+skipped+' 份阅读或待确认材料':'')+'。莱克会提前准备练习题；现在也可以直接问知识点、要重点总结。':skipped?'这批文件暂未确认到老师课件，阅读材料已跳过；可在报告中手动确认。':'这批资料还没有成功整理，请查看报告中的原因，换一份可读课件再试。');
 }catch(e){if(epoch===accountEpoch){const retryable=e.retryable!==false&&([429,503,504].includes(e.status)||!e.status);if(retryable){materialStatus((e.message||'AI 连接暂时中断。')+' 已保留进度，10 秒后自动继续。');clearTimeout(materialRetryTimer);materialRetryTimer=setTimeout(()=>{materialRetryTimer=null;if(session?.user.id===state.uid&&!materialBusy&&state.stage!=='finished')continueMaterials()},10000)}else{state.autoPaused=true;clearTimeout(materialRetryTimer);materialRetryTimer=null;await saveMaterialState();materialStatus(e.message+' 进度已保存。解决以上问题后，可点击“继续整理”。')}}}finally{if(epoch===accountEpoch){materialBusy=false;if(window._view?.type==='home')showAssistant()}}
}
async function startDailyStudy(unknownOnly=false,options={}){
 if(typeof saveVocabularyResume==='function')saveVocabularyResume();
 const uid=session?.user.id;if(typeof pullStudySync==='function'){await flushStudySync();await pullStudySync('words',options.course,options.week,unknownOnly?'unknown':'daily');if(uid!==session?.user.id)return}
 vocabularyStudyOptions={...options,unknownOnly};const pool=(options.course?words.filter(w=>w.course===options.course):ownedStudyWords()).filter(w=>!options.week||Number(w.week)===Number(options.week));const limit=Math.max(1,Math.min(100,options.count||20));
 if(!pool.length){materialStatus('先把自己的课件或词表放进来，莱克会帮你准备本课堂的第一轮。原来的资料仍保留在“我的学习资料”。');return showAssistant()}
 const now=Date.now(),status=w=>progress[w.id]||w.status;const review=pool.filter(w=>status(w)!=='new'&&(unknownOnly?status(w)==='unknown':options.course||!w.next_review_at||Date.parse(w.next_review_at)<=now)).sort((a,b)=>Date.parse(a.last_review_at||0)-Date.parse(b.last_review_at||0));const fresh=pool.filter(w=>status(w)==='new'||!status(w));
 const reviewLimit=Math.min(10,Math.ceil(limit/2));queue=unknownOnly?review.slice(0,limit):[...review.slice(0,reviewLimit),...fresh.slice(0,limit-Math.min(review.length,reviewLimit))];if(!unknownOnly&&queue.length<limit)queue.push(...review.slice(reviewLimit,reviewLimit+limit-queue.length));
 if(!queue.length){materialStatus(unknownOnly?'目前没有生词。':'今天该复习的词已经完成了，下次到时间会自动安排。你也可以继续上传新课件。');return showAssistant()}
 qIndex=0;currentMode=options.mode||'choice';if(typeof restoreVocabularyResume==='function')restoreVocabularyResume({...options,unknownOnly},pool);window.dailyStudy=true;window._view={type:'study'};showQuestion();
}
function showMaterialsLibrary(){
 window.dailyStudy=false;document.body?.classList.remove('assistantMode');window._view={type:'materials'};setStudyNav('manager');app.innerHTML=`<div class="sectionHead"><button class="back" onclick="showHome()">← 返回</button><h1>我的学习资料</h1></div><p class="meta">你上传的内容与已有词库都保留在这里。课程名称与词汇可随时管理。</p><div class="grid">${Object.entries(COURSES).map(([id,name])=>`<article class="course" onclick="showWeeks('${id}')"><div><h2>${esc(name)}</h2>${courseRows.find(c=>c.id===id)?.is_shared_template?'<small>以前导入的共享资料 · 不混入今日任务</small>':''}</div><p>${countCourse(id)} 个词 · 已掌握 ${knownCount(id)}</p></article>`).join('')}</div><div class="uploadActions"><button class="secondary" onclick="showCourses()">整理课程与名称</button><button class="secondary" onclick="showManager()">编辑词汇</button></div>`;
}
function showMaterialsHelp(){materialStatus('Canvas：进入课程的 Files，直接下载包含所有 Week 的 ZIP。莱克会优先识别 PPT、课堂讲义和教学材料，自动跳过论文、书籍章节与课外阅读；不确定的文件会列在报告里让你确认。无需提供 Canvas 密码。')}

async function includeMaterialFile(index){if(materialBusy||!materialState)return;const file=materialState.files[index];if(!file?.plan||file.result)return;materialBusy=true;try{const result=await materialRequest({action:'include',batch:materialState.batch,file:index});for(const entry of result.plan){if(materialState.files[entry.index])materialState.files[entry.index].plan=entry}file.status='等待整理';if(materialState.stage==='finished')materialState.stage='learning';await saveMaterialState()}catch(e){materialStatus(e.message);materialBusy=false;return}materialBusy=false;continueMaterials()}

async function finishMaterialBatch(){if(materialBusy||!materialState)return;if(!confirm('结束未完成的整理？已经导入的词汇会保留，未导入的文件可稍后重新上传。'))return;materialState.stage='finished';await saveMaterialState();showAssistant()}

async function materialRequest(body){const epoch=accountEpoch;for(let attempt=0;attempt<6;attempt++){try{return await coursewareRequest(body)}catch(e){if(epoch!==accountEpoch)throw e;if(e.retryable===false||![429,503,504].includes(e.status)||attempt===5)throw e;const delay=Math.min(12000,2000*2**attempt);materialStatus((e.message||'AI 正忙。')+' 约 '+Math.round(delay/1000)+' 秒后自动继续，不用重复上传。');await new Promise(resolve=>setTimeout(resolve,delay));if(epoch!==accountEpoch)throw Error('账号已切换。')}}}

function readableMaterialError(e){if(/password/i.test(e.name+' '+e.message))return '这份 PDF 有密码保护，请先解锁再上传。';if(/invalid pdf|invalidpdf|pdf structure/i.test(e.name+' '+e.message))return '这份 PDF 无法打开，可能已损坏，请从 Canvas 重新下载。';return e.message||'文件无法读取，请重新导出为 PDF。'}

function showQuickWordImport(){showAssistant();materialStatus('把“英文 | 中文”词表粘贴到对话框，点击发送即可预览；需要整理提示词或上传词表文件时，使用下方详细导入。');document.getElementById('materialPrompt').focus();document.getElementById('materialProgress').innerHTML='<button class="secondary" onclick="showOwnAI()">提示词与文件导入</button>'}
async function importQuickWords(){if(!materialDraftTerms||materialBusy)return;const epoch=accountEpoch;materialBusy=true;try{let course=courseRows.find(c=>c.name==='自己的词表'&&!c.archived);if(!course){[course]=await sb('user_courses',{method:'POST',body:JSON.stringify({user_id:session.user.id,name:'自己的词表',weeks:1})})}const result=await sb('rpc/import_user_vocabulary',{method:'POST',body:JSON.stringify({p_course:course.id,p_week:1,p_terms:materialDraftTerms.map(t=>({english:t.en,chinese:t.zh}))})});if(epoch!==accountEpoch)return;materialDraftTerms=null;await loadCloud();materialMessage='已导入 '+result.inserted+' 个词，跳过 '+result.skipped+' 个重复词。莱克会提前准备练习题；现在也可以直接问知识点、要重点总结。'}catch(e){if(epoch===accountEpoch)materialMessage=e.message}finally{if(epoch===accountEpoch){materialBusy=false;showAssistant()}}}

function editWord(id){const word=words.find(w=>w.id===id);if(!word)return;document.getElementById('wordEditor')?.remove();const dialog=document.createElement('dialog');dialog.id='wordEditor';dialog.innerHTML=`<h2>编辑词汇</h2><form id="wordEditForm"><label for="editEnglish">英文</label><input id="editEnglish" maxlength="200" required value="${esc(word.en)}"><br><br><label for="editChinese">中文释义</label><textarea id="editChinese" maxlength="500" required>${esc(word.zh)}</textarea><p class="meta">修改后保留已有学习进度。</p><div class="uploadActions"><button class="primary" type="submit">保存</button><button class="secondary" type="button" onclick="document.getElementById('wordEditor').close()">取消</button></div><p id="wordEditNotice" role="status"></p></form>`;document.body.append(dialog);dialog.showModal();const epoch=accountEpoch;dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=dialog.querySelector('button');button.disabled=true;try{await sb('user_vocabulary?id=eq.'+word.id,{method:'PATCH',body:JSON.stringify({english:document.getElementById('editEnglish').value.trim(),chinese:document.getElementById('editChinese').value.trim()})});if(epoch!==accountEpoch){dialog.close();return}await loadCloud();dialog.close();renderList()}catch(e){dialog.querySelector('#wordEditNotice').textContent='未保存，请核对是否已有同名词汇后重试。'}finally{button.disabled=false}}}

function ownedStudyWords(){return words.filter(w=>!courseRows.find(c=>c.id===w.course)?.is_shared_template)}

function resolveStudyRequest(hint,courses){
 const compact=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s_-]/g,'');
 const text=compact(hint),weekMatch=text.match(/(?:第|week|wk|lecture|lec)(\d{1,2})(?:周|讲)?/i),countMatch=text.match(/(?<!\d)(\d{1,3})(?:个)?(?:单词|词汇|生词|错词|词|words?)/i);
 const week=weekMatch?Number(weekMatch[1]):null,count=countMatch?Math.max(1,Math.min(100,Number(countMatch[1]))):20;
 if(weekMatch&&(week<1||week>52))return {error:'周次应在 1 到 52 之间。'};
 const courseText=text.replace(weekMatch?.[0]||'\0','').replace(countMatch?.[0]||'\0','');
 const codes=[...courseText.matchAll(/[a-z]{2,6}\d{3,5}|\d{3,5}/g)].map(m=>m[0]);
 const eligible=courses.filter(c=>!c.archived);
 const matches=eligible.filter(c=>{const code=compact(c.code),name=compact(c.name);return codes.length?codes.some(v=>/^\d+$/.test(v)?code.match(/\d{3,5}$/)?.[0]===v||new RegExp('(?:^|[^0-9])'+v+'(?:$|[^0-9])').test(name):code===v||name.includes(v)):name.length>=3&&courseText.includes(name)});
 if(codes.length&&!matches.length)return {error:'没有找到 '+codes.join('、')+' 的课程词库。请先上传该课程课件，或在“我的学习资料”核对课程名称。'};
 const options={week,count,mode:/认识|不认识/.test(hint)?'recognition':'choice',unknownOnly:/生词|错词/.test(hint)};
 if(matches.length===1)return {...options,course:matches[0].id};
 if(matches.length>1)return {...options,candidates:matches};
 const remainder=courseText.replace(/我想要|我需要|我要|帮我|我想|我|请|今天|现在|开始|学习|复习|背诵|背|学|单词|词汇|生词|错词|全部|所有|课程|认识|不认识|四选一|词|的|一下|吧|任务|[，。！？,.!?]/g,'');
 if(remainder||week)return {...options,candidates:eligible,error:eligible.length?'请选一下你想学的课程，我会只安排这门课的词。':'还没有可学习的课程，请先上传课件。'};
 return options;
}
function startStudyRequest(hint){
 const request=resolveStudyRequest(hint,courseRows);
 if(request.candidates){
  materialStatus(request.error||'找到了几门匹配的课程，请选择一门。');const area=document.getElementById('materialProgress');area.replaceChildren();
  for(const course of request.candidates){const button=document.createElement('button');button.className='secondary';button.textContent=course.code?course.code+' · '+course.name:course.name;button.onclick=()=>startDailyStudy(request.unknownOnly,{...request,course:course.id});area.append(button)}return;
 }
 if(request.error)return materialStatus(request.error);
 if(request.course&&request.week&&!words.some(w=>w.course===request.course&&w.week===request.week))return materialStatus('这门课的 Week '+request.week+' 还没有词汇。请先上传这一周的课件。');
 return startDailyStudy(request.unknownOnly,request);
}

// Switching the range starts a fresh queue; already submitted answers stay saved.
function vocabularyStudyControls(){
 const options=vocabularyStudyOptions||{course:currentCourse,week:currentWeek,count:100,mode:currentMode},course=options.course||'',week=Number(options.week)||0;
 const available=courseRows.filter(c=>!c.archived&&!c.is_shared_template),pool=words.filter(w=>(!course||w.course===course)&&available.some(c=>c.id===w.course)),weeks=[...new Set(pool.map(w=>Number(w.week)))].sort((a,b)=>a-b);
 return `<div class="studySyncStatus" data-study-sync role="status">${typeof studySyncMessage!=='undefined'?esc(studySyncMessage):''}</div><div class="vocabularyScope">${renderStudyPicker('vocabularyCourse','课程',course,available.map(c=>({value:c.id,label:c.code||c.name})),value=>switchStudyToolCourse('words',value))}${renderStudyPicker('vocabularyWeek','周次',String(week),[{value:'0',label:'全部周次'},...weeks.map(w=>({value:String(w),label:'Week '+w}))],value=>changeVocabularyRange(course,value))}<details class="learningMore"><summary aria-label="词库工具">词库</summary><div><button onclick="showBook('unknown')">生词本</button><button onclick="showBook('known')">熟词本</button><button onclick="showMaterialsLibrary()">管理词汇</button></div></details></div>`;
}
function changeVocabularyRange(course,week){if(answerBusy)return;const old=vocabularyStudyOptions||{count:100,mode:currentMode};startDailyStudy(old.unknownOnly===true,{...old,course:course||undefined,week:Number(week)||undefined,mode:currentMode})}

function changeVocabularyWeek(week){changeVocabularyRange(document.getElementById('vocabularyCourse').value,week)}

async function completeMaterialOriginal(file,result){
 try{if(typeof saveUploadedOriginal==='function')await saveUploadedOriginal(file,result.course,result.week);file.originalError='';file.text='';file.file=null;file.status='完成'}catch(error){file.originalError='原始PDF尚未保存：'+error.message;file.status=file.originalError}
}
async function retryMaterialOriginal(index){
 const state=materialState,epoch=accountEpoch,file=state?.files[index];if(materialBusy||!file?.result||!file.file||state.uid!==session?.user.id)return;
 materialBusy=true;try{await completeMaterialOriginal(file,file.result);if(epoch!==accountEpoch||state!==materialState)return;await saveMaterialState();renderMaterialProgress()}finally{if(epoch===accountEpoch&&state===materialState){materialBusy=false;renderMaterialProgress()}}
}
