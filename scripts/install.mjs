#!/usr/bin/env node
/** One entry point: install locked npm dependencies, obtain Electron, start pets. */
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ROOT, HOME, STATE, exists, readJSON, run, ensureElectron, start, selectedMode, openGallery } from './runtime.mjs';
import { ensureKeyboardArtwork } from './keyboard-artwork.mjs';

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw Error('需要 Node.js 22.12 或更新版本，请从 https://nodejs.org/ 安装 LTS 版');
  await fs.mkdir(STATE, { recursive: true });
  const manifest = await readJSON(path.join(ROOT, 'assets-manifest.json'));
  console.log('校验 49 组角色素材……');
  for (const row of manifest.animations) {
    const file = path.join(ROOT, row.file);
    if (!(await exists(file))) throw Error(`素材缺失：${row.file}，请完整解压项目后重试`);
    const hash = createHash('sha256').update(await fs.readFile(file)).digest('hex');
    if (hash !== row.sha256) throw Error(`素材校验失败：${row.file}，请重新下载`);
  }
  let installed;
  try { installed = await readJSON(path.join(ROOT, 'node_modules/dsh-pet/package.json')); } catch {}
  if (installed?.version !== '0.3.7' || process.argv.includes('--reinstall')) {
    console.log('安装固定版本的 dsh-pet 依赖……');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await run(npm, ['ci', '--ignore-scripts', '--legacy-peer-deps', '--omit=dev', '--no-audit', '--no-fund']);
  }
  await ensureElectron();
  if (process.platform === 'win32') await ensureKeyboardArtwork();
  const at = process.argv.indexOf('--mode');
  const mode = at >= 0 ? process.argv[at + 1] : await selectedMode();
  await start(mode);
  if (process.argv.includes('--review')) await openGallery();
  console.log('安装完成。右键桌宠操作即可，下次运行同一个脚本即可启动。');
} catch (error) {
  console.error(`\n安装/启动失败：${error.message}`);
  console.error(`日志目录：${path.join(ROOT, '.runtime')}`);
  process.exitCode = 1;
}
