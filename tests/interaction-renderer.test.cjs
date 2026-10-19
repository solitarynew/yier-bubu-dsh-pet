const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture(pet = 'yier') {
  let now = 1000, response = { enabled: true, session: { id: 'meeting', startAt: 1600, endAt: 5600,
    clips: { yier: '比心', bubu: '撒花' }, facing: { yier: 'right', bubu: 'left' } } };
  const timers = new Map(), reports = [], hidden = []; let counter = 0;
  class Sprite {
    constructor() {
      this.pet = {id:pet}; this.anim = '坐着发呆'; this.assetBase = '/thumb/'+pet+'/'; this.el = {style:{visibility:''}}; this.pos={x:100,y:200}; this.halfW=245; this.halfH=138;
      this.size=490; this.dragState={active:false}; this.menuOpen=false; this.throwRef=null;
      this.played=[]; this.random=0; this.ended=0; this.stops=0;
    }
    playIdle(){this.random++;} handleEnded(){this.ended++;}
    stopMove(){this.stops++;} stopThrow(){} playOnce(name){this.anim=name;this.played.push(name);}
    onPointerDown(){this.dragState.active=true;} onContextMenu(){this.menuOpen=true;}
    sendBounds(x,y){this.pos={x,y};} setInteractive(value){this.interactive=value;}
    onMenuAction(){} dispose(){this.disposed=true;}
  }
  const context = { PetSprite:Sprite, Date:{now:()=>now}, Math, console,
    BASE:'/pet', toLocal:n=>n, VIEW:{x:-145,y:-1080,w:1920,h:1961}, toScreen:n=>n,
    setTimeout:(fn,delay)=>{const id=++counter;timers.set(id,{fn,delay});return id;},
    clearTimeout:id=>timers.delete(id), window:{yierMenuBridge:{
      setCompanionHidden:(value,duration)=>hidden.push({value,duration}),
      state:()=>({settings:{}}), reportInteraction:async data=>{reports.push(data);return response;}
    }} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/interaction-addon.js'),'utf8'),context);
  const sprite=new Sprite(); sprite.playIdle();
  async function run(delay,time=now){now=time;const entry=[...timers].find(([,t])=>t.delay===delay);assert.ok(entry,`timer ${delay}`);timers.delete(entry[0]);await entry[1].fn();}
  return {sprite,timers,reports,hidden,run,setResponse:r=>{response=r;}};
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


const merged = { enabled:true, session:{ id:'hug', kind:'duo', duoAnim:'抱抱',
  startAt:1600, endAt:6800, anchor:{x:320,y:-742} } };
test('merged scene uses the duo asset at the shared center and restores original role and position',async()=>{
  const f=fixture(); f.setResponse(merged); await f.run(250); await f.run(600,1600);
  assert.equal(f.sprite.assetBase,'/pet/thumb/duo/'); assert.equal(f.sprite.anim,'抱抱');
  assert.equal(f.sprite.pos.x,220); assert.equal(f.sprite.facing,'left');
  await f.run(5200,6800);
  assert.equal(f.sprite.assetBase,'/thumb/yier/'); assert.equal(f.sprite.pos.x,100);
  assert.equal(f.sprite.anim,'坐着发呆'); assert.equal(f.sprite.random,2);
});
test('companion is hidden during a merged scene and restored when interaction is disabled',async()=>{
  const f=fixture('bubu'); f.setResponse(merged); await f.run(250); await f.run(600,1600);
  assert.equal(f.sprite.el.style.visibility,'hidden'); assert.equal(f.hidden.at(-1).value,true);
  assert.equal(f.sprite.interactive,false);
  f.setResponse({enabled:false,session:null}); await f.run(250,1850);
  assert.equal(f.sprite.el.style.visibility,''); assert.equal(f.hidden.at(-1).value,false);
  assert.equal(f.sprite.assetBase,'/thumb/bubu/'); assert.equal(f.sprite.random,2);
});
test('grabbing a merged character immediately restores its individual skin at the grab position',async()=>{
  const f=fixture(); f.setResponse(merged); await f.run(250); await f.run(600,1600);
  f.sprite.onPointerDown();
  assert.equal(f.sprite.assetBase,'/thumb/yier/'); assert.equal(f.sprite.pos.x,220);
  assert.equal(f.sprite._yierInteraction,null); assert.equal(f.sprite.dragState.active,true);
});
