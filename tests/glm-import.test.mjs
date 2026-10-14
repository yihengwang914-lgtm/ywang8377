import test from 'node:test';import assert from 'node:assert/strict';import {createHandler,validateTerms} from '../supabase/functions/courselex-glm-import/core.js';
const course='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001';
const env=n=>({GLM_API_KEY:'test',SUPABASE_URL:'https://db.invalid',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_test"}',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'}[n]);
const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
const request=(data,auth=true)=>new Request('https://fn.invalid',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer user-token'}:{})},body:JSON.stringify(data)});
function setup({owner='user-a',verified=true,courseOwned=true,aiResult}={}){let saved;let aiCalls=0,imports=0;const h=createHandler({env,fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return json({id:owner,email_confirmed_at:verified?'2026-10-14':null});
 if(url.includes('/user_courses?'))return json(courseOwned?[{weeks:13,archived:false}]:[]);
 if(url.includes('/user_courseware_jobs')){
 if(opt.method==='DELETE')return json([]);
 if(opt.method==='POST'){saved={id,status:'ready',cursor:0,terms:[],...JSON.parse(opt.body)};return json([saved])}
 if(opt.method==='PATCH'){Object.assign(saved,JSON.parse(opt.body));return json([saved])}
 return json(saved&&saved.user_id===owner?[saved]:[]);
 }
 if(url.endsWith('/rpc/acquire_material_ai')||url.endsWith('/rpc/release_material_ai'))return json(true);
 if(url.includes('open.bigmodel.cn')){aiCalls++;const body=JSON.parse(opt.body);assert.equal(body.model,'glm-4.7-flash');return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(aiResult||{complete:true,terms:[{english:'privacy',chinese:'隐私',quote:'privacy'}]})}}]})}
 if(url.endsWith('/rpc/import_user_vocabulary')){imports++;assert.equal(opt.headers.Authorization,'Bearer user-token');return json({inserted:1,skipped:0})}
 throw Error('unexpected '+url)
 }});return {h,get saved(){return saved},get aiCalls(){return aiCalls},get imports(){return imports}}}
const prepare={action:'prepare',course,week:1,filename:'lecture.txt',parts:['privacy is a specialist concept']};
test('anonymous and unverified users cannot call free AI',async()=>{const a=setup();assert.equal((await a.h(request(prepare,false))).status,401);const b=setup({verified:false});assert.equal((await b.h(request(prepare))).status,401);assert.equal(a.aiCalls+b.aiCalls,0)});
test('foreign courses blocked before storing source or calling AI',async()=>{const a=setup({courseOwned:false});assert.equal((await a.h(request(prepare))).status,403);assert.equal(a.saved,undefined);assert.equal(a.aiCalls,0)});
test('whole document imported only after all parts; repeat poll is idempotent',async()=>{const a=setup();assert.equal((await a.h(request({...prepare,parts:[...prepare.parts,...prepare.parts]}))).status,201);assert.equal((await a.h(request({action:'next',job:id}))).status,200);assert.equal(a.imports,0);await a.h(request({action:'next',job:id}));assert.equal(a.imports,0);const result=await (await a.h(request({action:'next',job:id}))).json();assert.equal(result.extracted,1);assert.equal(a.imports,1);await a.h(request({action:'next',job:id}));assert.equal(a.imports,1);assert.equal(a.aiCalls,2);assert.deepEqual(a.saved.parts,['已清理'])});
test('invalid AI source quotes fail without importing any words',async()=>{const a=setup({aiResult:{complete:true,terms:[{english:'privacy',chinese:'隐私',quote:'not in the lecture'}]}});await a.h(request(prepare));assert.equal((await a.h(request({action:'next',job:id}))).status,422);assert.equal(a.saved.status,'failed');assert.equal(a.imports,0)});
test('excessive source payloads are rejected before storage',async()=>{const a=setup();assert.equal((await a.h(request({...prepare,parts:['x'.repeat(6001)]}))).status,400);assert.equal(a.saved,undefined)});
test('source checker rejects incomplete outputs',()=>assert.throws(()=>validateTerms({complete:false,terms:[]},'privacy')));
test('dense output is split automatically without importing partial terms',async()=>{const a=setup({aiResult:{complete:false,terms:[]}});await a.h(request({...prepare,parts:['privacy '.repeat(400)]}));const result=await (await a.h(request({action:'next',job:id}))).json();assert.equal(result.status,'processing');assert.equal(result.total,2);assert.equal(a.saved.parts.length,2);assert.equal(a.saved.status,'ready');assert.equal(a.imports,0)});
