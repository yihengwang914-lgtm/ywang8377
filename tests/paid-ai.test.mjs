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
 fetcher:async(url,opt)=>{ai++;assert.ok(['glm-4.7-flashx','glm-4-flashx-250414','glm-4-air-250414'].includes(JSON.parse(opt.body).model));if(network)throw Error('timeout');return new Response(JSON.stringify(status===200?{usage:{prompt_tokens:101,completion_tokens:20},choices:[{finish_reason:'stop',message:{content:'{}'}}]}:{error:{code:'1302'}}),{status})}};
 return {args,calls,get ai(){return ai}};
}
test('budget exhaustion prevents any paid provider call',async()=>{const a=setup({allowed:false});await assert.rejects(callModel(a.args),e=>e.status===503&&e.retryable===false);assert.equal(a.ai,0);assert.ok(a.calls.at(-1).path.endsWith('release_material_ai'))});
test('successful paid request settles actual usage before releasing the model slot',async()=>{const a=setup();await callModel(a.args);assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,111);assert.equal(a.ai,1)});
test('paid requests acquire and release one of two parallel lanes',async()=>{const a=setup();await callModel(a.args);const acquire=a.calls.find(c=>c.path.endsWith('acquire_material_ai'));const release=a.calls.find(c=>c.path.endsWith('release_material_ai'));assert.match(acquire.body.p_model,/^glm-4\.7-flashx#[12]$/);assert.equal(release.body.p_model,acquire.body.p_model)});
test('provider rejection releases budget, while uncertain network billing keeps reservation',async()=>{const a=setup({status:429});await assert.rejects(callModel(a.args));assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,0);const b=setup({network:true});await assert.rejects(callModel(b.args));assert.equal(b.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,null)});

function streamed(events,{split=false}={}){
 const bytes=new TextEncoder().encode(events.map(e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\r\n\r\n').join(''));
 return new Response(new ReadableStream({start(c){if(split)for(const b of bytes)c.enqueue(new Uint8Array([b]));else c.enqueue(bytes);c.close()}}),{headers:{'Content-Type':'text/event-stream'}});
}
test('interactive streaming reconstructs split UTF-8 and CRLF frames without exposing partial output',async()=>{
 const a=setup();a.args.interactive=true;
 a.args.fetcher=async(url,opt)=>{assert.equal(JSON.parse(opt.body).stream,true);assert.equal(JSON.parse(opt.body).thinking,undefined);assert.equal(JSON.parse(opt.body).model,'glm-4-air-250414');return streamed([{choices:[{delta:{content:'{"reply":"中文'},finish_reason:null}]},{choices:[{delta:{content:'"}'},finish_reason:'stop'}],usage:{prompt_tokens:101,completion_tokens:20}},'[DONE]'],{split:true})};
 const result=await callModel(a.args);assert.equal(JSON.parse(result.choices[0].message.content).reply,'中文');assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,61);assert.match(a.calls.find(c=>c.path.endsWith('acquire_material_ai')).body.p_model,/#1$/);
});
test('a truncated streamed quiz is rejected, retains conservative accounting and releases its lane',async()=>{
 const a=setup();a.args.interactive=true;a.args.fetcher=async()=>streamed([{choices:[{delta:{content:'{"answer":0'},finish_reason:null}]}]);
 await assert.rejects(callModel(a.args),e=>e.status===422);assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,null);assert.ok(a.calls.at(-1).path.endsWith('release_material_ai'));
});
test('stalled interactive calls reconnect once, with independent reservations and releases',async()=>{
 const a=setup();let attempts=0;a.args.interactive=true;a.args.interactiveTimeoutMs=5;
 a.args.fetcher=async(url,opt)=>{attempts++;if(attempts===1)return new Promise((resolve,reject)=>opt.signal.addEventListener('abort',()=>reject(opt.signal.reason),{once:true}));return streamed([{choices:[{delta:{content:'{}'},finish_reason:'stop'}],usage:{prompt_tokens:101,completion_tokens:20}},'[DONE]'])};
 await callModel(a.args);assert.equal(attempts,2);assert.deepEqual(a.calls.filter(c=>c.path.endsWith('reserve_material_ai_trial')).map(c=>c.body.p_model),['glm-4-air-250414','glm-4-air-250414']);const settles=a.calls.filter(c=>c.path.endsWith('settle_material_ai_trial'));assert.deepEqual(settles.map(c=>c.body.p_actual),[null,61]);assert.notEqual(settles[0].body.p_id,settles[1].body.p_id);assert.equal(a.calls.filter(c=>c.path.endsWith('release_material_ai')).length,2);
});
test('reconnect cannot bypass an exhausted budget or loop indefinitely',async()=>{
 const a=setup();let reserves=0,attempts=0;const original=a.args.db;a.args.interactive=true;
 a.args.db=async(...args)=>{if(args[0].endsWith('reserve_material_ai_trial')){await original(...args);return ++reserves===1}return original(...args)};
 a.args.fetcher=async()=>{attempts++;throw Error('connection lost')};
 await assert.rejects(callModel(a.args),e=>e.retryable===false);assert.equal(attempts,1);assert.equal(reserves,2);
 const b=setup({network:true});b.args.interactive=true;await assert.rejects(callModel(b.args),e=>e.status===504);assert.equal(b.ai,2);
});
test('bulk import has independent lanes and interactive calls can use their second lane',async()=>{
 const a=setup();await callModel(a.args);assert.match(a.calls.find(c=>c.path.endsWith('acquire_material_ai')).body.p_model,/glm-4\.7-flashx#[12]$/);
 const b=setup(),original=b.args.db;b.args.interactive=true;b.args.db=async(...args)=>{const result=await original(...args);return args[0].endsWith('acquire_material_ai')&&args[2].p_model.endsWith('#1')?false:result};await callModel(b.args);assert.match(b.calls.at(-1).body.p_model,/#2$/);
});

test('DeepSeek uses its official endpoint, disabled thinking, private streaming and separate lanes',async()=>{for(const mode of ['chat','bank','import','vision']){const a=setup();a.args.provider='deepseek';a.args.interactive=mode==='chat'||mode==='bank';a.args.background=mode==='bank';a.args.vision=mode==='vision';if(mode==='vision')a.args.messages=[{role:'user',content:[{type:'text',text:'Read the lecture image as JSON.'},{type:'image_url',image_url:{url:'data:image/png;base64,aGVsbG8='}}]}];a.args.fetcher=async(url,opt)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(opt.body);assert.equal(body.model,'deepseek-flash');assert.equal(body.thinking.type,'disabled');assert.equal(body.response_format.type,'json_object');return new Response(JSON.stringify({usage:{prompt_tokens:100,completion_tokens:20},choices:[{finish_reason:'stop',message:{content:'{}'}}]}))};await callModel(a.args);assert.match(a.calls.find(c=>c.path.endsWith('acquire_material_ai')).body.p_model,new RegExp('^deepseek-flash#'+mode));assert.equal(a.calls.find(c=>c.path.endsWith('reserve_material_ai_trial')).body.p_model,'deepseek-flash');assert.equal(a.calls.find(c=>c.path.endsWith('settle_material_ai_trial')).body.p_actual,360)}});
test('DeepSeek upper-bound accounting cannot book oversized requests or bypass the shared cap',async()=>{const a=setup({allowed:false});a.args.provider='deepseek';await assert.rejects(callModel(a.args),e=>e.status===503);assert.equal(a.ai,0);const b=setup();b.args.provider='deepseek';b.args.messages=[{role:'user',content:'x'.repeat(131073)}];await assert.rejects(callModel(b.args),e=>e.status===413);assert.equal(b.calls.length,0);assert.equal(usageCost({prompt_tokens:131072,completion_tokens:8192},false,'deepseek-flash'),327680);assert.equal(usageCost({prompt_tokens:131073,completion_tokens:1},false,'deepseek-flash'),null)});
