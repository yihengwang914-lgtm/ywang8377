let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;});
async function showInstall(){
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();return;}
 const dialog=document.getElementById('installDialog');
 const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 document.getElementById('installInstructions').textContent=installed?'已经以桌面应用方式打开了 SINQ。':/iPhone|iPad|iPod/.test(navigator.userAgent)?'iPhone / iPad：用 Safari 打开本站，点“分享”，选择“添加到主屏幕”，再点“添加”。':/Android/.test(navigator.userAgent)?'Android：用 Chrome 打开本站，点右上角菜单，选择“安装应用”或“添加到主屏幕”。':'电脑：用 Chrome 或 Edge 打开本站，点击地址栏的安装图标；也可以在浏览器菜单中找到“安装此网站为应用”或“创建快捷方式”。';
 dialog.showModal();
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
