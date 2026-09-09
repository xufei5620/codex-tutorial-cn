// Check the real prebuild outputs. This is not an HTTP reachability or browser test.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const contract=JSON.parse(fs.readFileSync(path.join(root,'homepage-routes.json'),'utf8'))
const errors=[]
let checked=0
function localTarget(site,value,label){
 if(typeof value!=='string'||!value.startsWith('/'))return
 const pathname=value.split(/[?#]/)[0]
 if(pathname.startsWith('//')||pathname.split('/').includes('..')){errors.push(label+': invalid local path');return}
 const stem=path.join(root,site,pathname.slice(1))
 const candidates=[stem+'.md',path.join(stem,'index.md'),path.join(root,site,'public',pathname.slice(1))]
 if(!candidates.some(p=>fs.existsSync(p)&&fs.statSync(p).isFile()))errors.push(label+': missing '+value)
 checked++
}
function visit(site,items){for(const item of items||[]){if(item.link)localTarget(site,item.link,site+'/navigation');if(item.items)visit(site,item.items)}}
for(const id of ['sub2api','newapi']){
 const site=JSON.parse(fs.readFileSync(path.join(root,id,'site.json'),'utf8'))
 const expected=contract.sites[id]
 if(new URL(site.site_url).origin!==expected.homepage||'https://'+site.domain!==expected.docs)errors.push(id+': route contract and site settings differ')
 for(const [key,value]of Object.entries(contract.routes))localTarget(id,value,id+'/'+key)
 const nav=JSON.parse(fs.readFileSync(path.join(root,id,'nav.generated.json'),'utf8'));visit(id,nav.nav);visit(id,nav.sidebar)
 const provenance=JSON.parse(fs.readFileSync(path.join(root,id,'course-provenance.generated.json'),'utf8'))
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'../src/chapters.json'),'utf8'))
 const expectedChapters=manifest.parts.flatMap(p=>p.chapters)
 if(provenance.sources.filter(p=>p.id.startsWith('ch')).length!==expectedChapters.length)errors.push(id+': missing original course chapters')
 const effective=JSON.parse(fs.readFileSync(path.join(root,id,'site.generated.json'),'utf8'))
 if(effective.contact?.wecom_url){localTarget(id,effective.contact.wecom_qr,id+'/QR');if(effective.contact.wecom_url!==site.contact.wecom_url)errors.push(id+': support link differs')}
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(`PASS: ${checked} local article/navigation/asset targets. HTTP availability, hashes inside rendered components and browser behavior still require review.`)
