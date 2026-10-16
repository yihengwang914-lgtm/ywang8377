import test from 'node:test';import assert from 'node:assert/strict';import {createAssistant,materialCourseCode,classifyMaterialKind,materialWeek} from '../supabase/functions/courselex-glm-import/assistant.js';
const id='40000000-0000-4000-8000-000000000001',uid='10000000-0000-4000-8000-000000000001',course='20000000-0000-4000-8000-000000000001';
const env=n=>({GLM_API_KEY:'fixture',SUPABASE_URL:'https://db.invalid',SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_test"}',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'}[n]);
const json=data=>new Response(JSON.stringify(data));
function app({verified=true,foreign=false,newer=false,modelFiles=null,manifest=[{name:'COM100/Week 2.pdf',size:10}]}={}){
 let batch={id,user_id:uid,manifest,ocr_calls:0,created_at:'2026-10-14T00:00:00Z'};const calls=[];
 const handler=createAssistant({env,base:async()=>json({base:true}),fetch:async(url,opt={})=>{
  calls.push({url,opt});if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:verified?'2026-10-14':null});
  if(url.includes('/user_material_batches')){if(opt.method==='POST'){Object.assign(batch,JSON.parse(opt.body));return json([batch])}if(opt.method==='PATCH'){Object.assign(batch,JSON.parse(opt.body));return json([batch])}if(url.includes('created_at=gt.'))return json(newer?[{id:'50000000-0000-4000-8000-000000000001'}]:[]);return json(foreign?[]:[batch])}
  if(url.includes('/rpc/'))return json(true);if(url.includes('/user_courses')){if(opt.method==='POST'){assert.equal(opt.headers.Authorization,'Bearer fixture');return json([{id:course,...JSON.parse(opt.body)}])}return json([{id:course,name:'Communication',code:'COM100',weeks:13,archived:false,is_shared_template:false}])}if(url.includes('/user_vocabulary'))return json([{course_id:course,week:2,english:'privacy',chinese:'隐私',status:'unknown',seen_count:2,wrong_count:1}]);if(url.includes('open.bigmodel.cn')){const body=JSON.parse(opt.body);assert.equal(body.model,'glm-4.7-flash');const chatting=body.messages[0]?.content?.includes('conversational AI study assistant');return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(chatting?{reply:'可以，我们先选课程。',action:{type:'quick_filter',course:'',week:0,count:20,unknown_only:false}}:{files:modelFiles||[{index:0,course:'COM100',week:3}]})}}]})}throw Error('Unexpected fetch '+url)
 }});return {handler,calls,get batch(){return batch}}
}
const req=(body,auth=true)=>new Request('https://fn.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify(body)});
test('batch start verifies login and confirmed email before storing a manifest',async()=>{const a=app();assert.equal((await a.handler(req({action:'start',files:[{name:'week1.pdf',size:10}]},false))).status,401);const b=app({verified:false});assert.equal((await b.handler(req({action:'start',files:[{name:'week1.pdf',size:10}]}))).status,401);assert.equal(b.calls.some(c=>c.opt.method==='POST'),false)});
test('chat endpoint rejects an empty request before any model call',async()=>{const a=app();const response=await a.handler(req({action:'chat',scope:course,text:''}));assert.equal(response.status,400);assert.equal(a.calls.some(call=>call.url.includes('open.bigmodel.cn')),false)});
test('chat rejects a course scope outside the signed-in account before calling AI',async()=>{const a=app();const response=await a.handler(req({action:'chat',scope:'30000000-0000-4000-8000-000000000001',messages:[{role:'user',content:'开始学习'}]}));assert.equal(response.status,400);assert.equal(a.calls.some(call=>call.url.includes('open.bigmodel.cn')),false)});
test('a batch allows many files in one start, and caps oversized collections',async()=>{const a=app();assert.equal((await a.handler(req({action:'start',files:Array.from({length:13},(_,i)=>({name:'Week '+i+'.pdf',size:10}))}))).status,200);assert.equal(a.batch.manifest.length,13);assert.equal((await a.handler(req({action:'start',files:Array.from({length:61},()=>({name:'file.pdf',size:10}))}))).status,400)});
test('foreign batch cannot be organized or sent to AI',async()=>{const a=app({foreign:true});assert.equal((await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'lecture'}]}))).status,404);assert.equal(a.calls.some(c=>c.url.includes('open.bigmodel.cn')),false)});
test('a newer batch stops an older tab before it can call AI',async()=>{const a=app({newer:true});const response=await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'lecture'}]}));assert.equal(response.status,409);assert.equal((await response.json()).retryable,false);assert.equal(a.calls.some(c=>c.url.includes('open.bigmodel.cn')),false)});
test('explicit filename week wins over AI guess; course writes use user credentials',async()=>{const a=app();const result=await (await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'COM100 Communication'}]}))).json();assert.equal(result.plan[0].week,2);assert.equal(result.plan[0].course,course);const repeated=await a.handler(req({action:'organize',batch:id,files:[]}));assert.equal(repeated.status,200);assert.equal(a.calls.filter(c=>c.url.includes('open.bigmodel.cn')).length,1)});

