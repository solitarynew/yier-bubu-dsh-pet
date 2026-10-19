const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture() {
  const timers = new Map(), handlers = new Map(); let next = 0;
  const win = { id:7, hidden:false, shown:0, closedListeners:0, hide(){this.hidden=true;},
    isDestroyed:()=>false, showInactive(){this.hidden=false;this.shown++;},
    once(){this.closedListeners++;} };
  const context = { module:{exports:{}}, setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},
    clearTimeout:id=>timers.delete(id), Math, Number, WeakSet, Map };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/interaction-main.cjs'),'utf8'),context);
  context.module.exports({ipcMain:{on:(name,fn)=>handlers.set(name,fn)},BrowserWindow:{fromWebContents:()=>win}});
  return {win,timers,send:data=>handlers.get('yier:companion-hidden')({sender:{}},data)};
}
test('hidden companion is automatically restored even if its renderer stops responding',()=>{
  const f=fixture();f.send({hidden:true,duration:6000});assert.equal(f.win.hidden,true);
  const watchdog=[...f.timers.values()][0]; assert.equal(watchdog.delay,6000);
  watchdog.fn();assert.equal(f.win.hidden,false);
});
test('explicit restore cancels the watchdog, repeated interactions install only one close listener',()=>{
  const f=fixture();
  for(let i=0;i<12;i++){f.send({hidden:true,duration:5000});f.send({hidden:false});}
  assert.equal(f.timers.size,0);assert.equal(f.win.hidden,false);assert.equal(f.win.closedListeners,1);
});
