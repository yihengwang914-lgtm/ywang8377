const LEGACY_EMAIL='ywang8377-c@my.cityu.edu.hk';
const returnUrl='https://yihengwang914-lgtm.github.io/ywang8377/';
let recoveryMode=false;
function authNotice(text,bad=false){const el=document.getElementById('authNotice');if(el){el.textContent=text;el.className='notice'+(bad?' danger':'')}}
function showAuth(mode='login'){
 document.getElementById('userNav').hidden=true;window._view={type:'auth'};
 const signup=mode==='signup',reset=mode==='reset';
 app.innerHTML=`<section class="hero"><h1>把专业词汇<br>真正记下来。</h1><p>CourseLex AI · 每个人独立的课程、词库与学习进度。</p></section><section class="panel authPanel"><h2>${signup?'邮箱注册':reset?'重置密码':'登录 CourseLex AI'}</h2><form onsubmit="submitAuth(event,'${mode}')">
 <label for="authEmail">邮箱</label><input id="authEmail" type="email" autocomplete="email" required maxlength="254">
 ${reset?'':`<label for="authPassword">密码</label><input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="8" required>`}
 ${signup?'<p class="meta">密码至少 8 位。注册后请先验证邮箱。</p>':''}<br><br><button id="authSubmit" class="primary">${signup?'注册':reset?'发送重置邮件':'登录'}</button></form>
 <div id="authNotice" role="status" class="notice"></div><div class="uploadActions"><button class="linkbtn" onclick="showAuth('${signup||reset?'login':'signup'}')">${signup||reset?'返回登录':'创建账号'}</button>${!signup&&!reset?'<button class="linkbtn" onclick="showAuth(\'reset\')">忘记密码</button>':''}</div></section>`;
}
async function submitAuth(event,mode){
 event.preventDefault();const button=document.getElementById('authSubmit');button.disabled=true;
 const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword')?.value;
 try{
 let result;
 if(mode==='signup')result=await authClient.auth.signUp({email,password,options:{emailRedirectTo:returnUrl}});
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
async function switchAccount(active){
 accountEpoch++;answerBusy=false;session=active;words=[];progress={};COURSES={};courseRows=[];queue=[];current=null;currentCourse='';currentWeek=1;setSync(false);resetUploadAccount(active?.user.id||'');
 document.getElementById('userNav').hidden=!active;
 if(!active)return showAuth();
 const epoch=accountEpoch;app.innerHTML='<div class="empty">正在加载你的课程…</div>';
 if(await loadCloud()){if(epoch===accountEpoch){resetUploadAccount(active.user.id);showHome();}}else if(epoch===accountEpoch){app.innerHTML='<div class="panel"><h2>暂时无法同步</h2><p>请检查网络后重试，课程与词库仍保存在云端。</p><button class="primary" onclick="switchAccount(session)">重试</button><button class="linkbtn" onclick="logout()">退出</button></div>';}
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
