// Local navigation state only. Word answers and note text retain their existing saves.
let activeVocabularyResume=null,vocabularyAnsweredIndex=-1,activeReaderResume=null;
function scopedResumeKey(kind,course,week,extra=''){return session?.user.id?'sinq-resume:'+kind+':'+session.user.id+':'+(course||'all')+':'+(Number(week)||'all')+':'+extra:''}
function saveVocabularyResume(answered=false){
 if(!activeVocabularyResume||activeVocabularyResume.uid!==session?.user.id||!window.dailyStudy||!Array.isArray(queue))return;
 if(answered)vocabularyAnsweredIndex=qIndex;
 const payload={ids:queue.map(w=>w.id),index:Math.min(queue.length,qIndex+(vocabularyAnsweredIndex===qIndex?1:0)),mode:currentMode};try{localStorage.setItem(activeVocabularyResume.key,JSON.stringify(payload))}catch{}if(typeof queueStudySync==='function')queueStudySync(activeVocabularyResume.key,payload)
}
function restoreVocabularyResume(options,pool){
 const key=scopedResumeKey('words',options.course,options.week,options.unknownOnly?'unknown':'daily');activeVocabularyResume={key,uid:session?.user.id};vocabularyAnsweredIndex=-1;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null'),allowed=new Map(pool.map(w=>[w.id,w]));if(!saved||!Array.isArray(saved.ids)||!saved.ids.length||saved.ids.length>100||new Set(saved.ids).size!==saved.ids.length||!saved.ids.every(id=>allowed.has(id))||!Number.isInteger(saved.index)||saved.index<0||saved.index>saved.ids.length)return false;queue=saved.ids.map(id=>allowed.get(id));qIndex=saved.index;currentMode=['choice','recognition'].includes(saved.mode)?saved.mode:'choice';return true}catch{return false}
}
function saveReadingResume(){
 if(!activeReaderResume||activeReaderResume.uid!==session?.user.id||!readingPane.open||activeReaderResume.key!==scopedResumeKey('reader',workspaceScope(),readingPane.week))return;
 const payload={id:readingPane.id,page:readingPane.page,scroll:readingPane.scroll,pdf:readingPane.pdf};const anchor=readingResumeAnchor();if(anchor)payload.anchor=anchor;if(typeof workspaceNote!=='undefined'&&workspaceNote?.version&&workspaceNote.course_id===workspaceScope()&&Number(workspaceNote.week||0)===Number(readingPane.week||0))payload.note=workspaceNote.id;try{localStorage.setItem(activeReaderResume.key,JSON.stringify(payload))}catch{}if(typeof queueStudySync==='function')queueStudySync(activeReaderResume.key,payload)
}
function restoreReadingResume(course,week){
 const key=scopedResumeKey('reader',course,week);activeReaderResume={key,uid:session?.user.id};
 let value;try{value=JSON.parse(localStorage.getItem(key)||'null')}catch{}
 readingPane.id=typeof value?.id==='string'?value.id:'';readingPane.page=Number.isInteger(value?.page)&&value.page>0&&value.page<10000?value.page:Array.isArray(window.SINQ_LECTURE_PAGES)?window.SINQ_LECTURE_PAGES[0]:1;
 readingPane.anchor=value?.anchor&&Number.isInteger(value.anchor.page)&&Number.isFinite(value.anchor.ratio)?{page:value.anchor.page,ratio:Math.max(0,Math.min(1,value.anchor.ratio))}:null;readingPane.restoreAnchor=true;
 readingPane.scroll=Number.isFinite(value?.scroll)&&value.scroll>=0?Math.min(value.scroll,10000000):0;readingPane.pdf=value?.pdf!==false;readingPane.key='';readingPane.html='';
}
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',()=>{saveVocabularyResume();saveReadingResume()});

function readingResumeAnchor(){
 if(typeof document==='undefined')return readingPane.anchor||null;
 const area=document.getElementById('readingScroll'),figure=document.getElementById('lecturePage'+readingPane.page);
 if(!area?.clientHeight||!figure)return readingPane.anchor||null;
 const a=area.getBoundingClientRect(),r=figure.getBoundingClientRect();if(!r.height)return readingPane.anchor||null;
 return readingPane.anchor={page:Number(readingPane.page),ratio:Math.max(0,Math.min(1,(a.top-r.top)/r.height))};
}
function applyReadingResumePosition(area){
 if(!readingPane.restoreAnchor||!area?.clientHeight)return false;
 const anchor=readingPane.anchor||{page:readingPane.page,ratio:0},figure=document.getElementById('lecturePage'+anchor.page);
 if(figure&&readingPane.pdf){const a=area.getBoundingClientRect(),r=figure.getBoundingClientRect();if(!r.height)return false;area.scrollTop+=r.top-a.top+anchor.ratio*r.height;readingPane.scroll=area.scrollTop;readingPane.page=anchor.page}
 readingPane.restoreAnchor=false;return true;
}
