import test from 'node:test';import assert from 'node:assert/strict';import {createHandler} from '../supabase/functions/courselex-user-import/core.js';
const course='20000000-0000-4000-8000-000000000001';
const env=n=>({SUPABASE_URL:'https://db.invalid',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_test"}',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}',UPLOAD_ACCESS_TOKEN:'test-upload-password-long',OPENAI_API_KEY:'test-ai'}[n]);
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
function handler({owner='user-a',hasCourse=true}={}){let jobs=[];const calls=[];const h=createHandler({env,fetch:async(url,opt={})=>{calls.push({url,opt});if(url.endsWith('/auth/v1/user'))return json({id:owner,email_confirmed_at:'2026-10-13'});if(url.includes('/user_courses?'))return json(hasCourse?[{weeks:20,archived:false}]:[]);if(url.includes('/user_upload_jobs')){if(opt.method==='POST'){jobs.push(JSON.parse(opt.body));return json(jobs)}if(url.includes('created_at=gte'))return json([]);return json(jobs)}throw new Error('unexpected fetch '+url)}});return {h,calls}}
const req=(data,auth=true)=>new Request('https://fn.invalid',{method:'POST',headers:{'content-type':'application/json','x-upload-token':'test-upload-password-long',...(auth?{authorization:'Bearer user-token'}:{})},body:JSON.stringify(data)});
test('unsigned requests denied before reading files or calling AI',async()=>{const {h,calls}=handler();const r=await h(req({action:'prepare',course,week:1,filename:'test.txt'},false));assert.equal(r.status,401);assert.equal(calls.length,0)});
test('foreign course denied before creating job or calling AI',async()=>{const {h,calls}=handler({hasCourse:false});assert.equal((await h(req({action:'prepare',course,week:1,filename:'test.txt'}))).status,403);assert.equal(calls.some(x=>x.opt.method==='POST'),false)});
test('custom week 20 accepted; signed task cannot be stolen by another account',async()=>{const a=handler();const r=await a.h(req({action:'prepare',course,week:20,filename:'test.txt'}));assert.equal(r.status,201);const job=(await r.json()).job;const b=handler({owner:'user-b'});assert.equal((await b.h(req({action:'poll',job}))).status,403);assert.equal(b.calls.length,1)});
test('week beyond course configuration rejected',async()=>{const {h}=handler();assert.equal((await h(req({action:'prepare',course,week:21,filename:'test.txt'}))).status,403)});
test('AI completion imports with the user bearer token, not the server key',async()=>{
 let saved,metadata,importHeader;
 const h=createHandler({env,fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return json({id:'user-a',email_confirmed_at:'2026-10-13'});
 if(url.includes('/user_courses?'))return json([{weeks:20,archived:false}]);
 if(url.includes('/user_upload_jobs')){
 if(opt.method==='POST'){saved=JSON.parse(opt.body);return json([saved]);}
 if(opt.method==='PATCH'){Object.assign(saved,JSON.parse(opt.body));return json([saved]);}
 return json(url.includes('created_at=gte')?[]:[saved]);}
 if(url.endsWith('/responses')){metadata=JSON.parse(opt.body).metadata;return json({id:'resp_test123'});}
 if(url.endsWith('/responses/resp_test123'))return json({status:'completed',metadata,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({complete:true,coverage_note:'read',warnings:[],terms:[{english:'privacy',chinese:'隐私',source:'slide 1',quote:'privacy'}]})}]}]});
 if(url.endsWith('/rpc/import_user_vocabulary')){importHeader=opt.headers.Authorization;assert.equal(JSON.parse(opt.body).p_course,course);return json({inserted:1,skipped:0});}
 throw new Error('unexpected fetch '+url);
 }});
 const prepared=await (await h(req({action:'prepare',course,week:20,filename:'test.txt'}))).json();
 const form=new FormData();form.append('file',new File(['privacy'], 'test.txt'));form.append('course',course);form.append('week','20');form.append('job',prepared.job);
 const uploaded=await h(new Request('https://fn.invalid',{method:'POST',headers:{authorization:'Bearer user-token','x-upload-token':'test-upload-password-long'},body:form}));assert.equal(uploaded.status,202);
 const result=await h(req({action:'poll',job:prepared.job}));assert.equal(result.status,200);assert.equal((await result.json()).inserted,1);assert.equal(importHeader,'Bearer user-token');
});
