import test from 'node:test';import assert from 'node:assert/strict';
import {callModel,usageCost} from '../supabase/functions/courselex-glm-import/model.js';
const user='10000000-0000-4000-8000-000000000001';
test('usage accounting rounds up and fails closed for absent or out-of-range counters',()=>{
 assert.equal(usageCost({prompt_tokens:101,completion_tokens:20},false),111);
 assert.equal(usageCost({prompt_tokens:101,completion_tokens:20},true),91);
 assert.equal(usageCost(undefined,true),null);
 assert.equal(usageCost({prompt_tokens:9999999,completion_tokens:0},true),null);
});
function setup({allowed=true,status=200,network=false}={}){
 const calls=[];let ai=0;
 const args={user,paid:true,key:'fixture',messages:[{role:'user',content:'Synthetic test'}],
 db:async(path,method,body)=>{calls.push({path,body});if(path.endsWith('reserve_material_ai_trial'))return allowed;return true},
 fetcher:async(url,opt)=>{ai++;assert.equal(JSON.parse(opt.body).model,'glm-4.7-flashx');if(network)throw Error('timeout');return new Response(JSON.stringify(status===200?{usage:{prompt_tokens:101,completion_tokens:20},choices:[{finish_reason:'stop',message:{content:'{}'}}]}:{error:{code:'1302'}}),{status})}};
 return {args,calls,get ai(){return ai}};
}
test('budget exhaustion prevents any paid provider call',async()=>{const a=setup({allowed:false});await assert.rejects(callModel(a.args),e=>e.status===503&&e.retryable===false);assert.equal(a.ai,0);assert.ok(a.calls.at(-1).path.endsWith('release_material_ai'))});
test('successful paid request settles actual usage before releasing the model slot',async()=>{const a=setup();await callModel(a.args);assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,111);assert.equal(a.ai,1)});
test('provider rejection releases budget, while uncertain network billing keeps reservation',async()=>{const a=setup({status:429});await assert.rejects(callModel(a.args));assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,0);const b=setup({network:true});await assert.rejects(callModel(b.args));assert.equal(b.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,null)});
