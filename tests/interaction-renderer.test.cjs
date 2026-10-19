const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture() {
  let now = 1000, response = { enabled: true, session: { id: 'meeting', startAt: 1600, endAt: 5600,
    clips: { yier: '比心', bubu: '撒花' }, facing: { yier: 'right', bubu: 'left' } } };
  const timers = new Map(), reports = []; let counter = 0;
  class Sprite {
    constructor() {
      this.pet = {id:'yier'}; this.pos={x:100,y:200}; this.halfW=245; this.halfH=138;
      this.size=490; this.dragState={active:false}; this.menuOpen=false; this.throwRef=null;
      this.played=[]; this.random=0; this.ended=0; this.stops=0;
    }
    playIdle(){this.random++;} handleEnded(){this.ended++;}
    stopMove(){this.stops++;} stopThrow(){} playOnce(name){this.anim=name;this.played.push(name);}
    onPointerDown(){this.dragState.active=true;} onContextMenu(){this.menuOpen=true;}
    onMenuAction(){} dispose(){this.disposed=true;}
  }
  const context = { PetSprite:Sprite, Date:{now:()=>now}, Math, console,
    VIEW:{x:-145,y:-1080,w:1920,h:1961}, toScreen:n=>n,
    setTimeout:(fn,delay)=>{const id=++counter;timers.set(id,{fn,delay});return id;},
    clearTimeout:id=>timers.delete(id), window:{yierMenuBridge:{
      state:()=>({settings:{}}), reportInteraction:async data=>{reports.push(data);return response;}
    }} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/interaction-addon.js'),'utf8'),context);
  const sprite=new Sprite(); sprite.playIdle();
  async function run(delay,time=now){now=time;const entry=[...timers].find(([,t])=>t.delay===delay);assert.ok(entry,`timer ${delay}`);timers.delete(entry[0]);await entry[1].fn();}
  return {sprite,timers,reports,run,setResponse:r=>{response=r;}};
}
test('two-process session starts on schedule, uses live position, pauses random and resumes afterward', async()=>{
  const f=fixture(); await f.run(250);
  assert.equal(f.sprite.played.length,0);
  assert.equal(f.reports[0].x,200); assert.equal(f.reports[0].y,-742);
  await f.run(600,1600);
  assert.equal(f.sprite.anim,'比心'); assert.equal(f.sprite.facing,'right');
  assert.equal(f.sprite.customPos.rx,345/1920); assert.equal(f.sprite.stops,1);
  f.sprite.handleEnded(); f.sprite.playIdle();
  assert.equal(f.sprite.ended,0); assert.equal(f.sprite.random,1);
  await f.run(4000,5600);
  assert.equal(f.sprite._yierInteraction,null); assert.equal(f.sprite.random,2);
});
test('dragging interrupts immediately and prevents restarting the same session', async()=>{
  const f=fixture(); await f.run(250); await f.run(600,1600);
  f.sprite.onPointerDown(); assert.equal(f.sprite._yierInteraction,null);
  assert.equal(f.sprite.dragState.active,true);
  await f.run(250,1800); assert.equal(f.reports.at(-1).busy,true);
  assert.equal(f.sprite.played.length,1);
});
test('turning interaction off releases both pending timers and returns to normal activities', async()=>{
  const f=fixture(); await f.run(250); await f.run(600,1600);
  f.setResponse({enabled:false,session:null}); await f.run(250,1850);
  assert.equal(f.sprite._yierInteraction,null); assert.equal(f.sprite.random,2);
  assert.equal([...f.timers.values()].some(t=>t.delay===4000),false);
});
test('disposing a window stops polling and never leaves an interaction timer behind',async()=>{
  const f=fixture(); await f.run(250); f.sprite.dispose();
  assert.equal(f.timers.size,0); assert.equal(f.sprite.disposed,true);
});
