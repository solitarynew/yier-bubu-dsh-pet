'use strict';
// A narrow bridge: read only our settings; send only allowlisted local commands.
const { contextBridge, ipcRenderer } = require('electron');
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
  return { mode: ['pair', 'duo', 'keyboard-pair', 'keyboard-yier', 'keyboard-bubu'].includes(mode) ? mode : 'pair', settings, platform: process.platform };
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
  pollStatus() { return send('/api/status-sync/poll', {}); },
  setStatusSync(source,enabled) {
    if (!['codex','dsh'].includes(source) || typeof enabled!=='boolean') return Promise.reject(Error('无效同步设置'));
    return send('/api/status-sync/setting',{source,enabled});
  },
  openSyncSettings() { ipcRenderer.send('yier:open-sync-settings'); },
  setMode(mode) {
    if (!['pair', 'duo', 'keyboard-pair', 'keyboard-yier', 'keyboard-bubu'].includes(mode)) return Promise.reject(Error('无效模式'));
    return send('/api/mode', { mode });
  },
  setKeyboardSetting(setting, value) {
    if (!['paused', 'effects'].includes(setting) || typeof value !== 'boolean') return Promise.reject(Error('无效键盘设置'));
    return send('/api/keyboard/setting', { setting, value }).then(result => {
      ipcRenderer.send('yier:keyboard-refresh');
      return result;
    });
  },
  onKeyboard(callback) {
    if (typeof callback !== 'function') throw Error('需要键盘状态回调');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('yier:keyboard-frame', listener);
    ipcRenderer.send('yier:keyboard-subscribe', true);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      ipcRenderer.removeListener('yier:keyboard-frame', listener);
      ipcRenderer.send('yier:keyboard-subscribe', false);
    };
  },
  retryKeyboard() { ipcRenderer.send('yier:keyboard-retry'); },
  saveSettings(pet, settings) {
    if (!['yier', 'bubu', 'duo'].includes(pet)) return Promise.reject(Error('无效角色'));
    return send('/api/settings', { pet, ...settings });
  },
  reportInteraction(report) { return send('/api/interaction/report', report); },
  setCompanionHidden(hidden, duration) {
    if (typeof hidden === 'boolean') ipcRenderer.send('yier:companion-hidden', { hidden, duration });
  },
  setSize(size) {
    if (![380, 490, 600].includes(size)) return Promise.reject(Error('无效共享大小'));
    return send('/api/size', { size });
  },
  setInteractionStyle(style) {
    if (!['mixed', 'duo', 'sync'].includes(style)) return Promise.reject(Error('无效互动方式'));
    return send('/api/interaction/style', { style });
  },
  setInteraction(enabled) {
    if (typeof enabled !== 'boolean') return Promise.reject(Error('无效互动设置'));
    return send('/api/interaction/setting', { enabled });
  },
  quit() { return send('/api/quit', {}); },
});
