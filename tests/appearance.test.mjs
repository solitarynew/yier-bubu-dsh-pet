import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sharedSize } from '../scripts/appearance.mjs';
test('shared size has one validated value for every role',()=>{
 assert.equal(sharedSize({}, {size:490}),490);
 assert.equal(sharedSize({sharedSize:600},{size:490}),600);
 for(const value of [NaN,Infinity,'600',-1,901]) assert.throws(()=>sharedSize({sharedSize:value}));
});
test('asset scaling is identical for individual and combined clips, without artwork cropping',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../assets-manifest.json',import.meta.url))).animations;
 for(const row of rows){
  assert.equal(row.scale,258/162,`${row.pack}/${row.name}`);
  assert.ok((row.crop[2]-row.crop[0])*row.scale<=640);
  assert.ok((row.crop[3]-row.crop[1])*row.scale<=330);
 }
});

test('renderer and native pointer fallback agree on a hit area wide enough for normalized duo art', async()=>{
 const vm=await import('node:vm');
 const {createRequire}=await import('node:module'); const require=createRequire(import.meta.url);
 const source=fs.readFileSync(new URL('../node_modules/dsh-pet/runtime/electron-helper/shared-core.js',import.meta.url),'utf8');
 const rendered=vm.runInNewContext(source+'\nPetShared;').HIT_BOX;
 const pointer=require('../node_modules/dsh-pet/runtime/electron-helper/pointer-target.js').HIT_BOX;
 for(const key of ['x0','x1','y0','y1'])assert.equal(rendered[key],pointer[key]);
 const rows=JSON.parse(fs.readFileSync(new URL('../assets-manifest.json',import.meta.url))).animations;
 for(const row of rows){
  const width=Math.round((row.crop[2]-row.crop[0])*row.scale),x=Math.floor((640-width)/2);
  assert.ok(x>=rendered.x0 && x+width<=rendered.x1,`${row.pack}/${row.name}`);
 }
});
