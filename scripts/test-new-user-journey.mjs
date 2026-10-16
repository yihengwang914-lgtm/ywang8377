// Real Supabase + AI, disposable QA only. Serve current local UI in an isolated
// headless context at the real origin; credentials and results stay outside Git.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('/Users/evenwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=require('playwright');
const root=path.resolve(new URL('../',import.meta.url).pathname),out=path.join(root,'output/journey');
const qa=JSON.parse(fs.readFileSync('/tmp/courselex-journey-qa.json','utf8'));
assert.match(qa.email,/^courselex-journey-[a-f0-9]+@example\.invalid$/);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.route('https://www.courselexai.com/**',async route=>{
 const p=decodeURIComponent(new URL(route.request().url()).pathname),file=path.join(root,p==='/'?'index.html':p);
 if(!file.startsWith(root)||!fs.existsSync(file))return route.abort();
 return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream'});
});
const page=await context.newPage(),errors=[],timings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async response=>{
 if(!response.url().endsWith('/functions/v1/courselex-glm-import'))return;
 try{const request=response.request(),body=request.postDataJSON(),result=await response.json();timings.push({action:body.action,status:response.status(),ms:Math.round(request.timing().responseEnd),prepared:result.prepared||false});}catch{}
});
const idle=()=>page.waitForFunction(()=>!assistantBusy&&!learningLoading,null,{timeout:120000});
async function send(text){await page.getByRole('textbox',{name:'给莱克发消息',exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();await idle();assert.equal(await page.locator('.learningError').count(),0,await page.locator('.learningError').allTextContents());}
async function mobileFits(label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' horizontal overflow');const box=await page.locator('.assistantComposer').boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=await page.evaluate(()=>innerHeight)+1,label+' composer outside viewport');assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,label+' duplicate outer scroll');}
try{
 await page.goto('https://www.courselexai.com/?journey=local');
 await page.getByLabel('邮箱',{exact:true}).fill(qa.email);await page.getByLabel('密码',{exact:true}).fill(qa.password);await page.getByRole('button',{name:'登录',exact:true}).click();
 if(!process.env.COURSELEX_RESUME_JOURNEY){
 await page.getByRole('heading',{name:'把课件交给莱克',exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'开始学习',exact:true}).click();
 await idle();assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'materialPrompt','tour should not open the mobile keyboard');
 await page.screenshot({path:path.join(out,'01-first-home.png')});await mobileFits('first home');
 await page.locator('input[type=file]').setInputFiles(path.join(out,'Week 1 Lecture.pdf'));await page.getByRole('button',{name:'移除 Week 1 Lecture.pdf',exact:true}).click();assert.equal(await page.locator('.attachmentChip').count(),0);
 await page.locator('input[type=file]').setInputFiles(path.join(out,'STU5101 - Whole Course Canvas.zip'));assert.ok(await page.locator('#materialConsent').isVisible());await page.screenshot({path:path.join(out,'02-upload-ready.png')});
 var uploadStart=Date.now();await page.getByRole('button',{name:'上传并整理',exact:true}).click();
 await page.waitForFunction(()=>materialState?.stage==='learning'&&materialState.files.some(f=>f.job),null,{timeout:90000});
 var batch=await page.evaluate(()=>materialState.batch);await page.screenshot({path:path.join(out,'03-processing.png')});
 // Deliberately interrupt the page while vocabulary is still being prepared.
 await page.reload();await page.waitForFunction(batch=>materialState?.batch===batch,batch,{timeout:30000});
 }else{uploadStart=Date.now();await page.waitForFunction(()=>Boolean(materialState),null,{timeout:30000});batch=await page.evaluate(()=>materialState.batch)}
 await page.waitForFunction(()=>learningState.sources.length===3,null,{timeout:90000});
 var sourceReadyMs=Date.now()-uploadStart;
 await page.getByRole('textbox',{name:'给莱克发消息',exact:true}).fill('帮我比较随机分配和随机抽样');
 await page.getByRole('textbox',{name:'给莱克发消息',exact:true}).press('Enter');
 assert.match(await page.getByRole('textbox',{name:'给莱克发消息',exact:true}).inputValue(),/\n$/,'mobile Enter should create a newline');
 await page.waitForFunction(()=>materialState?.stage==='finished'&&!materialBusy,null,{timeout:180000});
 assert.equal(await page.getByRole('textbox',{name:'给莱克发消息',exact:true}).inputValue(),'帮我比较随机分配和随机抽样\n','background work must preserve the draft');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'materialPrompt','background work must preserve keyboard focus');
 const batchResult=await page.evaluate(()=>({batch:materialState.batch,duplicates:materialState.duplicates,done:materialState.files.filter(f=>f.result).length,skipped:materialState.files.filter(f=>f.plan?.include===false).length,errors:materialState.files.filter(f=>f.error).map(f=>f.error),courses:courseRows.map(c=>({id:c.id,code:c.code})),scope:assistantScope,weeks:materialState.files.filter(f=>f.result).map(f=>f.plan.week).sort(),words:words.length}));
 assert.equal(batchResult.duplicates,process.env.COURSELEX_RESUME_JOURNEY?0:1);assert.equal(batchResult.done,3);assert.equal(batchResult.skipped,1);assert.deepEqual(batchResult.errors,[]);assert.equal(batchResult.courses.length,1);assert.equal(batchResult.courses[0].code,'STU5101');assert.equal(batchResult.scope,batchResult.courses[0].id);assert.deepEqual(batchResult.weeks,[1,2,3]);assert.ok(batchResult.words>=20);
 console.log('PASS upload/reload:',JSON.stringify({...batchResult,source_ready_ms:sourceReadyMs,elapsed_ms:Date.now()-uploadStart}));await mobileFits('after upload');
 qa.course=batchResult.scope;fs.writeFileSync('/tmp/courselex-journey-qa.json',JSON.stringify(qa),{mode:0o600});
 await send('用简单的话比较随机分配和随机抽样，给一个生活例子，引用我的课件。');
 assert.ok(await page.locator('.learningSources').count());await page.screenshot({path:path.join(out,'04-explanation.png')});await mobileFits('explanation');
 await send('帮我总结这三周课件的重点和容易混淆的概念。');assert.ok(await page.locator('.learningSources').count());
 await send('根据我的课件出 3 道理解和应用练习题，逐题做，先不要透露答案');
 const quiz=await page.evaluate(()=>learningThread.messages.findLast(m=>m.quiz).quiz);assert.equal(quiz.questions.length,3);for(const q of quiz.questions){assert.doesNotMatch(q.prompt,/\p{Script=Han}/u);assert.equal('answer' in q,false);assert.equal('expected_answer' in q,false);assert.equal('evidence' in q,false);for(const option of q.options)assert.doesNotMatch(option,/\p{Script=Han}/u)}
 await page.screenshot({path:path.join(out,'05-english-quiz.png')});await mobileFits('quiz');
 await page.locator('.learningOptions button').first().click();await idle();assert.match(await page.locator('#assistantConversation').innerText(),/正确答案/);assert.equal(await page.locator('.learningQuiz').count(),0);await page.screenshot({path:path.join(out,'06-feedback.png')});
 await page.reload();await page.getByRole('button',{name:'下一题 · 2/3',exact:true}).waitFor({timeout:30000});assert.match(await page.locator('#assistantConversation').innerText(),/正确答案/);await page.getByRole('button',{name:'下一题 · 2/3',exact:true}).click();await page.locator('.learningOptions button').first().click();await idle();assert.ok(await page.getByRole('button',{name:'下一题 · 3/3',exact:true}).isVisible());
 await send('先暂停练习，按我的薄弱点安排三天复习，每次15分钟。');assert.ok(await page.locator('.learningTask').count()>=2);assert.equal(await page.locator('.learningQuiz').count(),0);await page.screenshot({path:path.join(out,'07-review-plan.png')});
 const complete=page.getByRole('button',{name:'标为完成',exact:true}).first();await complete.click();await idle();assert.ok(await page.locator('.taskDone').count());
 // Close all persisted client state except authentication: simulate another device.
 const storage=await context.storageState();storage.origins=storage.origins.map(o=>({...o,localStorage:o.localStorage.filter(x=>x.name==='courselex-auth-v2')}));
 const other=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:storage});
 await other.route('https://www.courselexai.com/**',async route=>{const p=decodeURIComponent(new URL(route.request().url()).pathname),file=path.join(root,p==='/'?'index.html':p);if(!file.startsWith(root)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file,contentType:{'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream'})});
 const second=await other.newPage();await second.goto('https://www.courselexai.com/');await second.waitForFunction(()=>materialState?.stage==='finished'&&learningState.sources.length===3&&!learningLoading,null,{timeout:30000});
 assert.equal(await second.locator('#welcomeDialog').count(),0);assert.equal(await second.evaluate(()=>materialState.files.filter(f=>f.result).length),3);assert.equal(await second.evaluate(()=>words.length),batchResult.words);
 await second.getByRole('button',{name:'学习记录',exact:true}).click();await second.getByRole('button',{name:'知识点复习',exact:true}).click();await second.locator('.reviewItem .secondary').first().click();await second.waitForFunction(()=>!assistantBusy&&!learningLoading&&Boolean(document.querySelector('.learningQuiz')),null,{timeout:30000});
 await second.screenshot({path:path.join(out,'08-review-on-another-device.png')});assert.equal(await second.locator('.learningError').count(),0);await other.close();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:width<600?844:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);if(width<600)await mobileFits('width '+width)}
 await page.setViewportSize({width:390,height:460});await mobileFits('keyboard-sized viewport');
 await page.getByRole('button',{name:'学习记录',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('#learningDrawer').isVisible(),false);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'journey-result.json'),JSON.stringify({batchResult,timings,errors},null,2));
 console.log('PASS: real sign-in → tour → removable attachments → PDF/PPTX/DOCX ZIP → refresh while processing → scoped lecture/exclusion/deduplication → draft preservation → explanation → summary → private English quiz → feedback and next question → saved plan → cross-device recovery and direct review → mobile keyboard layout.');
}catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({stage:materialState?.stage,busy:materialBusy,message:materialMessage,files:materialState?.files?.map(f=>({path:f.path,status:f.status,error:f.error,job:f.job,result:Boolean(f.result)}))})).catch(()=>({})),null,2));throw error}finally{await browser.close()}
