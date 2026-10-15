let materialState=null,materialSelection=[],materialBusy=false,materialMessage='',materialPanelOpen=false,materialAutoResume=false,materialDraftTerms=null;
function materialDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('courselex-materials-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('batches');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveMaterialState(){if(!materialState)return;try{const db=await materialDB();await new Promise((resolve,reject)=>{const t=db.transaction('batches','readwrite');t.objectStore('batches').put(materialState,materialState.uid);t.oncomplete=resolve;t.onerror=reject});db.close()}catch{materialState.localUnavailable=true}}
async function resetMaterialsAccount(uid){materialState=null;materialSelection=[];materialBusy=false;materialMessage='';materialAutoResume=false;materialDraftTerms=null;if(!uid)return;const epoch=accountEpoch;try{const db=await materialDB();const state=await new Promise((resolve,reject)=>{const r=db.transaction('batches').objectStore('batches').get(uid);r.onsuccess=()=>resolve(r.result);r.onerror=reject});db.close();if(epoch!==accountEpoch)return;if(state&&Date.now()-state.started<86400000){materialState=state;if(window._view?.type==='home')showHome()}}catch{}}
function showAssistant(){
 if(!session)return showAuth();window.dailyStudy=false;document.body?.classList.add('assistantMode');setStudyNav('home');window._view={type:'home'};
 const active=materialState&&materialState.stage!=='finished';const todayCount=Math.min(20,ownedStudyWords().filter(w=>(progress[w.id]||w.status)==='new'||!w.next_review_at||Date.parse(w.next_review_at)<=Date.now()).length);
 app.innerHTML=`<section class="assistantHero"><img src="assets/brand/courselex-mark.png" width="52" height="52" alt=""><p class="eyebrow">莱克 Lex · 你的课件学习助手</p><h1>${ownedStudyWords().length?'今天，学会一点新知识。':'把课件给我，\n下一步直接背词。'}</h1><p>单个课件、多个文件、Canvas 压缩包都可以。<br>自动整理，只学你自己课堂里的词。</p></section>
 ${ownedStudyWords().length?`<div class="dailyActions"><button class="primary" onclick="startDailyStudy()">${todayCount?'开始今天的 '+todayCount+' 词':'今天的任务已完成'}</button><button class="secondary" onclick="startDailyStudy(true)">复习生词 · ${ownedStudyWords().filter(w=>w.status==='unknown').length}</button></div>`:''}
 <section class="assistantBox" id="materialDrop"><div class="assistantBubble">${materialMessage?esc(materialMessage):active?'上次的资料还没整理完，可以从断点继续。':words.length?'想加新课件？直接放进来，我会帮你接着整理。':'把 Canvas 下载的 ZIP 直接放进来。我会识别老师课件，跳过论文和课外阅读。'}</div>
 <form onsubmit="submitMaterials(event)"><div id="materialAttachments" class="materialAttachments">${materialSelection.map(f=>`<span>${esc(f.name)}</span>`).join('')}</div><textarea id="materialPrompt" rows="2" placeholder="拖入课件，或告诉莱克你想学什么…" aria-label="告诉莱克你的学习需求"></textarea><div class="composerActions"><label class="attachButton">＋ 添加课件<input type="file" multiple accept=".zip,.pdf,.ppt,.pptx,.docx,.txt,image/png,image/jpeg,image/webp" onchange="selectMaterials(this.files)"></label><button class="primary" id="materialSend" type="submit" ${materialBusy?'disabled':''}>${materialBusy?'正在整理…':materialSelection.length?'同意并整理':'发送'}</button></div><p class="dataNote">整理时，读取到的课件内容由智谱 AI 处理，只保存到你的账号。</p></form>
 <div id="materialProgress" aria-live="polite"></div></section><div class="assistantUtilities"><button class="linkbtn" onclick="showMaterialsLibrary()">我的学习资料${words.length?' · '+words.length+' 词':''}</button><button class="linkbtn" onclick="showQuickWordImport()">已有词表？直接导入</button><button class="linkbtn" onclick="showMaterialsHelp()">如何从 Canvas 下载？</button></div>`;
 if(active&&!materialBusy&&!materialAutoResume){materialAutoResume=true;setTimeout(()=>{if(session?.user.id===materialState?.uid&&window._view?.type==='home')continueMaterials()},500)}
 const drop=document.getElementById('materialDrop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');selectMaterials(e.dataTransfer.files)};renderMaterialProgress();
}
function selectMaterials(files){if(materialBusy)return;materialSelection=Array.from(files);const el=document.getElementById('materialAttachments');if(el)el.innerHTML=materialSelection.map(f=>`<span>${esc(f.name)}</span>`).join('');const button=document.getElementById('materialSend');if(button)button.textContent='同意并整理'}
function materialStatus(message){materialMessage=message;const el=document.querySelector('.assistantBubble');if(el)el.textContent=message;renderMaterialProgress()}
function renderMaterialProgress(){
 const el=document.getElementById('materialProgress');if(!el||!materialState)return;const state=materialState,done=state.files.filter(f=>f.result).length,failed=state.files.filter(f=>f.error).length,skipped=state.files.filter(f=>f.plan?.include===false).length,included=state.files.filter(f=>!f.plan||f.plan.include!==false).length;
 el.innerHTML=`<div class="batchSummary"><strong>${state.stage==='finished'?'资料整理完成':materialBusy?'莱克正在整理':'资料已保留'} · ${done} / ${included} 份课件${skipped?' · 已跳过 '+skipped+' 份非课件':''}</strong><progress max="${Math.max(1,included)}" value="${Math.min(included,done+failed)}"></progress><details class="fileList"><summary>查看识别结果（共 ${state.files.length} 份${failed?'，'+failed+' 份需处理':''}）</summary>${state.files.map((f,index)=>`<details class="materialFile ${f.plan?.include===false?'materialSkipped':''}"><summary><span>${f.result?'✓':f.error?'!':f.plan?.include===false?'—':'·'}</span> ${esc(f.path)} <small>${f.result?f.result.inserted+' 个新词':f.error?'需处理':f.plan?.include===false?(f.plan.kind==='reading'?'阅读材料 · 已跳过':'无法确认 · 已跳过'):f.status||'等待整理'}</small></summary>${f.plan?`<p>${esc(f.plan.reason||'')} ${f.plan.name?'· '+esc(f.plan.name)+' · '+(f.plan.week_known?'Week '+f.plan.week:'未标明周次，已放到课程开头'):''}</p>`:''}${f.plan?.include===false?`<button class="secondary materialOverride" onclick="includeMaterialFile(${index})">这是老师课件，加入整理</button>`:''}${f.error?`<p class="danger">${esc(f.error)}</p>`:''}${f.result?'<p>已保存，可从今天的背词任务开始学习。</p>':''}</details>`).join('')}</details>${state.ignored?.length?`<details><summary>已跳过 ${state.ignored.length} 个其他格式文件</summary><p>${state.ignored.map(esc).join('<br>')}</p></details>`:''}${state.duplicates?`<p>已跳过 ${state.duplicates} 个内容完全相同的重复文件。</p>`:''}${state.stage!=='finished'&&!materialBusy?'<button class="secondary" onclick="continueMaterials()">继续整理</button><button class="linkbtn" onclick="finishMaterialBatch()">结束这批资料</button>':''}${state.stage==='finished'&&done?'<button class="primary" onclick="startDailyStudy()">直接开始背词</button>':''}${state.stage==='finished'&&failed?'<p class="meta">失败的文件不影响其余资料；修正后可单独重新上传。</p>':''}</div>`;
 if(state.stage==='finished'){const added=state.files.reduce((sum,f)=>sum+(f.result?.inserted||0),0);el.innerHTML=`<details class="finishedReport"><summary>已整理 ${done} 份 · 新增 ${added} 个词${failed?' · '+failed+' 份需处理':''} <span>查看报告</span></summary>${el.innerHTML}</details>`}
 else if(words.length&&materialBusy&&!document.querySelector('.dailyActions'))el.insertAdjacentHTML('beforeend','<button class="primary" onclick="startDailyStudy()">先背已经整理好的词</button>');
}
async function submitMaterials(event){
 event.preventDefault();if(materialBusy)return;const hint=document.getElementById('materialPrompt').value.trim();if(!materialSelection.length){if(/[|\t]/.test(hint)){try{materialDraftTerms=parseOwnTerms(hint);materialStatus('已识别 '+materialDraftTerms.length+' 个词。直接导入，不调用 AI。');document.getElementById('materialProgress').innerHTML='<button class="primary" onclick="importQuickWords()">确认导入词表</button>';return}catch(e){return materialStatus(e.message)}}if(/生词|错词|背|学|复习|开始|\d{3,5}/.test(hint))return startStudyRequest(hint);if(/资料|课程|词库/.test(hint))return showMaterialsLibrary();return materialStatus('你可以直接上传课件或 ZIP，也可以说“开始背词”或“复习生词”。')}
 if(materialState&&materialState.stage!=='finished'){materialStatus('先点“继续整理”完成上一批资料，或在进度下方结束这一批，再上传新的课件。');return}
 const epoch=accountEpoch;materialBusy=true;materialStatus('正在打开资料包，检查文件和重复内容…');
 try{const {files,ignored,duplicates}=await unpackMaterials(materialSelection);if(epoch!==accountEpoch)return;const started=await materialRequest({action:'start',files:files.map(f=>({name:f.path,size:f.file.size}))});if(epoch!==accountEpoch)return;materialState={uid:session.user.id,batch:started.batch,started:Date.now(),stage:'reading',files,ignored,duplicates,hint};materialSelection=[];await saveMaterialState();materialBusy=false;await continueMaterials()}catch(e){if(epoch!==accountEpoch)return;materialBusy=false;materialStatus(e.message);showAssistant()}
}
async function continueMaterials(){
 if(materialBusy||!materialState)return;const state=materialState,epoch=accountEpoch;materialBusy=true;showAssistant();
 try{
  if(state.stage==='reading'){
   for(const [index,file] of state.files.entries()){if(epoch!==accountEpoch)return;if(file.text||file.error)continue;file.status='正在读取';materialStatus('正在读取 '+(index+1)+' / '+state.files.length+'：'+file.path);
    try{file.text=await readCoursewareText(file.file,{ocr:async image=>{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image))),b=>b.toString(16).padStart(2,'0')).join('');file.ocrCache=file.ocrCache||{};if(file.ocrCache[hash])return file.ocrCache[hash];const r=await materialRequest({action:'ocr',batch:state.batch,file:index,image});file.ocrCache[hash]=r.text;await saveMaterialState();return r.text},onProgress:text=>materialStatus(file.path+' · '+text)});file.status='文字已读取'}catch(e){if([429,503,504,401].includes(e.status)){file.status='等待继续';await saveMaterialState();throw e}file.error=readableMaterialError(e);file.status='需处理'}
    await saveMaterialState();renderMaterialProgress();
   }
   if(epoch!==accountEpoch)return;state.stage='organizing';await saveMaterialState();
  }
  if(state.stage==='organizing'){
   materialStatus('正在区分老师课件和课外阅读，并识别课程与周次…');const metadata=state.files.map((f,index)=>({index,preview:(f.text||'').slice(0,800),week:inferMaterialWeek(f.path)})).filter(f=>state.files[f.index].text);
   if(metadata.length){const {plan}=await materialRequest({action:'organize',batch:state.batch,files:metadata,hint:state.hint});if(epoch!==accountEpoch)return;for(const entry of plan)state.files[entry.index].plan=entry}
   state.stage='learning';await saveMaterialState();
  }
  for(const [index,file] of state.files.entries()){
   if(epoch!==accountEpoch)return;if(file.error||file.result||!file.plan||file.plan.include===false)continue;file.status='正在生成词库';materialStatus('整理 '+(index+1)+' / '+state.files.length+'：'+file.path);
   try{
    if(!file.job){const prepared=await materialRequest({action:'prepare',course:file.plan.course,week:file.plan.week,filename:file.path.split('/').pop(),parts:splitCoursewareText(file.text),batch:state.batch,file_index:index});file.job=prepared.job;await saveMaterialState()}
    for(let attempt=0;attempt<160;attempt++){if(epoch!==accountEpoch)return;const r=await materialRequest({action:'next',job:file.job});if(r.status==='completed'){file.result=r;file.text='';file.file=null;file.status='完成';break}file.status='正在整理 '+r.done+' / '+r.total+' 段';renderMaterialProgress();await new Promise(resolve=>setTimeout(resolve,Math.max(100,Math.min(2500,r.poll_after_ms||2500))))}
    if(!file.result)throw Error('整理仍在进行，可稍后继续。');
   }catch(e){if([429,503,504,401].includes(e.status)||!e.status){file.status='等待继续';await saveMaterialState();throw e}file.error=e.message}
   await saveMaterialState();if(!words.length)await loadCloud();renderMaterialProgress();
  }
  if(epoch!==accountEpoch)return;state.stage='finished';await saveMaterialState();await loadCloud();const completed=state.files.filter(f=>f.result).length,skipped=state.files.filter(f=>f.plan?.include===false).length;materialStatus(completed?'老师课件已经整理好'+(skipped?'，并跳过 '+skipped+' 份阅读或待确认材料':'')+'。现在可以开始今天的任务。':skipped?'这批文件暂未确认到老师课件，阅读材料已跳过；可在报告中手动确认。':'这批资料还没有成功整理，请查看报告中的原因，换一份可读课件再试。');
 }catch(e){if(epoch===accountEpoch)materialStatus(e.message+' 已保留进度，稍后点击“继续整理”。')}finally{if(epoch===accountEpoch){materialBusy=false;if(window._view?.type==='home')showAssistant()}}
}
function startDailyStudy(unknownOnly=false,options={}){
 const pool=options.course?words.filter(w=>w.course===options.course&&(!options.week||w.week===options.week)):ownedStudyWords();const limit=Math.max(1,Math.min(100,options.count||20));
 if(!pool.length){materialStatus('先把自己的课件或词表放进来，莱克会帮你准备本课堂的第一轮。原来的资料仍保留在“我的学习资料”。');return showAssistant()}
 const now=Date.now(),status=w=>progress[w.id]||w.status;const review=pool.filter(w=>status(w)!=='new'&&(unknownOnly?status(w)==='unknown':options.course||!w.next_review_at||Date.parse(w.next_review_at)<=now)).sort((a,b)=>Date.parse(a.last_review_at||0)-Date.parse(b.last_review_at||0));const fresh=pool.filter(w=>status(w)==='new'||!status(w));
 const reviewLimit=Math.min(10,Math.ceil(limit/2));queue=unknownOnly?review.slice(0,limit):[...review.slice(0,reviewLimit),...fresh.slice(0,limit-Math.min(review.length,reviewLimit))];if(!unknownOnly&&queue.length<limit)queue.push(...review.slice(reviewLimit,reviewLimit+limit-queue.length));
 if(!queue.length){materialStatus(unknownOnly?'目前没有生词。':'今天该复习的词已经完成了，下次到时间会自动安排。你也可以继续上传新课件。');return showAssistant()}
 qIndex=0;currentMode=options.mode||'choice';window.dailyStudy=true;window._view={type:'study'};showQuestion();
}
function showMaterialsLibrary(){
 window.dailyStudy=false;document.body?.classList.remove('assistantMode');window._view={type:'materials'};setStudyNav('manager');app.innerHTML=`<div class="sectionHead"><button class="back" onclick="showHome()">← 返回</button><h1>我的学习资料</h1></div><p class="meta">你上传的内容与已有词库都保留在这里。课程名称与词汇可随时管理。</p><div class="grid">${Object.entries(COURSES).map(([id,name])=>`<article class="course" onclick="showWeeks('${id}')"><div><h2>${esc(name)}</h2>${courseRows.find(c=>c.id===id)?.is_shared_template?'<small>以前导入的共享资料 · 不混入今日任务</small>':''}</div><p>${countCourse(id)} 个词 · 已掌握 ${knownCount(id)}</p></article>`).join('')}</div><div class="uploadActions"><button class="secondary" onclick="showCourses()">整理课程与名称</button><button class="secondary" onclick="showManager()">编辑词汇</button></div>`;
}
function showMaterialsHelp(){materialStatus('Canvas：进入课程的 Files，直接下载包含所有 Week 的 ZIP。莱克会优先识别 PPT、课堂讲义和教学材料，自动跳过论文、书籍章节与课外阅读；不确定的文件会列在报告里让你确认。无需提供 Canvas 密码。')}

