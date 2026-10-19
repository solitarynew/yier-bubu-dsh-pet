#!/usr/bin/env node
/** Run the unmodified dsh-pet framework with project-local configuration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import os from 'node:os';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE = path.join(ROOT, '.runtime');
export const HOME = path.join(STATE, 'home');
export const PORT = 17340;
export const GALLERY_PORT = 17341;
export const MODES = {
  pair: { label: '双人版', description: '一二、布布两个独立实例，各自活动', pets: ['yier', 'bubu'] },
  duo: { label: '组合版', description: '一个实例，播放两只同框的双人表情', pets: ['duo'] },
};
const FRAMEWORK_ROOT = path.join(ROOT, 'node_modules', 'dsh-pet');
export const exists = async p => { try { await fs.access(p); return true; } catch { return false; } };
export const readJSON = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const writeJSON = async (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + '\n');

export async function request(route = '/health', method = 'GET') {
  const response = await fetch(`http://127.0.0.1:${PORT}${route}`, {
    method, signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw Error(`dsh-pet 返回 HTTP ${response.status}`);
  return response.json();
}

export async function ownedHealth() {
  let status;
  try { status = await request(); }
  catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw Error(`端口 ${PORT} 无法验证归属，未改动其他进程：${error.message}`);
  }
  if (status.name !== 'dsh-pet-standalone' || path.resolve(status.plugin?.root || '') !== FRAMEWORK_ROOT) {
    throw Error(`端口 ${PORT} 已被其他项目占用，请先关闭另一个一二布布项目副本。`);
  }
  return status;
}

export async function selectedMode() {
  try {
    const mode = (await fs.readFile(path.join(STATE, 'mode'), 'utf8')).trim();
    if (MODES[mode]) return mode;
  } catch {}
  return 'pair';
}

export async function prepare(mode) {
  if (!MODES[mode]) throw Error('启动模式只能为 pair（双人版）或 duo（组合版）');
  const petRoot = path.join(HOME, 'dsh-pet', 'pet');
  await fs.mkdir(petRoot, { recursive: true });
  const main = {
    notificationsEnabled: false, confineToScreen: true,
    physics: { gravity: 1400, restitution: 0.78, groundFriction: 2.5,
      ceilingBounce: true, throwPower: 1, petCollision: true },
    pets: [{ id: 'main', name: '原版鲸鱼娘', size: 462, display: 'none',
      balanceEnabled: false, whisperEnabled: false, workStatusEnabled: false, fixedEnabled: false,
      position: { corner: 'top-right', marginX: 24, marginY: 100 } }],
  };
  await writeJSON(path.join(HOME, 'dsh-pet', 'main-config.jsonc'), main);
  for (const pack of ['yier', 'bubu', 'duo']) {
    const conf = await readJSON(path.join(ROOT, 'packs', `${pack}-config.json`));
    for (const pet of conf.pets) {
      pet.display = MODES[mode].pets.includes(pack) ? 'both' : 'none';
      // Center a combined pet rather than leaving it at the third demo's position.
      if (pack === 'duo') pet.position.marginX = 390;
    }
    await writeJSON(path.join(petRoot, `${pack}-config.json`), conf);
    const link = path.join(petRoot, `${pack}-animation`);
    const target = path.join(ROOT, 'packs', `${pack}-animation`);
    if (!(await exists(link))) {
      await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    } else if (path.resolve(await fs.realpath(link)) !== target) {
      throw Error(`已有非预期素材目录，请先备份后移走：${link}`);
    }
  }
}

export async function currentStatus() {
  const runtime = await ownedHealth();
  const mode = await selectedMode();
  return { running: Boolean(runtime), mode, ...MODES[mode],
    instanceCount: runtime ? MODES[mode].pets.length : 0 };
}

export async function setMode(mode) {
  const previous = await selectedMode();
  if (!(await ownedHealth())) throw Error('桌宠尚未启动，请先运行一键安装启动脚本');
  await prepare(mode);
  try {
    await request('/dsh-pet-7340/reload', 'POST');
    await fs.writeFile(path.join(STATE, 'mode'), mode);
  } catch (error) {
    await prepare(previous);
    throw error;
  }
  return currentStatus();
}

export async function electronPath() {
  const relative = process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron'
    : process.platform === 'win32' ? 'electron.exe' : 'electron';
  const candidates = [process.env.DSH_PET_ELECTRON_PATH,
    path.join(HOME, 'electron', relative), path.join(os.homedir(), '.dsh', 'electron', relative)].filter(Boolean);
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return null;
}

export async function ensureElectron() {
  let electron = await electronPath();
  if (!electron) {
    console.log('首次运行：下载并校验 Electron，可能需要几分钟……');
    await run(process.execPath, [path.join(FRAMEWORK_ROOT, 'scripts', 'ensure-electron.mjs')],
      { ...process.env, DSH_HOME: HOME });
    electron = await electronPath();
  }
  if (!electron) throw Error('Electron 安装失败，请查看上方网络或解压错误');
  return electron;
}

export async function run(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit',
      shell: process.platform === 'win32' && command.endsWith('.cmd') });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(Error(`${command} 退出码 ${code}`)));
  });
}

async function detached(args, name, env = process.env) {
  const log = await fs.open(path.join(STATE, `${name}.log`), 'a');
  try {
    const child = spawn(process.execPath, args, { cwd: ROOT, env, detached: true,
      stdio: ['ignore', log.fd, log.fd], windowsHide: true });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    await fs.writeFile(path.join(STATE, `${name}.pid`), String(child.pid));
    child.unref();
  } finally { await log.close(); }
}

async function galleryHealth() {
  try {
    const res = await fetch(`http://127.0.0.1:${GALLERY_PORT}/__yier_gallery_health`,
      { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.root !== ROOT) throw Error('动作库端口已被其他程序占用');
    return data;
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw error;
  }
}

export async function start(mode) {
  await fs.mkdir(STATE, { recursive: true });
  const cli = path.join(FRAMEWORK_ROOT, 'lib', 'standalone.js');
  if (!(await exists(cli))) throw Error('请先运行 node scripts/install.mjs 安装依赖');
  if (await ownedHealth()) {
    await setMode(mode);
  } else {
    const electron = await ensureElectron();
    await prepare(mode);
    await detached([cli, '--port', String(PORT)], 'pet',
      { ...process.env, DSH_HOME: HOME, DSH_PET_ELECTRON_PATH: electron });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (await ownedHealth()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw Error(`启动失败，请查看 ${path.join(STATE, 'pet.log')}`);
    await fs.writeFile(path.join(STATE, 'mode'), mode);
  }
  if (!(await galleryHealth())) await detached([path.join(ROOT, 'scripts', 'gallery_server.mjs')], 'gallery');
  for (let i = 0; i < 30; i++) {
    if (await galleryHealth()) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const status = await currentStatus();
  console.log(`${status.label}已启动：${status.description}（${status.instanceCount} 个实例）`);
  console.log(`预览与切换模式：http://127.0.0.1:${GALLERY_PORT}/review/`);
  return status;
}

export async function stop() {
  if (await ownedHealth()) await request('/shutdown', 'POST');
  if (await galleryHealth()) {
    const pid = Number(await fs.readFile(path.join(STATE, 'gallery.pid'), 'utf8'));
    if (Number.isSafeInteger(pid) && pid > 0) process.kill(pid, 'SIGTERM');
  }
  console.log('一二布布已停止。');
}

export async function openGallery() {
  const url = `http://127.0.0.1:${GALLERY_PORT}/review/`;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { await run(command, args); } catch { console.log(`请在浏览器打开 ${url}`); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2] || 'start';
    const at = process.argv.indexOf('--mode');
    const mode = at >= 0 ? process.argv[at + 1] : await selectedMode();
    if (action === 'start') await start(mode);
    else if (action === 'stop') await stop();
    else if (action === 'status') console.log(JSON.stringify(await currentStatus(), null, 2));
    else throw Error('用法：node scripts/runtime.mjs start|stop|status [--mode pair|duo]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
