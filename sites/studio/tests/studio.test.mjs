import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {addShots,integrate,attachCourseFigures} from '../prepare.mjs'
import {safeRecord,parseSnapshot} from '../theme/shot-schema.mjs'
const catalog=JSON.parse(fs.readFileSync(new URL('../content/yichen/catalog.json',import.meta.url)))
const chapters=catalog.chapters.map(meta=>JSON.parse(fs.readFileSync(new URL('../content/yichen/chapters/'+meta.id+'.json',import.meta.url))))
test('tool connection goes through manager instead of a tools hub',()=>{
  const hub=fs.readFileSync(new URL('../theme/StudioHub.vue',import.meta.url),'utf8')
  const layout=fs.readFileSync(new URL('../theme/StudioLayout.vue',import.meta.url),'utf8')
  const prepare=fs.readFileSync(new URL('../prepare.mjs',import.meta.url),'utf8')
  assert.equal(hub.includes("kind==='tools'"),false)
  assert.equal(hub.includes('href="/tools"'),false)
  assert.equal(layout.includes("['◇','工具接入','/tools']"),false)
  assert.ok(layout.includes('/guide/manager'))
  assert.equal(prepare.includes('StudioHub kind="tools"'),false)
  assert.ok(prepare.includes('/guide/manager'))
})
test('course figures become locally replaceable slots instead of hardcoded images',()=>{
  const manifest=[]
  const chapter=attachCourseFigures({
    id:'ch01',shortTitle:'认清界面',
    sections:[{title:'搜索',body:'<p>x</p><figure class="yichen-figure"><img src="/img/shared/yichen/a.png" alt="搜索"></figure>'}]
  },manifest)
  assert.equal(chapter.sections[0].body.includes('data-shot-id="fig-ch01-s01-01"'),true)
  assert.ok(chapter.sections[0].body.includes('<img src="/img/shared/yichen/a.png"'))
  assert.equal(manifest[0].capturePolicy,'published')
  assert.equal(manifest[0].fallback,'/img/shared/yichen/a.png')
})
test('course catalog keeps teaching chapters and drops junk tweets',()=>{
  assert.equal(catalog.title,'Codex 零基础')
  assert.equal(catalog.parts.length,2)
  assert.equal(chapters.length,2)
  assert.equal(chapters[0].title.includes('认清'),true)
  assert.equal(chapters[1].title.includes('办公四件套'),true)
  assert.equal(chapters.some(ch=>/Sites|备案|Obsidian|Computer Use|微信双开|变现杠杆|未收录/.test(ch.title)),false)
})
test('illustrated chapters keep teaching figures and drop promo plus empty shot hosts',()=>{
  const banned=/yichen365ai|gamsgo\.com|赚杯咖啡|私信找我|yichen10801|ss-shot-host|本节依据与适用范围|无需截图/
  const text=chapters.flatMap(ch=>ch.sections.map(s=>s.body)).join('\n')
  assert.equal(banned.test(text),false)
  assert.ok(chapters[0].imageCount>=12)
  const nav=chapters[0].sections.find(s=>s.title.includes('左侧入口'))
  const settings=chapters[0].sections.find(s=>s.title.includes('设置页'))
  assert.ok(nav.body.includes('HHmwSdOaQAAlP2t.png'))
  assert.equal(nav.body.includes('HHmwGrmaMAA9LPK.jpg'),false)
  assert.ok(settings.body.includes('HHmvw_iacAAfIMi.jpg'))
  assert.ok(settings.body.includes('HHmwJzpaYAAU3Gp.jpg'))
  assert.ok(settings.body.includes('电脑操控'))
  const office=chapters.find(ch=>ch.title.includes('办公四件套'))
  const video=office.sections.find(s=>s.title.includes('3D 视频'))
  const sleep=office.sections.find(s=>s.title.includes('早睡早起')||s.title.includes('做网站'))
  assert.ok(video.body.includes('HIAmOONaQAA3uS7.jpg'))
  assert.equal(video.body.includes('HIAlwMhasAAAqo9.png'),false)
  assert.ok(sleep.body.includes('HIAmIPoaMAA7lCp.jpg'))
  assert.equal(sleep.body.includes('HIAltNFbEAAPS6V.jpg'),false)
  assert.equal(/OpenRouter|白嫖Token|Yichen tutorial writing|实战demo/.test(text),false)
  const download=chapters[0].sections.find(s=>s.title.includes('下载和登录'))
  assert.ok(download.body.includes('/guide/manager'))
  const tutorial=office.sections.find(s=>s.title.includes('图文教程'))
  assert.ok(tutorial.body.includes('HIAl8MvaEAAmSLO-mosaic.jpg'))
  assert.ok(tutorial.body.includes('所以，我直接干脆让Codex来写!'))
  assert.equal(tutorial.body.includes('92W'), false)
})
test('all adapted units have real body and original practice material',()=>{const units=[1,2,3].flatMap(i=>JSON.parse(fs.readFileSync(new URL('../content/units-'+i+'.json',import.meta.url))));assert.equal(units.length,18);for(const u of units){assert.ok(u.officialCore.length>50);assert.ok(u.steps.length>=3);assert.ok(u.material&&u.prompt&&u.reference);assert.ok(integrate(u).includes(u.steps[0]))}})
test('every top level ordered step gets its own stable screenshot ID',()=>{const manifest=[],html=addShots('<ol><li>A<ol><li>nested</li></ol></li><li>B</li></ol>','ch01-s01',{route:'/x',section:'test'},manifest);assert.equal(manifest.length,2);assert.ok(html.includes('ch01-s01-step01'));assert.ok(html.includes('ch01-s01-step02'))})
test('explanation without steps gets an optional overview image',()=>{const m=[];addShots('<p>Text</p>','ch01-s01',{route:'/x',section:'test'},m);assert.equal(m[0].id,'ch01-s01-overview');assert.equal(m[0].optional,true)})
test('uploaded screenshot data rejects SVG and active HTML',()=>{for(const data of ['javascript:alert(1)','data:text/html;base64,AA==','data:image/svg+xml;base64,AA=='])assert.throws(()=>safeRecord({images:[{data,width:10,height:10}]}))})
test('a slot accepts six screenshots and rejects a seventh',()=>{
 const image={data:'data:image/png;base64,AAAA',width:10,height:10}
 assert.equal(safeRecord({images:Array(6).fill(image)}).images.length,6)
 assert.throws(()=>safeRecord({images:Array(7).fill(image)}),/每个图片位最多6张/)
})
test('screenshot dimensions enforce the 32 million pixel limit inclusively',()=>{
 const image={data:'data:image/png;base64,AAAA',width:8000,height:4000}
 assert.equal(safeRecord({images:[image]}).images[0].width,8000)
 for(const dimensions of [{width:8001,height:4000},{width:8000,height:4001}]){
  assert.throws(()=>safeRecord({images:[{...image,...dimensions}]}),/图片尺寸无效或超过3200万像素/)
 }
 // The documented limit is total pixels, so a long image below it is valid.
 assert.equal(safeRecord({images:[{...image,width:999999,height:10}]}).images[0].width,999999)
})
test('both screenshot dimensions must be positive finite integers',()=>{
 const image={data:'data:image/png;base64,AAAA',width:1,height:1}
 assert.deepEqual(safeRecord({images:[image]}).images[0],{...image,name:'截图'})
 for(const dimension of ['width','height'])for(const value of [0,-1,1.5,NaN,Infinity,undefined]){
  assert.throws(()=>safeRecord({images:[{...image,[dimension]:value}]}),/图片尺寸无效或超过3200万像素/)
 }
})
test('site backups are isolated by default',()=>{assert.throws(()=>parseSnapshot({schema:'xingmang-screenshots/1',siteId:'newapi',records:{}},'sub2api',new Map()))})
test('only explicitly shared software images cross sites',()=>{const r=parseSnapshot({schema:'xingmang-screenshots/1',siteId:'newapi',records:{a:{scope:'shared',images:[]},b:{scope:'shared',images:[]}}},'sub2api',new Map([['a',{siteOnly:false}],['b',{siteOnly:true}]]),true);assert.deepEqual(Object.keys(r.records),['a']);assert.deepEqual(r.skipped,['b'])})
test('unknown old slots are retained and reported rather than silently lost',()=>{const r=parseSnapshot({schema:'xingmang-screenshots/1',siteId:'sub2api',records:{old:{images:[],caption:'keep'}}},'sub2api',new Map());assert.equal(r.records.old.caption,'keep');assert.deepEqual(r.unknown,['old'])})
test('prototype-shaped IDs are refused',()=>{assert.throws(()=>parseSnapshot(JSON.parse('{"schema":"xingmang-screenshots/1","siteId":"sub2api","records":{"__proto__":{"images":[]}}}'),'sub2api',new Map()))})
