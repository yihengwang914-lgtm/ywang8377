// Local, deterministic note presentation. No model, telemetry or network calls.
let noteMarkdownParser=null;
let noteEditorState={key:'',mode:'edit',undo:null};
const NOTE_PAPERS=[{value:'blank',label:'空白'},{value:'ruled',label:'横线'},{value:'dots',label:'点阵'},{value:'grid',label:'方格'}];
function validNotePaper(value){return NOTE_PAPERS.some(p=>p.value===value)?value:'blank'}
function noteEditorKey(){return session?.user.id+':'+workspaceCourse+':'+workspaceNote?.id}
function noteEditorToolbar(note){return `<div class="noteFormatTools"><div class="noteViewSwitch" role="group" aria-label="笔记显示方式"><button type="button" data-note-view="edit" aria-pressed="true" onclick="setNoteView('edit')">编辑</button><button type="button" data-note-view="read" aria-pressed="false" onclick="setNoteView('read')">阅读</button></div><div class="notePaper">${renderStudyPicker('notePaperStyle','纸张',validNotePaper(note.paper_style),NOTE_PAPERS,setNotePaperStyle)}</div>${typeof noteMediaControl==='function'?noteMediaControl():''}<button type="button" class="noteTidy" onclick="tidyCurrentNote()">一键排版</button><button type="button" id="noteFormatUndo" class="noteUndo" aria-label="撤销排版" title="撤销上次排版" onclick="undoNoteFormatting()" disabled>↶</button><details class="noteMoreTools"><summary aria-label="更多笔记排版工具">···</summary><div>${[['heading','标题'],['bold','加粗'],['list','列表'],['todo','待办'],['quote','引用']].map(([kind,label])=>`<button type="button" onclick="insertNoteMarkup('${kind}')">${label}</button>`).join('')}</div></details></div><p id="noteEditorHint" class="noteEditorHint" role="status"></p>`}
function initializeNoteEditor(note){
 noteEditorState={key:noteEditorKey(),mode:'edit',undo:null};
 try{const undo=JSON.parse(sessionStorage.getItem('courselex-note-format:'+noteEditorState.key)||'null');if(undo&&typeof undo.before==='string'&&typeof undo.after==='string'&&undo.before.length<=60000&&undo.after.length<=60000)noteEditorState.undo=undo}catch{}
 const surface=document.getElementById('noteSurface');if(surface)surface.dataset.paper=validNotePaper(note.paper_style);
 updateNoteEditorState();if(typeof initializeNoteMedia==='function')initializeNoteMedia();if(/!\[[^\]]*\]\(note-media:/.test(note.body||''))setNoteView('read');if(typeof refreshMobileNotebook==='function')refreshMobileNotebook();
}
function setNotePaperStyle(paper){
 const value=validNotePaper(paper),input=document.getElementById('notePaperStyle'),surface=document.getElementById('noteSurface');
 if(input)input.value=value;if(surface)surface.dataset.paper=value;scheduleNoteSave();
}
function noteHTML(text){
 if(typeof marked==='undefined'||typeof DOMPurify==='undefined')return learningMarkdown(text);
 if(!noteMarkdownParser){noteMarkdownParser=new marked.Marked({gfm:true,breaks:true});const escape=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;');noteMarkdownParser.use({renderer:{image({text,href}){if(typeof decodeNoteMedia==='function'&&href?.startsWith('note-media:')&&decodeNoteMedia(href.slice(11)))return '[SINQ_IMAGE:'+href.slice(11)+']';return '[图片：'+escape(text)+']'},html({text}){return escape(text)}}})}
 const html=noteMarkdownParser.parse(String(text)).replace(/<input\b[^>]*type="checkbox"[^>]*>/gi,tag=>/\bchecked(?:\s|=|>)/i.test(tag)?'☑ ':'☐ ');
 return DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','del','s','blockquote','ul','ol','li','pre','code','hr','table','thead','tbody','tr','th','td','a'],ALLOWED_ATTR:['href','title','start','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
}
function noteEditProjection(source){
 const refs=[];let index=1;
 const text=String(source).replace(/!\[[^\]]*\]\(note-media:([A-Za-z0-9_-]+)\)/g,(marker,encoded)=>{
  if(typeof decodeNoteMedia!=='function'||!decodeNoteMedia(encoded))return '[无效图片引用]';
  let label;do{label='〔图片 '+index+++'〕'}while(source.includes(label));refs.push({label,marker});return label;
 });return {text,refs};
}
function expandNoteEditText(text,refs){let body=String(text);for(const ref of refs||[])body=body.split(ref.label).join(ref.marker);return body}
function syncNoteTextInput(){
 const editor=document.getElementById('noteTextBody'),body=document.getElementById('noteBody');if(!editor||editor.hidden||!body)return;
 const refs=noteEditorState.mediaRefs||[];body.value=expandNoteEditText(editor.value,refs);
 const start=expandNoteEditText(editor.value.slice(0,editor.selectionStart||0),refs).length,end=expandNoteEditText(editor.value.slice(0,editor.selectionEnd||0),refs).length;
 body.setSelectionRange?.(start,end);
}
function setNoteView(mode){
 noteEditorState.mode=mode==='read'?'read':'edit';const body=document.getElementById('noteBody'),preview=document.getElementById('noteReadView');if(!body||!preview)return;
 let editor=document.getElementById('noteTextBody');if(editor)editor.hidden=true;
 const projection=noteEditProjection(body.value),visual=noteEditorState.mode==='edit'&&projection.refs.length;
 const surface=document.getElementById('noteSurface');if(surface)surface.dataset.mediaEditing=String(Boolean(visual));body.hidden=noteEditorState.mode==='read'||Boolean(visual);preview.hidden=noteEditorState.mode!=='read'&&!visual;
 if(visual){
  if(!editor){editor=document.createElement('textarea');editor.id='noteTextBody';editor.className=body.className;editor.maxLength=60000;editor.setAttribute('aria-label','笔记文字');editor.placeholder='写下理解…图片位置用简短标记表示';body.after(editor);editor.addEventListener('input',()=>{syncNoteTextInput();scheduleNoteSave();updateNoteEditorState()});editor.addEventListener('paste',event=>{const images=[...(event.clipboardData?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile());if(images.length){event.preventDefault();syncNoteTextInput();insertNoteImages(images)}})}
  noteEditorState.mediaRefs=projection.refs;editor.maxLength=Math.max(0,60000-(body.value.length-projection.text.length));editor.value=projection.text;editor.hidden=false;
  preview.innerHTML=noteHTML(projection.refs.map(r=>r.marker).join('\n\n'));
  const hint=document.getElementById('noteEditorHint');if(hint)hint.textContent='图片显示在文字下方；〔图片 1〕等标记决定插入位置，可移动或删除。';
 }else if(!preview.hidden)preview.innerHTML=noteHTML(body.value);
 if(!preview.hidden&&typeof hydrateNoteMedia==='function')hydrateNoteMedia(preview);
 document.querySelectorAll('[data-note-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.noteView===noteEditorState.mode)));if(typeof refreshMobileNotebook==='function')refreshMobileNotebook();
}

function updateNoteEditorState(){
 const body=document.getElementById('noteBody'),button=document.getElementById('noteFormatUndo'),undo=noteEditorState.undo;
 if(button)button.disabled=!(noteEditorState.key===noteEditorKey()&&undo&&body?.value===undo.after);
}
function formatNoteText(text){
 const lines=String(text).replace(/\r\n?/g,'\n').split('\n'),out=[];let fence=null,math=null,previous='';
 const blank=()=>{if(out.length&&out.at(-1)!=='')out.push('')};
 for(const original of lines){
  if(fence){out.push(original);if(new RegExp('^ {0,3}'+fence.char+'{'+fence.size+',}\\s*$').test(original))fence=null;continue}
  if(math){out.push(original);if(original.trim()===math)math=null;continue}
  const start=original.match(/^ {0,3}(`{3,}|~{3,})/);if(start){blank();out.push(original);fence={char:start[1][0],size:start[1].length};previous='protected';continue}
  if(['$$','\\['].includes(original.trim())){blank();out.push(original);math=original.trim()==='$$'?'$$':'\\]';previous='protected';continue}
  if(!original.trim()){blank();continue}
  // Preserve indented code, tables, hard line breaks and URL/reference contents.
  if(/^ {4}|^\t/.test(original)||original.includes('|')){out.push(original);previous='protected';continue}
  let line=original.replace(/[\t ]+$/,'');if(/ {2,}$/.test(original))line+='  ';
  const heading=line.match(/^ {0,3}(#{1,6})(?!#)\s*(\S.*)$/)||(!/https?:\/\//.test(line)&&(/^[\u4e00-\u9fffA-Za-z][^\n]{0,38}[：:]$/.test(line)||/^[一二三四五六七八九十]+、.{1,35}$/.test(line))?[line,'##',line]:null);
  if(heading){blank();out.push(heading[1]+' '+heading[2]);out.push('');previous='heading';continue}
  if(/^\s*[•●]\s*/.test(line))line=line.replace(/^(\s*)[•●]\s*/,'$1- ');
  line=line.replace(/^(\s*)(\d{1,2})[、）)]\s*/,'$1$2. ');
  const kind=/^\s*(?:[-+*]\s+|\d{1,2}\.\s+)/.test(line)?'list':/^\s*>/.test(line)?'quote':'paragraph';
  if(kind!==previous&&(kind==='list'||kind==='quote'||previous==='list'||previous==='quote'||previous==='protected'))blank();
  out.push(line);previous=kind;
 }
 while(out[0]==='')out.shift();if(!fence&&!math)while(out.at(-1)==='')out.pop();return out.join('\n');
}
function tidyCurrentNote(){
 const input=document.getElementById('noteBody'),hint=document.getElementById('noteEditorHint');if(!input||!workspaceNote)return;
 const before=input.value,after=formatNoteText(before);
 if(before!==after){noteEditorState.undo={before,after};try{sessionStorage.setItem('courselex-note-format:'+noteEditorKey(),JSON.stringify(noteEditorState.undo))}catch{}input.value=after;scheduleNoteSave()}
 setNoteView('read');updateNoteEditorState();if(hint)hint.textContent=before===after?'当前排版已整齐，已切换阅读。':'已整理标题、列表和段落间距，可撤销排版。';
}
function undoNoteFormatting(){
 const input=document.getElementById('noteBody'),undo=noteEditorState.undo;if(!input||noteEditorState.key!==noteEditorKey()||!undo||input.value!==undo.after)return false;
 input.value=undo.before;noteEditorState.undo=null;try{sessionStorage.removeItem('courselex-note-format:'+noteEditorKey())}catch{}scheduleNoteSave();setNoteView('edit');updateNoteEditorState();document.getElementById('noteEditorHint').textContent='已恢复排版前的内容。';return true;
}
function insertNoteMarkup(kind){
 setNoteView('edit');const projected=document.getElementById('noteTextBody'),input=projected&&!projected.hidden?projected:document.getElementById('noteBody');if(!input)return;
 let start=input.selectionStart,end=input.selectionEnd,selected=input.value.slice(start,end),replacement;
 if(kind==='bold')replacement='**'+(selected||'重点内容')+'**';
 else{start=start===0?0:input.value.lastIndexOf('\n',start-1)+1;const next=input.value.indexOf('\n',end);end=next<0?input.value.length:next;selected=input.value.slice(start,end);const prefix={heading:'## ',list:'- ',todo:'- [ ] ',quote:'> '}[kind];if(!prefix)return;replacement=selected.split('\n').map(line=>prefix+line).join('\n')}
 input.setRangeText(replacement,start,end,'select');if(input.id==='noteTextBody')syncNoteTextInput();scheduleNoteSave();updateNoteEditorState();input.focus();document.querySelector('.noteMoreTools')?.removeAttribute('open');
}
