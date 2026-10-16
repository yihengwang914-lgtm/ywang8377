let learningThread=null,learningState={threads:[],sources:[],reviews:[]},learningLoaded='',learningLoading=false,learningError='',learningPendingRequest=null,learningPoll=null,learningDrawer=false,learningDraft='',learningLoadSerial=0,learningActionChoices=null;
function resetLearningAccount(){learningLoadSerial++;learningActionChoices=null;if(learningPoll)clearTimeout(learningPoll);learningPoll=null;learningThread=null;learningState={threads:[],sources:[],reviews:[]};learningLoaded='';learningLoading=false;learningError='';learningPendingRequest=null;learningDrawer=false;learningDraft=''}
function learningStorageKey(){return 'courselex-learning:'+session.user.id+':'+assistantScope}
function learningSaveThread(){try{if(learningThread?.id)localStorage.setItem(learningStorageKey(),learningThread.id);else localStorage.removeItem(learningStorageKey())}catch{}}
function learningMarkdown(text){
 const escaped=esc(text||'');const inline=s=>s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
 return escaped.split(/\n\s*\n/).map(block=>{
  if(/^#{1,4}\s/.test(block))return block.split('\n').map(line=>/^#{1,4}\s/.test(line)?'<h3>'+inline(line.replace(/^#{1,4}\s+/,''))+'</h3>':'<p>'+inline(line)+'</p>').join('');
  if(block.split('\n').every(line=>/^\s*(?:[-*•]|\d+[.)、])\s/.test(line)))return '<ul>'+block.split('\n').map(line=>'<li>'+inline(line.replace(/^\s*(?:[-*•]|\d+[.)、])\s+/,''))+'</li>').join('')+'</ul>';
  return '<p>'+inline(block).replace(/\n/g,'<br>')+'</p>';
 }).join('');
}
function learningCitations(citations){if(!citations?.length)return '';return '<details class="learningSources"><summary>课件出处 · '+citations.length+'</summary>'+citations.map(c=>`<blockquote><strong>[${esc(c.ref)}] ${esc(c.filename)}</strong><small>Week ${Number(c.week)||1} · 文字段 ${Number(c.section)||1}</small><p>${esc(c.quote)}</p></blockquote>`).join('')+'</details>'}
function learningPlan(plan){if(!plan)return '';return `<section class="learningPlan"><strong>${esc(plan.title)}</strong>${plan.tasks.map(t=>`<div class="learningTask ${t.done?'taskDone':''}"><div><span>${new Date(t.due_at).toLocaleDateString('zh-CN',{month:'short',day:'numeric'})} · ${Number(t.minutes)} 分钟</span><b>${esc(t.title)}</b></div><button class="secondary" onclick="startLearningTask('${t.id}')" ${assistantBusy?'disabled':''}>${t.done?'再学一次':'开始'}</button><button class="taskToggle" aria-label="${t.done?'标为未完成':'标为完成'}" onclick="toggleLearningTask('${t.id}',${!t.done})" ${assistantBusy?'disabled':''}>${t.done?'✓':'○'}</button></div>`).join('')}</section>`}
function pendingLearningQuestion(){for(const m of [...(learningThread?.messages||[])].reverse())if(m.quiz&&!m.quiz.paused){const index=m.quiz.questions.findIndex(q=>!q.result);if(index>=0)return {quiz:m.quiz,question:m.quiz.questions[index],index}}return null}
function learningQuizSummary(quiz){if(!quiz)return '';const answered=quiz.questions.filter(q=>q.result),correct=answered.filter(q=>q.result.correct).length;return `<div class="quizSummary">${esc(quiz.title)} · ${answered.length}/${quiz.questions.length} 已作答${answered.length?' · '+correct+' 题答对':''}${answered.length?'<details><summary>查看作答记录</summary>'+answered.map(q=>`<div class="pastQuestion"><b>${q.result.correct?'✓':'再巩固'} · ${esc(q.prompt)}</b><p>你的答案：${esc(q.type==='choice'?q.options[q.result.answer]:q.result.answer)}</p><p>正确答案：${esc(q.result.correct_answer)}</p><p>${esc(q.result.explanation)}</p></div>`).join('')+'</details>':''}${quiz.paused&&answered.length<quiz.questions.length?`<button class="newChat" onclick="setLearningQuizState('${quiz.id}',false)">继续这组练习</button>`:''}</div>`}
function renderActiveLearningQuestion(){const pending=pendingLearningQuestion();if(!pending)return '';const {quiz,question:q,index}=pending;return `<section class="learningQuiz" aria-label="知识点练习"><div class="quizLabel">${esc(quiz.title)} · ${index+1}/${quiz.questions.length}</div><h3>${esc(q.prompt)}</h3>${q.type==='choice'?'<div class="learningOptions">'+q.options.map((option,i)=>`<button onclick="submitLearningAnswer('${q.id}',${i})" ${assistantBusy?'disabled':''}><span>${String.fromCharCode(65+i)}</span>${esc(option)}</button>`).join('')+'</div>':`<form onsubmit="submitShortLearningAnswer(event,'${q.id}')"><textarea id="learningShortAnswer" rows="3" maxlength="2000" placeholder="用自己的话回答，中英文都可以" required></textarea><button class="secondary" ${assistantBusy?'disabled':''}>提交答案</button></form>`}<p class="meta">也可以直接在对话里回答；提交后看解析。</p><button class="newChat" onclick="setLearningQuizState('${quiz.id}',true)">稍后再做</button></section>`}
function renderLearningConversation(){
 const el=document.getElementById('assistantConversation');if(!el)return;const messages=learningThread?.messages||[];
 el.innerHTML=messages.length?messages.map(m=>`<article class="chatMessage ${m.role==='user'?'fromUser':'fromLex'}" data-message="${esc(m.id)}">${m.role==='assistant'?learningMarkdown(m.content):esc(m.content)}${m.role==='assistant'?learningCitations(m.citations)+learningPlan(m.plan)+learningQuizSummary(m.quiz):''}</article>`).join(''):`<div class="learningWelcome"><div class="lexWelcomeMark">莱克 Lex</div><h2>${learningLoading?'正在找回你的学习记录…':'今天，想弄懂什么？'}</h2><p>${learningState.sources.length?'讲解知识点、整理重点、做几道题。都从你的课堂资料开始。':'上传老师的课件或 Canvas ZIP，莱克陪你讲懂、练会，再安排复习。'}</p></div>`;
 if(materialMessage)el.innerHTML+=`<div class="chatMessage fromLex materialNotice">${esc(materialMessage)}</div>`;
 if(learningError)el.innerHTML+=`<div class="learningError" role="alert">${esc(learningError)}${learningPendingRequest?'<button onclick="retryLearningRequest()">重试这一步</button>':'<button onclick="loadLearningHistory(true)">重新加载</button>'}</div>`;
 else if(messages.at(-1)?.role==='user'&&!assistantBusy&&!learningThread?.pending)el.innerHTML+='<div class="learningError">这条问题还没有完整回复，内容已保存。<button onclick="retrySavedLearningTurn()">继续回答</button></div>';
 if(assistantBusy||learningThread?.pending)el.innerHTML+='<div class="chatMessage fromLex thinking" role="status">莱克正在整理思路…这条对话会自动保存。</div>';
 else el.innerHTML+=renderActiveLearningQuestion();
 el.scrollTop=el.scrollHeight;
}
function renderStudyAssistant(){
 if(!session)return showAuth();window.dailyStudy=false;document.body?.classList.add('assistantMode');setStudyNav('home');window._view={type:'home'};
 if(assistantScope!=='all'&&!courseRows.some(c=>c.id===assistantScope&&!c.archived))assistantScope='all';
 const available=courseRows.filter(c=>!c.archived&&!c.is_shared_template),active=materialState&&materialState.stage!=='finished',due=learningState.reviews.filter(r=>Date.parse(r.due_at)<=Date.now()).length;
 app.innerHTML=`<section class="assistantWorkspace"><header class="lexWorkspaceHeader"><div class="lexIdentity"><img src="assets/brand/courselex-mark.png" width="40" height="40" alt=""><div><h1>莱克 Lex</h1><p>你的课堂，你的学习助理</p></div></div><div class="lexControls"><label><span>学习范围</span><select aria-label="学习范围" onchange="setAssistantScope(this.value)" ${assistantBusy?'disabled':''}><option value="all">选择课程 / 全部</option>${available.map(c=>`<option value="${c.id}" ${assistantScope===c.id?'selected':''}>${esc(c.code||c.name)}</option>`).join('')}</select></label><button class="newChat" onclick="clearLexConversation()" ${assistantBusy?'disabled':''} aria-label="新对话">＋</button><button class="newChat" onclick="toggleLearningDrawer()" aria-label="学习记录">记录</button></div></header>
 <div class="learningContext"><span>${learningState.sources.length?learningState.sources.length+' 份课件可问答':words.length?'词库已保留 · 上传原课件开启问答':'上传课件，开始学习'}</span><button onclick="showLearningReviews()">${due?due+' 个知识点待复习':'复习安排'}</button>${learningLoading?'<span>同步中…</span>':''}</div>
 <section class="assistantBox" id="materialDrop"><div id="assistantConversation" class="assistantConversation" aria-live="polite"></div>
 ${!learningThread?.messages.length?`<div class="starterPrompts learningStarters"><button onclick="sendLexPrompt('请从我的课件中选一个重要知识点，用简单的话和例子讲解')">讲解知识点</button><button onclick="sendLexPrompt('帮我梳理这门课的重点、易混概念和常见误区，标出课件依据')">整理重点</button><button onclick="sendLexPrompt('根据我的课件出 3 道理解和应用练习题，逐题做，先不要透露答案')">出题练习</button><button onclick="sendLexPrompt('根据课件和我的作答薄弱点，安排一个三天复习计划，每次 15 分钟')">安排复习</button></div>`:''}
 <div id="assistantActionChoices"></div><form class="assistantComposer" onsubmit="submitMaterials(event)"><div id="materialAttachments" class="materialAttachments">${materialSelection.map(f=>`<span>${esc(f.name)}</span>`).join('')}</div><textarea id="materialPrompt" rows="2" maxlength="2000" placeholder="问一个知识点、回答题目，或上传课件…" aria-label="给莱克发消息"></textarea><div class="composerActions"><label class="attachButton">＋ 课件<input type="file" multiple accept=".zip,.pdf,.ppt,.pptx,.docx,.txt,image/png,image/jpeg,image/webp" onchange="selectMaterials(this.files)" ${materialBusy?'disabled':''}></label><span class="composerHint">Enter 发送 · Shift + Enter 换行</span><button class="sendButton" id="materialSend" type="submit" aria-label="发送" ${materialBusy&&!learningState.sources.length||assistantBusy||learningThread?.pending?'disabled':''}>${assistantBusy?'思考中':materialBusy&&!learningState.sources.length?'读取中':'↑'}</button></div><p class="dataNote">课件文字用于私人学习问答，由智谱 AI 处理。回答可查看原文依据，重要内容请结合老师要求核对。</p></form><div id="materialProgress" aria-live="polite"></div></section>
 <div class="assistantUtilities"><button class="linkbtn" onclick="showMaterialsLibrary()">学习资料</button><button class="linkbtn" onclick="startDailyStudy(false,assistantScope==='all'?{}:{course:assistantScope})">背词</button><button class="linkbtn" onclick="showOwnAI()">导入词表</button><button class="linkbtn" onclick="showMaterialsHelp()">上传帮助</button></div><aside id="learningDrawer" class="learningDrawer" ${learningDrawer?'':'hidden'}></aside></section>`;
 const prompt=document.getElementById('materialPrompt');prompt.value=learningDraft;prompt.oninput=()=>{learningDraft=prompt.value};prompt.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();prompt.form.requestSubmit()}};
 const drop=document.getElementById('materialDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');selectMaterials(e.dataTransfer.files)};
 renderLearningConversation();renderMaterialProgress();renderLearningActionChoices();if(learningDrawer)renderLearningDrawer();
 if(learningLoaded!==session.user.id+':'+assistantScope&&!learningLoading&&!learningError)loadLearningHistory();
 if(active&&!materialBusy&&!materialAutoResume){materialAutoResume=true;setTimeout(()=>{if(session?.user.id===materialState?.uid&&window._view?.type==='home')continueMaterials()},500)}
}
async function loadLearningHistory(force=false,threadId){
 if(!session||learningLoading||assistantBusy)return;const epoch=accountEpoch,scope=assistantScope,serial=++learningLoadSerial;learningLoading=true;learningError='';
 let stored=threadId;if(stored===undefined)try{stored=localStorage.getItem(learningStorageKey())}catch{}
 try{
  let result;try{result=await coursewareRequest({action:'learning_history',scope,thread:stored||undefined})}catch(e){if(e.status===404&&stored){result=await coursewareRequest({action:'learning_history',scope});stored=null}else throw e}
  if(epoch!==accountEpoch||scope!==assistantScope||serial!==learningLoadSerial)return;learningState=result;learningThread=result.thread||null;learningLoaded=session.user.id+':'+scope;learningSaveThread();
  if(learningThread?.pending){clearTimeout(learningPoll);learningPoll=setTimeout(()=>loadLearningHistory(true,learningThread?.id),3000)}
 }catch(e){if(epoch===accountEpoch&&scope===assistantScope&&serial===learningLoadSerial)learningError='学习记录暂时无法加载：'+e.message}
 finally{if(epoch===accountEpoch&&scope===assistantScope&&serial===learningLoadSerial){learningLoading=false;if(window._view?.type==='home')renderStudyAssistant()}}
}
function clearLearningConversation(){if(assistantBusy)return;learningLoadSerial++;learningLoading=false;learningActionChoices=null;learningThread=null;learningError='';learningPendingRequest=null;learningSaveThread();materialMessage='';renderStudyAssistant()}
function changeLearningScope(value){if(assistantBusy)return;learningLoadSerial++;learningLoading=false;learningActionChoices=null;assistantScope=value||'all';try{sessionStorage.setItem('courselex-scope:'+session.user.id,assistantScope)}catch{}learningThread=null;learningState={threads:[],sources:[],reviews:[]};learningLoaded='';learningPendingRequest=null;learningError='';materialMessage='';renderStudyAssistant()}
async function sendLearningRequest(body){
 if(assistantBusy)return;learningActionChoices=null;const epoch=accountEpoch,scope=assistantScope;body={...body,scope,thread:learningThread?.id,request_id:body.request_id||crypto.randomUUID()};assistantBusy=true;learningError='';learningPendingRequest=body;
 if(body.action==='chat'){
  if(!learningThread)learningThread={id:body.request_id,messages:[],course_id:scope==='all'?null:scope};
  if(!learningThread.messages.some(m=>m.id===body.request_id))learningThread.messages.push({id:body.request_id,role:'user',content:body.text,created_at:new Date().toISOString()});
 }
 renderStudyAssistant();
 try{
  let result;for(let attempt=0;attempt<4;attempt++){try{result=await coursewareRequest(body);break}catch(e){if(e.status!==429||e.retryable===false||attempt===3)throw e;learningError='AI 通道正忙，正在自动继续，不用重复发送。';renderLearningConversation();await new Promise(r=>setTimeout(r,2500*(attempt+1)));if(epoch!==accountEpoch)return}}
  if(epoch!==accountEpoch)return;learningThread=result.thread;learningPendingRequest=null;materialMessage='';learningError='';
  if(result.course_id&&courseRows.some(c=>c.id===result.course_id)){assistantScope=result.course_id;sessionStorage.setItem('courselex-scope:'+session.user.id,assistantScope)}
  learningSaveThread();learningLoaded=session.user.id+':'+assistantScope;assistantBusy=false;renderStudyAssistant();if(result.action?.type!=='none')applyLexAction(result.action);
  // Refresh just metadata after each successful turn, preserving the current conversation.
  if(!learningLoading)loadLearningHistory(true,learningThread.id);
 }catch(e){if(epoch!==accountEpoch)return;assistantBusy=false;learningError=e.message||'连接中断，请重试；已保存的内容仍在。';if(e.thread_id){learningThread.id=e.thread_id;learningPendingRequest.thread=e.thread_id;learningSaveThread()}renderStudyAssistant()}
}
function chatLearning(text){learningDraft='';document.getElementById('materialPrompt').value='';return sendLearningRequest({action:'chat',text})}
function retryLearningRequest(){if(learningPendingRequest)return sendLearningRequest(learningPendingRequest)}
function retrySavedLearningTurn(){const last=learningThread?.messages.at(-1);if(last?.role==='user')return sendLearningRequest({action:'chat',text:last.content,request_id:last.id})}
function setLearningQuizState(quiz,paused){return sendLearningRequest({action:'learning_quiz_state',quiz,paused})}
function submitLearningAnswer(question,answer){return sendLearningRequest({action:'learning_answer',question,answer})}
function submitShortLearningAnswer(event,question){event.preventDefault();return submitLearningAnswer(question,document.getElementById('learningShortAnswer').value.trim())}
function allLearningTasks(){return (learningThread?.messages||[]).flatMap(m=>m.plan?.tasks||[])}
function startLearningTask(id){const task=allLearningTasks().find(t=>t.id===id);if(task)sendLexPrompt(task.prompt)}
function toggleLearningTask(task,done){return sendLearningRequest({action:'learning_task',task,done})}
function toggleLearningDrawer(){learningDrawer=!learningDrawer;const el=document.getElementById('learningDrawer');el.hidden=!learningDrawer;if(learningDrawer)renderLearningDrawer()}
function showLearningReviews(){learningDrawer=true;const el=document.getElementById('learningDrawer');el.hidden=false;renderLearningDrawer('reviews')}
function renderLearningDrawer(tab='history'){
 const el=document.getElementById('learningDrawer');if(!el)return;
 const threads=learningState.threads.filter(t=>assistantScope==='all'||t.course_id===assistantScope),reviews=learningState.reviews.filter(r=>assistantScope==='all'||r.course_id===assistantScope);
 el.innerHTML=`<div class="drawerHeading"><h2>学习记录</h2><button class="newChat" onclick="toggleLearningDrawer()" aria-label="关闭学习记录">✕</button></div><div class="drawerTabs"><button onclick="renderLearningDrawer('history')" ${tab==='history'?'class="selected"':''}>对话</button><button onclick="renderLearningDrawer('reviews')" ${tab==='reviews'?'class="selected"':''}>知识点复习</button></div>`+(tab==='history'?threads.length?threads.map(t=>`<button class="threadItem" onclick="openLearningThread('${t.id}')"><strong>${esc(t.title)}</strong><small>${esc(courseRows.find(c=>c.id===t.course_id)?.code||'学习对话')} · ${new Date(t.updated_at).toLocaleDateString('zh-CN')}</small></button>`).join(''):'<p class="meta">新对话会自动保存在这里。</p>':reviews.length?reviews.map(r=>`<div class="reviewItem"><strong>${esc(r.title)}</strong><small>${Date.parse(r.due_at)<=Date.now()?'到复习时间了':new Date(r.due_at).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 已练 ${r.attempts} 次</small><button class="secondary" onclick="startKnowledgeReview('${r.id}','${r.course_id}')" ${assistantBusy?'disabled':''}>复习这个知识点</button></div>`).join(''):'<p class="meta">完成一次知识点练习后，会自动安排复习。答错的题更早再见。</p>');
}
async function openLearningThread(id){if(assistantBusy)return;learningDrawer=false;await loadLearningHistory(true,id)}
async function startKnowledgeReview(review,course){
 if(assistantBusy)return;learningDrawer=false;
 if(assistantScope!==course||learningThread?.course_id!==course){changeLearningScope(course);if(learningLoading){const epoch=accountEpoch;for(let i=0;i<40&&learningLoading;i++){await new Promise(r=>setTimeout(r,100));if(epoch!==accountEpoch)return}}
  if(!learningThread){await sendLearningRequest({action:'chat',text:'我要复习这门课的薄弱知识点。'});if(!learningThread?.id)return}}
 return sendLearningRequest({action:'learning_review',review});
}

function showLearningCourseChoices(){const question=learningThread?.messages.filter(m=>m.role==='user').at(-1)?.content||'讲解一个重要知识点';showAssistantChoices('选一门课程，莱克会接着回答刚才的问题。',courseRows.filter(c=>!c.archived&&!c.is_shared_template).map(c=>({label:c.code?c.code+' · '+c.name:c.name,action:async()=>{const epoch=accountEpoch;changeLearningScope(c.id);for(let i=0;i<100&&learningLoading;i++){await new Promise(r=>setTimeout(r,100));if(epoch!==accountEpoch)return}if(epoch===accountEpoch)chatLearning(question)}})))}

function renderLearningActionChoices(){const area=document.getElementById('assistantActionChoices');if(!area)return;area.replaceChildren();if(!learningActionChoices)return;const wrap=document.createElement('div');wrap.className='assistantChoices';for(const choice of learningActionChoices.choices){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=choice.label;b.onclick=choice.action;wrap.append(b)}area.append(wrap)}
