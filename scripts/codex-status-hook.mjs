#!/usr/bin/env node
// Intentionally forwards metadata only: no prompt, transcript, reply or tool arguments.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hookState } from './status-sync.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let enabled = false;
try { enabled = JSON.parse(await fs.readFile(path.join(root,'.runtime/menu-settings.json'),'utf8')).syncCodex === true; } catch {}
try {
  let text = '', oversized = false;
  process.stdin.setEncoding('utf8');
  // Always drain stdin, even while disabled, so the hook runner never gets a broken pipe.
  for await (const chunk of process.stdin) {
    if (enabled && !oversized) {
      text += chunk;
      if (text.length > 2 * 1024 * 1024) { oversized = true; text = ''; }
    }
  }
  if (enabled && !oversized) {
    const input = JSON.parse(text), state = hookState(input);
    if (state && typeof input.session_id === 'string') {
      const token = await fs.readFile(path.join(root,'.runtime/status-sync.token'),'utf8');
      await fetch('http://127.0.0.1:17341/api/status-sync/event', { method:'POST',
        headers:{'content-type':'application/json','x-yier-sync-token':token},
        body:JSON.stringify({sessionId:input.session_id.slice(0,200),state,
          revision:typeof input.turn_id==='string'?input.turn_id.slice(0,200):'',timestamp:Date.now()}),
        signal:AbortSignal.timeout(700) });
    }
  }
} catch { /* An unavailable pet must never interfere with Codex. */ }
process.stdout.write('{}\n');
