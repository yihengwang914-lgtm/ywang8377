export class ModelError extends Error {
 constructor(status,message,retryable=true){super(message);this.status=status;this.retryable=retryable}
}
export function modelName(vision,paid){return vision?(paid?'glm-4.6v-flashx':'glm-4.6v-flash'):(paid?'glm-4.7-flashx':'glm-4.7-flash')}
export function usageCost(usage,vision){
 const input=usage?.prompt_tokens,output=usage?.completion_tokens;
 if(!Number.isSafeInteger(input)||input<0||input>(vision?131072:200000)||!Number.isSafeInteger(output)||output<0||output>8192)return null;
 // RMB micro-units; conservatively charge the highest tier, never cache discounts.
 return Math.ceil(input*(vision?0.3:0.5)+output*3);
}
export async function callModel({db,fetcher,key,messages,user,vision=false,paid=false}){
 const model=modelName(vision,paid),lease=crypto.randomUUID();
 if(!await db('/rest/v1/rpc/acquire_material_ai','POST',{p_model:model,p_owner:lease}))throw new ModelError(429,'莱克正在处理其他课件，马上继续。');
 let ticket=null,actual=null,sent=false,r,data;const started=Date.now();
 try{
  if(paid){ticket=crypto.randomUUID();if(!await db('/rest/v1/rpc/reserve_material_ai_trial','POST',{p_id:ticket,p_user:user,p_model:model})){ticket=null;throw new ModelError(503,'本轮 ¥20 AI 测试预算已用完或暂停。资料已保留，请联系管理员。',false)}}
  sent=true;
  r=await fetcher('https://open.bigmodel.cn/api/paas/v4/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,thinking:{type:'disabled'},stream:false,max_tokens:8192,response_format:{type:'json_object'},messages}),signal:AbortSignal.timeout(55000)});
  data=await r.json();
  if(!r.ok){
   actual=0;const code=String(data.error?.code||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,30);
   console.warn(JSON.stringify({event:'material_model_rejected',model,status:r.status,code}));
   const suffix='（'+code+'）';
   if(['1113','1308','1309','1310','1311','1313','1314','1315','1316','1317','1318','1319','1320','1321'].includes(code))throw new ModelError(503,'智谱账号额度或模型权限受限，请管理员检查后台；本次进度已保留。'+suffix,false);
   if(r.status===401||r.status===403)throw new ModelError(503,'AI 服务连接或权限异常，请管理员检查后台。'+suffix,false);
   if(r.status===400)throw new ModelError(422,'这份内容未被 AI 接受，请管理员检查识别设置。'+suffix,false);
   throw new ModelError(r.status===429?429:503,(code==='1302'?'智谱调用达到速率限制，正在等待。':code==='1305'?'智谱模型当前拥挤，正在等待。':'AI 服务暂时繁忙，正在等待。')+suffix);
  }
  actual=usageCost(data.usage,vision);
  console.info(JSON.stringify({event:'material_model_completed',model,duration_ms:Date.now()-started,prompt_tokens:data.usage?.prompt_tokens,completion_tokens:data.usage?.completion_tokens}));
  return data;
 }catch(e){if(e instanceof ModelError)throw e;throw new ModelError(504,'AI 响应暂时中断，已保留进度，正在重试。')}
 finally{
  if(ticket)try{await db('/rest/v1/rpc/settle_material_ai_trial','POST',{p_id:ticket,p_actual:sent?actual:0})}catch{console.warn(JSON.stringify({event:'material_budget_settle_pending',ticket}))}
  try{await db('/rest/v1/rpc/release_material_ai','POST',{p_model:model,p_owner:lease})}catch{}
 }
}
