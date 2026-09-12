import test from 'node:test'
import assert from 'node:assert/strict'
import {createAutosave, reconcileDraft} from '../theme/shot-autosave.mjs'

const copy=value=>JSON.parse(JSON.stringify(value))
const image={data:'data:image/png;base64,AAAA',name:'第一步.png',width:1,height:1}
const record=caption=>({images:[image],caption})
const snapshot=(records={},extra={})=>({schema:'xingmang-screenshots/1',version:'5.4',siteId:'newapi',records,hideMissing:false,...extra})
const remote=(value=snapshot(),revision='revision-0')=>({snapshot:copy(value),revision,savedAt:value.updatedAt||null,directory:'E:/教程/sites/studio/screenshots'})
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no});return {promise,resolve,reject}}

function fixture(t,options={}){
 const state={records:{},hideMissing:false,dirty:false,saveStatus:'idle',saveError:'',savedAt:null,saveDirectory:'',localAvailable:false,cache:null}
 let metadata=snapshot(),disk=options.disk||remote()
 const saves=[],cache=[],recoveries=[],messages=[]
 const getSnapshot=()=>copy({...metadata,records:state.records,hideMissing:state.hideMissing})
 const api=createAutosave({
  state,getSnapshot,
  applySnapshot(value){metadata=copy(value);state.records=copy(value.records);state.hideMissing=!!value.hideMissing},
  normalize:copy,
  readCache:options.readCache||async function(){return options.draft?copy(options.draft):null},
  async writeCache(value){cache.push(copy(value));if(options.writeCache)await options.writeCache(value)},
  async writeRecovery(value){if(options.writeRecovery)await options.writeRecovery(value);recoveries.push(copy(value))},
  loadRemote:options.loadRemote||async function(){return copy(disk)},
  async saveRemote(value,revision){
   saves.push({snapshot:copy(value),revision})
   if(options.saveRemote)return options.saveRemote(value,revision,saves.length)
   disk=remote({...value,updatedAt:1000+saves.length},'revision-'+saves.length)
   return copy(disk)
  },
  notify:message=>messages.push(message),
  delay:60_000
 })
 t.after(()=>api.dispose())
 return {api,state,saves,cache,recoveries,messages,getSnapshot,setDisk(value){disk=value}}
}

test('legacy browser screenshots migrate automatically into an empty local folder',async t=>{
 const draft=snapshot({step:record('原有截图')},{updatedAt:50})
 const f=fixture(t,{draft})
 await f.api.start()
 await f.api.cacheSettled()
 assert.equal(f.saves.length,1)
 assert.equal(f.saves[0].snapshot.records.step.caption,'原有截图')
 assert.equal(f.state.records.step.images.length,1)
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.state.localAvailable,true)
 assert.equal(f.state.dirty,false)
 assert.ok(f.state.savedAt>0)
 assert.equal(f.cache.at(-1).autosave.pending,false)
 assert.equal(f.cache.at(-1).autosave.baseRevision,'revision-1')
})

test('refresh prefers local files over an older browser draft that was already saved',async t=>{
 const old=snapshot({step:record('旧截图')},{autosave:{baseRevision:'revision-1',pending:false}})
 const latest=snapshot({step:record('磁盘最新版')},{updatedAt:2000,hideMissing:true})
 const f=fixture(t,{draft:old,disk:remote(latest,'revision-2')})
 await f.api.start()
 assert.equal(f.state.records.step.caption,'磁盘最新版')
 assert.equal(f.state.hideMissing,true)
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.state.savedAt,2000)
 assert.equal(f.saves.length,0)
})

test('a pending draft from the current revision is saved while divergent edits require a conflict',()=>{
 const disk=snapshot({step:record('已存版本')},{updatedAt:2000})
 const draft=snapshot({step:record('尚未保存')},{autosave:{baseRevision:'revision-2',pending:true}})
 const continuing=reconcileDraft(disk,draft,'revision-2')
 assert.equal(continuing.pending,true)
 assert.equal(continuing.conflict,false)
 assert.equal(continuing.snapshot.records.step.caption,'尚未保存')
 const divergent=reconcileDraft(disk,draft,'revision-3')
 assert.equal(divergent.conflict,true)
 assert.equal(divergent.snapshot.records.step.caption,'尚未保存')
})

