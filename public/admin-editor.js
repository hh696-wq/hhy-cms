/* Local progressive enhancement; HHY owns validation, persistence and permissions. */
function cmsDeltaHtml(delta) {
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let result = '', line = '', list = '';
  function endLine(attrs = {}) {
    const nextList = attrs.list === 'ordered' ? 'ol' : attrs.list === 'bullet' ? 'ul' : '';
    if (nextList !== list) { if (list) result += `</${list}>`; if (nextList) result += `<${nextList}>`; list = nextList; }
    const tag = list ? 'li' : attrs.header === 2 ? 'h2' : attrs.header === 3 ? 'h3' : attrs.blockquote ? 'blockquote' : 'p';
    result += `<${tag}>${line || '<br>'}</${tag}>`; line = '';
  }
  for (const op of delta.ops || []) {
    if (typeof op.insert !== 'string') continue;
    const attrs = op.attributes || {}, parts = op.insert.split('\n');
    parts.forEach((part, i) => {
      if (i) endLine(attrs);
      let text = escape(part);
      if (text && attrs.bold) text = `<strong>${text}</strong>`;
      if (text && attrs.italic) text = `<em>${text}</em>`;
      line += text;
    });
  }
  if (line) endLine();
  if (list) result += `</${list}>`;
  return result === '<p><br></p>' ? '' : result;
}

for (const box of document.querySelectorAll('[data-rich-editor]')) {
  if (!window.Quill) continue; // Keep the original textarea usable if loading fails.
  const textarea = box.querySelector('textarea[name="body"]');
  const surface = box.querySelector('[data-rich-surface]'), toolbar = box.querySelector('[data-rich-toolbar]');
  const status = box.querySelector('[data-rich-status]');
  try {
    toolbar.hidden = false; surface.hidden = false;
    const editor = new Quill(surface, {
      theme: 'snow', placeholder: '在这里开始写正文……',
      formats: ['bold', 'italic', 'header', 'list', 'blockquote'],
      modules: { toolbar, history: { userOnly: true } }
    });
    editor.setContents(editor.clipboard.convert({html: box.querySelector('[data-rich-initial]').innerHTML}), 'silent');
    editor.history.clear();
    editor.root.setAttribute('role', 'textbox'); editor.root.setAttribute('aria-label', '正文'); editor.root.setAttribute('aria-multiline', 'true');
    textarea.closest('label').hidden = true;
    const sync = () => {
      textarea.value = cmsDeltaHtml(editor.getContents());
      status.textContent = `${Math.max(0, editor.getLength() - 1)} 字 · ${textarea.value.length}/16000 存储字符`;
      if (textarea.value.length > 16000) status.textContent += ' · 内容过长，请精简后保存';
    };
    editor.on('text-change', sync);
    // Do not rewrite untouched legacy content merely by opening its editor.
    box.closest('form').addEventListener('submit', event => {
      if (textarea.value.length > 16000) { event.preventDefault(); status.textContent = '正文超过 16000 个存储字符，请精简后保存。'; editor.focus(); }
    });
    box.querySelector('[data-rich-undo]').addEventListener('click', () => editor.history.undo());
    box.querySelector('[data-rich-redo]').addEventListener('click', () => editor.history.redo());
    status.textContent = `${Math.max(0, editor.getLength()-1)} 字 · 排版会随草稿或发布一起保存`;
  } catch { toolbar.hidden = true; surface.hidden = true; textarea.closest('label').hidden = false; status.textContent = '编辑器加载失败，可使用下方 HTML 文本框继续编辑。'; }
}

