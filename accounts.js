const LEGACY_EMAIL='ywang8377-c@my.cityu.edu.hk';
const returnUrl=location.hostname==='www.courselexai.com'||location.hostname==='courselexai.com'?'https://www.courselexai.com/':'https://yihengwang914-lgtm.github.io/ywang8377/';
let recoveryMode=false;
let userProfile=null,isAdmin=false,activityTimer=null,activitySession='';
let signupEmail='',signupResendAt=0;
const SCHOOL_OPTIONS=[
 ['香港城市大学','City University of Hong Kong · CityUHK · 城大'],['香港大学','The University of Hong Kong · HKU · 港大'],['香港中文大学','The Chinese University of Hong Kong · CUHK · 中大'],['香港科技大学','The Hong Kong University of Science and Technology · HKUST · 科大'],['香港理工大学','The Hong Kong Polytechnic University · PolyU · 理大'],['香港浸会大学','Hong Kong Baptist University · HKBU · 浸大'],['岭南大学','Lingnan University · LU'],['香港教育大学','The Education University of Hong Kong · EdUHK · 教大'],['香港都会大学','Hong Kong Metropolitan University · HKMU · 都大'],['香港恒生大学','The Hang Seng University of Hong Kong · HSUHK'],['香港树仁大学','Hong Kong Shue Yan University · HKSYU'],['香港珠海学院','Hong Kong Chu Hai College · HKCHC'],['香港演艺学院','The Hong Kong Academy for Performing Arts · HKAPA'],['香港高等教育科技学院','Technological and Higher Education Institute of Hong Kong · THEi']
];
let schoolSuggestionMatches=[];
function authNotice(text,bad=false){const el=document.getElementById('authNotice');if(el){el.textContent=text;el.className='notice'+(bad?' danger':'')}}
function showAuth(mode='login'){
 document.body?.classList?.remove('assistantMode');
 document.getElementById('userNav').hidden=true;window._view={type:'auth'};
 const signup=mode==='signup',reset=mode==='reset';
 app.innerHTML=`<div class="authLayout"><section class="hero authHero"><div class="authEyebrow">莱克 Lex · AI 学习助理</div><h1>每一个知识点，<br>都是新的起点。</h1><p>上传课堂课件，和莱克一起理解知识、练习巩固、安排复习。</p></section><section class="panel authPanel"><h2>${signup?'邮箱注册':reset?'重置密码':'登录奇点'}</h2><form class="authForm" onsubmit="submitAuth(event,'${mode}')">
 <label for="authEmail">邮箱</label><input id="authEmail" name="email" spellcheck="false" autocapitalize="none" type="email" autocomplete="email" required maxlength="254" value="${esc(signupEmail)}">
 ${reset?'':`<label for="authPassword">密码</label><input id="authPassword" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="8" required>`}
 ${signup?'<p class="meta">密码至少 8 位。验证邮箱后即可保存学习进度。</p>'+registrationProfileFields():''}<button id="authSubmit" class="primary">${signup?'注册':reset?'发送重置邮件':'登录'}</button></form>
 <div id="authNotice" role="status" class="notice"></div><div class="uploadActions"><button class="linkbtn" onclick="showAuth('${signup||reset?'login':'signup'}')">${signup||reset?'返回登录':'创建账号'}</button>${!signup&&!reset?'<button class="linkbtn" onclick="showAuth(\'reset\')">忘记密码</button>':''}</div></section></div>`;
}
async function submitAuth(event,mode){
 event.preventDefault();const button=document.getElementById('authSubmit');button.disabled=true;const label=button.textContent;button.textContent=mode==='signup'?'正在注册…':mode==='reset'?'正在发送…':'正在登录…';authNotice('');
 const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword')?.value;
 try{
 let result;
 if(mode==='signup')result=await authClient.auth.signUp({email,password,options:{emailRedirectTo:returnUrl,data:{courselex_profile:readProfileFields()}} });
 else if(mode==='reset')result=await authClient.auth.resetPasswordForEmail(email,{redirectTo:returnUrl});
 else result=await authClient.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 if(mode==='signup'){signupEmail=email;signupResendAt=Date.now()+60000;showSignupConfirmation();}
 if(mode==='reset')authNotice('若该邮箱已注册，重置邮件将发送至你的邮箱。');
 }catch(e){authNotice(friendlyAuthError(e),true);if(/USERNAME_TAKEN|用户名已被使用/i.test(String(e?.message))){const field=document.getElementById('profileUsername');field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby','authNotice');field?.focus()}document.getElementById('authNotice')?.scrollIntoView?.({block:'nearest',behavior:'smooth'})}finally{if(button.isConnected){button.disabled=false;button.textContent=label}}
}
function friendlyAuthError(error){const text=String(error?.message||'');if(/USERNAME_TAKEN|用户名已被使用/i.test(text))return '这个用户名已被使用，请换一个用户名；邮箱和其他资料不用重填。';if(/Database error saving new user/i.test(text))return '注册资料暂时未能保存，请稍后重试；若仍失败，请联系我们检查，不必反复提交。';if(/invalid login credentials/i.test(text))return '邮箱或密码不正确，请核对后重试。';if(/email not confirmed/i.test(text))return '请先点击邮箱里的验证链接，再回来登录。';if(/rate limit|too many|security purposes/i.test(text))return '操作有些频繁，请稍等一分钟再试。';if(/error sending confirmation/i.test(text))return '验证邮件暂时未能发送，请稍后重试。';if(/fetch|network|timeout/i.test(text))return '连接暂时中断，请检查网络后重试。';return text||'暂时无法连接，请稍后重试。'}
function showSignupConfirmation(){
 app.innerHTML=`<section class="panel authPanel signupConfirmation"><h2>验证邮箱，开始学习</h2><p>请打开 <strong>${esc(signupEmail)}</strong> 的验证邮件，点击里面的链接。</p><p class="meta">没看到？也检查一下垃圾邮件。若已有账号，直接登录即可。</p><button class="primary" onclick="showAuth('login')">已验证，去登录</button><button class="linkbtn" id="signupResend" onclick="resendSignup()">重新发送验证邮件</button><button class="linkbtn" onclick="showAuth('signup')">邮箱填错了？重新填写</button><div id="authNotice" role="status" class="notice"></div></section>`;
 window.scrollTo?.({top:0,behavior:'smooth'});
}
async function resendSignup(){const button=document.getElementById('signupResend');if(!signupEmail||!button)return;if(Date.now()<signupResendAt)return authNotice('请等待 '+Math.ceil((signupResendAt-Date.now())/1000)+' 秒后再发送。');button.disabled=true;try{const {error}=await authClient.auth.resend({type:'signup',email:signupEmail,options:{emailRedirectTo:returnUrl}});if(error)throw error;signupResendAt=Date.now()+60000;authNotice('验证邮件已重新发送，请查收。')}catch(e){authNotice(friendlyAuthError(e),true)}finally{if(button.isConnected)button.disabled=false}}
function showPasswordReset(){
 app.innerHTML='<section class="panel authPanel"><h2>设置新密码</h2><form onsubmit="updatePassword(event)"><label for="newPassword">新密码</label><input id="newPassword" type="password" autocomplete="new-password" minlength="8" required><br><br><button class="primary">保存新密码</button></form><div id="authNotice" class="notice" role="status"></div></section>';
}
async function updatePassword(event){event.preventDefault();const {error}=await authClient.auth.updateUser({password:document.getElementById('newPassword').value});if(error)return authNotice(error.message,true);recoveryMode=false;await switchAccount(session);}
async function logout(){
 if(typeof flushWorkspace==='function'&&!await flushWorkspace())return;
 if(typeof flushStudySync==='function')await flushStudySync();
 recoveryMode=false;
 const {error}=await authClient.auth.signOut();if(error)return alert('退出失败：'+error.message);
 if(session)await switchAccount(null);
}
function stopActivityTracking(){if(activityTimer&&globalThis.clearInterval)globalThis.clearInterval(activityTimer);activityTimer=null;activitySession='';}
async function activityHeartbeat(){if(!session||!activitySession||document.visibilityState==='hidden')return;try{await sb('rpc/record_user_activity',{method:'POST',body:JSON.stringify({p_session:activitySession})})}catch(e){console.error(e)}}
function startActivityTracking(){
 stopActivityTracking();
 if(!session)return;
 activitySession=(globalThis.crypto?.randomUUID?.()||'10000000-0000-4000-8000-'+String(Date.now()).padStart(12,'0').slice(-12));
 activityHeartbeat();if(globalThis.setInterval)activityTimer=globalThis.setInterval(activityHeartbeat,60000);
}
async function loadAccountProfile(){
 const rows=await sb('user_profiles?select=*&limit=1');
 userProfile=rows[0]||null;
 isAdmin=await sb('rpc/is_courselex_admin',{method:'POST',body:'{}'});
 const adminLink=document.getElementById('adminLink');if(adminLink)adminLink.hidden=!isAdmin;
 return userProfile;
}
function consumeAuthRedirectError(){
 const hash=String(location.hash||'');if(!hash)return '';
 const params=new URLSearchParams(hash.slice(1));
 if(!params.has('error')&&!params.has('error_code'))return '';
 // Never display provider descriptions or retain authentication details in the URL.
 globalThis.history?.replaceState(null,'',location.pathname+(location.search||''));
 return params.get('error_code')==='otp_expired'
  ?'邮件链接已失效或已使用。请重新发送所需的验证或重置邮件，并使用最新邮件中的链接。'
  :'邮件验证未完成。请重新发送所需的验证或重置邮件后再试。';
}
async function switchAccount(active){
 if(typeof resetWelcomeAccount==='function')resetWelcomeAccount();accountEpoch++;document.getElementById('wordEditor')?.remove?.();resetSharedLibraryAccount();answerBusy=false;stopActivityTracking();session=active;userProfile=null;isAdmin=false;words=[];progress={};COURSES={};courseRows=[];queue=[];current=null;currentCourse='';currentWeek=1;setSync(false);resetUploadAccount(active?.user.id||'');if(typeof resetMaterialsAccount==='function')resetMaterialsAccount(active?.user.id||'');
 document.getElementById('userNav').hidden=!active;
 const adminLink=document.getElementById('adminLink');if(adminLink)adminLink.hidden=true;
 const redirectError=consumeAuthRedirectError();
 if(redirectError){document.getElementById('userNav').hidden=true;showAuth('reset');authNotice(redirectError,true);return;}
 if(!active)return showAuth();
 const epoch=accountEpoch;app.innerHTML='<div class="empty">正在加载你的课程…</div>';
 try{
   const identity=await authClient.auth.getUser();if(epoch!==accountEpoch)return;
   if(identity.error||!identity.data?.user||identity.data.user.id!==active.user.id){
    const e=identity.error;if(e&&![401,403].includes(e.status)&&e.code!=='user_not_found')throw e;
    if(e?.code==='user_not_found')await purgeDeletedAccountCache(active.user.id);
    await authClient.auth.signOut({scope:'local'});if(epoch===accountEpoch)await switchAccount(null);return;
   }
   await loadAccountProfile();
   if(epoch!==accountEpoch)return;
   startActivityTracking();
   if(!userProfile||!userProfile.username)return showProfile(true);
   if(await loadCloud()){if(epoch===accountEpoch){resetUploadAccount(active.user.id);showHome();}}
   else throw new Error('暂时无法同步');
 }catch(e){if(epoch===accountEpoch)app.innerHTML='<div class="panel"><h2>暂时无法同步</h2><p>请检查网络后重试，课程、资料与词库仍保存在云端。</p><button class="primary" onclick="switchAccount(session)">重试</button><button class="linkbtn" onclick="logout()">退出</button></div>';}
}
function profileFields(data=null){return ` <label for="profileUsername">用户名</label><input id="profileUsername" name="username" oninput="this.removeAttribute('aria-invalid')" autocomplete="nickname" minlength="2" maxlength="40" required value="${esc(data?.username||'')}">
 <label for="profileSchool">学校</label><div class="schoolPicker"><input id="profileSchool" autocomplete="off" minlength="2" maxlength="120" required value="${esc(data?.school||'')}" placeholder="任何地区学校均可填写，支持中英文搜索" oninput="showSchoolSuggestions(this.value)" onfocus="showSchoolSuggestions(this.value)" onblur="setTimeout(hideSchoolSuggestions,180)"><div id="schoolSuggestions" class="suggestions" hidden></div></div>
 <label for="profileDegree">学历</label><select id="profileDegree" required onchange="showMajorSuggestions()"><option value="">请选择</option>${[['Bachelor','本科 · Bachelor'],['Master','硕士 · Master'],['Doctorate','博士 · Doctorate / PhD'],['Associate','专科 · Associate'],['Diploma','文凭 · Diploma'],['Other','其他 · Other']].map(([v,l])=>`<option value="${v}" ${data?.degree===v?'selected':''}>${l}</option>`).join('')}</select>
 <label for="profileMajor">专业</label><div class="schoolPicker"><input id="profileMajor" minlength="2" maxlength="120" required value="${esc(data?.major||'')}" placeholder="输入专业名，或选择下方推荐" oninput="showMajorSuggestions(this.value)" onfocus="showMajorSuggestions(this.value)"><div id="majorSuggestions" class="suggestions" hidden></div></div><p class="meta" id="majorHint">按学校和学历匹配已核对的专业；没有推荐时可自由填写。</p>

`;}
function readProfileFields(){const value=id=>document.getElementById(id).value.trim();return {username:value('profileUsername'),school:value('profileSchool')||'Not provided',major:value('profileMajor')||'Not provided',degree:value('profileDegree')||'Other'};}
function showProfile(required=false){
 document.body?.classList?.remove('assistantMode');
 if(!session)return showAuth();window._view={type:'profile',required:Boolean(required)};
 app.innerHTML=`<div class="sectionHead">${required?'':'<button class="back" onclick="showHome()">← 返回</button>'}<div><h1>${required?'欢迎使用奇点':'我的资料'}</h1><div class="meta">${required?'首次登录，请先完成个人资料。':'可随时更新用户名、学校和专业。'}</div></div></div>
 <section class="panel authPanel"><form onsubmit="saveProfile(event,${required})">
 ${required?registrationProfileFields():profileFields(userProfile)}
 <p class="meta">这些资料用于账号识别、可选词库匹配和试用分析，个人资料仅管理员可在后台查看。</p><button id="profileSubmit" class="primary">保存资料</button></form><div id="profileNotice" role="status" class="notice"></div></section>`;
}
function showSchoolSuggestions(query){
 const box=document.getElementById('schoolSuggestions');if(!box)return;
 const q=String(query||'').trim().toLowerCase();
 schoolSuggestionMatches=EDUCATION_SCHOOLS.filter(s=>!q||s.join(' ').toLowerCase().includes(q)).slice(0,8);
 box.innerHTML=schoolSuggestionMatches.map(([name,en],i)=>`<button type="button" class="suggestion" onclick="chooseSchoolSuggestion(${i})"><b>${esc(name)}</b><small>${esc(en)}</small></button>`).join('');
 box.hidden=!schoolSuggestionMatches.length;
}
function chooseSchoolSuggestion(index){const choice=schoolSuggestionMatches[index];if(!choice)return;const input=document.getElementById('profileSchool');input.value=/^[\x20-\x7e]+$/.test(input.value)?choice[1]:choice[0];hideSchoolSuggestions();showMajorSuggestions();}
let majorSuggestionMatches=[];
function showMajorSuggestions(query=''){const box=document.getElementById('majorSuggestions');if(!box)return;majorSuggestionMatches=recommendedProgrammes(document.getElementById('profileSchool').value,document.getElementById('profileDegree').value,query);box.innerHTML=majorSuggestionMatches.map((p,i)=>`<button type="button" class="suggestion" onclick="chooseMajorSuggestion(${i})"><b>${esc(p.zh)}</b><small>${esc(p.en)}</small></button>`).join('');box.hidden=!majorSuggestionMatches.length;}
function chooseMajorSuggestion(i){const p=majorSuggestionMatches[i];if(!p)return;const input=document.getElementById('profileMajor');input.value=input.value&&/^[\x20-\x7e]+$/.test(input.value)?p.en:p.zh;document.getElementById('majorSuggestions').hidden=true;}
function hideSchoolSuggestions(){const box=document.getElementById('schoolSuggestions');if(box)box.hidden=true;}
async function saveProfile(event,required=false){
 event.preventDefault();const button=document.getElementById('profileSubmit');button.disabled=true;
 const payload={...readProfileFields(),updated_at:new Date().toISOString()};
 try{
   if(userProfile)await sb('user_profiles?user_id=eq.'+session.user.id,{method:'PATCH',body:JSON.stringify(payload)});
   else await sb('user_profiles',{method:'POST',body:JSON.stringify({user_id:session.user.id,...payload})});
   userProfile={...userProfile,user_id:session.user.id,...payload,welcome_completed_at:userProfile?.welcome_completed_at||null};resetSharedLibraryAccount();
   if(required){app.innerHTML='<div class="empty">资料已保存，正在加载你的课程…</div>';if(await loadCloud()){resetUploadAccount(session.user.id);showHome();}else throw new Error('课程暂时无法同步');}
   else{showProfile(false);const n=document.getElementById('profileNotice');if(n)n.textContent='资料已保存';}
 }catch(e){const n=document.getElementById('profileNotice');if(n){n.textContent=e.message?.includes('duplicate')?'这个用户名已被使用，请换一个。':'保存失败：'+(e.message||'请稍后重试');n.className='notice danger'}}finally{if(button.isConnected)button.disabled=false;}
}
function showCourses(){
 document.body?.classList?.remove('assistantMode');
 if(!session)return showAuth();window._view={type:'courses'};
 app.innerHTML=`<div class="sectionHead"><button class="back" onclick="showHome()">← 返回</button><h1>自定义课程</h1></div><section class="panel"><p class="meta">按需添加课程，即可自定义课程数量。每门课支持 1–52 周；删除课程后可恢复，词汇与进度会保留。</p>
 <form onsubmit="createCourse(event)"><div class="row"><input id="courseName" aria-label="课程名称" placeholder="课程名称" maxlength="120" required><input id="courseCode" aria-label="课程简称" placeholder="课程简称（可选）" maxlength="40"><input id="courseWeeks" aria-label="周数" type="number" min="1" max="52" value="13" required></div><br><button class="primary">添加课程</button></form><div id="notice" class="notice" role="status"></div>
 <div class="list">${courseRows.map(c=>`<form class="item" onsubmit="updateCourse(event,'${c.id}')"><div>${c.archived?'<p class="meta">已删除 · 可恢复</p>':''}<label>课程名称<input name="name" value="${esc(c.name)}" maxlength="120" required></label><label>简称<input name="code" value="${esc(c.code)}" maxlength="40"></label><label>周数<input name="weeks" type="number" min="1" max="52" value="${c.weeks}" required></label></div><div><button class="secondary">保存</button><button class="linkbtn" type="button" onclick="archiveCourse('${c.id}',${!c.archived})">${c.archived?'恢复课程':'删除课程'}</button></div></form>`).join('')}</div>
 ${session.user.email?.toLowerCase()===LEGACY_EMAIL?'<hr><h3>个人数据迁移</h3><p class="meta">复制原来的课程与词库，保留原表。请在原来学习的浏览器完成迁移，以便导入其本地学习进度。重复执行不会重复复制词库。</p><button class="secondary" onclick="migrateLegacy()">复制我的旧词库与学习进度</button>':''}</section>`;
}
async function createCourse(event){event.preventDefault();try{await sb('user_courses',{method:'POST',body:JSON.stringify({name:document.getElementById('courseName').value.trim(),code:document.getElementById('courseCode').value.trim(),weeks:Number(document.getElementById('courseWeeks').value)})});await loadCloud();showCourses();notice('课程已添加')}catch(e){notice(e.message,true)}}
async function updateCourse(event,id){event.preventDefault();const data=new FormData(event.target);try{await sb('user_courses?id=eq.'+id,{method:'PATCH',body:JSON.stringify({name:String(data.get('name')).trim(),code:String(data.get('code')).trim(),weeks:Number(data.get('weeks'))})});await loadCloud();showCourses();notice('课程已保存')}catch(e){notice('保存失败：'+e.message,true)}}
async function archiveCourse(id,archived){if(archived&&!confirm("删除后将从首页移除这门课程。词汇和学习进度会保留，可随时恢复。确定删除吗？"))return;try{await sb('user_courses?id=eq.'+id,{method:'PATCH',body:JSON.stringify({archived})});await loadCloud();showCourses();notice(archived?'课程已删除，词汇和进度保留，可在此恢复':'课程已恢复')}catch(e){notice(e.message,true)}}
async function migrateLegacy(){
 try{
 const result=await sb('rpc/migrate_legacy_vocabulary',{method:'POST',body:'{}'});await loadCloud();
 // A separate marker prevents overwriting newer cloud progress on repeated migration.
 const marker='courselex-legacy-progress:'+session.user.id;
 if(!localStorage.getItem(marker)){
 const old=JSON.parse(localStorage.getItem('studyProgress')||'{}');
 for(const w of words){if(w.legacy_id&&w.status==='new'&&['known','unknown'].includes(old[w.legacy_id]))await sb('user_vocabulary?id=eq.'+w.id,{method:'PATCH',body:JSON.stringify({status:old[w.legacy_id]})});}
 localStorage.setItem(marker,'done');await loadCloud();
 }
 showCourses();notice(result.already_migrated?'词库此前已复制；已检查本地学习进度。':'旧词库与学习进度已复制，原始数据保留。');
 }catch(e){notice('迁移未完成，可安全重试：'+e.message,true)}
}
authClient.auth.onAuthStateChange((event,active)=>{
 if(event==='PASSWORD_RECOVERY'){recoveryMode=true;accountEpoch++;session=active;words=[];progress={};COURSES={};courseRows=[];queue=[];current=null;document.getElementById('wordEditor')?.remove?.();if(typeof resetMaterialsAccount==='function')resetMaterialsAccount('');resetUploadAccount('');document.getElementById('userNav').hidden=true;setTimeout(showPasswordReset,0);return;}
 if(recoveryMode&&event!=='SIGNED_OUT')return;
 if(event==='INITIAL_SESSION'||event==='SIGNED_OUT'||(event==='SIGNED_IN'&&active?.user.id!==session?.user.id))setTimeout(()=>switchAccount(active),0);
 else if(active)session=active;
});
app.innerHTML='<section class="assistantHero"><h1>正在打开你的学习空间…</h1></section>';

function registrationProfileFields(){const fields=profileFields();const start=fields.indexOf('<label for="profileSchool">');return fields.slice(0,start)+'<details class="optionalEducation"><summary>学校与专业（选填，可稍后补充）</summary>'+fields.slice(start).replaceAll(' required','')+'</details>'}

async function purgeDeletedAccountCache(uid){
 for(const storage of [localStorage,sessionStorage])try{for(const key of Object.keys(storage))if(key.startsWith('courselex-')&&key.includes(uid))storage.removeItem(key)}catch{}
 try{if(typeof indexedDB!=='undefined'){const db=await materialDB();await new Promise((resolve,reject)=>{const tx=db.transaction('batches','readwrite');tx.objectStore('batches').delete(uid);tx.oncomplete=resolve;tx.onerror=reject});db.close()}}catch{}
}
