import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {addShots,integrate} from '../prepare.mjs'
import {safeRecord,parseSnapshot} from '../theme/shot-schema.mjs'
const chapters=Array.from({length:11},(_,i)=>JSON.parse(fs.readFileSync(new URL('../content/ch'+String(i+1).padStart(2,'0')+'.json',import.meta.url))))
test('approved course keeps 11 chapters and 64 sections',()=>{assert.equal(chapters.length,11);assert.equal(chapters.reduce((n,c)=>n+c.sections.length,0),64)})
test('all adapted units have real body and original practice material',()=>{const units=[1,2,3].flatMap(i=>JSON.parse(fs.readFileSync(new URL('../content/units-'+i+'.json',import.meta.url))));assert.equal(units.length,18);for(const u of units){assert.ok(u.officialCore.length>50);assert.ok(u.steps.length>=3);assert.ok(u.material&&u.prompt&&u.reference);assert.ok(integrate(u).includes(u.steps[0]))}})
test('every top level ordered step gets its own stable screenshot ID',()=>{const manifest=[],html=addShots('<ol><li>A<ol><li>nested</li></ol></li><li>B</li></ol>','ch01-s01',{route:'/x',section:'test'},manifest);assert.equal(manifest.length,2);assert.ok(html.includes('ch01-s01-step01'));assert.ok(html.includes('ch01-s01-step02'))})
test('explanation without steps gets an optional overview image',()=>{const m=[];addShots('<p>Text</p>','ch01-s01',{route:'/x',section:'test'},m);assert.equal(m[0].id,'ch01-s01-overview');assert.equal(m[0].optional,true)})
test('uploaded screenshot data rejects SVG and active HTML',()=>{for(const data of ['javascript:alert(1)','data:text/html;base64,AA==','data:image/svg+xml;base64,AA=='])assert.throws(()=>safeRecord({images:[{data,width:10,height:10}]}))})
test('slot maximum and dimension guards are enforced',()=>{const image={data:'data:image/png;base64,AAAA',width:10,height:10};assert.throws(()=>safeRecord({images:Array(7).fill(image)}));assert.throws(()=>safeRecord({images:[{...image,width:999999}]}))})
test('site backups are isolated by default',()=>{assert.throws(()=>parseSnapshot({schema:'xingmang-screenshots/1',siteId:'newapi',records:{}},'sub2api',new Map()))})
test('only explicitly shared software images cross sites',()=>{const r=parseSnapshot({schema:'xingmang-screenshots/1',siteId:'newapi',records:{a:{scope:'shared',images:[]},b:{scope:'shared',images:[]}}},'sub2api',new Map([['a',{siteOnly:false}],['b',{siteOnly:true}]]),true);assert.deepEqual(Object.keys(r.records),['a']);assert.deepEqual(r.skipped,['b'])})
test('unknown old slots are retained and reported rather than silently lost',()=>{const r=parseSnapshot({schema:'xingmang-screenshots/1',siteId:'sub2api',records:{old:{images:[],caption:'keep'}}},'sub2api',new Map());assert.equal(r.records.old.caption,'keep');assert.deepEqual(r.unknown,['old'])})
test('prototype-shaped IDs are refused',()=>{assert.throws(()=>parseSnapshot(JSON.parse('{"schema":"xingmang-screenshots/1","siteId":"sub2api","records":{"__proto__":{"images":[]}}}'),'sub2api',new Map()))})