test('an edit made during an in-flight save is included in the next revision',async t=>{
 const firstWrite=deferred(),writeStarted=deferred()
 const f=fixture(t,{saveRemote(value,revision,index){
  if(index===1){writeStarted.resolve();return firstWrite.promise}
  return remote({...value,updatedAt:3000},'revision-2')
 }})
 await f.api.start()
 f.state.records.step=record('第一次修改')
 f.api.changed()
 const flushing=f.api.flush()
 await writeStarted.promise
 f.state.records.step=record('保存期间的新修改')
 f.state.records.second=record('新增截图')
 f.api.changed()
 firstWrite.resolve(remote({...f.saves[0].snapshot,updatedAt:2000},'revision-1'))
 await flushing
 await f.api.cacheSettled()
 assert.equal(f.saves.length,2)
 assert.equal(f.saves[0].snapshot.records.step.caption,'第一次修改')
 assert.equal(f.saves[1].revision,'revision-1')
 assert.equal(f.saves[1].snapshot.records.step.caption,'保存期间的新修改')
 assert.equal(f.saves[1].snapshot.records.second.caption,'新增截图')
 assert.equal(f.state.records.step.caption,'保存期间的新修改')
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.state.dirty,false)
 assert.equal(f.cache.at(-1).autosave.baseRevision,'revision-2')
 assert.equal(f.cache.at(-1).autosave.pending,false)
})

test('a failed disk write keeps unsaved content and retry persists it',async t=>{
 const f=fixture(t,{saveRemote(value,revision,index){
  if(index===1)throw Error('磁盘空间不足')
  return remote({...value,updatedAt:3000},'revision-1')
 }})
 await f.api.start()
 f.state.records.step=record('必须保留')
 f.api.changed()
 await f.api.flush()
 await f.api.cacheSettled()
 assert.equal(f.state.saveStatus,'error')
 assert.match(f.state.saveError,/磁盘空间不足/)
 assert.equal(f.state.dirty,true)
 assert.equal(f.state.savedAt,null)
 assert.equal(f.state.records.step.caption,'必须保留')
 assert.equal(f.cache.at(-1).autosave.pending,true)
 await f.api.retry()
 assert.equal(f.saves.length,2)
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.state.dirty,false)
 assert.equal(f.state.savedAt,3000)
})

test('a 409 conflict prevents automatic overwrites and cannot be bypassed by retry',async t=>{
 const f=fixture(t,{saveRemote(){throw Object.assign(Error('其他窗口已修改'),{status:409})}})
 await f.api.start()
 f.state.records.step=record('本窗口截图')
 f.api.changed()
 await f.api.flush()
 assert.equal(f.state.saveStatus,'conflict')
 assert.equal(f.state.dirty,true)
 f.state.records.step=record('冲突后继续保留的修改')
 f.api.changed()
 await f.api.flush()
 await f.api.retry()
 await f.api.cacheSettled()
 assert.equal(f.saves.length,1)
 assert.equal(f.state.saveStatus,'conflict')
 assert.equal(f.state.records.step.caption,'冲突后继续保留的修改')
 assert.equal(f.cache.at(-1).records.step.caption,'冲突后继续保留的修改')
 assert.equal(f.cache.at(-1).autosave.pending,true)
})

test('a startup conflict remains unresolved after editing, caching, and refreshing the page',async t=>{
 const disk=remote(snapshot({step:record('磁盘 R2 截图')},{updatedAt:2000}),'revision-2')
 const draft=snapshot({step:record('基于 R1 的旧草稿')},{autosave:{baseRevision:'revision-1',pending:true}})
 const first=fixture(t,{disk,draft})
 await first.api.start()
 assert.equal(first.state.saveStatus,'conflict')
 assert.equal(first.saves.length,0)
 first.state.records.step=record('冲突后继续修改的草稿')
 first.api.changed()
 await first.api.cacheSettled()
 assert.equal(first.cache.at(-1).records.step.caption,'冲突后继续修改的草稿')
 first.api.dispose()

 const refreshed=fixture(t,{disk,draft:first.cache.at(-1)})
 await refreshed.api.start()
 await refreshed.api.flush()
 await refreshed.api.retry()
 assert.equal(refreshed.saves.length,0,'refresh must not turn the unresolved draft into an authorized overwrite of revision 2')
 assert.equal(refreshed.state.saveStatus,'conflict')
 assert.equal(refreshed.state.dirty,true)
 assert.equal(refreshed.state.records.step.caption,'冲突后继续修改的草稿')
})

test('reloading disk saves the unsaved variant to recovery before replacing the displayed screenshots',async t=>{
 const recoveryStarted=deferred(),allowRecovery=deferred()
 const f=fixture(t,{writeRecovery(){recoveryStarted.resolve();return allowRecovery.promise}})
 await f.api.start()
 f.state.records.step=record('当前未保存版本')
 f.api.changed()
 f.state.saveStatus='conflict'
 f.setDisk(remote(snapshot({step:record('其他窗口版本')},{updatedAt:3000}),'revision-2'))
 const loading=f.api.reloadSaved()
 await recoveryStarted.promise
 assert.equal(f.state.records.step.caption,'当前未保存版本')
 allowRecovery.resolve()
 await loading
 assert.equal(f.recoveries.length,1)
 assert.equal(f.recoveries[0].records.step.caption,'当前未保存版本')
 assert.equal(f.state.cache.records.step.caption,'当前未保存版本')
 assert.equal(f.state.records.step.caption,'其他窗口版本')
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.state.dirty,false)
 assert.equal(f.saves.length,0)
 assert.equal(f.cache.at(-1).records.step.caption,'其他窗口版本')
})

