#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { ROOT, GALLERY_PORT, PORT, currentStatus, setMode, MODES, readJSON } from './runtime.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webm': 'video/webm', '.json': 'application/json; charset=utf-8' };
let changingMode = false;
function json(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}
async function body(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 2048) throw Error('请求过大');
    chunks.push(chunk);
  }
  const result = JSON.parse(Buffer.concat(chunks).toString());
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('无效请求');
  return result;
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${GALLERY_PORT}` && req.headers.host !== `localhost:${GALLERY_PORT}`) {
      return json(res, 403, { error: '无效的 Host' });
    }
    const url = new URL(req.url, `http://127.0.0.1:${GALLERY_PORT}`);
    if (req.method === 'GET' && url.pathname === '/__yier_gallery_health') {
      return json(res, 200, { root: ROOT });
    }
    if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, await currentStatus());
    if (req.method === 'POST') {
      const allowedOrigins = [`http://127.0.0.1:${GALLERY_PORT}`, `http://localhost:${GALLERY_PORT}`];
      if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) return json(res, 403, { error: '无效来源' });
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
        return json(res, 415, { error: '需要 application/json' });
      }
      const data = await body(req);
      if (url.pathname === '/api/mode') {
        if (!MODES[data.mode]) return json(res, 400, { error: '模式只能是双人版或组合版' });
        if (changingMode) return json(res, 409, { error: '正在切换模式，请稍候' });
        changingMode = true;
        try { return json(res, 200, await setMode(data.mode)); }
        finally { changingMode = false; }
      }
      if (url.pathname === '/api/anim') {
        const pet = url.searchParams.get('pet');
        const status = await currentStatus();
        if (!status.running || !status.pets.includes(pet)) {
          return json(res, 409, { error: pet === 'duo' ? '请先切换到组合版' : '请先切换到双人版' });
        }
        const manifest = await readJSON(path.join(ROOT, 'assets-manifest.json'));
        if (!manifest.animations.some(row => row.pack === pet && row.name === data.name)) {
          return json(res, 400, { error: '未知动作' });
        }
        const upstream = await fetch(`http://127.0.0.1:${PORT}/dsh-pet-7340/anim?pet=${pet}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name }), signal: AbortSignal.timeout(4000),
        });
        return json(res, upstream.status, await upstream.json());
      }
      return json(res, 404, { error: '未知接口' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '不支持的方法' });
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/review/';
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(ROOT, '.' + relative);
    const rootRelative = path.relative(ROOT, file);
    if (rootRelative.startsWith('..') || !['review', 'packs'].includes(rootRelative.split(path.sep)[0])) {
      return json(res, 404, { error: '文件不存在' });
    }
    const real = await fs.realpath(file);
    if (path.relative(ROOT, real).startsWith('..')) return json(res, 404, { error: '文件不存在' });
    const stat = await fs.stat(file);
    if (!stat.isFile() || !mime[path.extname(file)]) return json(res, 404, { error: '文件不存在' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.destroy();
    return json(res, error.code === 'ENOENT' ? 404 : 500, { error: error.message });
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(GALLERY_PORT, '127.0.0.1', () => console.log(`动作库：http://127.0.0.1:${GALLERY_PORT}/review/`));
