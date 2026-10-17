const path='/rest/v1/user_learning_question_banks';
export async function questionBankVersion(sources,week=0){
 const material=sources.filter(s=>!week||s.week===week).map(s=>[s.id,s.content_hash||s.content_chars,s.week]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 if(!material.length)return null;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('question-bank-v2-english:'+JSON.stringify(material)));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function quizBankRequest(text){
 if(/不要.{0,8}(?:出题|练习)|不想.{0,8}(?:出题|练习)|先不.{0,8}(?:出题|练习)/.test(text))return null;
 if(!/出.{0,12}题|考我|练习|quiz|practice|questions|(?:给我|来|做).{0,12}题/i.test(text)||/简答|short.answer|填空|多选|判断题|true.or.false/i.test(text))return null;
 const countMatch=text.match(/(?:^|[^\d])([1-9]\d{0,2}|[一二三四五六七八九十])\s*(?:道|个|题|questions)/i),count=countMatch?Number(countMatch[1])||'一二三四五六七八九十'.indexOf(countMatch[1])+1:3;
 if(count>5)return null;
 const week=Number(text.match(/(?:week|wk|第)\s*(\d{1,2})\s*(?:周)?/i)?.[1])||0;if(week>52)return null;
 // Specific topics keep normal retrieval rather than silently returning generic questions.
 const remainder=text.replace(/(?:[A-Za-z]{2,6})?\d{3,5}/g,'').replace(/(?:week|wk|第)\s*\d{1,2}\s*(?:周)?/gi,'').replace(/根据|按照|基于|我的|带我|带着我|一起|复习|温习|一下|吧|现在|这些|这门|这份|所有|课件|课程|内容|材料|知识点|给我|帮我|请|先不要|不要|透露|告诉|显示|答案|解析|逐题|一道一道|一道|理解|和|与|应用|综合|随机|英文|英语|四选一|单选|选择|练习|题目|问题|测试|开始|出|道|个|题|做|一|二|三|四|五|[1-5]|的|[，。！？、,.!?：:]/g,'').replace(/based on|my|the|lectures?|materials?|course|generate|give me|please|practice|quiz|questions?|understanding|and|application|one at a time|don't reveal answers/gi,'').replace(/\s/g,'').trim();
 return remainder?null:{count,week};
}
export async function takePreparedQuestions({db,user,course,sources,text,request}){
 const spec=quizBankRequest(text);if(!spec)return null;const version=await questionBankVersion(sources,spec.week);if(!version)return null;
 const questions=await db('/rest/v1/rpc/take_courselex_questions','POST',{p_user:user,p_course:course.id,p_week:spec.week,p_version:version,p_request:request,p_count:spec.count});
 if(!Array.isArray(questions)||questions.length!==spec.count)return null;
 return {content:'先独立作答，提交后我会讲解答案，并安排薄弱点复习。',kind:'quiz',citations:[],quiz:{id:crypto.randomUUID(),title:(course.code||course.name)+(spec.week?' · Week '+spec.week:'')+' 练习',questions},action:{type:'none'}};
}
export async function prepareQuestionBank({db,user,course,sources,week=0,generate}){
 const version=await questionBankVersion(sources,week);if(!version)return false;const owner=crypto.randomUUID();
 const bank=await db('/rest/v1/rpc/claim_courselex_question_bank','POST',{p_user:user,p_course:course.id,p_week:week,p_version:version,p_owner:owner});if(!bank)return false;
 const target=path+'?id=eq.'+bank.id+'&user_id=eq.'+user+'&lock_owner=eq.'+owner+'&source_version=eq.'+version;
 try{
  const questions=await generate({course,week,previous:bank.questions.map(q=>q.prompt).slice(-15)});
  if(!Array.isArray(questions)||!questions.length)throw Error('no verified questions');
  // Re-read cursor/reservations: learners may have taken older ready questions while
  // new ones were being prepared. Updating only questions avoids losing claims.
  const [current]=await db(target);if(!current)return false;
  await db(target,'PATCH',{questions:[...current.questions,...questions].slice(0,40),status:current.questions.length-current.cursor+questions.length>=5?'ready':'queued',lock_owner:null,locked_until:'-infinity',retry_after:'-infinity',updated_at:new Date().toISOString()});return true;
 }catch(error){
  await db(target,'PATCH',{status:error.status===429?'queued':'failed',lock_owner:null,locked_until:'-infinity',retry_after:new Date(Date.now()+(error.status===429?15000:300000)).toISOString(),updated_at:new Date().toISOString()}).catch(()=>{});
  console.warn(JSON.stringify({event:'question_bank_prepare_failed',status:error.status||503,message:String(error.message||'').slice(0,180)}));return false;
 }
}
export async function questionBankSummary({db,user,course,sources}){
 if(!course)return null;const version=await questionBankVersion(sources);if(!version)return null;
 const [row]=await db(path+'?select=status,available,source_version&user_id=eq.'+user+'&course_id=eq.'+course.id+'&week=eq.0');
 return row?.source_version===version?{status:row.status,available:Math.max(0,row.available)}:{status:'queued',available:0};
}
