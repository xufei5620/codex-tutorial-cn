import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import {Readable} from 'node:stream'
import {createLocalScreenshotStore,createLocalScreenshotMiddleware} from '../local-screenshots.mjs'

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSocAAAAASUVORK5CYII=','base64')
const image={data:'data:image/png;base64,'+png.toString('base64'),name:'操作截图.png',width:1,height:1}
const imagePath='/screenshots/'+crypto.createHash('sha256').update(png).digest('hex')+'.png'
const snapshot=(records={},extra={})=>({schema:'xingmang-screenshots/1',version:'5.4',siteId:'newapi',hideMissing:false,records,...extra})

async function fixture(t,initial=snapshot()){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'studio-local-shots-'))
 t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const site=path.join(root,'sites/newapi')
 const directory=path.join(root,'sites/studio/screenshots')
 await fs.mkdir(path.join(site,'public/screenshots'),{recursive:true})
 await fs.mkdir(directory,{recursive:true})
 const manifest=path.join(directory,'newapi.json')
 const original=JSON.stringify(initial)+'\n'
 await fs.writeFile(manifest,original)
 return {root,site,directory,manifest,original,store:createLocalScreenshotStore(site)}
}

async function serverFor(t,store){
 const middleware=createLocalScreenshotMiddleware(store)
 const server=http.createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end('Not found')}))
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 t.after(()=>new Promise((resolve,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):resolve())}))
 const port=server.address().port
 return {
  origin:'http://127.0.0.1:'+port,
  request(url='/__studio/screenshots',{method='GET',headers={},body}={}){
   return new Promise((resolve,reject)=>{
    const request=http.request({host:'127.0.0.1',port,path:url,method,headers,agent:false},response=>{
     const chunks=[]
     response.on('data',chunk=>chunks.push(chunk))
     response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}))
    })
    request.on('error',reject)
    request.end(body)
   })
  }
 }
}

test('save writes content-addressed images and a reloadable manifest, retaining the original backup',async t=>{
 const f=await fixture(t)
 const initial=await f.store.read()
 assert.equal(initial.savedAt,null)
 const saved=await f.store.save(snapshot({step:{images:[image],caption:'完成操作'}}),initial.revision)
 assert.match(saved.revision,/^[a-f0-9]{64}$/)
 assert.notEqual(saved.revision,initial.revision)
 assert.equal(saved.snapshot.records.step.images[0].data,imagePath)
 assert.ok(saved.savedAt>0)
 assert.equal(saved.snapshot.updatedAt,saved.savedAt)
 assert.equal(saved.directory,f.directory)
 assert.deepEqual(await fs.readFile(path.join(f.site,'public',imagePath)),png)
 assert.deepEqual(await createLocalScreenshotStore(f.site).read(),saved)
 const backups=await fs.readdir(path.join(f.directory,'.local-backups/newapi'))
 assert.equal(backups.length,1)
 assert.equal(await fs.readFile(path.join(f.directory,'.local-backups/newapi',backups[0]),'utf8'),f.original)
 const noChange=await f.store.save(saved.snapshot,saved.revision)
 assert.deepEqual(noChange,saved)
 assert.equal((await fs.readdir(path.join(f.directory,'.local-backups/newapi'))).length,1)
})

test('missing legacy IDs survive new snapshots and clearing a slot keeps its image file for recovery',async t=>{
 const f=await fixture(t,snapshot({'legacy-step':{images:[],caption:'旧课程资料'}}))
 const first=await f.store.save(snapshot({step:{images:[image]}}),(await f.store.read()).revision)
 assert.equal(first.snapshot.records['legacy-step'].caption,'旧课程资料')
 const second=await f.store.save(snapshot({step:{images:[]}}, {hideMissing:true}),first.revision)
 assert.equal(second.snapshot.records.step.images.length,0)
 assert.equal(second.snapshot.records['legacy-step'].caption,'旧课程资料')
 assert.equal(second.snapshot.hideMissing,true)
 assert.deepEqual(await fs.readFile(path.join(f.site,'public',imagePath)),png)
 assert.equal((await fs.readdir(path.join(f.directory,'.local-backups/newapi'))).length,2)
})

test('simultaneous writers for one site serialize revision checks instead of overwriting',async t=>{
 const f=await fixture(t)
 const initial=await f.store.read()
 const other=createLocalScreenshotStore(f.site)
 const results=await Promise.allSettled([
  f.store.save(snapshot({one:{images:[image]}}),initial.revision),
  other.save(snapshot({two:{images:[image]}}),initial.revision)
 ])
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
 assert.equal(results.find(result=>result.status==='rejected').reason.status,409)
 const current=await f.store.read()
 assert.deepEqual(Object.keys(current.snapshot.records),['one'])
 await assert.rejects(f.store.save(snapshot(),undefined),{status:409})
})

