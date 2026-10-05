// Unit fixtures are explicitly synthetic. These tests do not replace a VitePress build.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { render, markGenerated, https } from '../util.mjs'
import { qrSVG, validateDownloadConfiguration } from '../site.mjs'
import { rewriteCourseLinks, stagePrompts } from '../prompts.mjs'
import { generate } from '../index.mjs'
const hash=s=>crypto.createHash('sha256').update(s).digest('hex')
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xm-docs-unit-')),sites=path.join(root,'sites')
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
 const ids=Array.from({length:11},(_,i)=>`ch${String(i+1).padStart(2,'0')}`)
 const chapters=Object.fromEntries(ids.map((id,i)=>[id,{num:i+1,title:'Synthetic chapter '+(i+1),desc:'UNIT TEST FIXTURE',status:'draft'}]))
 put('src/chapters.json',JSON.stringify({site:{version:'fixture-only',date:'2026-09-08'},parts:[{chapters:ids}],chapters,extras:{prompts:{title:'Synthetic prompts',status:'draft'}}}))
 put('src/content/prompts.html','<h1>prompts UNIT TEST FIXTURE</h1><a href="{{link:prompts#s1}}">card</a><section id="s1">Example</section>')
 put('sites/shared/pages/guide/choose-tool.md','---\ntitle: Shared\n---\n# %%SITE_NAME%%\n%%BASE_URL%% %%KEY_WORD%%')
 put('sites/shared/pages/guide/download.md','---\ntitle: Download\n---\n<script setup>\nimport { onMounted } from \'vue\'\nonMounted(()=>{location.replace(\'%%DOWNLOAD_URL%%\')})\n</script>\n')
 put('sites/shared/nav.json',JSON.stringify({nav:[{text:'首页',link:'/guide/start'}],sidebar:[{text:'开始',items:[]}]}))
 put('sites/shared/admin/config.yml','backend:\n  name: github\n  branch: main\n')
 fs.cpSync(new URL('../../studio/content',import.meta.url),path.join(sites,'studio/content'),{recursive:true})
 for(const id of ['sub2api','newapi']){
  const origin=id==='sub2api'?'https://api.solov.cc':'https://xm.solov.cc'
  const site={id,name:'星芒AI',title:'Unit test',description:'Synthetic',domain:id==='sub2api'?'docs-sub.solov.cc':'docs-new.solov.cc',site_url:origin,base_url:origin,codex_base_url:origin+'/v1',keys_url:origin+'/keys',models_url:origin+'/models',console_url:origin+'/dashboard',key_word:id==='sub2api'?'API 密钥':'令牌',contact:{wecom_url:`https://example.invalid/support/${id}`,qr_mode:'auto'},download_page_url:'/guide/manager#download-installers',download_indexes:{manager:'/cos-download-index/xingmang.json',chatgpt:'/cos-download-index/chatgpt.json',claude:'/cos-download-index/claude.json'},downloads:{windows:{label:'Windows',enabled:true,url:''}}}
  put(`sites/${id}/site.json`,JSON.stringify(site))
  put(`sites/${id}/pages/guide/start.md`,'---\ntitle: Start\n---\n# '+id+' start\n')
 }
 return {root,sites,put}
}
test('template variables render explicitly',()=>assert.equal(render('%%A%% / %%A%%',{A:'value'}),'value / value'))
test('unknown variables fail closed',()=>assert.throws(()=>render('%%UNKNOWN%%',{})))
test('frontmatter remains first, including CRLF',()=>assert.match(markGenerated('---\r\ntitle: x\r\n---\r\n# x'),/^---\ntitle: x\n---\n<!-- generated/))
test('invalid frontmatter is rejected',()=>assert.throws(()=>markGenerated('---\ntitle: broken')))
test('HTTPS and credential validation',()=>{assert.equal(https('https://example.invalid/x','URL'),'https://example.invalid/x');assert.throws(()=>https('http://example.invalid','URL'));assert.throws(()=>https('https://user:pass@example.invalid','URL'))})
test('course links and assets are rewritten',()=>assert.equal(rewriteCourseLinks('<a href="{{link:ch01#s1}}">x</a><img src="assets/a.svg">',['ch01']),'<a href="/learn/codex/ch01#s1">x</a><img src="/img/course/a.svg">'))
test('unknown course links are rejected',()=>assert.throws(()=>rewriteCourseLinks('{{link:missing}}',['ch01'])))
test('prompt library may not link to unpublished chapters or images',()=>{const f=fixture();f.put('src/content/prompts.html','<a href="{{link:ch01}}">x</a>');assert.throws(()=>stagePrompts(f.root));f.put('src/content/prompts.html','<img src="assets/a.svg">');assert.throws(()=>stagePrompts(f.root))})
test('missing course source is a hard error',()=>{const x=fs.mkdtempSync(path.join(os.tmpdir(),'xm-empty-'));assert.throws(()=>stagePrompts(x))})
test('only the prompt library is imported, without changing its source',()=>{const f=fixture(),before=fs.readFileSync(path.join(f.root,'src/content/prompts.html'),'utf8'),out=stagePrompts(f.root);assert.deepEqual(out.pages.map(p=>p[0]),['learn/codex/prompts.md']);assert.deepEqual(out.sidebar,[{text:'Synthetic prompts',link:'/learn/codex/prompts'}]);assert.match(out.pages[0][1],/prompts UNIT TEST FIXTURE/);assert.match(out.pages[0][1],/href="\/learn\/codex\/prompts#s1"/);assert.equal(fs.readFileSync(path.join(f.root,'src/content/prompts.html'),'utf8'),before)})
test('same-site template and native headers build',()=>{
 const f=fixture();generate('sub2api',f.sites)
 const out=fs.readdirSync(path.join(f.sites,'sub2api/.src/learn/codex'))
 assert.ok(out.includes('prompts.md'))
 assert.deepEqual(out.filter(name=>/^ch\d+\.md$/.test(name)),['ch01.md','ch02.md'])
 assert.match(fs.readFileSync(path.join(f.sites,'sub2api/.src/guide/choose-tool.md'),'utf8'),/https:\/\/api.solov.cc API 密钥/)
 assert.match(fs.readFileSync(path.join(f.sites,'sub2api/.src/guide/download.md'),'utf8'),/location\.replace\('\/guide\/manager#download-installers'\)/)
 const paths=['/cos-download-index/xingmang.json','/cos-download-index/chatgpt.json','/cos-download-index/claude.json']
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.sites,'sub2api/.src/public/_routes.json'),'utf8')),{version:1,include:paths,exclude:paths})
 const headers=fs.readFileSync(path.join(f.sites,'sub2api/.src/public/_headers'),'utf8')
 assert.match(headers,/frame-ancestors 'self' https:\/\/api.solov.cc/)
 assert.equal((headers.match(/X-Content-Type-Options: nosniff/g)||[]).length,1)
 assert.ok(headers.startsWith('/*\n'))
 for(const route of paths)assert.ok(headers.includes(route+'\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n'))
})

