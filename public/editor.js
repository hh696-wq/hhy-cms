// Progressive enhancement only. All content, validation and publishing run in HHY.
document.addEventListener('click', event => {
  const action = event.target.closest('[data-confirm]');
  if (action && !window.confirm(action.dataset.confirm)) event.preventDefault();
  const button = event.target.closest('[data-tag]');
  if (!button) return;
  const area = button.closest('form').querySelector('textarea[name="body"]');
  const tag = button.dataset.tag;
  if (!['strong', 'em', 'h2', 'p'].includes(tag)) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selection = area.value.slice(start, end) || '在这里输入内容';
  area.setRangeText(`<${tag}>${selection}</${tag}>`, start, end, 'select');
  area.focus();
});

// Passwords are generated locally and only submitted with the installation form.
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-password-generate], [data-password-toggle], [data-password-copy]');
  if (!button) return;
  const field = button.closest('.password-field');
  const input = field.querySelector('input');
  const status = field.querySelector('[role="status"]');
  if (button.hasAttribute('data-password-generate')) {
    if (!globalThis.crypto?.getRandomValues) {
      status.textContent = '当前浏览器不支持安全随机数，请手动输入密码。';
      return;
    }
    // 64 symbols divide the byte range exactly, so indexing is unbiased.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    input.value = Array.from(bytes, value => alphabet[value & 63]).join('');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = '已生成 20 位随机密码，请复制并妥善保存。';
  } else if (button.hasAttribute('data-password-toggle')) {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? '隐藏' : '显示';
    button.setAttribute('aria-pressed', String(show));
  } else {
    if (!input.value) {
      status.textContent = '请先输入或生成密码。';
      return;
    }
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = '密码已复制，请妥善保存。';
    } catch {
      status.textContent = '浏览器未允许复制，请点击“显示”后手动复制密码。';
    }
  }
});