if (document.querySelector('[data-media-picker]')) {
  const dialog = document.createElement('dialog');
  dialog.className = 'media-dialog';
  dialog.setAttribute('aria-labelledby', 'media-dialog-title');
  dialog.innerHTML = `<header><div><h2 id="media-dialog-title">选择图片</h2><p>搜索媒体库，或上传新图片并立即选中。</p></div><button type="button" data-close aria-label="关闭图片选择">关闭 ×</button></header><div class="media-dialog-tools"><label>搜索文件名<input type="search" data-search maxlength="100" placeholder="输入图片名称" autocomplete="off"></label><button type="button" data-refresh>刷新</button><label class="media-upload-label">上传图片<input type="file" data-upload accept="image/png,image/jpeg"></label></div><p class="muted">PNG / JPEG，最大 2 MiB。选择图片不会清空正在编辑的内容。</p><p data-status role="status" aria-live="polite"></p><div class="media-choice-grid" data-grid></div><footer><button type="button" data-prev>上一页</button><span data-page></span><button type="button" data-next>下一页</button></footer>`;
  document.body.append(dialog);
  const search = dialog.querySelector('[data-search]'), grid = dialog.querySelector('[data-grid]'), status = dialog.querySelector('[data-status]');
  const upload = dialog.querySelector('[data-upload]'), prev = dialog.querySelector('[data-prev]'), next = dialog.querySelector('[data-next]');
  let owner, opener, page = 1, total = 0, controller, timer, busy = false;
  const imageUrl = item => /^[a-f0-9]+\.(png|jpg)$/.test(item.filename) ? '/media/' + item.filename : '';
  function select(item) {
    const input = owner.querySelector('input[type="hidden"]'); input.value = item ? String(item.id) : '0';
    const preview = owner.querySelector('[data-media-selection]'); preview.replaceChildren();
    if (item) { const img = document.createElement('img'); img.src = imageUrl(item); img.alt = ''; preview.append(img); }
    const name = document.createElement('span'); name.textContent = item ? item.original_name : '尚未选择图片'; preview.append(name);
    owner.querySelector('[data-media-status]').textContent = item ? '已选中图片，请保存当前表单使其生效。' : '已移除选择，请保存当前表单使其生效。';
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }
  async function json(response) {
    if (response.redirected || !(response.headers.get('content-type') || '').includes('application/json')) throw new Error('登录可能已过期。请在新标签页登录后重试，保留本页未保存内容。');
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败，请重试。'); return data;
  }
  async function load() {
    controller?.abort(); controller = new AbortController(); const current = controller;
    status.textContent = '正在加载图片……'; grid.replaceChildren(); prev.disabled = true; next.disabled = true;
    try {
      const data = await json(await fetch('/admin/media/search?' + new URLSearchParams({q:search.value, page:String(page)}), {signal:current.signal,cache:'no-store'}));
      if (current !== controller || current.signal.aborted) return;
      total = data.total;
      for (const item of data.items) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'media-choice';
        button.setAttribute('aria-pressed', String(String(item.id) === owner.querySelector('input[type="hidden"]').value));
        const img = document.createElement('img'); img.src = imageUrl(item); img.alt = ''; img.loading = 'lazy';
        const name = document.createElement('span'); name.textContent = item.original_name;
        const detail = document.createElement('small'); detail.textContent = `#${item.id} · ${Math.ceil(Number(item.size)/1024)} KB`;
        button.append(img,name,detail); button.addEventListener('click', () => { select(item); dialog.close(); }); grid.append(button);
      }
      status.textContent = total ? `共 ${total} 张图片，点击缩略图选择。` : '没有匹配的图片，试试其他关键词或上传一张。';
      dialog.querySelector('[data-page]').textContent = `第 ${page} / ${Math.max(1,Math.ceil(total/24))} 页`;
      prev.disabled = page <= 1; next.disabled = page*24 >= total;
    } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message; }
  }
  for (const picker of document.querySelectorAll('[data-media-picker]')) {
    picker.querySelector('[data-media-open]').addEventListener('click', event => { owner = picker; opener = event.currentTarget; page = 1; search.value = ''; dialog.showModal(); search.focus(); load(); });
    picker.querySelector('[data-media-clear]').addEventListener('click', () => { owner = picker; select(null); });
  }
  search.addEventListener('input', () => { clearTimeout(timer); controller?.abort(); timer = setTimeout(() => {page = 1; load();},250); });
  dialog.querySelector('[data-refresh]').addEventListener('click', () => {page = 1;load();});
  prev.addEventListener('click', () => {if(page>1){page--;load();}});
  next.addEventListener('click', () => {if(page*24<total){page++;load();}});
  dialog.querySelector('[data-close]').addEventListener('click', () => {if(!busy) dialog.close();});
  dialog.addEventListener('cancel', event => {if(busy) event.preventDefault();});
  dialog.addEventListener('close', () => {controller?.abort();clearTimeout(timer);opener?.focus();});
  upload.addEventListener('change', async () => {
    const file = upload.files[0]; if(!file) return;
    if(!['image/png','image/jpeg'].includes(file.type) || file.size>2097152 || !file.size){ status.textContent = '请选择不超过 2 MiB 的 PNG 或 JPEG 图片。';upload.value='';return;}
    busy = true;controller?.abort();clearTimeout(timer);
    dialog.querySelectorAll('button,input').forEach(el => el.disabled=true);
    status.textContent = '正在上传，请稍候……';
    try {
      const form = new FormData(); form.set('csrf',owner.closest('form').querySelector('[name="csrf"]').value);form.set('image',file);form.set('response','json');
      const data = await json(await fetch('/admin/media?format=json',{method:'POST',body:form}));
      select(data.item); owner.querySelector('[data-media-status]').textContent = '上传成功，已自动选中。请保存当前表单使其生效。';dialog.close();
    } catch(error){status.textContent=error.message;}
    finally{busy=false;upload.value='';dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);prev.disabled=page<=1;next.disabled=page*24>=total;}
  });
}
