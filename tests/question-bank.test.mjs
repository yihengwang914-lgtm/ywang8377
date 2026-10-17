import test from 'node:test';import assert from 'node:assert/strict';
import {questionBankVersion,quizBankRequest,takePreparedQuestions,prepareQuestionBank,questionBankSummary} from '../supabase/functions/courselex-glm-import/question-bank.js';
const user='10000000-0000-4000-8000-000000000001',course={id:'20000000-0000-4000-8000-000000000001',code:'COM5101'},sources=[{id:'s1',course_id:course.id,week:1,content_hash:'hash1'},{id:'s2',course_id:course.id,week:2,content_hash:'hash2'}];
test('generic practice uses a prepared pool; custom topics, formats and large counts keep live retrieval',()=>{
 assert.deepEqual(quizBankRequest('根据我的 COM5101 课件出 3 道理解和应用练习题，逐题做，先不要透露答案。'),{count:3,week:0});
 assert.deepEqual(quizBankRequest('请根据第2周课件出一道四选一题'),{count:1,week:2});assert.deepEqual(quizBankRequest('给我3道英文选择题'),{count:3,week:0});assert.equal(quizBankRequest('不要出题，请讲解'),null);
 for(const text of ['出3道关于隐私保护的题','出一道简答题','出10道题','出12道题','根据第53周课件出题','解释知识点'])assert.equal(quizBankRequest(text),null,text);
});
test('source versions are order independent and a week-specific pool changes only with that week',async()=>{
 assert.equal(await questionBankVersion(sources),await questionBankVersion([...sources].reverse()));
 const changed=sources.map(s=>s.week===2?{...s,content_hash:'changed'}:s);
 assert.notEqual(await questionBankVersion(sources),await questionBankVersion(changed));
 assert.equal(await questionBankVersion(sources,1),await questionBankVersion(changed,1));
 assert.notEqual(await questionBankVersion(sources,2),await questionBankVersion(changed,2));
 assert.equal(await questionBankVersion(sources,3),null);
});
test('prepared questions are requested with the exact owner, course, week, source version and idempotency key',async()=>{
 const request=crypto.randomUUID(),questions=Array.from({length:3},(_,i)=>({id:String(i),answer:0}));let captured;
 const result=await takePreparedQuestions({db:async(path,method,body)=>{captured={path,body};return questions},user,course,sources,text:'根据第2周课件出3道题',request});
 assert.equal(captured.body.p_user,user);assert.equal(captured.body.p_course,course.id);assert.equal(captured.body.p_week,2);assert.equal(captured.body.p_version,await questionBankVersion(sources,2));assert.equal(captured.body.p_request,request);
 assert.equal(result.quiz.questions,questions);assert.equal(result.kind,'quiz');
 const miss=await takePreparedQuestions({db:async()=>[],user,course,sources,text:'出3道题',request});assert.equal(miss,null);
});
test('generation updates only the claimed version and preserves cursor/reservations changed during generation',async()=>{
 const version=await questionBankVersion(sources),calls=[];let patch;
 const db=async(path,method,body)=>{calls.push({path,method,body});if(path.includes('claim_courselex'))return {id:'bank',questions:[{prompt:'previous'}]};if(method==='PATCH'){patch=body;return [{}]}return [{questions:[{prompt:'previous'}],cursor:1,reservations:{served:true}}]};
 const ok=await prepareQuestionBank({db,user,course,sources,generate:async({previous})=>{assert.deepEqual(previous,['previous']);return [{id:'new'}]}});
 assert.equal(ok,true);assert.equal(patch.questions.length,2);assert.equal(patch.cursor,undefined);assert.equal(patch.reservations,undefined);
 assert.ok(calls.filter(c=>c.path.includes('?id=')).every(c=>c.path.includes('user_id=eq.'+user)&&c.path.includes('source_version=eq.'+version)&&c.path.includes('lock_owner=eq.')));
});
test('busy claims do not generate, failed generation keeps old questions and schedules a bounded retry',async()=>{
 let generated=0;assert.equal(await prepareQuestionBank({db:async()=>null,user,course,sources,generate:async()=>{generated++}}),false);assert.equal(generated,0);
 let patch;const db=async(path,method,body)=>{if(path.includes('claim_courselex'))return {id:'bank',questions:[]};if(method==='PATCH')patch=body;return []};
 assert.equal(await prepareQuestionBank({db,user,course,sources,generate:async()=>{throw Object.assign(Error('provider busy'),{status:429})}}),false);
 assert.equal(patch.status,'queued');assert.equal(patch.questions,undefined);assert.ok(Date.parse(patch.retry_after)>Date.now());
});
test('metadata exposes availability only, never questions or answer keys; stale pools are not reported ready',async()=>{
 let query;const db=async path=>{query=path;return [{source_version:await questionBankVersion(sources),status:'ready',available:5,questions:[{answer:0}]}]};
 assert.deepEqual(await questionBankSummary({db,user,course,sources}),{status:'ready',available:5});assert.ok(!query.includes('select=status,cursor,questions'));
 assert.deepEqual(await questionBankSummary({db:async()=>[{source_version:'old',status:'ready',available:5}],user,course,sources}),{status:'queued',available:0});
});

test('conversational review wording uses the ready pool without discarding a requested topic',()=>{for(const text of ['出题带我复习吧','帮我出题复习一下','出题带着我一起复习吧'])assert.deepEqual(quizBankRequest(text),{count:3,week:0});assert.equal(quizBankRequest('出题带我复习议程设置吧'),null)});
