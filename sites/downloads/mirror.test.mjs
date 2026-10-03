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
