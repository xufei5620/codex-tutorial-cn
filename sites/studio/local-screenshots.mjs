import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {SCHEMA,parseSnapshot} from './theme/shot-schema.mjs'

const ENDPOINT='/__studio/screenshots'
const IMAGE_LIMIT=12*1024*1024
const BODY_LIMIT=150*1024*1024
const IMAGE_PATH=/^\/screenshots\/([a-f0-9]{64})\.(png|jpg|webp)$/
const pendingWrites=new Map()
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const failure=(status,message)=>Object.assign(new Error(message),{status})

function checkImage(bytes,extension){
 if(bytes.length>IMAGE_LIMIT)throw failure(422,'单张截图不能超过 12 MB')
 const matches=extension==='png'
  ?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  :extension==='jpg'
   ?bytes[0]===255&&bytes[1]===216&&bytes[2]===255
   :bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
 if(!matches)throw failure(422,'截图内容与 PNG/JPG/WebP 文件类型不符')
}

function parse(data,siteId){
 try{return parseSnapshot(data,siteId,new Map())}
 catch(error){throw failure(422,error.message)}
}

/** A fixed site owns its manifest and images; callers cannot choose filesystem paths. */
export function createLocalScreenshotStore(siteDirectory){
 const siteDir=path.resolve(siteDirectory instanceof URL?fileURLToPath(siteDirectory):siteDirectory)
 const siteId=path.basename(siteDir)
 if(!['sub2api','newapi'].includes(siteId))throw Error('本地截图服务只支持 sub2api 和 newapi')
 const directory=path.resolve(siteDir,'../studio/screenshots')
 const manifest=path.join(directory,siteId+'.json')
 const imageDirectory=path.join(siteDir,'public/screenshots')
 const backupDirectory=path.join(directory,'.local-backups',siteId)

 async function readState(){
  let bytes,exists=true
  try{bytes=await fs.readFile(manifest)}
  catch(error){
   if(error.code!=='ENOENT')throw error
   exists=false
   bytes=Buffer.from(JSON.stringify({schema:SCHEMA,version:'5.4',siteId,hideMissing:false,records:{}}))
  }
  let data,parsed
  try{data=JSON.parse(bytes.toString('utf8'));parsed=parseSnapshot(data,siteId,new Map())}
  catch(error){throw failure(500,'本地截图清单无法读取，原文件已保留：'+error.message)}
  const savedAt=Number.isFinite(data.updatedAt)&&data.updatedAt>0?data.updatedAt:null
  const snapshot={schema:SCHEMA,version:'5.4',siteId,hideMissing:parsed.hideMissing,records:parsed.records,updatedAt:savedAt}
  return {bytes,exists,response:{snapshot,revision:hash(bytes),savedAt,directory}}
 }

 async function readImage(source){
  const match=IMAGE_PATH.exec(source)
  if(!match)throw failure(422,'截图路径无效')
  const filename=path.join(imageDirectory,match[1]+'.'+match[2])
  try{
   const [realDirectory,realFile]=await Promise.all([fs.realpath(imageDirectory),fs.realpath(filename)])
   if(path.dirname(realFile)!==realDirectory)throw failure(422,'截图路径不能超出本站截图目录')
   const stat=await fs.stat(realFile)
   if(!stat.isFile()||stat.size>IMAGE_LIMIT)throw failure(422,'截图文件无效或超过 12 MB')
   const bytes=await fs.readFile(realFile)
   checkImage(bytes,match[2])
   if(hash(bytes)!==match[1])throw failure(422,'截图文件与文件名校验值不一致')
   return {bytes,type:match[2]==='jpg'?'image/jpeg':'image/'+match[2]}
  }catch(error){
   if(error.code==='ENOENT')throw failure(422,'本站缺少引用的截图：'+source)
   throw error
  }
 }

 async function persist(snapshot,revision){
  const current=await readState()
  if(typeof revision!=='string'||revision!==current.response.revision){
   throw failure(409,'本地截图已被其他页面更新，请先重新载入本地版本后再保存')
  }
  const incoming=parse(snapshot,siteId)
  // Missing legacy slots survive a save. An explicit empty images array clears a slot.
  const records=structuredClone({...current.response.snapshot.records,...incoming.records})
  if(Object.keys(records).length>3000)throw failure(422,'合并后的图片位不能超过 3000 个')
  const images=new Map(),checked=new Set()
  for(const record of Object.values(records))for(const image of record.images){
   if(image.data.startsWith('/screenshots/')){
    if(!checked.has(image.data)){await readImage(image.data);checked.add(image.data)}
    continue
   }
   const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(image.data)
   if(!match)throw failure(422,'只允许 PNG/JPG/WebP 截图')
   const encoded=match[2].replace(/\s/g,'')
   const bytes=Buffer.from(encoded,'base64')
   if(bytes.toString('base64')!==encoded)throw failure(422,'截图 Base64 数据不完整')
   const extension=match[1]==='jpeg'?'jpg':match[1]
   checkImage(bytes,extension)
   const source='/screenshots/'+hash(bytes)+'.'+extension
   const target=path.join(imageDirectory,path.basename(source))
   try{await fs.access(target);await readImage(source)}
   catch(error){if(error.code!=='ENOENT')throw error;images.set(target,bytes)}
   image.data=source
  }
  const previous=current.response.snapshot
  if(incoming.hideMissing===previous.hideMissing&&JSON.stringify(records)===JSON.stringify(previous.records))return current.response
  const savedAt=Date.now()
  const output={schema:SCHEMA,version:'5.4',siteId,hideMissing:incoming.hideMissing,records,updatedAt:savedAt}
  const bytes=Buffer.from(JSON.stringify(output,null,2)+'\n')
  // Validate every record and image before creating files; keep old images for recovery.
  await fs.mkdir(directory,{recursive:true})
  await fs.mkdir(imageDirectory,{recursive:true})
  if(current.exists){
   await fs.mkdir(backupDirectory,{recursive:true})
   await fs.writeFile(path.join(backupDirectory,`${savedAt}-${crypto.randomUUID()}.json`),current.bytes,{flag:'wx'})
  }
  for(const [target,imageBytes]of images){
   try{await fs.writeFile(target,imageBytes,{flag:'wx'})}
   catch(error){if(error.code!=='EEXIST')throw error;await readImage('/screenshots/'+path.basename(target))}
  }
  const temporary=path.join(directory,`.${siteId}-${crypto.randomUUID()}.tmp`)
  try{
   const handle=await fs.open(temporary,'wx')
   try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
   await fs.rename(temporary,manifest)
  }finally{await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error})}
  return {snapshot:output,revision:hash(bytes),savedAt,directory}
 }

 return {
  siteId,directory,readImage,
  async read(){return (await readState()).response},
  save(snapshot,revision){
   // Check the revision inside the queue so simultaneous writes cannot overwrite each other.
   const result=(pendingWrites.get(manifest)||Promise.resolve()).then(()=>persist(snapshot,revision))
   const settled=result.catch(()=>{})
   pendingWrites.set(manifest,settled)
   settled.then(()=>{if(pendingWrites.get(manifest)===settled)pendingWrites.delete(manifest)})
   return result
  }
 }
}