test('a failed recovery backup prevents reload from discarding unsaved screenshots',async t=>{
 const f=fixture(t,{writeRecovery(){throw Error('恢复缓存不可用')}})
 await f.api.start()
 f.state.records.step=record('不能丢失')
 f.api.changed()
 f.state.saveStatus='conflict'
 f.setDisk(remote(snapshot({step:record('磁盘内容')},{updatedAt:3000}),'revision-2'))
 await f.api.reloadSaved()
 assert.equal(f.state.records.step.caption,'不能丢失')
 assert.equal(f.state.saveStatus,'error')
 assert.equal(f.state.dirty,true)
 assert.match(f.state.saveError,/恢复缓存不可用/)
 assert.equal(f.recoveries.length,0)
})

test('edits made while a recovery backup is pending survive reloading the disk version',async t=>{
 const recoveryStarted=deferred(),allowRecovery=deferred()
 const f=fixture(t,{writeRecovery(){recoveryStarted.resolve();return allowRecovery.promise}})
 await f.api.start()
 f.state.records.step=record('开始加载前的版本')
 f.api.changed()
 f.state.saveStatus='conflict'
 f.setDisk(remote(snapshot({step:record('磁盘内容')},{updatedAt:3000}),'revision-2'))
 const loading=f.api.reloadSaved()
 await recoveryStarted.promise
 f.state.records.step=record('等待备份时的新修改')
 f.api.changed()
 allowRecovery.resolve()
 await loading
 await f.api.cacheSettled()
 const retained=[f.getSnapshot(),f.state.cache,...f.recoveries,f.cache.at(-1)].filter(Boolean)
 assert.ok(retained.some(value=>value.records.step?.caption==='等待备份时的新修改'),'the latest edit must remain displayed or recoverable after reload')
})

test('changing only the hide-missing preference is durably saved',async t=>{
 const f=fixture(t)
 await f.api.start()
 f.state.hideMissing=true
 f.api.changed()
 await f.api.flush()
 assert.equal(f.saves.length,1)
 assert.equal(f.saves[0].snapshot.hideMissing,true)
 assert.deepEqual(f.saves[0].snapshot.records,{})
 assert.equal(f.state.hideMissing,true)
 assert.equal(f.state.saveStatus,'saved')
})

test('startup reads the existing browser cache before writing and preserves edits made while loading',async t=>{
 const oldCache=deferred(),diskRead=deferred()
 const f=fixture(t,{readCache:()=>oldCache.promise,loadRemote:()=>diskRead.promise})
 const starting=f.api.start()
 f.state.records.fresh=record('加载期间的新截图')
 f.api.changed()
 await f.api.cacheSettled()
 assert.equal(f.cache.length,0)
 assert.equal(f.saves.length,0)
 diskRead.resolve(remote())
 await Promise.resolve()
 assert.equal(f.cache.length,0)
 oldCache.resolve(snapshot({legacy:record('旧浏览器截图')}))
 await starting
 await f.api.cacheSettled()
 assert.equal(f.saves.length,1)
 assert.equal(f.saves[0].snapshot.records.legacy.caption,'旧浏览器截图')
 assert.equal(f.saves[0].snapshot.records.fresh.caption,'加载期间的新截图')
 assert.equal(f.state.saveStatus,'saved')
 assert.equal(f.cache.at(-1).records.legacy.caption,'旧浏览器截图')
})

test('without a local service, browser drafts restore automatically and remain editable',async t=>{
 const draft=snapshot({step:record('浏览器保留截图')})
 const f=fixture(t,{draft,loadRemote:async()=>null})
 await f.api.start()
 assert.equal(f.state.records.step.caption,'浏览器保留截图')
 assert.equal(f.state.localAvailable,false)
 assert.equal(f.state.saveStatus,'browser')
 f.state.records.step.caption='浏览器中的新图注'
 f.api.changed()
 await f.api.flush()
 assert.equal(f.saves.length,0)
 assert.equal(f.state.saveStatus,'browser')
 assert.equal(f.state.dirty,false)
 assert.equal(f.cache.at(-1).records.step.caption,'浏览器中的新图注')
})

test('a broken browser cache reports failure instead of claiming an automatic save',async t=>{
 const f=fixture(t,{loadRemote:async()=>null,writeCache(){throw Error('浏览器存储空间不足')}})
 await f.api.start()
 assert.equal(f.state.saveStatus,'error')
 assert.equal(f.state.dirty,true)
 assert.match(f.state.saveError,/浏览器存储空间不足/)
})
