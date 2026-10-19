'use strict';
let activePets = [];
let busy = false;
const modeStatus = document.querySelector('#mode-status');
const actionStatus = document.querySelector('#status');

function reflectStatus(status) {
  activePets = status.running ? status.pets : [];
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === status.mode));
  });
  modeStatus.textContent = status.running
    ? `当前：${status.label} · ${status.instanceCount} 个实例。${status.description}。`
    : '桌宠未运行，请先双击「一键安装启动.command」。';
  document.querySelectorAll('article').forEach(card => {
    const button = card.querySelector('button');
    button.disabled = !activePets.includes(card.dataset.pack);
    button.title = button.disabled ? (card.dataset.pack === 'duo' ? '切换到组合版后可点播' : '切换到双人版后可点播') : '';
  });
}

async function refreshMode() {
  if (busy) return;
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '读取失败');
    reflectStatus(data);
  } catch (error) { modeStatus.textContent = '读取模式失败：' + error.message; }
}

async function switchMode(mode) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('[data-mode]').forEach(b => b.disabled = true);
  modeStatus.textContent = '正在切换桌宠模式……';
  try {
    const response = await fetch('/api/mode', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '切换失败');
    reflectStatus(data);
    actionStatus.textContent = '模式已切换。桌宠窗口正在按新配置重载。';
  } catch (error) { modeStatus.textContent = '切换失败：' + error.message; }
  finally {
    busy = false;
    document.querySelectorAll('[data-mode]').forEach(b => b.disabled = false);
  }
}

function filter(pack, button) {
  document.querySelectorAll('article').forEach(card => {
    card.hidden = pack !== 'all' && card.dataset.pack !== pack;
    card.style.display = card.hidden ? 'none' : '';
    if (card.hidden) card.querySelector('video').pause();
  });
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
}

function toggleBackground() {
  const dark = document.body.classList.toggle('dark');
  document.querySelector('#background-button').setAttribute('aria-pressed', String(dark));
}

async function playPet(pet, name) {
  try {
    const response = await fetch('/api/anim?pet=' + encodeURIComponent(pet), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw Error(data.error || data.message || '点播失败');
    actionStatus.textContent = '已请求播放：' + name;
  } catch (error) { actionStatus.textContent = '点播失败：' + error.message; }
}

document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => {
  document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
}));
refreshMode();
setInterval(refreshMode, 5000);