async function includeMaterialFile(index){if(materialBusy||!materialState)return;const file=materialState.files[index];if(!file?.plan||file.result)return;materialBusy=true;try{const result=await materialRequest({action:'include',batch:materialState.batch,file:index});for(const entry of result.plan){if(materialState.files[entry.index])materialState.files[entry.index].plan=entry}file.status='等待整理';if(materialState.stage==='finished')materialState.stage='learning';await saveMaterialState()}catch(e){materialStatus(e.message);materialBusy=false;return}materialBusy=false;continueMaterials()}

async function finishMaterialBatch(){if(materialBusy||!materialState)return;if(!confirm('结束未完成的整理？已经导入的词汇会保留，未导入的文件可稍后重新上传。'))return;materialState.stage='finished';await saveMaterialState();showAssistant()}

async function materialRequest(body){const epoch=accountEpoch;for(let attempt=0;attempt<7;attempt++){try{return await coursewareRequest(body)}catch(e){if(epoch!==accountEpoch)throw e;if(e.retryable===false||![429,503,504].includes(e.status)||attempt===6)throw e;const delay=Math.min(60000,10000*2**attempt);materialStatus((e.message||'免费 AI 正忙。')+' 约 '+Math.round(delay/1000)+' 秒后自动继续，不用重复上传。');await new Promise(resolve=>setTimeout(resolve,delay));if(epoch!==accountEpoch)throw Error('账号已切换。')}}}

