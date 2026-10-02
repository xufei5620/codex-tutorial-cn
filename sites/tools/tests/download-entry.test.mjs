// Exercise the real Vue setup with mocked network; no account or model requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import {ref} from 'vue'
import {INDEX_ROUTES} from '../../downloads/catalog.mjs'
import {validateDownloadConfiguration} from '../prebuild.mjs'
const source=fs.readFileSync(new URL('../../studio/theme/DownloadLink.vue',import.meta.url),'utf8')
const {descriptor}=parse(source)
const script=compileScript(descriptor,{id:'download-unit'})
function setup(fetchCatalog){
 let destroy,mount
 const code=script.content.replace(/^import .*$/gm,'').replace('export default {','globalThis.component = {')
 const listeners=new Map(),location={hash:''}
 const context={ref,AbortController,INDEX_ROUTES,fetchCatalog,location,window:{addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener:name=>listeners.delete(name)},fetch:()=>{throw Error('Unmocked network is forbidden')},onMounted:callback=>{mount=callback},onBeforeUnmount:callback=>{destroy=callback}}
 vm.runInNewContext(code,context)
 return {state:context.component.setup({}, {expose(){}}),destroy:()=>destroy(),mount:()=>mount(),location,listeners}
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const flush=()=>new Promise(resolve=>setImmediate(resolve))
test('installer selector compiles with native details and an accessible summary',()=>{
 const compiled=compileTemplate({source:descriptor.template.content,id:'download-unit',filename:'DownloadLink.vue',ssr:true,ssrCssVars:[],compilerOptions:{bindingMetadata:script.bindings}})
 assert.deepEqual(compiled.errors,[])
 assert.match(descriptor.template.content,/<details ref="picker" id="download-installers"/)
 assert.match(descriptor.template.content,/<summary class="gold-button"/)
 assert.match(descriptor.template.content,/role="status"/)
 assert.equal(source.includes('v-html'),false)
 assert.equal(source.includes('feishu.cn'),false)
})
test('both product catalogs load only when the selection is expanded',async()=>{
 const calls=[],fixture=setup(async(product,options)=>{calls.push({product,options});return []})
 assert.equal(calls.length,0)
 fixture.state.expand({target:{open:false}})
 assert.equal(calls.length,0)
 fixture.state.expand({target:{open:true}})
 await flush()
 assert.deepEqual(calls.map(call=>call.product),['manager','chatgpt'])
 for(const call of calls)assert.equal(call.options.signal.aborted,false)
 assert.equal(fixture.state.catalogs.value.manager.status,'ready')
 assert.equal(fixture.state.catalogs.value.manager.items.length,0)
 fixture.state.expand({target:{open:true}})
 assert.equal(calls.length,2)
 fixture.destroy()
})
test('the same-site download anchor opens the selector while ordinary visits make no requests',async()=>{
 const calls=[],fixture=setup(async product=>{calls.push(product);return []})
 fixture.state.picker.value={open:false}
 fixture.mount()
 assert.equal(fixture.state.picker.value.open,false)
 assert.equal(calls.length,0)
 fixture.location.hash='#download-installers'
 fixture.listeners.get('hashchange')()
 await flush()
 assert.equal(fixture.state.picker.value.open,true)
 assert.deepEqual(calls,['manager','chatgpt'])
 fixture.destroy()
 assert.equal(fixture.listeners.size,0)
})
test('an unavailable product keeps a retryable state without hiding the other product',async()=>{
 let failed=true
 const fixture=setup(async product=>{if(product==='manager'&&failed)throw Error('Mock index unavailable');return product==='manager'?[{id:'macos-arm64'}]:[]})
 fixture.state.expand({target:{open:true}})
 await flush()
 assert.equal(fixture.state.catalogs.value.manager.status,'error')
 assert.equal(fixture.state.catalogs.value.chatgpt.status,'ready')
 failed=false
 await fixture.state.load('manager')
 assert.equal(fixture.state.catalogs.value.manager.status,'ready')
 assert.equal(fixture.state.catalogs.value.manager.items[0].id,'macos-arm64')
 fixture.destroy()
})
test('a newer request and unmount prevent slow responses from restoring stale download links',async()=>{
 const requests=[]
 const fixture=setup((product,options)=>{const pending=deferred();requests.push({...pending,product,signal:options.signal});return pending.promise})
 const first=fixture.state.load('manager'),second=fixture.state.load('manager')
 assert.equal(requests[0].signal.aborted,true)
 requests[1].resolve([{id:'new'}]);await second
 requests[0].resolve([{id:'old'}]);await first
 assert.equal(fixture.state.catalogs.value.manager.items[0].id,'new')
 const late=fixture.state.load('chatgpt')
 fixture.destroy()
 assert.equal(requests[2].signal.aborted,true)
 requests[2].resolve([{id:'after-unmount'}]);await late
 assert.equal(fixture.state.catalogs.value.chatgpt.status,'loading')
})
test('Windows offline instructions use the selected architecture and matching license filenames',()=>{
 const fixture=setup(async()=>[])
 assert.equal(fixture.state.windowsCommand({fileName:'ChatGPT-arm64.msix',licenseFileName:'ChatGPT-License.xml'}),"Add-AppxProvisionedPackage -Online -PackagePath '.\\ChatGPT-arm64.msix' -LicensePath '.\\ChatGPT-License.xml' -Regions all")
 fixture.destroy()
})
test('site configuration restricts download routing to the manager anchor and exactly two indexes',()=>{
 const site={download_page_url:'/guide/manager#download-installers',download_indexes:{...INDEX_ROUTES}}
 validateDownloadConfiguration(site)
 for(const download_page_url of ['/guide/download','https://example.invalid/file','//example.invalid/file'])assert.throws(()=>validateDownloadConfiguration({...site,download_page_url}))
 for(const download_indexes of [undefined,[],{...INDEX_ROUTES,extra:'/x'},{...INDEX_ROUTES,manager:'https://example.invalid/x'},{...INDEX_ROUTES,chatgpt:'/cos-download-index/other.json'}])assert.throws(()=>validateDownloadConfiguration({...site,download_indexes}))
})
test('both current sites use the same selector without old Feishu downloads or platform defaults',()=>{
 for(const id of ['newapi','sub2api']){
  const site=JSON.parse(fs.readFileSync(new URL('../../'+id+'/site.json',import.meta.url),'utf8'))
  validateDownloadConfiguration(site)
  assert.deepEqual(site.download_indexes,INDEX_ROUTES)
  assert.equal(JSON.stringify(site).includes('feishu.cn'),false)
 }
 const layout=fs.readFileSync(new URL('../../studio/theme/StudioLayout.vue',import.meta.url),'utf8')
 const manager=fs.readFileSync(new URL('../../shared/pages/guide/manager.md',import.meta.url),'utf8')
 assert.equal(layout.includes('packageHref'),false)
 assert.ok(layout.includes('data.value.site.download_page_url'))
 assert.equal(manager.includes('飞书'),false)
 assert.equal(manager.includes('<p class="manager-download"><DownloadLink'),false)
})
