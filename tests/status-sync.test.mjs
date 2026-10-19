import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {StatusSync,hookState,parseDshState,dshStateUrl,STATUS_ACTIONS} from '../scripts/status-sync.mjs';
import {installCodexHooks} from '../scripts/install-codex-hooks.mjs';
function fixture(){let time=1000;return{sync:new StatusSync({now:()=>time,staleSeconds:10,terminalSeconds:2}),time:value=>{time=value;}};}
test('source switches are independent, and disabling immediately removes that source',()=>{
 const {sync}=fixture();sync.enable('codex',true);sync.push('codex',{state:'working'});
 assert.equal(sync.snapshot().display.source,'codex');assert.equal(sync.snapshot().sources.dsh.enabled,false);
 sync.enable('dsh',true);sync.push('dsh',{state:'waiting'});assert.equal(sync.snapshot().display.source,'dsh');
 sync.enable('dsh',false);assert.equal(sync.snapshot().display.source,'codex');
 sync.enable('codex',false);assert.equal(sync.snapshot().display,null);
 assert.equal(sync.push('codex',{state:'working'}),false);
});
test('expired events return to ordinary pet behavior without pretending a task completed',()=>{
 const f=fixture();f.sync.enable('codex',true);f.sync.push('codex',{state:'working'});f.time(12000);
 assert.equal(f.sync.snapshot().display,null);assert.equal(f.sync.snapshot().sources.codex.connected,false);
 assert.match(f.sync.snapshot().sources.codex.label,/等待/);
});
test('multi-session aggregation and event ordering preserve active work over terminal states',()=>{
 const f=fixture();f.sync.enable('codex',true);
 f.sync.push('codex',{sessionId:'a',state:'working',timestamp:1000});
 f.time(2000);f.sync.push('codex',{sessionId:'b',state:'success',timestamp:2000});
 assert.equal(f.sync.snapshot().display.state,'working');
 f.sync.push('codex',{sessionId:'a',state:'idle',timestamp:500});assert.equal(f.sync.snapshot().display.state,'working');
 f.sync.push('codex',{sessionId:'a',state:'idle',timestamp:2000});assert.equal(f.sync.snapshot().display.state,'success');
});
test('repeated DSH terminal snapshots do not replay an old completion forever',()=>{
 const f=fixture();f.sync.enable('dsh',true);f.sync.push('dsh',{state:'success',revision:'123'});
 f.time(3500);f.sync.push('dsh',{state:'success',revision:'123'});assert.equal(f.sync.snapshot().display,null);
});
test('DSH adapter rejects unrelated services, unknown states and non-local URLs',()=>{
 assert.deepEqual(parseDshState({sections:{workStatus:{counter:1,data:{state:'working',task:'ignored'}}}}),{state:'working',revision:'1'});
 assert.deepEqual(parseDshState({sections:{workStatus:{counter:0,data:null}}}),{state:'idle',revision:'0'});
 for(const body of [{},{status:'working'},{sections:{workStatus:{counter:1,data:{state:'made-up'}}}}])assert.throws(()=>parseDshState(body));
 assert.ok(dshStateUrl('http://localhost:3000/dsh-pet-7340/state'));
 for(const url of ['https://example.com/state','http://127.0.0.1:17340/state','http://user:pass@localhost:3000/state'])assert.throws(()=>dshStateUrl(url));
});
test('Codex hook events use lifecycle metadata, not model reply text',()=>{
 for(const [event,state] of [['UserPromptSubmit','working'],['PermissionRequest','waiting'],['PostToolUse','working'],['Stop','success'],['Interrupt','idle']])assert.equal(hookState({hook_event_name:event,prompt:'private'}),state);
 assert.equal(hookState({hook_event_name:'PostToolUse',tool_response:{is_error:true}}),'error');
 assert.equal(hookState({hook_event_name:'Unknown'}),null);
});
test('every mapped status action exists in its role pack',async()=>{
 const rows=JSON.parse(await fs.readFile(new URL('../assets-manifest.json',import.meta.url),'utf8')).animations;
 for(const [pack,states]of Object.entries(STATUS_ACTIONS))for(const name of Object.values(states))assert.ok(rows.some(row=>row.pack===pack&&row.name===name),`${pack}/${name}`);
});
test('hook installation preserves other hooks, is idempotent and never records hook trust',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yier-hooks-'));
 try{
  const file=path.join(dir,'hooks.json');await fs.writeFile(file,JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command:'existing-check'}]}]},other:'keep'}));
  const result=await installCodexHooks(dir);assert.equal(result.reviewRequired,true);
  const first=await fs.readFile(file,'utf8');await installCodexHooks(dir);assert.equal(await fs.readFile(file,'utf8'),first);
  const config=JSON.parse(first);assert.equal(config.other,'keep');assert.equal(config.hooks.Stop[0].hooks[0].command,'existing-check');
  assert.equal(config.hooks.Stop.filter(group=>group.hooks.some(h=>h.command.includes('--yier-bubu-status-hook'))).length,1);
  assert.equal((await fs.readdir(dir)).some(name=>/trust/.test(name)),false);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
