import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {prepareMirror,writeMirror,readMirrorState,saveMirrorState} from './mirror.mjs'
import {COS_ROOT,INDEX_ROUTES,validateManagerIndex,validateChatgptIndex,validateClaudeIndex} from './catalog.mjs'

function fixture(){
 const version='0.2.13',fileName='XingMang-AI-Manager-0.2.13-Setup.exe',key=`xingmang/releases/${version}/${fileName}`
 return {schemaVersion:1,product:'xingmang-ai-manager',version,internal:'must-not-project',files:[{fileName,version,platform:'windows',architecture:'x64',kind:'installer',key,url:COS_ROOT+'/'+key,size:10,sha256:'a'.repeat(64),type:'application/vnd.microsoft.portable-executable',source:{private:'must-not-project'}}]}
}
function json(value){return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})}
function chatgptFixture(version='26.930.2377.0'){
 function artifact(fileName,bytes,verification,contentType){
  const key=`chatgpt/windows-x64/${version}/${fileName}`
  return {key,url:COS_ROOT+'/'+key,bytes,sha256:'b'.repeat(64),verification,contentType}
 }
 return {schemaVersion:1,product:'chatgpt',windows:{schemaVersion:1,buildVersion:version,packageIdentity:'OpenAI.Codex',storeProductId:'9PLM9XGG6VKS'},platforms:{'windows-x64':{
  platform:'windows',architecture:'x64',format:'msix',packageVersion:version,
  artifact:artifact('ChatGPT-x64.msix',100,'windows-authenticode','application/vnd.ms-appx'),
  license:artifact('ChatGPT-License.xml',10,'official-https-sha256-and-product-identity','application/xml')
 }}}
}
function twoWindowsFixture(version='26.930.2377.0'){
 const value=chatgptFixture(version)
 const arm=structuredClone(value.platforms['windows-x64'])
 arm.architecture='arm64'
 for(const artifact of [arm.artifact,arm.license]){
  artifact.key=artifact.key.replaceAll('x64','arm64')
  artifact.url=artifact.url.replaceAll('x64','arm64')
 }
 value.platforms['windows-arm64']=arm
 return value
}
test('mirror reads only three fixed anonymous COS indexes and strips source internals',async()=>{
 const urls=[]
 const entries=await prepareMirror({fetchImpl:async(url,options)=>{
  urls.push(url)
  assert.equal(options.method,'GET')
  assert.equal(options.redirect,'error')
  assert.equal(Object.hasOwn(options,'credentials'),false)
  assert.deepEqual(options.headers,{Accept:'application/json','Cache-Control':'no-cache'})
  return url.endsWith('/xingmang/latest.json')?json(fixture()):new Response(null,{status:404})
 }})
 assert.deepEqual(new Set(urls),new Set(['xingmang/latest.json','chatgpt/latest.json','xingmang/offline/claude/latest.json'].map(key=>COS_ROOT+'/'+key)))
 assert.equal(validateManagerIndex(JSON.parse(entries[0].json)).length,1)
 assert.deepEqual(validateChatgptIndex(JSON.parse(entries[1].json)),[])
 assert.deepEqual(validateClaudeIndex(JSON.parse(entries[2].json)),[])
 assert.equal(entries[0].json.includes('must-not-project'),false)
 assert.deepEqual(entries.map(entry=>entry.pending),[false,true,true])
})
test('missing products become empty valid indexes without guessed URLs',async()=>{
 const entries=await prepareMirror({fetchImpl:async()=>new Response(null,{status:404})})
 assert.equal(entries.every(entry=>entry.pending&&!entry.json.includes('https:')),true)
 assert.deepEqual(entries.map(entry=>entry.route),Object.values(INDEX_ROUTES))
})
test('a verified baseline restores only ChatGPT packages when its upstream index is missing',async()=>{
 const entries=await prepareMirror({chatgptBaseline:chatgptFixture(),fetchImpl:async()=>new Response(null,{status:404})})
 assert.deepEqual(entries.map(entry=>entry.pending),[true,false,true])
 assert.deepEqual(entries.map(entry=>entry.verifiedBaseline),[false,true,false])
 const items=validateChatgptIndex(JSON.parse(entries[1].json))
 assert.deepEqual(items.map(item=>[item.id,item.version]),[['windows-x64','26.930.2377.0']])
 assert.equal(items[0].licenseUrl.endsWith('/26.930.2377.0/ChatGPT-License.xml'),true)
 assert.deepEqual(validateManagerIndex(JSON.parse(entries[0].json)),[])
 assert.deepEqual(validateClaudeIndex(JSON.parse(entries[2].json)),[])
})
test('any valid upstream ChatGPT index takes precedence over the verified baseline',async()=>{
 for(const upstream of [chatgptFixture('26.930.3930.0'),{schemaVersion:1,product:'chatgpt',platforms:{}}]){
  const entries=await prepareMirror({chatgptBaseline:chatgptFixture(),fetchImpl:async url=>url.endsWith('/chatgpt/latest.json')?json(upstream):new Response(null,{status:404})})
  const entry=entries[1]
  assert.equal(entry.verifiedBaseline,false)
  assert.equal(entry.pending,false)
  assert.deepEqual(validateChatgptIndex(JSON.parse(entry.json)),validateChatgptIndex(upstream))
 }
})
test('an already published baseline stays intact while the first nonempty source lacks a baseline platform',async()=>{
 const baseline=twoWindowsFixture(),upstream=chatgptFixture('26.930.3930.0')
 const original=structuredClone(upstream)
 const fetchImpl=async url=>url.endsWith('/chatgpt/latest.json')?json(upstream):new Response(null,{status:404})
 const entries=await prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:baseline},fetchImpl})
 assert.equal(entries[1].verifiedBaseline,true)
 assert.equal(entries[1].pending,false)
 assert.deepEqual(validateChatgptIndex(JSON.parse(entries[1].json)),validateChatgptIndex(baseline))
 assert.deepEqual(upstream,original)
 const key=`chatgpt/linux-deb-x64/sha256-${'d'.repeat(64)}/chatgpt_amd64.deb`
 upstream.platforms['linux-deb-x64']={platform:'linux',architecture:'x64',format:'deb',artifact:{key,url:COS_ROOT+'/'+key,bytes:50,sha256:'d'.repeat(64),contentType:'application/vnd.debian.binary-package',verification:'official-https-sha256'}}
 const sameCount=await prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:baseline},fetchImpl})
 assert.equal(Object.keys(upstream.platforms).length,Object.keys(baseline.platforms).length)
 assert.equal(sameCount[1].verifiedBaseline,true)
 assert.deepEqual(validateChatgptIndex(JSON.parse(sameCount[1].json)),validateChatgptIndex(baseline))
})
test('the first source covering all baseline platforms replaces the whole baseline',async()=>{
 const baseline=twoWindowsFixture(),upstream=twoWindowsFixture('26.930.3930.0')
 const entries=await prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:baseline},fetchImpl:async url=>url.endsWith('/chatgpt/latest.json')?json(upstream):new Response(null,{status:404})})
 assert.equal(entries[1].verifiedBaseline,false)
 const items=validateChatgptIndex(JSON.parse(entries[1].json))
 assert.deepEqual(items,validateChatgptIndex(upstream))
 assert.equal(items.every(item=>item.version==='26.930.3930.0'),true)
})
test('an explicitly empty valid source clears an already published baseline',async()=>{
 const baseline=twoWindowsFixture(),upstream={schemaVersion:1,product:'chatgpt',platforms:{}}
 const entries=await prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:baseline},fetchImpl:async url=>url.endsWith('/chatgpt/latest.json')?json(upstream):new Response(null,{status:404})})
 assert.equal(entries[1].verifiedBaseline,false)
 assert.equal(entries[1].pending,false)
 assert.deepEqual(validateChatgptIndex(JSON.parse(entries[1].json)),[])
})
test('partial sources remain authoritative without baseline history or after switching to a source catalog',async()=>{
 const baseline=twoWindowsFixture(),upstream=chatgptFixture('26.930.3930.0')
 const switched=twoWindowsFixture('26.930.3930.0')
 for(const previousIndexes of [{},{chatgpt:{schemaVersion:1,product:'chatgpt',platforms:{}}},{chatgpt:switched}]){
  const entries=await prepareMirror({chatgptBaseline:baseline,previousIndexes,fetchImpl:async url=>url.endsWith('/chatgpt/latest.json')?json(upstream):new Response(null,{status:404})})
  assert.equal(entries[1].verifiedBaseline,false)
  assert.deepEqual(validateChatgptIndex(JSON.parse(entries[1].json)),validateChatgptIndex(upstream))
 }
 await assert.rejects(prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:switched},fetchImpl:async()=>new Response(null,{status:404})}),/保留现有镜像/)
})
test('the baseline never masks transport, HTTP or schema failures',async()=>{
 for(const response of [new Response(null,{status:403}),new Response(null,{status:500}),json({schemaVersion:2})]){
  await assert.rejects(prepareMirror({chatgptBaseline:chatgptFixture(),fetchImpl:async url=>url.endsWith('/chatgpt/latest.json')?response.clone():new Response(null,{status:404})}))
 }
 await assert.rejects(prepareMirror({chatgptBaseline:chatgptFixture(),fetchImpl:async()=>{throw Error('transport-failed')}}))
})
test('the baseline can be redeployed but cannot replace a different previously published catalog',async()=>{
 const baseline=chatgptFixture(),fetchImpl=async()=>new Response(null,{status:404})
 for(const previous of [baseline,{schemaVersion:1,product:'chatgpt',platforms:{}}]){
  const entries=await prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:previous},fetchImpl})
  assert.equal(entries[1].verifiedBaseline,true)
 }
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'xm-baseline-cache-'))
 const entries=await prepareMirror({chatgptBaseline:baseline,fetchImpl})
 await saveMirrorState(entries,{cacheDir})
 const previousIndexes=await readMirrorState({cacheDir})
 assert.equal((await prepareMirror({chatgptBaseline:baseline,previousIndexes,fetchImpl}))[1].verifiedBaseline,true)
 await assert.rejects(prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:chatgptFixture('26.930.3930.0')},fetchImpl}),/保留现有镜像/)
 const changed=structuredClone(baseline)
 changed.platforms['windows-x64'].artifact.sha256='c'.repeat(64)
 await assert.rejects(prepareMirror({chatgptBaseline:baseline,previousIndexes:{chatgpt:changed},fetchImpl}),/保留现有镜像/)
})
test('a malformed or empty baseline fails validation before fetching',async()=>{
 const missingLicense=chatgptFixture()
 delete missingLicense.platforms['windows-x64'].license
 for(const baseline of [missingLicense,fixture(),{schemaVersion:1,product:'chatgpt',platforms:{}}]){
  let requests=0
  await assert.rejects(prepareMirror({chatgptBaseline:baseline,fetchImpl:async()=>{requests++;return new Response(null,{status:404})}}))
  assert.equal(requests,0)
 }
})
test('the checked-in baseline exposes only the seven verified packages and their exact versions',async()=>{
 const baseline=JSON.parse(await fs.readFile(new URL('./chatgpt-verified-baseline.json',import.meta.url),'utf8'))
 const entries=await prepareMirror({chatgptBaseline:baseline,fetchImpl:async()=>new Response(null,{status:404})})
 const items=validateChatgptIndex(JSON.parse(entries[1].json))
 assert.deepEqual(items.map(item=>item.id),['windows-x64','windows-arm64','macos-arm64','macos-x64','linux-deb-x64','linux-deb-arm64','linux-rpm-x64'])
 for(const item of items){
  if(item.platform==='windows')assert.equal(item.version,'26.930.2377.0')
  if(item.platform==='macos'){
   assert.equal(item.version,'26.930.21537')
   assert.equal(baseline.platforms[item.id].buildVersion,'12776')
  }
 }
 assert.equal(items.filter(item=>item.licenseUrl).length,2)
 assert.equal(entries[1].json.includes('verifiedAt'),false)
})
test('transport, non-404 errors and invalid schemas prevent a new mirror',async()=>{
 for(const response of [new Response(null,{status:403}),new Response(null,{status:500}),json({schemaVersion:2}),new Response('{broken',{headers:{'Content-Type':'application/json'}})]){
  await assert.rejects(prepareMirror({fetchImpl:async()=>response.clone()}))
 }
 await assert.rejects(prepareMirror({fetchImpl:async()=>{throw Error('private-upstream-error')}}))
})
test('all mirror entries are validated before writing either site',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'xm-index-mirror-'))
 const entries=await prepareMirror({fetchImpl:async()=>new Response(null,{status:404})})
 await writeMirror(entries,{root})
 for(const site of ['newapi','sub2api'])for(const entry of entries){
  assert.equal(await fs.readFile(path.join(root,site,'public',entry.route),'utf8'),entry.json)
 }
 const malformed=entries.map(entry=>({...entry}));malformed[2].route='/../../unrelated.json'
 await assert.rejects(writeMirror(malformed,{root}))
 await assert.rejects(writeMirror(entries.slice(0,2),{root}))
 for(const site of ['newapi','sub2api'])for(const entry of entries)assert.equal(await fs.readFile(path.join(root,site,'public',entry.route),'utf8'),entry.json)
})
test('a previously valid installer index disappearing cannot deploy an empty replacement',async()=>{
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'xm-index-cache-'))
 const entries=await prepareMirror({fetchImpl:async url=>url.endsWith('/xingmang/latest.json')?json(fixture()):new Response(null,{status:404})})
 await saveMirrorState(entries,{cacheDir})
 const previousIndexes=await readMirrorState({cacheDir})
 await assert.rejects(prepareMirror({previousIndexes,fetchImpl:async()=>new Response(null,{status:404})}),/保留现有镜像/)
 assert.equal(validateManagerIndex((await readMirrorState({cacheDir})).manager).length,1)
})
test('previous pending products may remain empty while corrupt cache data fails closed',async()=>{
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'xm-index-cache-empty-'))
 assert.deepEqual(await readMirrorState({cacheDir}),{})
 const entries=await prepareMirror({fetchImpl:async()=>new Response(null,{status:404})})
 await saveMirrorState(entries,{cacheDir})
 const previousIndexes=await readMirrorState({cacheDir})
 assert.equal((await prepareMirror({previousIndexes,fetchImpl:async()=>new Response(null,{status:404})})).every(entry=>entry.pending),true)
 await fs.writeFile(path.join(cacheDir,'manager.json'),'{broken')
 await assert.rejects(readMirrorState({cacheDir}))
})
test('cached files cannot bypass path, size or schema validation',async()=>{
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'xm-index-cache-bounds-'))
 await fs.writeFile(path.join(cacheDir,'manager.json'),' '.repeat(262145))
 await assert.rejects(readMirrorState({cacheDir}))
 await fs.writeFile(path.join(cacheDir,'manager.json'),JSON.stringify({schemaVersion:2,product:'xingmang-ai-manager',files:[]}))
 await assert.rejects(readMirrorState({cacheDir}))
 await assert.rejects(saveMirrorState([{product:'../../../outside',route:'/bad',json:'{}'}],{cacheDir}))
})
test('existing deploy workflow restores the guard before mirroring and deploys only afterward',async()=>{
 const workflow=await fs.readFile(new URL('../../.github/workflows/sites.yml',import.meta.url),'utf8')
 assert.ok(workflow.includes("cron: '31 */6 * * *'"))
 assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"))
 assert.equal((workflow.match(/run: node downloads\/mirror\.mjs/g)||[]).length,1)
 const restore=workflow.indexOf('actions/cache/restore@v4'),mirror=workflow.indexOf('run: node downloads/mirror.mjs'),save=workflow.indexOf('actions/cache/save@v4'),build=workflow.indexOf('run: npm run build'),deploy=workflow.indexOf('name: Deploy docs-sub')
 assert.ok(restore>=0&&restore<mirror&&mirror<save&&save<build&&build<deploy)
 assert.equal(workflow.includes('continue-on-error'),false)
 assert.equal((workflow.match(/github\.run_attempt/g)||[]).length,2)
})
