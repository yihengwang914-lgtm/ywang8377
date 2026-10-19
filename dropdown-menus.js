// Transient menus close when a mouse leaves both trigger and popup.
// Content disclosures (citations, reports, optional forms) deliberately stay open.
const transientMenuSelector='details.navMenu,details.courseSwitcher,details.studyPicker,details.homeTools,details.learningMore,details.noteMoreTools';
const transientMenuTimers=new WeakMap();
function cancelMenuClose(menu){const timer=transientMenuTimers.get(menu);if(timer!==undefined){clearTimeout(timer);transientMenuTimers.delete(menu)}}
function closeTransientMenu(menu){cancelMenuClose(menu);menu.querySelectorAll('details[open]').forEach(child=>child.open=false);menu.open=false}
function handleMenuPointerOver(event){if(event.pointerType!=='mouse')return;const menu=event.target?.closest?.(transientMenuSelector);if(menu)cancelMenuClose(menu)}
function handleMenuPointerOut(event){if(event.pointerType!=='mouse')return;const menu=event.target?.closest?.(transientMenuSelector);if(!menu?.open||event.relatedTarget?.nodeType&&menu.contains(event.relatedTarget))return;cancelMenuClose(menu);transientMenuTimers.set(menu,setTimeout(()=>{transientMenuTimers.delete(menu);if(menu.isConnected)closeTransientMenu(menu)},260))}
function handleMenuEscape(event){if(event.key!=='Escape')return;const menu=event.target?.closest?.(transientMenuSelector);if(!menu?.open)return;event.preventDefault();event.stopPropagation();closeTransientMenu(menu);menu.querySelector('summary')?.focus()}
if(typeof document!=='undefined'&&document.addEventListener){document.addEventListener('pointerover',handleMenuPointerOver);document.addEventListener('pointerout',handleMenuPointerOut);document.addEventListener('keydown',handleMenuEscape)}
// Touch users dismiss by tapping elsewhere; content disclosures remain untouched.
function handleMenuOutsidePointer(event){const active=event.target?.closest?.(transientMenuSelector);document.querySelectorAll(transientMenuSelector).forEach(menu=>{if(menu.open&&menu!==active&&!menu.contains(event.target))closeTransientMenu(menu)})}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('pointerdown',handleMenuOutsidePointer);
