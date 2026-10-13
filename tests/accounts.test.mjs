import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const inline=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').split('<script>')[1].split('</script>')[0];
function page(){
 const elements=new Map();const storage=new Map();let callback;let active={user:{id:'user-a',email:'a@example.invalid'},access_token:'token-a'};
 const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:false,className:'',isConnected:true,value:'',disabled:false});return elements.get(id)};
 const responses={courses:[{id:'20000000-0000-4000-8000-000000000001',name:'课程 <script>',code:"A'",weeks:20,archived:false}],words:[{id:1,course:'20000000-0000-4000-8000-000000000001',week:20,en:"student's rights",zh:"学生's 权利",status:'new'}]};
 const calls=[];const c=vm.createContext({console,URL,AbortController,AbortSignal,FormData,location:{origin:'https://yihengwang914-lgtm.github.io',pathname:'/ywang8377/'},document:{getElementById:el},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>{},alert:()=>{},confirm:()=>true,supabase:{createClient:()=>({auth:{onAuthStateChange:cb=>callback=cb,getSession:async()=>({data:{session:active}}),signOut:async()=>({error:null})}})},fetch:async(url,options)=>{calls.push({url,options});let result=url.includes('user_courses')?responses.courses:responses.words;return {ok:true,text:async()=>JSON.stringify(result)}}});
 c.window=c;
 for(const script of [inline,fs.readFileSync(new URL('../upload.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../accounts.js',import.meta.url),'utf8')])vm.runInContext(script,c);
 return {c,el,calls,responses,setActive:v=>active=v};
}
test('cloud progress, dynamic weeks, escaped course names, logout clears account',async()=>{
 const p=page();await vm.runInContext("switchAccount({user:{id:'user-a',email:'a@example.invalid'},access_token:'token-a'})",p.c);
 assert.match(p.el('app').innerHTML,/课程 &lt;script&gt;/);assert.equal(p.el('userNav').hidden,false);
 vm.runInContext("showWeeks(currentCourse)",p.c);assert.equal((p.el('app').innerHTML.match(/class="week"/g)||[]).length,20);
 vm.runInContext("current=words[0]",p.c);await vm.runInContext("recordAnswer('known')",p.c);
 const patch=p.calls.find(x=>x.options.method==='PATCH');assert.equal(patch.options.headers.Authorization,'Bearer token-a');assert.equal(JSON.parse(patch.options.body).status,'known');
 await vm.runInContext('switchAccount(null)',p.c);assert.equal(vm.runInContext('words.length',p.c),0);assert.equal(vm.runInContext('Object.keys(progress).length',p.c),0);assert.equal(p.el('userNav').hidden,true);assert.match(p.el('app').innerHTML,/登录 CourseLex/);
});
test('choice text is data, not inline executable arguments',()=>{const p=page();vm.runInContext(`session={user:{id:'a'}};words=[{id:1,en:'term',zh:"中文's"},{id:2,zh:'甲'},{id:3,zh:'乙'},{id:4,zh:'丙'}];queue=[words[0]];qIndex=0;showQuestion()`,p.c);assert.match(p.el('app').innerHTML,/answerChoiceIndex\(/);assert.doesNotMatch(p.el('app').innerHTML,/answerChoice\(/)});
