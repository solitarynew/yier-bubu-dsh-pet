import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVENTS = ['SessionStart','UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','PreCompact','PostCompact','Stop','Interrupt','SessionEnd'];
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export async function installCodexHooks(directory = process.env.CODEX_HOME || path.join(os.homedir(),'.codex')) {
  const file = path.join(directory,'hooks.json');
  let config = {}, original = null;
  try { original = await fs.readFile(file,'utf8'); config = JSON.parse(original); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!config || typeof config !== 'object' || Array.isArray(config) || (config.hooks && (typeof config.hooks !== 'object' || Array.isArray(config.hooks)))) throw Error('已有 Codex hooks 配置格式无效，未覆盖');
  config.hooks ||= {};
  const command = [process.execPath,path.join(ROOT,'scripts/codex-status-hook.mjs'),'--yier-bubu-status-hook'].map(quote).join(' ');
  for (const event of EVENTS) {
    const groups = config.hooks[event] || [];
    if (!Array.isArray(groups)) throw Error('已有 Codex hooks 事件格式无效，未覆盖');
    const preserved = groups.map(group => ({...group, hooks:(group.hooks||[]).filter(hook=>!hook.command?.includes('--yier-bubu-status-hook'))})).filter(group=>group.hooks.length);
    config.hooks[event] = [...preserved,{hooks:[{type:'command',command,timeout:2}]}];
  }
  const next = JSON.stringify(config,null,2)+'\n';
  if (next !== original) {
    await fs.mkdir(directory,{recursive:true});
    if(original!==null)await fs.writeFile(file+'.yier-backup-'+Date.now(),original,{mode:0o600});
    const temp=file+'.yier.tmp';await fs.writeFile(temp,next,{mode:0o600});await fs.rename(temp,file);
  }
  return { installed:true, reviewRequired:true, file };
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await installCodexHooks()));