function checkRequest(req,requireHeader){
 const address=req.socket?.remoteAddress
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))throw failure(403,'本地截图服务只接受本机连接')
 const host=req.headers.host
 if(typeof host!=='string'||! /^(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$/i.test(host))throw failure(403,'只允许 localhost 或回环 IP 地址')
 let parsed
 try{parsed=new URL('http://'+host)}catch{throw failure(403,'本地服务地址无效')}
 if(req.socket?.encrypted||req.headers.origin&&req.headers.origin!==parsed.origin)throw failure(403,'截图服务拒绝其他来源的请求')
 if(req.headers['sec-fetch-site']==='cross-site')throw failure(403,'截图服务拒绝跨站请求')
 if(requireHeader&&req.headers['x-studio-local']!=='1')throw failure(403,'缺少本地截图请求标记')
}

async function readBody(req){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw failure(415,'请使用 application/json')
 if(Number(req.headers['content-length'])>BODY_LIMIT)throw failure(413,'截图备份不能超过 150 MB')
 const chunks=[]
 let size=0
 for await(const chunk of req){
  size+=chunk.length
  if(size>BODY_LIMIT)throw failure(413,'截图备份不能超过 150 MB')
  chunks.push(chunk)
 }
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 catch{throw failure(400,'截图备份不是有效 JSON')}
}

function json(res,status,value){
 res.statusCode=status
 if(status>=400)res.setHeader('Connection','close')
 res.setHeader('Content-Type','application/json; charset=utf-8')
 res.setHeader('Cache-Control','no-store')
 res.setHeader('X-Content-Type-Options','nosniff')
 res.end(JSON.stringify(value))
}

export function createLocalScreenshotMiddleware(store){
 return async(req,res,next)=>{
  const pathname=(req.url||'').split('?')[0]
  if(pathname!==ENDPOINT&&!pathname.startsWith('/screenshots/'))return next()
  try{
   checkRequest(req,pathname===ENDPOINT)
   if(pathname===ENDPOINT){
    if(req.method==='GET')return json(res,200,await store.read())
    if(req.method==='PUT'){
     const body=await readBody(req)
     return json(res,200,await store.save(body?.snapshot,body?.revision))
    }
    res.setHeader('Allow','GET, PUT')
    throw failure(405,'截图清单仅支持 GET 和 PUT')
   }
   if(!['GET','HEAD'].includes(req.method))throw failure(405,'截图文件仅支持读取')
   const image=await store.readImage(pathname)
   res.statusCode=200
   res.setHeader('Content-Type',image.type)
   res.setHeader('Content-Length',image.bytes.length)
   res.setHeader('Cache-Control','public, max-age=31536000, immutable')
   res.setHeader('X-Content-Type-Options','nosniff')
   res.end(req.method==='HEAD'?undefined:image.bytes)
  }catch(error){json(res,error.status||500,{error:error.status?error.message:'本地截图保存失败：'+error.message})}
 }
}

/** Vite dev and preview get the API; static production builds contain no server. */
export function createLocalScreenshotPlugin(siteDirectory){
 const store=createLocalScreenshotStore(siteDirectory)
 const install=server=>{server.middlewares.use(createLocalScreenshotMiddleware(store))}
 return {name:'studio-local-screenshots',configureServer:install,configurePreviewServer:install}
}