test('invalid uploads and cross-site references leave the manifest and backups untouched',async t=>{
 const f=await fixture(t)
 const initial=await f.store.read()
 const otherImages=path.join(f.root,'sites/sub2api/public/screenshots')
 await fs.mkdir(otherImages,{recursive:true})
 await fs.writeFile(path.join(otherImages,path.basename(imagePath)),png)
 const oversized=Buffer.alloc(12*1024*1024+1)
 png.copy(oversized,0,0,8)
 const invalid=[
  snapshot({}, {siteId:'sub2api'}),
  snapshot({step:{images:[{...image,data:'data:image/png;base64,YWJjZA=='}]}}),
  snapshot({step:{images:[{...image,data:'data:image/png;base64,'+oversized.toString('base64')}]}}),
  snapshot({step:{images:[{...image,data:'data:image/png;base64,a==='}]}}),
  snapshot({step:{images:[{...image,data:'/screenshots/../../private.txt'}]}}),
  snapshot({step:{images:[{...image,data:imagePath}]}}),
  snapshot({step:{images:[{...image,width:0}]}})
 ]
 for(const value of invalid){
  await assert.rejects(f.store.save(value,initial.revision),{status:422})
  assert.equal(await fs.readFile(f.manifest,'utf8'),f.original)
 }
 assert.deepEqual(await fs.readdir(path.join(f.site,'public/screenshots')),[])
 await assert.rejects(fs.stat(path.join(f.directory,'.local-backups')),{code:'ENOENT'})
})

test('a corrupt existing manifest is preserved and cannot be silently replaced',async t=>{
 const f=await fixture(t)
 const initial=await f.store.read()
 await fs.writeFile(f.manifest,'{ interrupted old data')
 await assert.rejects(f.store.save(snapshot(),initial.revision),{status:500})
 assert.equal(await fs.readFile(f.manifest,'utf8'),'{ interrupted old data')
})

test('HTTP API saves screenshots and serves fresh images to dev and preview readers',async t=>{
 const f=await fixture(t)
 const server=await serverFor(t,f.store)
 const headers={'X-Studio-Local':'1',Origin:server.origin}
 const read=await server.request(undefined,{headers})
 assert.equal(read.status,200)
 assert.equal(read.headers['cache-control'],'no-store')
 const initial=JSON.parse(read.bytes)
 const saved=await server.request(undefined,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({snapshot:snapshot({step:{images:[image]}}),revision:initial.revision})})
 assert.equal(saved.status,200)
 const asset=await server.request(imagePath)
 assert.equal(asset.status,200)
 assert.equal(asset.headers['content-type'],'image/png')
 assert.deepEqual(asset.bytes,png)
 const head=await server.request(imagePath,{method:'HEAD'})
 assert.equal(head.status,200)
 assert.equal(Number(head.headers['content-length']),png.length)
 assert.equal(head.bytes.length,0)
 const conflict=await server.request(undefined,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({snapshot:snapshot(),revision:initial.revision})})
 assert.equal(conflict.status,409)
 assert.equal(typeof JSON.parse(conflict.bytes).error,'string')
})

test('HTTP API rejects foreign origins, non-loopback hosts, missing markers and malformed input',async t=>{
 const f=await fixture(t)
 const server=await serverFor(t,f.store)
 const base={'X-Studio-Local':'1'}
 for(const headers of [
  {},
  {...base,Host:'example.com'},
  {...base,Host:'localhost:99999'},
  {...base,Origin:'https://example.com'},
  {...base,Origin:server.origin.replace('http:','https:')},
  {...base,Origin:server.origin.replace('127.0.0.1','localhost')},
  {...base,'Sec-Fetch-Site':'cross-site'}
 ]){
  const response=await server.request(undefined,{headers})
  assert.equal(response.status,403)
  assert.equal(response.headers['access-control-allow-origin'],undefined)
 }
 const badJSON=await server.request(undefined,{method:'PUT',headers:{...base,'Content-Type':'application/json'},body:'{broken'})
 assert.equal(badJSON.status,400)
 const wrongType=await server.request(undefined,{method:'PUT',headers:{...base,'Content-Type':'text/plain'},body:'{}'})
 assert.equal(wrongType.status,415)
 const tooLarge=await server.request(undefined,{method:'PUT',headers:{...base,'Content-Type':'application/json','Content-Length':String(150*1024*1024+1)},body:''})
 assert.equal(tooLarge.status,413)
 const traversal=await server.request('/screenshots/../newapi.json')
 assert.equal(traversal.status,422)
 assert.equal(await fs.readFile(f.manifest,'utf8'),f.original)
})

test('a forged loopback Host cannot grant access to a remote TCP client',async t=>{
 const f=await fixture(t)
 const req=Readable.from([])
 Object.assign(req,{url:'/__studio/screenshots',method:'GET',headers:{host:'localhost:4184','x-studio-local':'1'},socket:{remoteAddress:'192.168.1.22'}})
 let result
 const res={setHeader(){},end(body){result=JSON.parse(body)}}
 await createLocalScreenshotMiddleware(f.store)(req,res,()=>assert.fail('must not reach static server'))
 assert.equal(res.statusCode,403)
 assert.match(result.error,/本机连接/)
})