function readableMaterialError(e){if(/password/i.test(e.name+' '+e.message))return '这份 PDF 有密码保护，请先解锁再上传。';if(/invalid pdf|invalidpdf|pdf structure/i.test(e.name+' '+e.message))return '这份 PDF 无法打开，可能已损坏，请从 Canvas 重新下载。';return e.message||'文件无法读取，请重新导出为 PDF。'}

function showQuickWordImport(){showAssistant();materialStatus('把“英文 | 中文”词表粘贴到对话框，点击发送即可预览；需要整理提示词或上传词表文件时，使用下方详细导入。');document.getElementById('materialPrompt').focus();document.getElementById('materialProgress').innerHTML='<button class="secondary" onclick="showOwnAI()">提示词与文件导入</button>'}
async function importQuickWords(){if(!materialDraftTerms||materialBusy)return;const epoch=accountEpoch;materialBusy=true;try{let course=courseRows.find(c=>c.name==='自己的词表'&&!c.archived);if(!course){[course]=await sb('user_courses',{method:'POST',body:JSON.stringify({user_id:session.user.id,name:'自己的词表',weeks:1})})}const result=await sb('rpc/import_user_vocabulary',{method:'POST',body:JSON.stringify({p_course:course.id,p_week:1,p_terms:materialDraftTerms.map(t=>({english:t.en,chinese:t.zh}))})});if(epoch!==accountEpoch)return;materialDraftTerms=null;await loadCloud();materialMessage='已导入 '+result.inserted+' 个词，跳过 '+result.skipped+' 个重复词。现在可以开始今天的任务。'}catch(e){if(epoch===accountEpoch)materialMessage=e.message}finally{if(epoch===accountEpoch){materialBusy=false;showAssistant()}}}

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
