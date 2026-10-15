import test from 'node:test';import assert from 'node:assert/strict';import {createAssistant,materialCourseCode} from '../supabase/functions/courselex-glm-import/assistant.js';
const id='40000000-0000-4000-8000-000000000001',uid='10000000-0000-4000-8000-000000000001',course='20000000-0000-4000-8000-000000000001';
const env=n=>({GLM_API_KEY:'fixture',SUPABASE_URL:'https://db.invalid',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_test"}',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'}[n]);
const json=data=>new Response(JSON.stringify(data));
function app({verified=true,foreign=false}={}){let batch={id,user_id:uid,manifest:[{name:'COM100/Week 2.pdf',size:10}],ocr_calls:0};const calls=[];const handler=createAssistant({env,base:async()=>json({base:true}),fetch:async(url,opt={})=>{calls.push({url,opt});if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:verified?'2026-10-14':null});if(url.includes('/user_material_batches')){if(opt.method==='POST'){Object.assign(batch,JSON.parse(opt.body));return json([batch])}if(opt.method==='PATCH'){Object.assign(batch,JSON.parse(opt.body));return json([batch])}return json(foreign?[]:[batch])}if(url.includes('/rpc/'))return json(true);if(url.includes('/user_courses')){if(opt.method==='POST'){assert.equal(opt.headers.Authorization,'Bearer fixture');return json([{id:course,...JSON.parse(opt.body)}])}return json([])}if(url.includes('open.bigmodel.cn')){const body=JSON.parse(opt.body);assert.equal(body.model,'glm-4.7-flash');return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({files:[{index:0,course:'COM100',week:3}]})}}]})}throw Error('Unexpected fetch '+url)}});return {handler,calls,get batch(){return batch}}}
const req=(body,auth=true)=>new Request('https://fn.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify(body)});
test('batch start verifies login and confirmed email before storing a manifest',async()=>{const a=app();assert.equal((await a.handler(req({action:'start',files:[{name:'week1.pdf',size:10}]},false))).status,401);const b=app({verified:false});assert.equal((await b.handler(req({action:'start',files:[{name:'week1.pdf',size:10}]}))).status,401);assert.equal(b.calls.some(c=>c.opt.method==='POST'),false)});
test('a batch allows many files in one start, and caps oversized collections',async()=>{const a=app();assert.equal((await a.handler(req({action:'start',files:Array.from({length:13},(_,i)=>({name:'Week '+i+'.pdf',size:10}))}))).status,200);assert.equal(a.batch.manifest.length,13);assert.equal((await a.handler(req({action:'start',files:Array.from({length:61},()=>({name:'file.pdf',size:10}))}))).status,400)});
test('foreign batch cannot be organized or sent to AI',async()=>{const a=app({foreign:true});assert.equal((await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'lecture'}]}))).status,404);assert.equal(a.calls.some(c=>c.url.includes('open.bigmodel.cn')),false)});
test('explicit filename week wins over AI guess; course writes use user credentials',async()=>{const a=app();const result=await (await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'COM100 Communication'}]}))).json();assert.equal(result.plan[0].week,2);assert.equal(result.plan[0].course,course);const repeated=await a.handler(req({action:'organize',batch:id,files:[]}));assert.equal(repeated.status,200);assert.equal(a.calls.filter(c=>c.url.includes('open.bigmodel.cn')).length,1)});

test('course codes are read from metadata while camera and week numbering stay out',()=>{assert.equal(materialCourseCode('Week001/COM 5103 lecture'),'COM5103');assert.equal(materialCourseCode('IMG_1234 CS100 Computer Science'),'CS100');assert.equal(materialCourseCode('Week 1 introduction'),'')});

test('Canvas underscore names retain course identity',()=>assert.equal(materialCourseCode('2026_COM5103_Week03.pdf'),'COM5103'));

test('failed OCR releases reserved image count and permanent account limits do not retry',async()=>{
 let calls=0,count=0;
 for(const [code,retryable] of [['1302',true],['1113',false]]){
 const handler=createAssistant({env,base:async()=>json({}),fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'2026-10-14'});
 if(url.includes('/user_material_batches')){if(opt.method==='PATCH'){count=JSON.parse(opt.body).ocr_calls;return json([{id,ocr_calls:count}])}return json([{id,user_id:uid,manifest:[{name:'scan.pdf',size:10}],ocr_calls:count}])}
 if(url.includes('/rpc/'))return json(true);
 if(url.includes('open.bigmodel.cn')){calls++;return new Response(JSON.stringify({error:{code,message:'provider detail'}}),{status:429})}
 throw Error(url)
 }});
 const r=await handler(req({action:'ocr',batch:id,file:0,image:'data:image/jpeg;base64,AAAA'}));
 const body=await r.json();assert.equal(body.retryable,retryable);assert.ok(body.error.includes(code));assert.equal(count,0);
 }assert.equal(calls,2)
});
