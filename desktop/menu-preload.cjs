'use strict';
// A narrow bridge: read only our settings; send only allowlisted local commands.
const { contextBridge } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.YIER_BUBU_STATE_DIR;
function state() {
  let mode = 'pair', settings = {};
  if (directory) {
    try { mode = fs.readFileSync(path.join(directory, 'mode'), 'utf8').trim(); } catch {}
    try { settings = JSON.parse(fs.readFileSync(path.join(directory, 'menu-settings.json'), 'utf8')); } catch {}
  }
  return { mode: mode === 'duo' ? 'duo' : 'pair', settings };
}
function send(route, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({ hostname: '127.0.0.1', port: 17341, path: route,
      method: 'POST', headers: { 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data) }, timeout: 6000 }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; if (text.length > 16384) req.destroy(Error('响应过大')); });
      res.on('end', () => {
        try {
          const result = JSON.parse(text);
          if (res.statusCode >= 400) reject(Error(result.error || '操作失败'));
          else resolve(result);
        } catch (error) { reject(error); }
      });
    });
    req.on('timeout', () => req.destroy(Error('操作超时')));
    req.on('error', reject);
    req.end(data);
  });
}
contextBridge.exposeInMainWorld('yierMenuBridge', {
  state,
  setMode(mode) {
    if (!['pair', 'duo'].includes(mode)) return Promise.reject(Error('无效模式'));
    return send('/api/mode', { mode });
  },
  saveSettings(pet, settings) {
    if (!['yier', 'bubu', 'duo'].includes(pet)) return Promise.reject(Error('无效角色'));
    return send('/api/settings', { pet, ...settings });
  },
  reportInteraction(report) { return send('/api/interaction/report', report); },
  setInteraction(enabled) {
    if (typeof enabled !== 'boolean') return Promise.reject(Error('无效互动设置'));
    return send('/api/interaction/setting', { enabled });
  },
  quit() { return send('/api/quit', {}); },
});
