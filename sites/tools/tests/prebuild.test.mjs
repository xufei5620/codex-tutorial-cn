// Unit fixtures are explicitly synthetic. These tests do not replace a VitePress build.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { render, markGenerated, https, qrSVG, build } from '../prebuild.mjs'
import { rewriteCourseLinks, stageCourse } from '../course-bridge.mjs'
const hash=s=>crypto.createHash('sha256').update(s).digest('hex')
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xm-docs-unit-')),sites=path.join(root,'sites')
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
 const ids=Array.from({length:11},(_,i)=>`ch${String(i+1).padStart(2,'0')}`)
 const chapters=Object.fromEntries(ids.map((id,i)=>[id,{num:i+1,title:'Synthetic chapter '+(i+1),desc:'UNIT TEST FIXTURE',status:'draft'}]))
 put('src/chapters.json',JSON.stringify({site:{version:'fixture-only',date:'2026-09-08'},parts:[{chapters:ids}],chapters,extras:{prompts:{title:'Synthetic prompts',status:'draft'}}}))
 for(const id of [...ids,'prompts'])put(`src/content/${id}.html`,`<h1>${id} UNIT TEST FIXTURE</h1><a href="{{link:ch01#s1}}">chapter</a><section id="s1">Example</section>`)
 put('assets/example.svg','<svg xmlns="http://www.w3.org/2000/svg"/>')
 put('sites/shared/pages/guide/choose-tool.md','---\ntitle: Shared\n---\n# %%SITE_NAME%%\n%%BASE_URL%% %%KEY_WORD%%')
 put('sites/shared/admin/config.yml','backend:\n  name: github\n  branch: main\n')
 for(const id of ['sub2api','newapi']){
  const origin=id==='sub2api'?'https://api.solov.cc':'https://xm.solov.cc'
  const site={id,name:'星芒AI',title:'Unit test',description:'Synthetic',domain:id==='sub2api'?'docs-sub.solov.cc':'docs-new.solov.cc',site_url:origin,base_url:origin,codex_base_url:origin+'/v1',keys_url:origin+'/keys',models_url:origin+'/models',console_url:origin+'/dashboard',key_word:id==='sub2api'?'API 密钥':'令牌',contact:{wecom_url:`https://example.invalid/support/${id}`,qr_mode:'auto'},downloads:{windows:{label:'Windows',enabled:true,url:''}}}
  put(`sites/${id}/site.json`,JSON.stringify(site))
  put(`sites/${id}/nav.json`,JSON.stringify({nav:[{text:'首页',link:'/guide/start'}],sidebar:[{text:'开始',items:[]}]}))
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
test('missing course source is a hard error',()=>{const x=fs.mkdtempSync(path.join(os.tmpdir(),'xm-empty-'));assert.throws(()=>stageCourse(x))})
test('11 fixture chapters preserve source, status and hash',()=>{const f=fixture(),before=fs.readFileSync(path.join(f.root,'src/content/ch01.html'),'utf8'),out=stageCourse(f.root);assert.equal(out.sources.length,12);assert.equal(out.pages.length,13);assert.equal(out.sources[0].status,'draft');assert.equal(out.sources[0].sha256,hash(before));assert.equal(out.version,'fixture-only');assert.equal(fs.readFileSync(path.join(f.root,'src/content/ch01.html'),'utf8'),before)})
test('same-site template and native headers build',()=>{const f=fixture();const out=build('sub2api',f.sites);assert.ok(out.includes('learn/codex/ch11.md'));assert.match(fs.readFileSync(path.join(f.sites,'sub2api/guide/choose-tool.md'),'utf8'),/https:\/\/api.solov.cc API 密钥/);assert.match(fs.readFileSync(path.join(f.sites,'sub2api/public/_headers'),'utf8'),/frame-ancestors 'self' https:\/\/api.solov.cc/)})
test('site override is rendered and other site remains shared',()=>{const f=fixture();f.put('sites/sub2api/overrides/guide/choose-tool.md','---\ntitle: Override\n---\nOnly %%SITE_NAME%%');build('sub2api',f.sites);build('newapi',f.sites);assert.match(fs.readFileSync(path.join(f.sites,'sub2api/guide/choose-tool.md'),'utf8'),/Only 星芒AI/);assert.match(fs.readFileSync(path.join(f.sites,'newapi/guide/choose-tool.md'),'utf8'),/title: Shared/);})
test('per-site QR matrices differ and contain quiet-zone SVG',()=>{const f=fixture();build('sub2api',f.sites);build('newapi',f.sites);const a=fs.readFileSync(path.join(f.sites,'sub2api/public/img/contact/wecom-auto.svg'),'utf8'),b=fs.readFileSync(path.join(f.sites,'newapi/public/img/contact/wecom-auto.svg'),'utf8');assert.notEqual(a,b);assert.match(a,/shape-rendering="crispEdges"/);assert.match(a,/<rect[^>]+fill="white"/);})
test('foreign site identity and Codex URL are rejected',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.codex_base_url='https://xm.solov.cc/v1';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>build('sub2api',f.sites),/Cross-site URL/);s.codex_base_url=s.base_url;s.id='newapi';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>build('sub2api',f.sites),/Site ID mismatch/);})
test('foreign documentation hostname is rejected',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.domain='docs-new.solov.cc';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>build('sub2api',f.sites),/Cross-site docs/);})
test('bad download metadata is rejected before rendering',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.downloads.windows.url='http://example.invalid/file';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>build('sub2api',f.sites),/HTTPS/);s.downloads.windows.url='';s.downloads.windows.checksum='123';fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>build('sub2api',f.sites),/SHA-256/);})
test('generated public data does not expose unrelated operator config',()=>{const f=fixture(),file=path.join(f.sites,'sub2api/site.json'),s=JSON.parse(fs.readFileSync(file));s.internal_note='fixture-secret-not-a-real-secret';fs.writeFileSync(file,JSON.stringify(s));build('sub2api',f.sites);const pub=fs.readFileSync(path.join(f.sites,'sub2api/site.generated.json'),'utf8');assert.ok(!pub.includes(s.internal_note));assert.equal(JSON.parse(pub).downloads.windows.url,'');})
test('preview CMS branch is selected explicitly, source unchanged',()=>{const f=fixture(),old=process.env.DOCS_CMS_BRANCH;try{process.env.DOCS_CMS_BRANCH='docs/test-preview';build('sub2api',f.sites);assert.match(fs.readFileSync(path.join(f.sites,'sub2api/public/admin/config.yml'),'utf8'),/branch: docs\/test-preview/);assert.match(fs.readFileSync(path.join(f.sites,'shared/admin/config.yml'),'utf8'),/branch: main/);}finally{if(old===undefined)delete process.env.DOCS_CMS_BRANCH;else process.env.DOCS_CMS_BRANCH=old;}})
test('QR generated locally and excessive input rejected',()=>{assert.match(qrSVG('https://example.invalid/help'),/^<svg/);assert.throws(()=>qrSVG('https://example.invalid/'+ 'x'.repeat(10000)));})
