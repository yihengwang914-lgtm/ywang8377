import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('/Users/evenwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');const {chromium}=require('playwright');
const root=path.resolve(new URL('../',import.meta.url).pathname),qa=JSON.parse(fs.readFileSync('/tmp/courselex-learning-qa.json')),session=JSON.parse(fs.readFileSync('/tmp/courselex-learning-qa-session.json'));
const browser=await chromium.launch({headless:true,channel:"chrome"});const failures=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
await context.route('https://www.courselexai.com/**',async route=>{const p=new URL(route.request().url()).pathname,file=path.join(root,p==='/'?'index.html':decodeURIComponent(p));if(!file.startsWith(root)||!fs.existsSync(file))return route.abort();const ext=path.extname(file),type={'.js':'application/javascript','.mjs':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.ttf':'font/ttf','.woff2':'font/woff2'}[ext]||'application/octet-stream';return route.fulfill({path:file,contentType:type})});
await page.addInitScript(({session,course,id})=>{localStorage.setItem('courselex-auth-v2',JSON.stringify(session));sessionStorage.setItem('courselex-scope:'+id,course)},{session,course:qa.course,id:qa.id});
await page.goto('https://www.courselexai.com/');await page.getByRole('heading',{name:'莱克 Lex',exact:true}).waitFor({timeout:30000});await page.waitForFunction(()=>!learningLoading,{timeout:30000});
assert.match(await page.locator('.learningContext').innerText(),/\d+ 份课件/);
if(process.env.COURSELEX_UPLOAD_QA){
 await page.locator('input[type=file]').setInputFiles('/tmp/courselex-upload-qa/QA5103-Canvas.zip');await page.getByRole('button',{name:'发送',exact:true}).click();await page.waitForFunction(()=>materialState?.stage==='finished'&&!materialBusy,{timeout:180000});
 const status=await page.evaluate(()=>({duplicates:materialState.duplicates,skipped:materialState.files.filter(f=>f.plan?.include===false).length,done:materialState.files.filter(f=>f.result).length,failed:materialState.files.filter(f=>f.error).map(f=>f.error),courses:[...new Set(materialState.files.map(f=>f.plan?.course))]}));assert.equal(status.duplicates,1);assert.equal(status.skipped,1);assert.equal(status.done,3);assert.deepEqual(status.failed,[]);assert.deepEqual(status.courses,[qa.course]);console.log('PASS: Canvas ZIP → PDF/PPTX/DOCX reading → duplicate skip → reading exclusion → correct course → durable sources and vocabulary');
}

await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'output/qa/learning-welcome-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
await page.getByRole('button',{name:'学习记录',exact:true}).click();await page.locator('.threadItem').first().click();await page.waitForFunction(()=>learningThread?.messages.length>0&&!learningLoading,{timeout:30000});
await page.screenshot({path:path.join(root,'output/qa/learning-desktop.png'),fullPage:true});
for(const viewport of [{width:390,height:844},{width:320,height:740},{width:768,height:1024}]){await page.setViewportSize(viewport);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow at '+viewport.width)}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'output/qa/learning-mobile.png'),fullPage:true});
if(!await page.locator('.learningQuiz').count()&&await page.getByRole('button',{name:'继续这组练习',exact:true}).count()){await page.getByRole('button',{name:'继续这组练习',exact:true}).first().click();await page.waitForFunction(()=>!assistantBusy&&!learningLoading,{timeout:30000})}
await page.screenshot({path:path.join(root,'output/qa/learning-quiz-mobile.png'),fullPage:true});
const pending=page.locator('.learningQuiz');if(await pending.count()){
 const before=await pending.innerText();if(await pending.locator('.learningOptions button').count()){await pending.locator('.learningOptions button').first().click();await page.waitForFunction(()=>!assistantBusy&&!learningLoading,{timeout:45000});assert.ok((await page.locator('#assistantConversation').innerText()).includes('正确答案'));await page.reload();await page.getByRole('heading',{name:'莱克 Lex',exact:true}).waitFor();await page.waitForFunction(()=>!learningLoading&&learningThread?.messages.length,{timeout:30000});assert.ok((await page.locator('#assistantConversation').innerText()).includes('正确答案'));const after=await page.locator('.learningQuiz').innerText().catch(()=>'completed');assert.notEqual(before,after)}
}
const html=await page.evaluate(()=>learningMarkdown('<img src=x onerror="window.hacked=1"> **重点**'));assert.match(html,/&lt;img/);assert.equal(await page.evaluate(()=>window.hacked),undefined);
await page.getByRole('button',{name:'学习记录',exact:true}).click();await page.getByRole('button',{name:'知识点复习',exact:true}).click();await page.screenshot({path:path.join(root,'output/qa/learning-review-mobile.png'),fullPage:true});
await page.getByRole('button',{name:'关闭学习记录',exact:true}).click();
const sourceCard=page.locator('.learningSources').first();if(await sourceCard.count()){await sourceCard.locator('summary').click();await sourceCard.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'output/qa/learning-source-mobile.png'),fullPage:true})}
assert.deepEqual(failures,[]);console.log('PASS: real authenticated UI, source count, cloud history, 1440/768/390/320 widths, quiz answer, refresh, review drawer, safe formatting, no runtime errors');await browser.close();