test('download configuration requires exactly the three fixed same-site indexes',()=>{
 const valid={manager:'/cos-download-index/xingmang.json',chatgpt:'/cos-download-index/chatgpt.json',claude:'/cos-download-index/claude.json'}
 const site={download_page_url:'/guide/manager#download-installers',download_indexes:valid}
 assert.doesNotThrow(()=>validateDownloadConfiguration(site))
 for(const indexes of [
  {manager:valid.manager,chatgpt:valid.chatgpt},
  {...valid,claude:'https://example.invalid/claude/latest.json'},
  {...valid,claude:'/cos-download-index/*'},
  {...valid,other:'/cos-download-index/other.json'},
  Object.assign(Object.create({claude:valid.claude}),{manager:valid.manager,chatgpt:valid.chatgpt,other:'/cos-download-index/other.json'}),
  [],
  null
 ])assert.throws(()=>validateDownloadConfiguration({...site,download_indexes:indexes}),/three fixed same-site routes/)
})
test('site override is rendered and other site remains shared',()=>{const f=fixture();f.put('sites/sub2api/overrides/guide/choose-tool.md','---\ntitle: Override\n---\nOnly %%SITE_NAME%%');generate('sub2api',f.sites);generate('newapi',f.sites);assert.match(fs.readFileSync(path.join(f.sites,'sub2api/.src/guide/choose-tool.md'),'utf8'),/Only 星芒AI/);assert.match(fs.readFileSync(path.join(f.sites,'newapi/.src/guide/choose-tool.md'),'utf8'),/title: Shared/);})
test('per-site QR matrices differ and contain quiet-zone SVG',()=>{const f=fixture();generate('sub2api',f.sites);generate('newapi',f.sites);const a=fs.readFileSync(path.join(f.sites,'sub2api/.src/public/img/contact/wecom-auto.svg'),'utf8'),b=fs.readFileSync(path.join(f.sites,'newapi/.src/public/img/contact/wecom-auto.svg'),'utf8');assert.notEqual(a,b);assert.match(a,/shape-rendering="crispEdges"/);assert.match(a,/<rect[^>]+fill="white"/);})
test('foreign site identity and Codex URL are rejected',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.codex_base_url='https://xm.solov.cc/v1';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),/Cross-site URL/);s.codex_base_url=s.base_url;s.id='newapi';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),/Site ID mismatch/);})
test('newapi and sub2api keep different Codex and OpenClaw base URLs',()=>{
  const here=new URL('../../',import.meta.url)
  const neu=JSON.parse(fs.readFileSync(new URL('newapi/site.json',here)))
  const sub=JSON.parse(fs.readFileSync(new URL('sub2api/site.json',here)))
  assert.equal(neu.codex_base_url,'https://xm.solov.cc/v1')
  assert.equal(sub.codex_base_url,'https://api.solov.cc')
  assert.equal(neu.openclaw_base_url,'https://xm.solov.cc/v1')
  assert.equal(sub.openclaw_base_url,'https://api.solov.cc/v1')
  assert.notEqual(neu.codex_base_url,sub.codex_base_url)
})
test('foreign documentation hostname is rejected',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.domain='docs-new.solov.cc';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),/Cross-site docs/);})
test('bad download metadata is rejected before rendering',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.downloads.windows.url='http://example.invalid/file';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),/HTTPS/);s.downloads.windows.url='';s.downloads.windows.checksum='123';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),/SHA-256/);})
test('generated public data does not expose unrelated operator config',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.internal_note='fixture-secret-not-a-real-secret';fs.writeFileSync(file,JSON.stringify(s));generate('sub2api',f.sites);const pub=fs.readFileSync(path.join(f.sites,'sub2api/.src/site.generated.json'),'utf8');assert.ok(!pub.includes(s.internal_note));assert.equal(JSON.parse(pub).downloads.windows.url,'');})
test('preview CMS branch is selected explicitly, source unchanged',()=>{const f=fixture(),old=process.env.DOCS_CMS_BRANCH;try{process.env.DOCS_CMS_BRANCH='docs/test-preview';generate('sub2api',f.sites);assert.match(fs.readFileSync(path.join(f.sites,'sub2api/.src/public/admin/config.yml'),'utf8'),/branch: docs\/test-preview/);assert.match(fs.readFileSync(path.join(f.sites,'shared/admin/config.yml'),'utf8'),/branch: main/);}finally{if(old===undefined)delete process.env.DOCS_CMS_BRANCH;else process.env.DOCS_CMS_BRANCH=old;}})
test('QR generated locally and excessive input rejected',()=>{assert.match(qrSVG('https://example.invalid/help'),/^<svg/);assert.throws(()=>qrSVG('https://example.invalid/'+ 'x'.repeat(10000)));})
test('site pages are copied as written and may not shadow a shared page',()=>{
 const f=fixture();f.put('sites/sub2api/pages/faq.md','# FAQ %%NOT_A_VARIABLE%%\n');generate('sub2api',f.sites)
 assert.equal(fs.readFileSync(path.join(f.sites,'sub2api/.src/faq.md'),'utf8'),'# FAQ %%NOT_A_VARIABLE%%\n')
 assert.match(fs.readFileSync(path.join(f.sites,'sub2api/.src/guide/account.md'),'utf8'),/# sub2api start/)
 f.put('sites/sub2api/pages/guide/choose-tool.md','# Duplicate\n');assert.throws(()=>generate('sub2api',f.sites),/重名/)
})
test('output is rebuilt from scratch and old outputs beside the sources are removed',()=>{
 const f=fixture()
 f.put('sites/sub2api/.src/stale.md','# old')
 f.put('sites/sub2api/clients/codex.md','# old generated')
 f.put('sites/sub2api/public/_headers','stale')
 f.put('sites/sub2api/public/img/shared/old.png','stale')
 f.put('sites/sub2api/public/screenshots/local.png','kept')
 generate('sub2api',f.sites)
 assert.equal(fs.existsSync(path.join(f.sites,'sub2api/.src/stale.md')),false)
 assert.equal(fs.existsSync(path.join(f.sites,'sub2api/clients')),false)
 assert.equal(fs.existsSync(path.join(f.sites,'sub2api/public/_headers')),false)
 assert.equal(fs.existsSync(path.join(f.sites,'sub2api/.src/public/img/shared/old.png')),false)
 assert.equal(fs.readFileSync(path.join(f.sites,'sub2api/.src/public/screenshots/local.png'),'utf8'),'kept')
 assert.equal(fs.readFileSync(path.join(f.sites,'sub2api/pages/guide/start.md'),'utf8'),'---\ntitle: Start\n---\n# sub2api start\n')
})
test('site settings must keep a valid customer-service contact',()=>{
 const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),original=JSON.parse(fs.readFileSync(file))
 const attempt=(change,pattern)=>{const s=structuredClone(original);change(s);fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>generate('sub2api',f.sites),pattern)}
 attempt(s=>{delete s.contact},/contact/)
 attempt(s=>{s.contact.wecom_url='http://example.invalid/kf'},/HTTPS/)
 attempt(s=>{s.contact.qr_mode='maybe'},/qr_mode/)
 attempt(s=>{s.contact.qr_mode='upload'},/wecom_qr/)
 attempt(s=>{s.contact.qr_mode='upload';s.contact.wecom_qr='/img/contact/missing.png'},/public\/img/)
 attempt(s=>{s.contact.telegram_url='https://example.invalid/channel';s.contact.telegram_qr='../secret.png'},/public\/img/)
 attempt(s=>{s.title=''},/title/)
 f.put('sites/sub2api/public/img/contact/wecom.png','png');const ok=structuredClone(original);ok.contact.qr_mode='upload';ok.contact.wecom_qr='/img/contact/wecom.png';fs.writeFileSync(file,JSON.stringify(ok))
 assert.doesNotThrow(()=>generate('sub2api',f.sites))
})
test('shared navigation is filtered per site and labelled from page titles',()=>{
 const f=fixture()
 f.put('sites/shared/nav.json',JSON.stringify({_comment:'x',nav:[{text:'控制台',link:'%%CONSOLE_URL%%'}],sidebar:[{text:'开始',items:[{link:'/guide/start'},{text:'仅订阅站',link:'/faq',sites:['sub2api']}]},{text:'生图',sites:['sub2api'],items:[{text:'A',link:'/faq'}]}]}))
 generate('sub2api',f.sites);generate('newapi',f.sites)
 const sub=JSON.parse(fs.readFileSync(path.join(f.sites,'sub2api/.src/nav.generated.json'))),neu=JSON.parse(fs.readFileSync(path.join(f.sites,'newapi/.src/nav.generated.json')))
 assert.equal(sub.nav[0].link,'https://api.solov.cc/dashboard');assert.equal(neu.nav[0].link,'https://xm.solov.cc/dashboard')
 assert.deepEqual(sub.sidebar[0].items,[{text:'Start',link:'/guide/start'},{text:'仅订阅站',link:'/faq'}])
 assert.deepEqual(neu.sidebar[0].items,[{text:'Start',link:'/guide/start'}])
 assert.ok(sub.sidebar.some(g=>g.text==='生图'));assert.ok(!neu.sidebar.some(g=>g.text==='生图'))
 assert.ok(!JSON.stringify(sub).includes('sites'))
 f.put('sites/shared/nav.json',JSON.stringify({nav:[],sidebar:[{text:'开始',items:[{link:'/missing'}]}]}));assert.throws(()=>generate('sub2api',f.sites),/页面标题/)
})
test('online editor only points at source files that exist',()=>{
 const repo=new URL('../../../',import.meta.url),config=fs.readFileSync(new URL('sites/shared/admin/config.yml',repo),'utf8')
 const paths=[...config.matchAll(/^\s*(?:-\s*\{.*?)?\b(?:file|folder):\s*([^\s,}]+)/gm)].map(m=>m[1])
 assert.ok(paths.length>10)
 for(const p of paths)assert.ok(fs.existsSync(new URL(p,repo))||p.endsWith('/overrides'),p)
})
