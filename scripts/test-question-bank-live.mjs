// Manual live QA: disposable synthetic account and session files stay in /tmp.
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const qa=JSON.parse(fs.readFileSync('/tmp/courselex-bank-qa.json','utf8')),html=fs.readFileSync(root+'index.html','utf8'),base=html.match(/const SUPABASE_URL="([^"]+)/)[1],apikey=html.match(/const SUPABASE_KEY="([^"]+)/)[1];
const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey,'Content-Type':'application/json'},body:JSON.stringify({email:qa.email,password:qa.password})});const session=await r.json();if(!r.ok)throw Error('QA sign-in failed: '+JSON.stringify(session));fs.writeFileSync('/tmp/courselex-bank-qa-session.json',JSON.stringify(session),{mode:0o600});
async function request(data){const t=Date.now(),r=await fetch(base+'/functions/v1/courselex-glm-import',{method:'POST',headers:{apikey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({scope:qa.course,...data}),signal:AbortSignal.timeout(150000)}),body=await r.json();if(!r.ok)throw Error(r.status+' '+JSON.stringify(body));return {...body,elapsed_ms:Date.now()-t}}
let h=await request({action:'learning_history'});console.log('Initial metadata',h.elapsed_ms,h.preparation);
for(let n=0;n<30;n++){
 await new Promise(r=>setTimeout(r,5000));h=await request({action:'learning_history'});console.log('Preparation',n,h.preparation);if(h.preparation?.available>=3)break;
 if(h.preparation?.status==='failed')throw Error('Question bank generation failed');
}
assert.ok(h.preparation?.available>=3,'bank did not become ready');
const id=crypto.randomUUID(),quiz=await request({action:'chat',request_id:id,text:'根据我的课件出 3 道理解和应用练习题，逐题做，先不要透露答案。'});assert.equal(quiz.prepared,true);assert.equal(quiz.thread.messages.at(-1).quiz.questions.length,3);assert.ok(quiz.thread.messages.at(-1).quiz.questions.every(q=>!('answer' in q)&&!('evidence' in q)&&!('expected_answer' in q)));
console.log('Prepared 3-question response:',quiz.elapsed_ms,'ms');
const retry=await request({action:'chat',thread:quiz.thread.id,request_id:id,text:'根据我的课件出 3 道理解和应用练习题，逐题做，先不要透露答案。'});assert.equal(retry.cached,true);assert.deepEqual(retry.thread.messages.at(-1).quiz,quiz.thread.messages.at(-1).quiz);console.log('Idempotent retry:',retry.elapsed_ms,'ms');
const q=quiz.thread.messages.at(-1).quiz.questions[0];const graded=await request({action:'learning_answer',thread:quiz.thread.id,question:q.id,answer:3,request_id:crypto.randomUUID()});assert.ok(graded.thread.messages.at(-1).content.includes('答案'));console.log('Choice grading:',graded.elapsed_ms,'ms');
const restored=await request({action:'learning_history',thread:quiz.thread.id});assert.equal(restored.thread.messages.at(-1).content,graded.thread.messages.at(-1).content);console.log('Refresh restores same feedback:',restored.elapsed_ms,'ms');
fs.writeFileSync('/tmp/courselex-bank-live-result.json',JSON.stringify({course:qa.course,thread:quiz.thread.id,quiz_ms:quiz.elapsed_ms,retry_ms:retry.elapsed_ms,grade_ms:graded.elapsed_ms,history_ms:restored.elapsed_ms,questions:quiz.thread.messages.at(-1).quiz.questions},null,2),{mode:0o600});
console.log('PASS: precompute → private pool → immediate practice → idempotent retry → grading → refresh');
