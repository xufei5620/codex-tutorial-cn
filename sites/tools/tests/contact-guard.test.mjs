// Pins each site's own customer-service contact. Changing a contact on purpose means updating this test too.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const site=id=>JSON.parse(fs.readFileSync(path.join(ROOT,id,'site.json'),'utf8'))
const EXPECTED={
 sub2api:{wecom:'kfcffe6f62fdaa0ccf4',telegram:true},
 newapi:{wecom:'kfc3ac7eece5344c034',telegram:false}
}
test('each site keeps its own WeCom customer-service link',()=>{
 for(const [id,want] of Object.entries(EXPECTED)){
  const c=site(id).contact
  assert.equal(c.wecom_url,'https://work.weixin.qq.com/kfid/'+want.wecom,id)
  assert.equal(!!c.telegram_url,want.telegram,id+' telegram')
 }
 assert.notEqual(site('sub2api').contact.wecom_url,site('newapi').contact.wecom_url)
})
test('shared sources never hardcode a customer-service link',()=>{
 const banned=/work\.weixin\.qq\.com\/kfid|kfc[0-9a-f]{12,}|t\.me\//
 const dirs=['build','shared/pages','shared/theme','studio/theme','studio/content','sub2api/.vitepress/theme','newapi/.vitepress/theme']
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
 for(const dir of dirs)for(const f of walk(path.join(ROOT,dir)).filter(f=>/\.(md|vue|ts|mts|mjs|js|json)$/.test(f)))
  assert.equal(banned.test(fs.readFileSync(f,'utf8')),false,path.relative(ROOT,f))
})
test('per-site pages only use their own contact',()=>{
 for(const id of Object.keys(EXPECTED)){
  const other=Object.keys(EXPECTED).find(o=>o!==id)
  const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='.vitepress'||e.name==='public'?[]:walk(path.join(d,e.name))):[path.join(d,e.name)]):[]
  for(const f of walk(path.join(ROOT,id)).filter(f=>f.endsWith('.md')))
   assert.equal(fs.readFileSync(f,'utf8').includes(EXPECTED[other].wecom),false,path.relative(ROOT,f))
 }
})