test('an uncertain file stays excluded until its owner confirms it is a lecture',async()=>{const a=app();const organized=await (await a.handler(req({action:'organize',batch:id,files:[{index:0,week:2,preview:'COM100 Communication'}]}))).json();assert.equal(organized.plan[0].include,false);const included=await (await a.handler(req({action:'include',batch:id,file:0}))).json();assert.equal(included.plan[0].include,true);assert.equal(included.plan[0].kind,'lecture');assert.equal(a.batch.plan[0].include,true)});

test('one explicit course code applies to every file in the uploaded course pack',async()=>{const a=app({manifest:[{name:'Week 1/Course Introduction COM5103.pdf',size:10},{name:'Week 2/Privacy.pdf',size:10}]});const result=await (await a.handler(req({action:'organize',batch:id,files:[{index:0,week:1,preview:'course introduction'},{index:1,week:2,preview:'privacy'}]}))).json();assert.deepEqual(result.plan.map(file=>file.name),['COM5103','COM5103']);assert.equal(result.plan[1].include,true)});

test('course codes are read from metadata while camera and dates stay out',()=>{assert.equal(materialCourseCode('Week001/COM 5103 lecture'),'COM5103');assert.equal(materialCourseCode('IMG_1234 CS100 Computer Science'),'CS100');assert.equal(materialCourseCode('Week 1 introduction'),'');assert.equal(materialCourseCode('published July 2011'),'');assert.equal(materialCourseCode('since 2014'),'')});

test('Canvas underscore names retain course identity',()=>assert.equal(materialCourseCode('2026_COM5103_Week03.pdf'),'COM5103'));

test('lecture classifier skips readings and keeps teaching slides',()=>{
 assert.equal(classifyMaterialKind('COM5101/Readings/Week 2 article.pdf','Abstract Keywords DOI: 10.1 References','lecture').kind,'reading');
 assert.equal(classifyMaterialKind('COM5101/Week 2 lecture.pptx','').kind,'lecture');
 assert.equal(classifyMaterialKind('COM5103/NOTES/COM5103_WEEK2.docx','Week 2 Policy and Regulations').kind,'lecture');
 assert.equal(classifyMaterialKind('COM5101/Week 2.pdf','Abstract Keywords Journal Volume 5 References','lecture').kind,'reading');
 assert.equal(classifyMaterialKind('Week 2/Media Ownership.pdf','short text').kind,'lecture');
 assert.equal(classifyMaterialKind('Week 3/Coalition (2025) Report.pdf','short text').kind,'reading');
 assert.equal(classifyMaterialKind('COM5101/mystery.pdf','short text').include,false);
});

