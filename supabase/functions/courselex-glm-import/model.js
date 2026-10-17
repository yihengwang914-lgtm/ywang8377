export class ModelError extends Error {
 constructor(status,message,retryable=true){super(message);this.status=status;this.retryable=retryable}
}
export function modelName(vision,paid,interactive=false,fallback=false){if(paid&&!vision&&interactive)return 'glm-4-air-250414';return vision?(paid?'glm-4.6v-flashx':'glm-4.6v-flash'):(paid?'glm-4.7-flashx':'glm-4.7-flash')}
export function usageCost(usage,vision,model){
 const input=usage?.prompt_tokens,output=usage?.completion_tokens;
 if(model==='deepseek-flash'){if(!Number.isSafeInteger(input)||input<0||input>131072||!Number.isSafeInteger(output)||output<0||output>8192)return null;return Math.ceil(input*2+output*8)}
 if(!Number.isSafeInteger(input)||input<0||input>(vision||['glm-4-flashx-250414','glm-4-air-250414'].includes(model)?131072:200000)||!Number.isSafeInteger(output)||output<0||output>8192)return null;
 // RMB micro-units; conservatively charge the highest tier, never cache discounts.
 if(model==='glm-4-flashx-250414')return Math.ceil((input+output)*0.1);
 if(model==='glm-4-air-250414')return Math.ceil((input+output)*0.5);
 return Math.ceil(input*(vision?0.3:0.5)+output*3);
}
export function deepseekInputBound(messages){
 let bound=0,images=0;
 for(const message of messages){bound+=128;
  if(typeof message.content==='string')bound+=new TextEncoder().encode(message.content).length;
  else if(Array.isArray(message.content))for(const part of message.content){
   if(part.type==='text'&&typeof part.text==='string')bound+=new TextEncoder().encode(part.text).length;
   else if(part.type==='image_url'&&/^data:image\/(?:jpeg|png|webp);base64,/.test(part.image_url?.url||'')){images++;bound+=1024;}
   else throw new ModelError(413,'图片格式无法处理，请重新上传课件。',false);
  }else throw new ModelError(413,'学习内容格式无效，请重新发送。',false);
 }
 if(images>4||bound>131072)throw new ModelError(413,'这次学习内容过长，请缩小范围后重试。',false);
 return bound;
}
// Buffer structured output on the server: streamed quiz answers must never reach
// the browser before the learner submits an answer.
export async function readModelStream(response,{signal,onUsage=()=>{},onContent=()=>{}}={}){
 const reader=response.body?.getReader();if(!reader)throw new ModelError(504,'AI 连接中断，正在重新连接。');
 const decoder=new TextDecoder();let buffer='',content='',finish=null,usage,bytes=0;
 function event(block){
  const raw=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(!raw||raw==='[DONE]')return;
  let data;try{data=JSON.parse(raw)}catch{throw new ModelError(504,'AI 数据传输中断，正在重新连接。')}
  if(data.error)throw new ModelError(503,'AI 服务暂时繁忙，请稍后重试。');
  if(data.usage){usage=data.usage;onUsage(usage)}
  const choice=data.choices?.[0];if(typeof choice?.delta?.content==='string'&&choice.delta.content){content+=choice.delta.content;onContent()}
  if(choice?.finish_reason)finish=choice.finish_reason;
 }
 const abort=()=>{void reader.cancel().catch(()=>{})};signal?.addEventListener('abort',abort,{once:true});
 try{
  for(;;){
   if(signal?.aborted)throw signal.reason;
   const part=await reader.read();if(signal?.aborted)throw signal.reason;if(part.done)break;
   bytes+=part.value.byteLength;if(bytes>1000000)throw new ModelError(422,'AI 回答过长，请缩小问题范围。',false);
   buffer=(buffer+decoder.decode(part.value,{stream:true})).replace(/\r\n/g,'\n');
   let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2)}
  }
  buffer+=decoder.decode();if(buffer.trim())event(buffer);
  if(finish!=='stop'||!content.trim())throw new ModelError(422,'AI 回答未完整生成，请重试。');
  return {choices:[{finish_reason:finish,message:{content}}],usage};
 }finally{signal?.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function callModel(args){
 // One bounded reconnect, each with its own budget reservation and lease.
 for(let attempt=0;;attempt++)try{return await modelAttempt({...args,interactiveFallback:attempt>0})}catch(error){
  if(!args.interactive||args.background||attempt>=1||error.status!==504||error.retryable===false)throw error;
  console.info(JSON.stringify({event:'learning_model_reconnect',attempt:attempt+1}));
 }
}
async function modelAttempt({db,fetcher,key,messages,user,vision=false,paid=false,maxTokens=8192,interactive=false,interactiveFallback=false,background=false,interactiveTimeoutMs=35000,provider='glm'}){
 const deepseek=provider==='deepseek';if(deepseek){deepseekInputBound(messages);if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>8192)throw new ModelError(413,'回答长度超出本轮测试限制。',false)}
 const model=deepseek?'deepseek-flash':modelName(vision,paid,interactive,interactiveFallback),lease=crypto.randomUUID();let leaseModel=model;
 if(paid){
  // Chat uses dedicated model lanes, independent of lecture import slots.
  const start=parseInt(lease.slice(0,2),16)%2,candidates=deepseek?(vision?Array.from({length:2},(_,i)=>model+'#vision'+(i+1)):background?Array.from({length:2},(_,i)=>model+'#bank'+(i+1)):interactive?Array.from({length:8},(_,i)=>model+'#chat'+(1+(i+parseInt(lease.slice(0,2),16))%8)):Array.from({length:4},(_,i)=>model+'#import'+(1+(i+parseInt(lease.slice(0,2),16))%4))):background?[model+'#2']:interactive?[model+'#1',model+'#2']:[model+'#'+(start+1),model+'#'+(2-start)];leaseModel='';
  for(const candidate of candidates)if(await db('/rest/v1/rpc/acquire_material_ai','POST',{p_model:candidate,p_owner:lease})){leaseModel=candidate;break}
  if(!leaseModel)throw new ModelError(429,'AI 整理通道正在工作，马上继续。');
 }else if(!await db('/rest/v1/rpc/acquire_material_ai','POST',{p_model:model,p_owner:lease}))throw new ModelError(429,'莱克正在处理其他课件，马上继续。');
 let ticket=null,actual=null,sent=false,r,data,timer,stall,firstTokenMs=null;const started=Date.now(),controller=new AbortController();
 try{
  if(paid){ticket=crypto.randomUUID();if(!await db('/rest/v1/rpc/reserve_material_ai_trial','POST',{p_id:ticket,p_user:user,p_model:model})){ticket=null;throw new ModelError(503,'本轮 ¥20 AI 测试预算已用完或暂停。资料已保留，请联系管理员。',false)}}
  const deadline=interactive?interactiveTimeoutMs:55000;
  timer=setTimeout(()=>controller.abort(new Error('model deadline')),deadline);
  const resetStall=()=>{clearTimeout(stall);stall=setTimeout(()=>controller.abort(new Error('model stalled')),firstTokenMs===null?20000:12000)};
  if(interactive)resetStall();
  sent=true;
  r=await fetcher(deepseek?'https://api.deepseek.com/chat/completions':'https://open.bigmodel.cn/api/paas/v4/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,...(deepseek||!interactive?{thinking:{type:'disabled'}}:{}),stream:interactive,...(interactive?{temperature:0.25}:{}),...(deepseek&&interactive?{stream_options:{include_usage:true}}:{}),max_tokens:maxTokens,response_format:{type:'json_object'},messages}),signal:controller.signal});
  if(r.ok&&interactive&&r.headers.get('content-type')?.includes('text/event-stream')){
   // Detect stalled connections early; total generation still has a hard cap.
   data=await readModelStream(r,{signal:controller.signal,onContent:()=>{if(firstTokenMs===null)firstTokenMs=Date.now()-started;resetStall()},onUsage:usage=>{actual=usageCost(usage,vision,model)}});
  }else data=await r.json();
  if(!r.ok){
   actual=0;const code=String(data.error?.code||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,30);
   console.warn(JSON.stringify({event:'material_model_rejected',model,status:r.status,code}));
   const suffix='（'+code+'）';
   if(r.status===402)throw new ModelError(503,'AI 平台余额不足，请管理员检查；本次进度已保留。',false);
   if(['1113','1308','1309','1310','1311','1313','1314','1315','1316','1317','1318','1319','1320','1321'].includes(code))throw new ModelError(503,(deepseek?'DeepSeek':'智谱')+'账号额度或模型权限受限，请管理员检查后台；本次进度已保留。'+suffix,false);
   if(r.status===401||r.status===403)throw new ModelError(503,'AI 服务连接或权限异常，请管理员检查后台。'+suffix,false);
   if(r.status===400)throw new ModelError(422,'这份内容未被 AI 接受，请管理员检查识别设置。'+suffix,false);
   throw new ModelError(r.status===429?429:503,(deepseek?'DeepSeek 暂时繁忙，正在等待。':code==='1302'?'智谱调用达到速率限制，正在等待。':code==='1305'?'智谱模型当前拥挤，正在等待。':'AI 服务暂时繁忙，正在等待。')+suffix);
  }
  actual=usageCost(data.usage,vision,model);
  console.info(JSON.stringify({event:'material_model_completed',model,interactive,duration_ms:Date.now()-started,first_token_ms:firstTokenMs,prompt_tokens:data.usage?.prompt_tokens,completion_tokens:data.usage?.completion_tokens}));
  return data;
 }catch(e){console.warn(JSON.stringify({event:'learning_model_interrupted',model,interactive,duration_ms:Date.now()-started,first_token_ms:firstTokenMs,status:e.status||504,reason:controller.signal.aborted?'deadline':e instanceof ModelError?'invalid_output':'network'}));if(e instanceof ModelError)throw e;throw new ModelError(504,'AI 响应暂时中断，问题已保存。请稍后继续回答。')}
 finally{
  clearTimeout(timer);clearTimeout(stall);
  if(ticket)try{await db('/rest/v1/rpc/settle_material_ai_trial','POST',{p_id:ticket,p_actual:sent?actual:0})}catch{console.warn(JSON.stringify({event:'material_budget_settle_pending',ticket}))}
  try{await db('/rest/v1/rpc/release_material_ai','POST',{p_model:leaseModel,p_owner:lease})}catch{}
 }
}
