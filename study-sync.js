// Account-scoped navigation sync. CAS revisions prevent silent stale overwrites.
const studySyncMeta=new Map(),studySyncPending=new Map(),studySyncFlights=new Map(),studySyncConflicts=new Map();
let studySyncTimer=null,studySyncMessage='续学进度会保存到账号';
function studySyncScope(key){const p=String(key).split(':'),uuid=/^[0-9a-f-]{36}$/i;if(p[0]!=='sinq-resume'||!uuid.test(p[2])||!uuid.test(p[3]))return null;return {key,uid:p[2],course:p[3],week:p[4]==='all'?0:Number(p[4]),kind:p[1]==='reader'?'reader':'words:'+(p[5]==='unknown'?'unknown':'daily')}}
function renderStudySyncStatus(){for(const el of document.querySelectorAll?.('[data-study-sync]')||[]){el.textContent=studySyncMessage;const conflict=[...studySyncConflicts.entries()].find(([key])=>studySyncScope(key)?.uid===session?.user.id);if(conflict){el.textContent='另一台设备有更新，请选择要继续的进度';for(const [remote,label] of [[true,'使用另一设备进度'],[false,'保留本机进度']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>resolveStudySync(conflict[0],remote);el.append(b)}}else if(studySyncMessage.includes('本机')){const b=document.createElement('button');b.type='button';b.textContent='重试同步';b.onclick=()=>flushStudySync();el.append(b)}}}
function studySyncStatus(message){studySyncMessage=message;if(typeof document!=='undefined')renderStudySyncStatus()}
function queueStudySync(key,payload){const scope=studySyncScope(key);if(!scope||scope.uid!==session?.user.id||typeof sb!=='function')return;let base=studySyncMeta.get(key)?.revision;try{if(base===undefined)base=Number(localStorage.getItem(key+':revision'))||0}catch{}const previous=studySyncPending.get(key);studySyncPending.set(key,{base:previous?.base??base??0,payload:structuredClone(payload)});try{localStorage.setItem(key+':pending',JSON.stringify(studySyncPending.get(key)))}catch{}studySyncStatus('正在同步续学进度…');clearTimeout(studySyncTimer);studySyncTimer=setTimeout(()=>flushStudySync(),500)}
function applyStudySyncRow(scope,row){studySyncMeta.set(scope.key,{revision:Number(row?.revision)||0});try{localStorage.setItem(scope.key+':revision',String(row?.revision||0));if(row){localStorage.setItem(scope.key,JSON.stringify(row.payload));if(scope.kind==='reader'&&typeof row.payload.note==='string')localStorage.setItem('courselex-notebook:'+scope.uid+':'+scope.course+':'+(scope.week||'all'),row.payload.note)}}catch{}}
async function pullStudySync(kind,course,week,extra=''){
 const key=scopedResumeKey(kind,course,week,extra),scope=studySyncScope(key);if(!scope||typeof sb!=='function')return false;
 try{
  const disk=localStorage.getItem(key+':pending');if(disk&&!studySyncPending.has(key)){const pending=JSON.parse(disk);if(pending&&typeof pending.payload==='object'&&Number.isInteger(pending.base))studySyncPending.set(key,pending)}
  if(studySyncPending.has(key))await flushStudySyncKey(key);
  if(studySyncPending.has(key)||studySyncConflicts.has(key))return false;
  const rows=await sb('user_study_resume?course_id=eq.'+scope.course+'&week=eq.'+scope.week+'&kind=eq.'+encodeURIComponent(scope.kind));
  if(session?.user.id!==scope.uid)return false;applyStudySyncRow(scope,rows[0]);studySyncStatus(rows[0]?'续学进度已从账号恢复':'续学进度会保存到账号');return true;
 }catch{studySyncStatus('暂未同步，进度保存在本机');return false}
}
async function flushStudySyncKey(key){
 if(studySyncFlights.has(key))return studySyncFlights.get(key);const scope=studySyncScope(key),pending=studySyncPending.get(key);if(!scope||scope.uid!==session?.user.id||!pending||studySyncConflicts.has(key))return;
 let succeeded=false;const work=(async()=>{try{const snapshot=structuredClone(pending);const result=await sb('rpc/save_study_resume',{method:'POST',body:JSON.stringify({p_course:scope.course,p_week:scope.week,p_kind:scope.kind,p_expected:snapshot.base,p_payload:snapshot.payload})});if(session?.user.id!==scope.uid)return;
 if(result.conflict){studySyncConflicts.set(key,result.row);studySyncStatus('另一台设备有更新，请选择要继续的进度');return}
 studySyncMeta.set(key,{revision:Number(result.row.revision)});localStorage.setItem(key+':revision',String(result.row.revision));const latest=studySyncPending.get(key);
 if(JSON.stringify(latest?.payload)===JSON.stringify(snapshot.payload)){studySyncPending.delete(key);localStorage.removeItem(key+':pending')}else if(latest){latest.base=Number(result.row.revision);localStorage.setItem(key+':pending',JSON.stringify(latest))}
 succeeded=true;studySyncStatus([...studySyncPending.keys()].some(k=>studySyncScope(k)?.uid===session?.user.id)?'正在同步续学进度…':'续学进度已同步');
 }catch{studySyncStatus('暂未同步，进度保存在本机')}finally{studySyncFlights.delete(key);if(succeeded&&studySyncPending.has(key)&&!studySyncConflicts.has(key))studySyncTimer=setTimeout(()=>flushStudySyncKey(key),500)}})();studySyncFlights.set(key,work);return work;
}
async function flushStudySync(){clearTimeout(studySyncTimer);for(const key of [...studySyncPending.keys()])await flushStudySyncKey(key)}
async function resolveStudySync(key,useRemote){const scope=studySyncScope(key),row=studySyncConflicts.get(key);if(!scope||scope.uid!==session?.user.id||!studySyncConflicts.has(key))return;
 if(useRemote){if(typeof flushWorkspace==='function'&&!await flushWorkspace())return;studySyncPending.delete(key);localStorage.removeItem(key+':pending');studySyncConflicts.delete(key);applyStudySyncRow(scope,row);studySyncStatus('已保留另一设备的进度，请重新进入此周继续');if(scope.kind==='reader'&&typeof openNotebookSplit==='function'){if(typeof activeReaderResume!=='undefined')activeReaderResume=null;await openNotebookSplit(null,scope.course,scope.week||undefined)}else if(scope.kind.startsWith('words')&&typeof startDailyStudy==='function'){if(typeof activeVocabularyResume!=='undefined')activeVocabularyResume=null;await startDailyStudy(scope.kind==='words:unknown',{course:scope.course,week:scope.week||undefined})}
 }else{const pending=studySyncPending.get(key);if(pending){pending.base=Number(row?.revision)||0;studySyncConflicts.delete(key);await flushStudySyncKey(key)}}
}
if(typeof window!=='undefined'&&window.addEventListener){window.addEventListener('online',()=>flushStudySync());window.addEventListener('pagehide',()=>flushStudySync())}