test('failed OCR releases reserved image count and permanent account limits do not retry',async()=>{
 let calls=0,count=0;
 for(const [code,retryable] of [['1302',true],['1113',false]]){
 const handler=createAssistant({env,base:async()=>json({}),fetch:async(url,opt={})=>{
 if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'2026-10-14'});
 if(url.includes('/user_material_batches')){if(opt.method==='PATCH'){count=JSON.parse(opt.body).ocr_calls;return json([{id,ocr_calls:count}])}if(url.includes('created_at=gt.'))return json([]);return json([{id,user_id:uid,manifest:[{name:'scan.pdf',size:10}],ocr_calls:count,created_at:'2026-10-14T00:00:00Z'}])}
 if(url.includes('/rpc/'))return json(true);
 if(url.includes('open.bigmodel.cn')){calls++;return new Response(JSON.stringify({error:{code,message:'provider detail'}}),{status:429})}
 throw Error(url)
 }});
 const r=await handler(req({action:'ocr',batch:id,file:0,image:'data:image/jpeg;base64,AAAA'}));
 const body=await r.json();assert.equal(body.retryable,retryable);assert.ok(body.error.includes(code));assert.equal(count,0);
 }assert.equal(calls,2)
});


test('Canvas author years do not split one course pack, and W3 filenames keep the week',async()=>{
 const a=app({manifest:[{name:'Additional Readings/W1_Rogers_2009_Study.pdf',size:10},{name:'Additional Readings/W9_AMSALEM_NIR_2021.pdf',size:10},{name:'Assignment Instructions/COM5101 Final Paper.docx',size:10},{name:'Lecture Slides/W1_Canvas.pptx',size:10},{name:'Lecture Slides/W3_Canvas.pptx',size:10},{name:'Lecture Slides/W6_Canvas.pptx',size:10}]});
 const response=await a.handler(req({action:'organize',batch:id,files:[{index:0,week:0,preview:''},{index:1,week:0,preview:''},{index:2,week:0,preview:''},{index:3,week:1,preview:'COM5101 Communication Fundamentals'},{index:4,week:0,preview:'Theories of Interpersonal Communication'},{index:5,week:0,preview:'The 1968 social study'}]}));
 const result=await response.json();assert.equal(response.status,200);assert.ok(result.plan.every(f=>f.name==='COM5101'));assert.deepEqual(result.plan.filter(f=>f.include).map(f=>f.week),[1,3,6]);assert.equal(a.calls.filter(c=>c.url.includes('/user_courses')&&c.opt.method==='POST').length,1);
 assert.equal(materialCourseCode('Rogers_2009'),'');assert.equal(materialCourseCode('The 1968 results'),'');assert.equal(materialCourseCode('Nir_2021'),'');assert.equal(materialCourseCode('COM 5103'),'COM5103');assert.equal(materialWeek('Lecture Slides/W06_Canvas.pptx'),6);assert.equal(materialWeek('What communication means'),0);
});

test('excluded standalone readings do not create empty courses before confirmation',async()=>{
 const a=app({manifest:[{name:'Additional Readings/Smith_2021_Article.pdf',size:10}],modelFiles:[{index:0,course:'本次课件',kind:'reading'}]});
 const response=await a.handler(req({action:'organize',batch:id,files:[{index:0,week:0,preview:'Abstract Keywords DOI: 10.1 References'}]}));
 const result=await response.json();assert.equal(result.plan[0].include,false);assert.equal(result.plan[0].course,null);assert.equal(a.calls.filter(c=>c.url.includes('/user_courses')&&c.opt.method==='POST').length,0);
 const included=await (await a.handler(req({action:'include',batch:id,file:0}))).json();assert.equal(included.plan[0].include,true);assert.equal(included.plan[0].course,course);assert.equal(a.calls.filter(c=>c.url.includes('/user_courses')&&c.opt.method==='POST').length,1);
});
