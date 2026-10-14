const LEGACY_EMAIL='ywang8377-c@my.cityu.edu.hk';
const returnUrl=location.hostname==='www.courselexai.com'||location.hostname==='courselexai.com'?'https://www.courselexai.com/':'https://yihengwang914-lgtm.github.io/ywang8377/';
let recoveryMode=false;
let userProfile=null,isAdmin=false,activityTimer=null,activitySession='';
const SCHOOL_OPTIONS=[
 ['香港城市大学','City University of Hong Kong · CityUHK · 城大'],['香港大学','The University of Hong Kong · HKU · 港大'],['香港中文大学','The Chinese University of Hong Kong · CUHK · 中大'],['香港科技大学','The Hong Kong University of Science and Technology · HKUST · 科大'],['香港理工大学','The Hong Kong Polytechnic University · PolyU · 理大'],['香港浸会大学','Hong Kong Baptist University · HKBU · 浸大'],['岭南大学','Lingnan University · LU'],['香港教育大学','The Education University of Hong Kong · EdUHK · 教大'],['香港都会大学','Hong Kong Metropolitan University · HKMU · 都大'],['香港恒生大学','The Hang Seng University of Hong Kong · HSUHK'],['香港树仁大学','Hong Kong Shue Yan University · HKSYU'],['香港珠海学院','Hong Kong Chu Hai College · HKCHC'],['香港演艺学院','The Hong Kong Academy for Performing Arts · HKAPA'],['香港高等教育科技学院','Technological and Higher Education Institute of Hong Kong · THEi']
];
let schoolSuggestionMatches=[];
function authNotice(text,bad=false){const el=document.getElementById('authNotice');if(el){el.textContent=text;el.className='notice'+(bad?' danger':'')}}
function showAuth(mode='login'){
 document.getElementById('userNav').hidden=true;window._view={type:'auth'};
 const signup=mode==='signup',reset=mode==='reset';
 app.innerHTML=`<section class="hero"><h1>把专业词汇<br>真正记下来。</h1><p>CourseLex AI · 每个人独立的课程、词库与学习进度。</p></section><section class="panel authPanel"><h2>${signup?'邮箱注册':reset?'重置密码':'登录 CourseLex AI'}</h2><form onsubmit="submitAuth(event,'${mode}')">
 <label for="authEmail">邮箱</label><input id="authEmail" type="email" autocomplete="email" required maxlength="254">
 ${reset?'':`<label for="authPassword">密码</label><input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="8" required>`}
 ${signup?'<p class="meta">密码至少 8 位。填写以下资料后注册，请先验证邮箱。</p>'+profileFields():''}<br><br><button id="authSubmit" class="primary">${signup?'注册':reset?'发送重置邮件':'登录'}</button></form>
 <div id="authNotice" role="status" class="notice"></div><div class="uploadActions"><button class="linkbtn" onclick="showAuth('${signup||reset?'login':'signup'}')">${signup||reset?'返回登录':'创建账号'}</button>${!signup&&!reset?'<button class="linkbtn" onclick="showAuth(\'reset\')">忘记密码</button>':''}</div></section>`;
}
async function submitAuth(event,mode){
 event.preventDefault();const button=document.getElementById('authSubmit');button.disabled=true;
 const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword')?.value;
 try{
 let result;
 if(mode==='signup')result=await authClient.auth.signUp({email,password,options:{emailRedirectTo:returnUrl,data:{courselex_profile:readProfileFields()}} });
 else if(mode==='reset')result=await authClient.auth.resetPasswordForEmail(email,{redirectTo:returnUrl});
 else result=await authClient.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;
 if(mode==='signup')authNotice('请查收邮箱验证邮件，验证后回来登录。若已有账号，请直接登录。');
 if(mode==='reset')authNotice('若该邮箱已注册，重置邮件将发送至你的邮箱。');
 }catch(e){authNotice(e.message||'暂时无法连接，请稍后重试',true)}finally{if(button.isConnected)button.disabled=false;}
}
function showPasswordReset(){
 app.innerHTML='<section class="panel authPanel"><h2>设置新密码</h2><form onsubmit="updatePassword(event)"><label for="newPassword">新密码</label><input id="newPassword" type="password" autocomplete="new-password" minlength="8" required><br><br><button class="primary">保存新密码</button></form><div id="authNotice" class="notice" role="status"></div></section>';
}
async function updatePassword(event){event.preventDefault();const {error}=await authClient.auth.updateUser({password:document.getElementById('newPassword').value});if(error)return authNotice(error.message,true);recoveryMode=false;await switchAccount(session);}
async function logout(){
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
async function switchAccount(active){
 accountEpoch++;answerBusy=false;stopActivityTracking();session=active;userProfile=null;isAdmin=false;words=[];progress={};COURSES={};courseRows=[];queue=[];current=null;currentCourse='';currentWeek=1;setSync(false);resetUploadAccount(active?.user.id||'');
 document.getElementById('userNav').hidden=!active;
 const adminLink=document.getElementById('adminLink');if(adminLink)adminLink.hidden=true;
 if(!active)return showAuth();
 const epoch=accountEpoch;app.innerHTML='<div class="empty">正在加载你的课程…</div>';
 try{
   await loadAccountProfile();
   if(epoch!==accountEpoch)return;
   startActivityTracking();
   if(!userProfile||!userProfile.degree||!userProfile.school_en||!userProfile.major_en||!userProfile.username_en)return showProfile(true);
   if(await loadCloud()){if(epoch===accountEpoch){resetUploadAccount(active.user.id);showHome();}}
   else throw new Error('暂时无法同步');
 }catch(e){if(epoch===accountEpoch)app.innerHTML='<div class="panel"><h2>暂时无法同步</h2><p>请检查网络后重试，课程、资料与词库仍保存在云端。</p><button class="primary" onclick="switchAccount(session)">重试</button><button class="linkbtn" onclick="logout()">退出</button></div>';}
}
function profileFields(data=null){return ` <label for="profileUsername">用户名</label><input id="profileUsername" autocomplete="nickname" minlength="2" maxlength="40" required value="${esc(data?.username||'')}" placeholder="例如：Even Wang">
 <label for="profileSchool">学校 / 联合学院</label><div class="schoolPicker"><input id="profileSchool" autocomplete="off" minlength="2" maxlength="120" required value="${esc(data?.school||'')}" placeholder="任何地区学校均可填写，支持中英文搜索" oninput="showSchoolSuggestions(this.value);updateEducationEnglish()" onfocus="showSchoolSuggestions(this.value)" onblur="setTimeout(hideSchoolSuggestions,180)"><div id="schoolSuggestions" class="suggestions" hidden></div></div>
 <label for="profileDegree">学历</label><select id="profileDegree" required onchange="updateEducationEnglish();showMajorSuggestions()"><option value="">请选择</option>${[['Bachelor','本科 · Bachelor'],['Master','硕士 · Master'],['Doctorate','博士 · Doctorate / PhD'],['Associate','专科 · Associate'],['Diploma','文凭 · Diploma'],['Other','其他 · Other']].map(([v,l])=>`<option value="${v}" ${data?.degree===v?'selected':''}>${l}</option>`).join('')}</select>
 <label for="profileMajor">专业</label><div class="schoolPicker"><input id="profileMajor" minlength="2" maxlength="120" required value="${esc(data?.major||'')}" placeholder="输入专业名，或选择下方推荐" oninput="showMajorSuggestions(this.value);updateEducationEnglish()" onfocus="showMajorSuggestions(this.value)"><div id="majorSuggestions" class="suggestions" hidden></div></div><p class="meta" id="majorHint">按学校和学历匹配已核对的专业；没有推荐时可自由填写。</p>
 <div class="englishFields"><p class="meta">后台统一使用英文。已识别的名称会自动填写，其他名称请补充学校官方英文名及专业英文名。</p><label for="profileNameEn">英文用户名 / 拼音</label><input id="profileNameEn" maxlength="80" required pattern="[ -~]+" value="${esc(data?.username_en||(/^[ -~]+$/.test(data?.username||'')?data.username:''))}" placeholder="例如：Even Wang"><label for="profileSchoolEn">学校英文名</label><input id="profileSchoolEn" maxlength="200" required pattern="[ -~]+" value="${esc(data?.school_en||'')}"><label for="profileMajorEn">专业英文名</label><input id="profileMajorEn" maxlength="200" required pattern="[ -~]+" value="${esc(data?.major_en||'')}"></div>
`;}
function readProfileFields(){const value=id=>document.getElementById(id).value.trim();return {username:value('profileUsername'),school:value('profileSchool'),major:value('profileMajor'),degree:value('profileDegree'),username_en:value('profileNameEn'),school_en:value('profileSchoolEn'),major_en:value('profileMajorEn')};}
function showProfile(required=false){
 if(!session)return showAuth();window._view={type:'profile',required:Boolean(required)};
 app.innerHTML=`<div class="sectionHead">${required?'':'<button class="back" onclick="showHome()">← 返回</button>'}<div><h1>${required?'欢迎使用 CourseLex AI':'我的资料'}</h1><div class="meta">${required?'首次登录，请先完成个人资料。':'可随时更新用户名、学校和专业。'}</div></div></div>
 <section class="panel authPanel"><form onsubmit="saveProfile(event,${required})">
 ${profileFields(userProfile)}
 <p class="meta">这些资料用于账号识别和试用数据分析，仅管理员可在后台查看。</p><button id="profileSubmit" class="primary">保存资料</button></form><div id="profileNotice" role="status" class="notice"></div></section>`;
}
function showSchoolSuggestions(query){
 const box=document.getElementById('schoolSuggestions');if(!box)return;
 const q=String(query||'').trim().toLowerCase();
 schoolSuggestionMatches=EDUCATION_SCHOOLS.filter(s=>!q||s.join(' ').toLowerCase().includes(q)).slice(0,8);
 box.innerHTML=schoolSuggestionMatches.map(([name,en],i)=>`<button type="button" class="suggestion" onclick="chooseSchoolSuggestion(${i})"><b>${esc(name)}</b><small>${esc(en)}</small></button>`).join('');
 box.hidden=!schoolSuggestionMatches.length;
}
function chooseSchoolSuggestion(index){const choice=schoolSuggestionMatches[index];if(!choice)return;document.getElementById('profileSchool').value=choice[0];hideSchoolSuggestions();updateEducationEnglish();showMajorSuggestions();}
let majorSuggestionMatches=[];
function showMajorSuggestions(query=''){const box=document.getElementById('majorSuggestions');if(!box)return;majorSuggestionMatches=recommendedProgrammes(document.getElementById('profileSchool').value,document.getElementById('profileDegree').value,query);box.innerHTML=majorSuggestionMatches.map((p,i)=>`<button type="button" class="suggestion" onclick="chooseMajorSuggestion(${i})"><b>${esc(p.zh)}</b><small>${esc(p.en)}</small></button>`).join('');box.hidden=!majorSuggestionMatches.length;}
function chooseMajorSuggestion(i){const p=majorSuggestionMatches[i];if(!p)return;document.getElementById('profileMajor').value=p.zh;document.getElementById('profileMajorEn').value=p.en;document.getElementById('majorSuggestions').hidden=true;}
function updateEducationEnglish(){const school=document.getElementById('profileSchool').value,major=document.getElementById('profileMajor').value,degree=document.getElementById('profileDegree').value;document.getElementById('profileSchoolEn').value=englishSchool(school);document.getElementById('profileMajorEn').value=englishMajor(major,school,degree);}
function hideSchoolSuggestions(){const box=document.getElementById('schoolSuggestions');if(box)box.hidden=true;}
async function saveProfile(event,required=false){
 event.preventDefault();const button=document.getElementById('profileSubmit');button.disabled=true;
 const payload={user_id:session.user.id,...readProfileFields(),updated_at:new Date().toISOString()};
 try{
   if(userProfile)await sb('user_profiles?user_id=eq.'+session.user.id,{method:'PATCH',body:JSON.stringify(payload)});
   else await sb('user_profiles',{method:'POST',body:JSON.stringify(payload)});
   userProfile=payload;
   if(required){app.innerHTML='<div class="empty">资料已保存，正在加载你的课程…</div>';if(await loadCloud()){resetUploadAccount(session.user.id);showHome();}else throw new Error('课程暂时无法同步');}
   else{showProfile(false);const n=document.getElementById('profileNotice');if(n)n.textContent='资料已保存';}
 }catch(e){const n=document.getElementById('profileNotice');if(n){n.textContent=e.message?.includes('duplicate')?'这个用户名已被使用，请换一个。':'保存失败：'+(e.message||'请稍后重试');n.className='notice danger'}}finally{if(button.isConnected)button.disabled=false;}
}
function showCourses(){
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
 if(event==='PASSWORD_RECOVERY'){recoveryMode=true;accountEpoch++;session=active;words=[];progress={};COURSES={};courseRows=[];queue=[];current=null;resetUploadAccount('');document.getElementById('userNav').hidden=true;setTimeout(showPasswordReset,0);return;}
 if(recoveryMode&&event!=='SIGNED_OUT')return;
 if(event==='INITIAL_SESSION'||event==='SIGNED_OUT'||(event==='SIGNED_IN'&&active?.user.id!==session?.user.id))setTimeout(()=>switchAccount(active),0);
 else if(active)session=active;
});
showAuth();
