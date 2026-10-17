let welcomeStep=0,welcomeUser='',welcomeReturnFocus=null;
const welcomeSteps=[
 {icon:'attach',title:'把课件交给莱克',body:'老师的 PDF、PPT、Word，或从 Canvas 下载的 ZIP，都可以直接上传。',detail:'莱克会按课程整理，优先使用课堂课件，阅读材料会单独列出。课件由智谱 AI 处理，保存在你的账号。'},
 {icon:'spark',title:'想学什么，直接说',body:'选一门课，问知识点、要重点总结，或者开始练习。',detail:'练习会提前准备。题目和选项用英文，提交后看正确答案和中文解析；也可以继续追问。'},
 {icon:'clock',title:'学过的，接着巩固',body:'错题会进入复习安排。对话和学习进度随账号保存。',detail:'从“记录”找回每门课的对话。课程空间里可以写笔记、导入 syllabus、安排日历和打开学校链接。背单词也继续保留。'}
];
function resetWelcomeAccount(){document.getElementById('welcomeDialog')?.remove();welcomeUser='';welcomeStep=0;welcomeReturnFocus=null}
function maybeShowWelcome(){
 if(!session||!userProfile||!Object.prototype.hasOwnProperty.call(userProfile,'welcome_completed_at')||userProfile.welcome_completed_at||window._view?.type!=='home'||document.getElementById('welcomeDialog'))return;
 try{if(localStorage.getItem('courselex-welcome:'+session.user.id))return}catch{}
 showWelcomeGuide();
}
function showWelcomeGuide(){
 if(!session||!userProfile)return;resetWelcomeAccount();welcomeUser=session.user.id;welcomeReturnFocus=document.activeElement;welcomeStep=0;
 const dialog=document.createElement('dialog');dialog.id='welcomeDialog';dialog.className='welcomeDialog';dialog.setAttribute('aria-labelledby','welcomeTitle');
 dialog.addEventListener('cancel',event=>{event.preventDefault();finishWelcome()});document.body.append(dialog);renderWelcomeGuide();dialog.showModal();
}
function renderWelcomeGuide(){
 const dialog=document.getElementById('welcomeDialog');if(!dialog||!session||session.user.id!==welcomeUser)return;
 const step=welcomeSteps[welcomeStep];
 dialog.innerHTML='<div class="welcomeTop"><span aria-label="第 '+(welcomeStep+1)+' 步，共 3 步">'+(welcomeStep+1)+' / 3</span><button class="welcomeSkip" onclick="finishWelcome()">跳过</button></div>'+
 '<div class="welcomeVisual" aria-hidden="true">'+lexIcon(step.icon)+'</div><h2 id="welcomeTitle">'+step.title+'</h2><p class="welcomeBody">'+step.body+'</p><p class="welcomeDetail">'+step.detail+'</p>'+
 '<div class="welcomeBottom"><div class="welcomeDots" aria-hidden="true">'+welcomeSteps.map((_,i)=>'<i class="'+(i===welcomeStep?'current':'')+'"></i>').join('')+'</div><div class="welcomeActions">'+
 (welcomeStep?'<button class="secondary" onclick="welcomeStep--;renderWelcomeGuide()">上一步</button>':'')+
 '<button class="primary" id="welcomeNext" onclick="'+(welcomeStep===2?'finishWelcome()':'welcomeStep++;renderWelcomeGuide()')+'">'+(welcomeStep===2?'开始学习':'下一步')+'</button></div></div>';
 if(dialog.open)document.getElementById('welcomeNext')?.focus();
}
function finishWelcome(){
 const uid=welcomeUser;if(!session||uid!==session.user.id)return resetWelcomeAccount();
 const done=new Date().toISOString();userProfile.welcome_completed_at=done;
 try{localStorage.setItem('courselex-welcome:'+uid,done)}catch{}
 const dialog=document.getElementById('welcomeDialog');if(dialog?.open)dialog.close();dialog?.remove();welcomeUser='';
 const target=document.getElementById('materialPrompt');if(!window.matchMedia?.('(pointer: coarse)').matches)target?.focus();welcomeReturnFocus=null;
 sb('user_profiles?user_id=eq.'+uid,{method:'PATCH',body:JSON.stringify({welcome_completed_at:done})}).catch(()=>{});
}
