// Apply before paint. Appearance is a device preference, never part of learning data.
(function () {
  'use strict';
  const key = 'sinq-appearance-v1';
  const valid = value => ['system', 'light', 'dark'].includes(value);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch {}
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#212121' : '#f5f7f6');
    document.querySelectorAll('[data-appearance]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.appearance === preference)));
    const label = document.getElementById('appearanceLabel');
    if (label) label.textContent = ({system:'跟随系统',light:'浅色',dark:'深色'})[preference];
  }
  window.setSinqAppearance = function (value) {
    if (!valid(value)) return;
    preference = value;
    let saved = true;
    try { localStorage.setItem(key, preference); } catch { saved = false; }
    apply();
    const status = document.getElementById('appearanceStatus');
    if (status) status.textContent = saved ? '已记住此设备的显示偏好' : '已切换；此浏览器暂时无法记住偏好';
  };
  media.addEventListener?.('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  document.addEventListener('DOMContentLoaded', apply);
  apply();
}());
