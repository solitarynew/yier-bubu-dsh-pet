'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { KeyboardInput } = require('./yier-keyboard-input.cjs');

module.exports = function install({ ipcMain, BrowserWindow, app }) {
  const directory = process.env.YIER_BUBU_STATE_DIR;
  const subscribers = new Map(), observed = new WeakSet();
  let timer;
  const input = new KeyboardInput(frame => {
    for (const [id, win] of subscribers) {
      if (win.isDestroyed() || win.webContents.isDestroyed()) subscribers.delete(id);
      else win.webContents.send('yier:keyboard-frame', frame);
    }
  });
  function reconcile() {
    let mode = '', settings = {};
    try {
      mode = fs.readFileSync(path.join(directory, 'mode'), 'utf8').trim();
      try { settings = JSON.parse(fs.readFileSync(path.join(directory, 'menu-settings.json'), 'utf8')); } catch {}
    } catch {}
    input.configure({ enabled: subscribers.size > 0 && ['keyboard-pair', 'keyboard-yier', 'keyboard-bubu'].includes(mode),
      paused: settings.keyboardPaused === true, effects: settings.keyboardEffects !== false });
    if (!subscribers.size) { clearInterval(timer); timer = null; }
  }
  ipcMain.on('yier:keyboard-subscribe', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || typeof enabled !== 'boolean') return;
    if (enabled) {
      subscribers.set(win.id, win);
      // Pointer menus and dragging work without taking focus from the typing app.
      if (process.platform === 'win32') {
        const preventFocus = () => { if (!win.isDestroyed()) win.setFocusable(false); };
        if (win.isVisible()) preventFocus();
        else win.once('show', preventFocus);
      }
      if (!observed.has(win)) {
        observed.add(win);
        win.once('closed', () => { subscribers.delete(win.id); reconcile(); });
      }
      if (!timer) { timer = setInterval(reconcile, 500); timer.unref(); }
    } else subscribers.delete(win.id);
    reconcile();
    if (enabled && !event.sender.isDestroyed()) event.sender.send('yier:keyboard-frame', input.frame);
  });
  ipcMain.on('yier:keyboard-refresh', reconcile);
  ipcMain.on('yier:keyboard-retry', () => { input.retry(); reconcile(); });
  app.once('before-quit', () => { clearInterval(timer); subscribers.clear(); input.stop(); });
};
