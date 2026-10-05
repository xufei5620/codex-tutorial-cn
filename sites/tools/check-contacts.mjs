// Guard: each site must keep its own customer-service contact. Run after `npm run build`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const SITES=['sub2api','newapi']
const readSite=id=>JSON.parse(fs.readFileSync(path.join(ROOT,id,'site.json'),'utf8'))
function* files(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())yield* files(p);else if(/\.(html|js|json|svg|txt)$/.test(e.name))yield p}}
export function contactMarkers(site){return [site.contact?.wecom_url,site.contact?.telegram_url].filter(Boolean)}
export function checkBuilt(sites=SITES,root=ROOT){
 const errors=[],cfg=Object.fromEntries(sites.map(id=>[id,readSite(id)]))
 if(new Set(sites.map(id=>cfg[id].contact?.wecom_url)).size!==sites.length)errors.push('two sites share the same WeCom link')
 for(const id of sites){
  const dist=path.join(root,id,'.vitepress','dist')
  if(!fs.existsSync(dist)){errors.push(id+': build output missing, run npm run build first');continue}
  const foreign=sites.filter(o=>o!==id).flatMap(o=>contactMarkers(cfg[o])).filter(m=>!contactMarkers(cfg[id]).includes(m))
  let own=false
  for(const f of files(dist)){
   const text=fs.readFileSync(f,'utf8')
   if(text.includes(cfg[id].contact.wecom_url))own=true
   for(const m of foreign)if(text.includes(m))errors.push(id+': '+path.relative(dist,f)+' contains another site\'s contact '+m)
  }
  if(!own)errors.push(id+': own WeCom link not found in build output')
  // A configured Telegram channel must be a visible link on the contact page, not only inside page data.
  const contact=path.join(dist,'contact.html'),telegram=cfg[id].contact?.telegram_url
  if(telegram&&!(fs.existsSync(contact)&&fs.readFileSync(contact,'utf8').includes('href="'+telegram+'"')))errors.push(id+': contact.html does not show its Telegram link')
 }
 return errors
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const errors=checkBuilt()
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('PASS: each site build contains only its own customer-service contact.')
}
