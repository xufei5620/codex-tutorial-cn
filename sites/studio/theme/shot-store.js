import {reactive,provide,inject,onMounted,onBeforeUnmount,watch} from 'vue'
import {SCHEMA,parseSnapshot,safeRecord} from './shot-schema.mjs'
import {createAutosave} from './shot-autosave.mjs'

export const SHOTS=Symbol('xingmang-local-shots')
export function download(name,content,type='application/json') {
 const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a')
 a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)
}
export function installShots(raw) {
 const data=JSON.parse(JSON.stringify(raw)),specs=new Map(data.manifest.map(x=>[x.id,x]))
 const state=reactive({editing:false,active:'',records:data.shots.records||{},hideMissing:!!data.shots.hideMissing,
  dirty:false,message:'',cache:null,unknown:[],busy:false,showOptional:false,saveStatus:'loading',savedAt:null,
  saveError:'',saveDirectory:'',localAvailable:false})
 let timer,dbPromise,applying=false,ready=Promise.resolve()
 const say=m=>{state.message=m;clearTimeout(timer);timer=setTimeout(()=>state.message='',6500)}
 const snapshot=()=>({schema:SCHEMA,version:'5.4',siteId:data.site.id,updatedAt:Date.now(),hideMissing:state.hideMissing,records:JSON.parse(JSON.stringify(state.records))})
 const normalize=s=>{
  const r=parseSnapshot(s,data.site.id,specs)
  return {schema:SCHEMA,version:'5.4',siteId:data.site.id,updatedAt:s.updatedAt||null,hideMissing:r.hideMissing,records:r.records}
 }
 function applySnapshot(s) {
  const r=parseSnapshot(s,data.site.id,specs)
  applying=true
  state.records=r.records;state.hideMissing=r.hideMissing;state.unknown=r.unknown
  applying=false
 }
 function database() {
  if(dbPromise)return dbPromise
  dbPromise=new Promise((resolve,reject)=>{
   try {
    const req=indexedDB.open('xingmang-studio-v53',1)
    req.onupgradeneeded=()=>req.result.createObjectStore('drafts')
    req.onsuccess=()=>resolve(req.result)
    req.onerror=()=>reject(Error('浏览器草稿无法保存，请检查存储空间或导出备份。'))
    req.onblocked=()=>reject(Error('浏览器草稿正在被其他窗口占用。'))
   } catch {reject(Error('浏览器草稿不可用，请导出备份。'))}
  })
  return dbPromise
 }
 async function readDraft(key=data.site.id) {
  const db=await database()
  return new Promise((resolve,reject)=>{
   const req=db.transaction('drafts').objectStore('drafts').get(key)
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('读取浏览器草稿失败。'))
  })
 }
 async function writeDraft(value,key=data.site.id) {
  const db=await database()
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite')
   tx.objectStore('drafts').put(value,key)
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error('浏览器草稿保存失败，请检查存储空间或导出备份。'))
  })
 }
 async function request(method,body) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000)
  try {
   const response=await fetch('/__studio/screenshots',{method,credentials:'omit',cache:'no-store',
    headers:{'X-Studio-Local':'1',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:controller.signal})
   const result=await response.json().catch(()=>({}))
   if(!response.ok)throw Object.assign(Error(result.error||'本地自动保存服务不可用，请确认使用新版本地预览。'),{status:response.status})
   if(!result.snapshot||!result.revision)throw Error('本地保存服务返回了无效结果。')
   return result
  } catch(e) {
   if(e.name==='AbortError')throw Error('本地保存超时，内容已保留，请重试。')
   throw e
  } finally {clearTimeout(timeout)}
 }
 const autosave=createAutosave({state,getSnapshot:snapshot,applySnapshot,normalize,
  readCache:()=>readDraft(),writeCache:value=>writeDraft(value),
  writeRecovery:value=>writeDraft(value,'recovery:'+data.site.id),
  loadRemote:()=>['127.0.0.1','localhost','[::1]','::1'].includes(location.hostname)?request('GET'):Promise.resolve(null),
  saveRemote:(s,revision)=>request('PUT',{snapshot:s,revision}),notify:say})
 function update(id,record) {state.records[id]=safeRecord(record);autosave.changed()}
 watch(()=>state.hideMissing,()=>{if(!applying)autosave.changed()},{flush:'sync'})
 async function exportJSON(current=false) {
  await ready
  try {
   const s=snapshot()
   if(current){const ids=new Set([...document.querySelectorAll('[data-shot-id]')].map(n=>n.dataset.shotId));s.records=Object.fromEntries(Object.entries(s.records).filter(([id])=>ids.has(id)))}
   // Backups must stay portable after autosave replaces embedded images with local paths.
   for(const record of Object.values(s.records))for(const image of record.images){
    if(!image.data.startsWith('/screenshots/'))continue
    const response=await fetch(image.data,{credentials:'omit',referrerPolicy:'no-referrer'})
    if(!response.ok)throw Error('读取截图失败，未导出不完整备份。')
    const blob=await response.blob()
    image.data=await new Promise((resolve,reject)=>{
     const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('读取截图失败。'));reader.readAsDataURL(blob)
    })
   }
   download('screenshots-'+data.site.id+(current?'-chapter':'')+'-v5.4.json',JSON.stringify(s,null,2))
   say('已导出包含图片的本机备份；不会提交或发布网站。')
  } catch(e){say(e.message)}
 }
 async function importJSON(file,shared=false) {
  if(!file)return
  await ready
  if(file.size>150*1024*1024)throw Error('备份超过150MB，请按章节拆分后导入')
  const r=parseSnapshot(JSON.parse(await file.text()),data.site.id,specs,shared)
  applying=true
  state.records={...state.records,...r.records};state.unknown=r.unknown;state.hideMissing=r.hideMissing
  applying=false;autosave.changed()
  say('已导入 '+Object.keys(r.records).length+' 个位置；'+r.unknown.length+' 个旧位置仍保留；跳过 '+r.skipped.length+' 个不允许跨站共用的位置。')
 }
 function restore() {
  if(!state.cache)return
  try {
   const r=parseSnapshot(state.cache,data.site.id,specs)
   applying=true
   state.records={...state.records,...r.records};state.hideMissing=r.hideMissing;state.unknown=r.unknown
   applying=false;state.cache=null;autosave.changed();say('已恢复本机草稿。')
  } catch(e){applying=false;say(e.message)}
 }
 async function upload(id,files,replace=-1) {
  if(!state.editing||state.busy)return
  await ready
  if(state.busy)return
  const incoming=[...files]
  if(!incoming.length)return
  state.busy=true
  try {
   const next=[]
   for(const f of incoming){
    if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>12*1024*1024)throw Error('每张截图限12MB，只支持 PNG、JPG、WebP')
    const src=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(Error('读取失败'));r.readAsDataURL(f)})
    const dim=await new Promise((ok,no)=>{const image=new Image();image.onload=()=>ok([image.naturalWidth,image.naturalHeight]);image.onerror=()=>no(Error('图片不能解码'));image.src=src})
    if(dim[0]*dim[1]>32e6)throw Error('截图超过3200万像素')
    next.push({data:src,name:f.name||'剪贴板截图',width:dim[0],height:dim[1]})
   }
   // Use the latest record after decoding to preserve in-flight metadata changes.
   const r=JSON.parse(JSON.stringify(state.records[id]||{images:[]}))
   if(replace>=0){if(!r.images[replace])throw Error('原图已不存在');r.images.splice(replace,1,next[0])}
   else {if(r.images.length+next.length>6)throw Error('每个图片位最多6张');r.images.push(...next)}
   update(id,r)
   say(state.localAvailable?'截图已加入，正在自动保存到本机。':'截图已加入，自动保存状态见页面顶部。')
  } finally {state.busy=false}
 }
 const before=e=>{if(state.dirty||state.busy){e.preventDefault();e.returnValue=''}}
 const paste=e=>{
  if(!state.editing||!state.active||/INPUT|TEXTAREA/.test(e.target?.tagName))return
  const files=[...(e.clipboardData?.files||[])]
  if(files.length){e.preventDefault();upload(state.active,files).catch(e=>say(e.message))}
 }
 const visibility=()=>{if(document.visibilityState==='hidden'&&state.dirty)autosave.flush()}
 onMounted(()=>{
  window.addEventListener('beforeunload',before);window.addEventListener('paste',paste)
  document.addEventListener('visibilitychange',visibility)
  ready=autosave.start().then(()=>{
   if(!state.localAvailable){state.editing=false;return}
   const params=new URLSearchParams(location.search)
   if(params.get('edit')==='1')state.editing=true
   if(params.get('showOptional')==='1')state.showOptional=true
  }).catch(e=>{state.editing=false;state.saveStatus='error';state.saveError=e.message;say(e.message)})
  readDraft('recovery:'+data.site.id).then(r=>{if(r&&!state.cache)state.cache=r}).catch(()=>{})
 })
 onBeforeUnmount(()=>{
  autosave.dispose();clearTimeout(timer)
  window.removeEventListener('beforeunload',before);window.removeEventListener('paste',paste)
  document.removeEventListener('visibilitychange',visibility)
  if(dbPromise)autosave.cacheSettled().catch(()=>{}).then(()=>dbPromise).then(db=>db.close()).catch(()=>{})
 })
 const api={state,specs,data,snapshot,update,exportJSON,importJSON,restore,upload,say,
  retrySave:()=>autosave.retry(),reloadSaved:()=>autosave.reloadSaved()}
 provide(SHOTS,api);return api
}
export function useShots(){const store=inject(SHOTS);if(!store)throw Error('Screenshot store is not mounted');return store}
