// Manual authenticated integration run, using only the disposable QA account in /tmp.
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),qa=JSON.parse(fs.readFileSync('/tmp/courselex-learning-qa.json','utf8'));
const html=fs.readFileSync(new URL('index.html',root),'utf8'),base=html.match(/const SUPABASE_URL="([^"]+)/)[1],apikey=html.match(/const SUPABASE_KEY="([^"]+)/)[1];
const signed=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey,'Content-Type':'application/json'},body:JSON.stringify({email:qa.email,password:qa.password})});const session=await signed.json();if(!signed.ok)throw Error('QA sign-in failed: '+JSON.stringify(session));
fs.writeFileSync('/tmp/courselex-learning-qa-session.json',JSON.stringify(session),{mode:0o600});
async function request(data){const start=Date.now();for(let attempt=0;;attempt++){const r=await fetch(base+'/functions/v1/courselex-glm-import',{method:'POST',headers:{apikey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(150000)});const body=await r.json();if(!r.ok){if(r.status===429&&attempt<3){await new Promise(r=>setTimeout(r,4000));continue}throw Error(r.status+' '+JSON.stringify(body))}console.log(data.action+': '+(Date.now()-start)+'ms');return body}}
const source=`[Page 1] QA5103 Week 2 — Privacy and Data Protection
Learning objectives: understand privacy, consent, data minimisation, purpose limitation and retention.
Privacy protects personal information and an individual's control over how information is collected and used.
Informed consent must be specific, freely given and revocable. Bundling unrelated purposes into one mandatory consent request does not meet these requirements.
[Page 2] Data minimisation means collecting only personal data necessary for a specified purpose. For an optional event attendance reminder, a student's email address is sufficient; collecting passport numbers is unnecessary.
Purpose limitation means personal information must be used for the stated purpose, rather than reused for unrelated advertising without a valid basis.
Retention limitation means deleting or anonymising personal data when it is no longer needed for the specified purpose. Keeping data forever increases exposure.
[Page 3] Case study: a university club collects a student's email to send an event reminder. It should not require a passport number. It should not sell the email to advertisers. It should explain the reminder purpose and delete the contact list when no longer necessary.
Common mistake: consent does not make every collection necessary. Data minimisation and purpose limitation remain distinct principles.
Review question: explain why an email may be necessary while a passport number is unnecessary for event reminders.`;
fs.writeFileSync('/tmp/QA5103-Week-2-Lecture.txt',source);
if(!process.env.COURSELEX_SKIP_UPLOAD){const job=await request({action:'prepare',course:qa.course,week:2,filename:'QA5103 Week 2 Privacy.txt',parts:[source]});
for(let i=0;i<12;i++){const result=await request({action:'next',job:job.job});if(result.status==='completed'){assert.ok(result.extracted>=1);break}await new Promise(r=>setTimeout(r,500))}
}
const history=await request({action:'learning_history',scope:qa.course});assert.equal(history.sources.length,1);
let first=await request({action:'chat',scope:qa.course,text:'用简单的话和生活例子讲解数据最小化和目的限制有什么区别，引用我的课件。',request_id:crypto.randomUUID()});assert.ok(first.thread.messages.at(-1).citations.length);assert.match(first.reply,/最小化|目的/);const thread=first.thread.id;
const summary=await request({action:'chat',scope:qa.course,thread,text:'梳理这份课件的重点和最容易混淆的地方。',request_id:crypto.randomUUID()});assert.ok(summary.thread.messages.at(-1).citations.length);
const exercise=await request({action:'chat',scope:qa.course,thread,text:'根据我的课件出 3 道四选一练习，包含理解题和应用题，先不要告诉答案。',request_id:crypto.randomUUID()});const quiz=exercise.thread.messages.at(-1).quiz;assert.equal(quiz.questions.length,3);assert.equal(quiz.questions[0].answer,undefined);
const graded=await request({action:'learning_answer',scope:qa.course,thread,question:quiz.questions[0].id,answer:3,request_id:crypto.randomUUID()});assert.ok(graded.thread.messages.find(m=>m.quiz).quiz.questions[0].result.correct_answer);assert.match(graded.thread.messages.at(-1).content,/答案/);
const restored=await request({action:'learning_history',scope:qa.course,thread});assert.equal(restored.thread.messages.length,graded.thread.messages.length);assert.ok(restored.reviews.length>=1);
const plan=await request({action:'chat',scope:qa.course,thread,text:'根据这份课件和刚才的作答，给我安排三天的复习，每次 15 分钟。',request_id:crypto.randomUUID()});assert.ok(plan.thread.messages.at(-1).plan.tasks.length>=2);
const short=await request({action:'chat',scope:qa.course,thread,text:'再出一道简答题，我要用自己的话解释，请不要透露参考答案。',request_id:crypto.randomUUID()});assert.equal(short.thread.messages.at(-1).quiz.questions[0].type,'short');
const reviewed=await request({action:'learning_answer',scope:qa.course,thread,question:short.thread.messages.at(-1).quiz.questions[0].id,answer:'为了发活动提醒，只收集必要的邮箱即可，不应该收护照号，也不能把邮箱拿去广告，目的用完应删除。',request_id:crypto.randomUUID()});assert.ok(reviewed.thread.messages.at(-1).content.includes('参考答案'));
fs.writeFileSync('/tmp/courselex-learning-qa-result.json',JSON.stringify({thread,course:qa.course,messages:reviewed.thread.messages,reviews:restored.reviews},null,2));
console.log('PASS: source retention → explanation → summary → 3-question quiz → grading → cloud recovery → plan → short-answer grading');
