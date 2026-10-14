let sharedLibraryOffers=null;
function resetSharedLibraryAccount(){sharedLibraryOffers=null;}
async function renderSharedLibraryOffer(){
 const slot=document.getElementById('sharedLibrarySlot');if(!slot||!session)return;
 const epoch=accountEpoch;
 try{
  if(sharedLibraryOffers===null){const loaded=await sb('rpc/get_shared_library_offers',{method:'POST',body:'{}'});if(epoch!==accountEpoch)return;sharedLibraryOffers=loaded;}
  if(epoch!==accountEpoch||window._view?.type!=='home'||!slot.isConnected)return;
  const offer=Array.isArray(sharedLibraryOffers)?sharedLibraryOffers.find(o=>o.decision!=='imported'):null;if(!offer){slot.innerHTML='';return;}
  const prompt=`<h2>需要这份同校同专业词库吗？</h2><p>${esc(offer.school)} · ${esc(offer.major)}</p><p>已有 ${Number(offer.courses)} 门课程、${Number(offer.words)} 个词，可直接复制到你的账号，无需上传课件。</p><p class="meta">只导入课程与词汇，学习进度从零开始；不会覆盖已有课程。导入后由你独立管理，可自行修改。</p><div class="uploadActions"><button class="primary" onclick="chooseSharedLibrary('${esc(offer.id)}',true)">使用这份词库</button><button class="secondary" onclick="chooseSharedLibrary('${esc(offer.id)}',false)">暂不需要</button></div>`;
  slot.innerHTML=offer.decision==='declined'?`<details class="sharedLibraryCard"><summary>同校同专业词库 · 查看</summary>${prompt}</details>`:`<section class="panel sharedLibraryCard">${prompt}</section>`;
 }catch(e){if(epoch===accountEpoch&&slot.isConnected)slot.innerHTML='<p class="meta">共享词库暂时未加载，<button class="linkbtn" onclick="renderSharedLibraryOffer()">重试</button></p>';}
}
async function chooseSharedLibrary(id,accept){
 if(!session)return;const epoch=accountEpoch,slot=document.getElementById('sharedLibrarySlot');
 if(slot)slot.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  const result=await sb('rpc/choose_shared_library',{method:'POST',body:JSON.stringify({p_library:id,p_accept:accept})});if(epoch!==accountEpoch)return;
  resetSharedLibraryAccount();
  if(accept){if(!await loadCloud())throw Error('词库已保存，请点击同步重新加载');if(epoch!==accountEpoch)return;showHome();const status=document.getElementById('sharedLibraryNotice');if(status)status.textContent=result.already_imported?'这份词库已经导入，不会重复添加。':`已导入 ${result.courses} 门课程、${result.words} 个词，可以开始学习了。`;}
  else renderSharedLibraryOffer();
 }catch(e){if(epoch===accountEpoch){if(slot)slot.querySelectorAll('button').forEach(b=>b.disabled=false);const status=document.getElementById('sharedLibraryNotice');if(status)status.textContent='暂未完成：'+e.message;}}
}
