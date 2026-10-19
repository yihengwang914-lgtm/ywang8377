const SUPABASE_URL='https://lgluwowzuwsabedbyblr.supabase.co';
const SUPABASE_KEY='sb_publishable_04dsccL9acJYdCafv99nYg_yRgMaQdB';
const adminClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'courselex-auth-v2'}});
const adminApp=document.getElementById('adminApp');
let dashboard=null;
function escAdmin(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateTime(value){if(!value)return '暂无';return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function duration(seconds){seconds=Number(seconds)||0;if(seconds<60)return seconds+' 秒';const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60);return h?h+' 小时 '+m+' 分钟':m+' 分钟'}
async function adminRpc(name){
 const {data:{session},error}=await adminClient.auth.getSession();
 if(error||!session)throw new Error('请先在 SINQ 学习网站登录管理员账号。');
 const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});
 if(!response.ok){let detail;try{detail=await response.json()}catch{}throw new Error(response.status===401||response.status===403?'当前账号没有管理员权限。':detail?.message||'后台数据加载失败');}
 return response.json();
}
function bytes(value){const n=Number(value)||0;return n>=1073741824?(n/1073741824).toFixed(1)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB'}
function renderDashboard(){
 const s=dashboard.summary,u=dashboard.users||[],c=dashboard.capacity||{};const storagePercent=Math.min(100,Number(c.database_bytes||0)/Number(c.free_database_limit_bytes||1)*100);
 adminApp.innerHTML=`<section class="hero"><div><h1>试用数据</h1><div class="muted">更新于 ${dateTime(dashboard.generated_at)}</div></div><button class="button primary" onclick="refreshDashboard()">刷新数据</button></section>
 <section class="cards"><div class="card"><strong>${s.registered_users}</strong><span>注册用户</span></div><div class="card"><strong>${s.completed_profiles}</strong><span>已完善资料</span></div><div class="card"><strong>${s.active_7d}</strong><span>近 7 天活跃</span></div><div class="card"><strong>${s.active_30d}</strong><span>近 30 天活跃</span></div><div class="card"><strong>${duration(s.total_active_seconds)}</strong><span>累计前台使用</span></div><div class="card"><strong>${s.total_visits}</strong><span>访问次数</span></div></section>
 <section class="capacity"><div class="panel"><h2>免费容量</h2><div><b>${bytes(c.database_bytes)}</b> / ${bytes(c.free_database_limit_bytes)} 数据库空间</div><div class="meter"><span style="width:${storagePercent.toFixed(2)}%"></span></div><div class="muted">当前使用 ${storagePercent.toFixed(2)}%</div></div><div class="panel"><h2>建议试用规模</h2><p><b>先邀请 20–30 名学生</b></p><p class="muted">AI 学习版会保存课件文字、对话、题目和笔记。先观察每人的实际占用、流量及模型费用，再扩大试用；人数建议不代表并发保证。</p></div></section>
 <section class="panel"><div class="toolbar"><div><b>用户明细</b> <span class="muted">共 ${u.length} 人</span></div><input id="userSearch" type="search" placeholder="搜索用户名、邮箱、学校或专业" oninput="filterUsers(this.value)"></div><div class="tableWrap"><table><thead><tr><th>用户</th><th>学校 / 专业</th><th>注册时间</th><th>最近登录</th><th>最近使用</th><th>累计使用</th><th>访问</th><th>课程 / 词汇 / 熟词</th></tr></thead><tbody id="userRows"></tbody></table></div><p class="privacy">使用时长按页面处于前台时的心跳估算，从本功能上线后开始累计。后台数据仅管理员账号可读取。</p></section>`;
 renderRows(u);
}
function renderRows(users){
 const body=document.getElementById('userRows');
 body.innerHTML=users.length?users.map(x=>`<tr><td><div class="name">${escAdmin(x.username||'Pending English profile')}</div><div class="email">${escAdmin(x.email)}</div></td><td>${escAdmin(x.school||'Not provided')}<div class="email">${escAdmin(x.degree||'Not provided')} · ${escAdmin(x.major||'Not provided')}</div>${x.english_review?'<div class="email">Auto-transliterated · needs review</div>':''}</td><td>${dateTime(x.registered_at)}</td><td>${dateTime(x.last_sign_in_at)}</td><td>${dateTime(x.last_seen_at)}</td><td><span class="pill">${duration(x.active_seconds)}</span><div class="email">${x.active_days} 个活跃日</div></td><td>${x.visit_count} 次</td><td>${x.course_count} / ${x.word_count} / ${x.known_count}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">暂无匹配用户</td></tr>';
}
function filterUsers(query){const q=query.trim().toLowerCase();renderRows((dashboard.users||[]).filter(x=>[x.username,x.email,x.school,x.major].some(v=>String(v||'').toLowerCase().includes(q))))}
async function refreshDashboard(){adminApp.innerHTML='<div class="empty">正在加载后台数据…</div>';try{const [main,capacity]=await Promise.all([adminRpc('get_courselex_admin_dashboard_v2'),adminRpc('get_courselex_capacity')]);dashboard={...main,capacity};document.getElementById('logoutButton').hidden=false;renderDashboard()}catch(e){adminApp.innerHTML=`<section class="panel"><h1>无法打开管理后台</h1><p class="danger">${escAdmin(e.message)}</p><a class="button primary" href="index.html">前往学习网站登录</a></section>`}}
document.getElementById('logoutButton').onclick=async()=>{await adminClient.auth.signOut();location.href='index.html'};
refreshDashboard();
