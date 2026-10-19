'use strict';
// Hide only the sending companion window, with an independent recovery deadline.
module.exports = function install({ ipcMain, BrowserWindow }) {
  const hidden = new Map();
  const observed = new WeakSet();
  function restore(win) {
    clearTimeout(hidden.get(win.id)); hidden.delete(win.id);
    if (!win.isDestroyed()) win.showInactive();
  }
  ipcMain.on('yier:companion-hidden', (event, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || typeof data?.hidden !== 'boolean') return;
    if (!data.hidden) { restore(win); return; }
    clearTimeout(hidden.get(win.id));
    win.hide();
    const duration = Math.max(500, Math.min(10000, Number(data.duration) || 8000));
    hidden.set(win.id, setTimeout(() => restore(win), duration));
    if (!observed.has(win)) {
      observed.add(win);
      win.once('closed', () => { clearTimeout(hidden.get(win.id)); hidden.delete(win.id); });
    }
  });
};
