/** Reference art remains local; the source repository distributes the adapter, not third-party PNGs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KEYBOARD_ART = path.join(ROOT, '.runtime', 'keyboard-reference');
const URL = 'https://github.com/Li-Jiangjiu/YierBubu/releases/download/v0.4.0-beta.3/YierBubu-macOS-Universal-v0.4.0-beta.3.zip';
const HASH = 'e4aa6030330ec0fdbb31bd63d6739793f1086cacf82b4eea1e4187ed8ddaed6b';
export const ART_FILES = ['compact-scene.png', 'compact-cleanplate.png', 'compact-paws.png'];
let preparing;
export async function ensureKeyboardArtwork() {
  if (preparing) return preparing;
  preparing = prepare().finally(() => { preparing = null; });
  return preparing;
}
async function prepare() {
  const marker = path.join(KEYBOARD_ART, 'verified.json');
  try {
    const hashes = JSON.parse(await fs.readFile(marker, 'utf8'));
    for (const file of ART_FILES) {
      const data = await fs.readFile(path.join(KEYBOARD_ART, file));
      if (createHash('sha256').update(data).digest('hex') !== hashes[file]) throw Error('Artwork changed');
    }
    return KEYBOARD_ART;
  } catch {}
  await fs.mkdir(KEYBOARD_ART, { recursive: true });
  const archive = path.join(KEYBOARD_ART, 'reference.zip');
  let valid = false;
  try { valid = createHash('sha256').update(await fs.readFile(archive)).digest('hex') === HASH; } catch {}
  if (!valid) {
    console.log('下载二维键盘角色参考资源（约 5.7 MB，仅首次）……');
    if (process.platform !== 'win32') throw Error('键盘同步目前支持 Windows');
    // Invoke-WebRequest uses the user's existing Windows proxy settings.
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    const command = "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri " + quote(URL) + ' -OutFile ' + quote(archive);
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'inherit' });
      const timeout = setTimeout(() => { child.kill(); reject(Error('角色资源下载超时，请检查网络后重试')); }, 120000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Error('角色资源下载失败')); });
    });
  }
  if (createHash('sha256').update(await fs.readFile(archive)).digest('hex') !== HASH) throw Error('角色参考包 SHA256 校验失败');
  const { default: extract } = await import('@electron-internal/extract-zip');
  const unpack = path.join(KEYBOARD_ART, 'unpacked');
  await fs.mkdir(unpack, { recursive: true });
  await extract(archive, { dir: unpack });
  const hashes = {};
  for (const file of ART_FILES) {
    const data = await fs.readFile(path.join(unpack, 'YierBubu', 'YierBubu.app', 'Contents', 'Resources', 'Layered', file));
    if (data.readUInt32BE(16) !== 1536 || data.readUInt32BE(20) !== 1024 || data[25] !== 6) throw Error('角色参考 PNG 格式不匹配');
    await fs.writeFile(path.join(KEYBOARD_ART, file), data);
    hashes[file] = createHash('sha256').update(data).digest('hex');
  }
  await fs.writeFile(marker, JSON.stringify(hashes, null, 2) + '\n');
  return KEYBOARD_ART;
}
