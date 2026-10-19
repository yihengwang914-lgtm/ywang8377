// Mobile presentation only: viewport sizing and scroll chrome; no note or network writes.
let mobileNoteScrollY=0,mobileNoteScrollTravel=0,mobileNoteDirection=0,mobileNoteFrame=0;
let mobileViewportLast=null,mobileNotebookFrame=0,mobileViewportFrame=0;
const mobileNoteSizes=new WeakMap();
function mobileViewportMetrics(view,layoutHeight){
 const height=Math.max(180,Number(view?.height)||Number(layoutHeight)||600),top=Math.max(0,Number(view?.offsetTop)||0);
 return {height,top,keyboard:Math.max(0,(Number(layoutHeight)||height)-height)>140};
}
function updateMobileViewport(){
 const metrics=mobileViewportMetrics(window.visualViewport,window.innerHeight),style=document.documentElement.style;
 if(!mobileViewportLast||mobileViewportLast.height!==metrics.height)style.setProperty('--mobile-view-height',metrics.height+'px');
 if(!mobileViewportLast||mobileViewportLast.top!==metrics.top)style.setProperty('--mobile-view-top',metrics.top+'px');
 if(!mobileViewportLast||mobileViewportLast.keyboard!==metrics.keyboard)document.body.classList.toggle('mobileKeyboardOpen',metrics.keyboard);mobileViewportLast=metrics;
}
function setMobileNoteControls(visible){
 if(document.body.classList.contains('mobileNoteFocused')===!visible)return;document.body.classList.toggle('mobileNoteFocused',!visible);mobileNoteScrollTravel=0;
 const button=document.getElementById('mobileNoteControls');if(button){button.setAttribute('aria-expanded',String(visible));button.textContent=visible?'收起工具':'课程与工具 ↓'}
}
function mobileNoteScrollDecision(previous,current,travel,direction){
 const delta=current-previous,nextDirection=Math.sign(delta);
 if(current<24)return {travel:0,direction:0,visible:true};
 if(Math.abs(delta)<2)return {travel,direction,visible:null};
 travel=nextDirection===direction?travel+Math.abs(delta):Math.abs(delta);
 return {travel,direction:nextDirection,visible:travel>=28?(nextDirection<0):null};
}
function trackMobileNoteScroll(){
 if(!window.matchMedia('(max-width:760px)').matches||!document.body.classList.contains('notebookMode'))return;
 if(document.querySelector('.lexFloatingPanel:not([hidden])')||document.querySelector('.notebookChrome details[open]'))return;
 const y=Math.max(0,window.scrollY);const next=mobileNoteScrollDecision(mobileNoteScrollY,y,mobileNoteScrollTravel,mobileNoteDirection);
 mobileNoteScrollY=y;mobileNoteScrollTravel=next.travel;mobileNoteDirection=next.direction;if(next.visible!==null)setMobileNoteControls(next.visible);
}
function refreshMobileNotebook(){
 updateMobileViewport();const mobile=window.matchMedia('(max-width:760px)').matches;
 if(!mobile||!document.body.classList.contains('notebookMode'))document.body.classList.remove('mobileNoteFocused');
 const fullPage=mobile&&Boolean(document.querySelector('.studySplit[data-mobile-panel=notebook]'));
 for(const input of document.querySelectorAll('.notebookPanel textarea.noteEditor:not([hidden])')){if(fullPage){const width=input.clientWidth,previous=mobileNoteSizes.get(input);if(previous&&previous.width===width&&previous.value===input.value)continue;input.style.height='auto';input.style.setProperty('height',Math.max(240,input.scrollHeight)+'px','important');mobileNoteSizes.set(input,{width,value:input.value})}else{if(mobileNoteSizes.has(input)){input.style.removeProperty('height');mobileNoteSizes.delete(input)}}}
}
function scheduleMobileNotebook(){if(mobileNotebookFrame)return;mobileNotebookFrame=requestAnimationFrame(()=>{mobileNotebookFrame=0;refreshMobileNotebook()})}
function scheduleMobileViewport(){if(mobileViewportFrame)return;mobileViewportFrame=requestAnimationFrame(()=>{mobileViewportFrame=0;updateMobileViewport()})}
if(typeof window!=='undefined'&&window.addEventListener){
 window.addEventListener('scroll',()=>{if(mobileNoteFrame)return;mobileNoteFrame=requestAnimationFrame(()=>{mobileNoteFrame=0;trackMobileNoteScroll()})},{passive:true});
 window.addEventListener('resize',scheduleMobileNotebook);window.visualViewport?.addEventListener('resize',scheduleMobileViewport);window.visualViewport?.addEventListener('scroll',scheduleMobileViewport);
 document.addEventListener('input',event=>{if(event.target.matches?.('.notebookPanel textarea.noteEditor'))scheduleMobileNotebook()});
 document.addEventListener('focusin',event=>{if(event.target.matches?.('.notebookPanel textarea.noteEditor')&&window.matchMedia('(max-width:760px)').matches)setMobileNoteControls(false);updateMobileViewport()});
 document.addEventListener('DOMContentLoaded',updateMobileViewport);
}
