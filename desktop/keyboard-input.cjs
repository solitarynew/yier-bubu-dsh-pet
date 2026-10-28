'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');

// One bounded, ephemeral bitmask stream shared by every bear window.
class KeyboardInput {
  constructor(onFrame, options = {}) {
    this.onFrame = onFrame;
    this.spawn = options.spawn || spawn;
    this.platform = options.platform || process.platform;
    this.source = options.source || path.join(__dirname, 'yier-keyboard-state.cs');
    this.parent = options.parent || process.pid;
    this.clock = options.clock || Date.now;
    this.setInterval = options.setInterval || setInterval;
    this.clearInterval = options.clearInterval || clearInterval;
    this.child = null; this.generation = 0; this.buffer = '';
    this.frame = { status: 'idle', mask: 0, effects: true };
  }
  publish(status, mask = 0) {
    const next = { status, mask, effects: this.effects !== false };
    if (JSON.stringify(next) === JSON.stringify(this.frame)) return;
    this.frame = next; this.onFrame(next);
  }
  configure({ enabled, paused = false, effects = true }) {
    this.effects = effects;
    if (!enabled || paused || this.platform !== 'win32') {
      this.failed = false;
      this.stop(!enabled ? 'idle' : paused ? 'paused' : 'unavailable'); return;
    }
    if (!this.child && !this.failed) this.start();
    else this.publish(this.frame.status, this.frame.mask);
  }
  start() {
    const generation = ++this.generation;
    this.buffer = ''; this.lastFrame = this.clock();
    this.publish('starting');
    // Add-Type loads our reviewed C# source. No execution-policy changes or extra packages.
    const command = "Add-Type -Path '" + this.source.replaceAll("'", "''") + "'; [YierBubu.KeyboardState]::Run(" + this.parent + ')';
    try {
      const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const child = this.spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        if (this.generation !== generation) return;
        this.buffer += chunk;
        if (this.buffer.length > 8192) { this.stop('error'); return; }
        let end;
        while ((end = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, end).trim(); this.buffer = this.buffer.slice(end + 1);
          if (!/^(0|[1-9]\d{0,9})$/.test(line)) continue;
          const mask = Number(line);
          if (!Number.isSafeInteger(mask) || mask > 0xffffffff) continue;
          this.lastFrame = this.clock(); this.publish('listening', mask);
        }
      });
      // Never forward native stdout/stderr to logs: it contains current key state.
      child.stderr.resume();
      child.once('error', () => { if (this.generation === generation) this.stop('error'); });
      child.once('exit', () => { if (this.generation === generation) this.stop('error'); });
      this.watchdog = this.setInterval(() => {
        if (this.clock() - this.lastFrame > (this.frame.status === 'starting' ? 15000 : 5000)) this.stop('error');
      }, 1000);
      this.watchdog.unref?.();
    } catch { this.stop('error'); }
  }
  stop(status = 'idle') {
    if (status === 'error') this.failed = true;
    this.generation++;
    this.clearInterval(this.watchdog); this.watchdog = null;
    const child = this.child; this.child = null; this.buffer = '';
    if (child) child.kill();
    this.publish(status);
  }
  retry() { this.failed = false; this.stop(); }
}
module.exports = { KeyboardInput };
