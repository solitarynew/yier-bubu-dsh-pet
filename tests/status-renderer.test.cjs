const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function fixture(){let now=1000, response={sources:{codex:{enabled:true,connected:true,label:'处理中'}},display:{source:'codex',state:'working',key:'a',label:'Codex · 处理中'}};let next=0;const timers=new Map();
 class Sprite{constructor(){this.pet={id:'yier'};this.dragState={active:false};this.menuOpen=false;this.throwRef=null;this.anim='待机';this.el={appendChild:()=>{}};this.played=[];this.random=0;}
 playIdle(){this.random++;}handleEnded(){this.playIdle();}stopMove(){}playOnce(name){this.anim=name;this.played.push(name);}dispose(){}}
 const context={PetSprite:Sprite,Date:{now:()=>now},document:{createElement:()=>({style:{},textContent:'',remove(){}})},setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id),window:{yierMenuBridge:{pollStatus:async()=>response}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/status-sync-addon.js'),'utf8'),context);const sprite=new Sprite();sprite.playIdle();
 return{sprite,timers,set:r=>{response=r;},time:t=>{now=t;},run:async ms=>{const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry);timers.delete(entry[0]);await entry[1].fn();}};
}
test('live status loops the matching role animation and a disabled source restores random activity',async()=>{
 const f=fixture();await f.run(150);assert.equal(f.sprite.anim,'打电脑');assert.equal(f.sprite._yierStatusBadge.textContent,'Codex · 处理中');
 f.sprite.handleEnded();assert.equal(f.sprite.played.at(-1),'打电脑');
 f.set({sources:{codex:{enabled:false,label:'已关闭'}},display:null});await f.run(750);assert.equal(f.sprite.random,2);assert.equal(f.sprite._yierStatusBadge.textContent,'');
});
test('manual actions and merged interactions take priority over status animations',async()=>{
 const f=fixture();f.sprite._yierManualUntil=9000;f.sprite.anim='比心';await f.run(150);assert.equal(f.sprite.anim,'比心');
 f.time(10000);f.sprite._yierInteraction={kind:'duo'};await f.run(750);assert.equal(f.sprite.anim,'比心');
 f.sprite._yierInteraction=null;await f.run(750);assert.equal(f.sprite.anim,'打电脑');
 f.sprite.dispose();assert.equal(f.timers.size,0);
});
