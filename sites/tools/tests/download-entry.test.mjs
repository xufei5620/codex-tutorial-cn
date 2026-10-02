// Exercise the real Vue setup with mocked network; no account or model requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import * as Vue from 'vue'
import * as ServerRenderer from 'vue/server-renderer'
import {COS_ROOT,INDEX_ROUTES} from '../../downloads/catalog.mjs'
import {validateDownloadConfiguration} from '../prebuild.mjs'
const source=fs.readFileSync(new URL('../../studio/theme/DownloadLink.vue',import.meta.url),'utf8')
const {descriptor}=parse(source)
const script=compileScript(descriptor,{id:'download-unit'})
function setup(fetchCatalog){
 let destroy,mount
 const code=script.content.replace(/^import .*$/gm,'').replace('export default {','globalThis.component = {')
 const context={ref:Vue.ref,AbortController,INDEX_ROUTES,fetchCatalog,fetch:()=>{throw Error('Unmocked network is forbidden')},onMounted:callback=>{mount=callback},onBeforeUnmount:callback=>{destroy=callback}}
 vm.runInNewContext(code,context)
 return {state:context.component.setup({}, {expose(){}}),destroy:()=>destroy(),mount:()=>mount()}
}
function render(state){
 const compiled=compileTemplate({source:descriptor.template.content,id:'download-unit',filename:'DownloadLink.vue',ssr:true,ssrCssVars:[],compilerOptions:{bindingMetadata:script.bindings}})
 const context={}
 const code=compiled.code.replace(/^import \{ (.*?) \} from "(.*?)"$/gm,(_,bindings,module)=>{for(const binding of bindings.split(', ')){const [name,alias]=binding.split(' as ');context[alias||name]=(module==='vue'?Vue:ServerRenderer)[name]}return ''}).replace('export function ssrRender','globalThis.render = function ssrRender')
 vm.runInNewContext(code,context)
 let html=''
 context.render({},value=>{html+=value},null,{},null,Vue.proxyRefs(state),null,null)
 return html
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const flush=()=>new Promise(resolve=>setImmediate(resolve))
test('primary download links compile outside the secondary installer details',()=>{
 const compiled=compileTemplate({source:descriptor.template.content,id:'download-unit',filename:'DownloadLink.vue',ssr:true,ssrCssVars:[],compilerOptions:{bindingMetadata:script.bindings}})
 assert.deepEqual(compiled.errors,[])
 assert.match(descriptor.template.content,/<section id="download-installers"/)
 assert.match(descriptor.template.content,/<details class="installer-more"/)
 assert.match(descriptor.template.content,/<summary class="soft-button"/)
 assert.match(descriptor.template.content,/role="status"/)
 assert.equal(source.includes('v-html'),false)
 assert.equal(source.includes('feishu.cn'),false)
})
test('mount loads all three catalogs once and installation details do not trigger extra requests',async()=>{
 const calls=[],fixture=setup(async(product,options)=>{calls.push({product,options});return []})
 assert.equal(calls.length,0)
 fixture.mount()
 await flush()
 assert.deepEqual(calls.map(call=>call.product),['manager','chatgpt','claude'])
 fixture.mount()
 assert.equal(descriptor.template.content.includes('@toggle'),false)
 render(fixture.state)
 assert.deepEqual(calls.map(call=>call.product),['manager','chatgpt','claude'])
 for(const call of calls)assert.equal(call.options.signal.aborted,false)
 assert.equal(fixture.state.catalogs.value.manager.status,'ready')
 assert.equal(fixture.state.catalogs.value.manager.items.length,0)
 assert.equal(calls.length,3)
 fixture.destroy()
})
test('provided system buttons link straight to COS without choosing Windows for the reader',async()=>{
 const url=COS_ROOT+'/xingmang/releases/0.2.13/XingMang-AI-Manager-0.2.13-Apple-Silicon-arm64.dmg'
 const item={id:'macos-arm64',label:'macOS Apple Silicon',architecture:'arm64',version:'0.2.13',url,bytes:143258716,format:'dmg',sha256:'a'.repeat(64)}
 const fixture=setup(async product=>product==='manager'?[item]:[])
 fixture.mount()
 await flush()
 const html=render(fixture.state),primary=html.slice(0,html.indexOf('<details class="installer-more"'))
 assert.ok(primary.includes('href="'+url+'"'))
 assert.ok(primary.includes('下载 macOS Apple Silicon'))
 assert.equal(primary.includes('下载 Windows'),false)
 assert.equal(primary.includes('/guide/manager'),false)
 fixture.destroy()
})
test('Codex display name keeps the original package and matching license links beside their system label',async()=>{
 const directory=COS_ROOT+'/chatgpt/windows-arm64/26.930.2377.0/'
 const item={id:'windows-arm64',label:'Windows ARM64',architecture:'arm64',version:'26.930.2377.0',fileName:'ChatGPT-arm64.msix',licenseFileName:'ChatGPT-License.xml',url:directory+'ChatGPT-arm64.msix',licenseUrl:directory+'ChatGPT-License.xml',bytes:900000000,format:'msix',sha256:'a'.repeat(64),licenseSha256:'b'.repeat(64)}
 const fixture=setup(async product=>product==='chatgpt'?[item]:[])
 fixture.mount();await flush()
 const html=render(fixture.state),primary=html.slice(0,html.indexOf('<details class="installer-more"'))
 assert.ok(primary.includes('Codex 桌面端离线包（备用）'))
 assert.equal(primary.includes('ChatGPT 桌面端'),false)
 assert.ok(primary.includes('href="'+item.url+'"'))
 assert.ok(primary.includes('href="'+item.licenseUrl+'"'))
 assert.ok(primary.includes('下载 Windows ARM64'))
 assert.ok(primary.includes('Windows ARM64 许可文件'))
 assert.equal(primary.includes('Windows x64'),false)
 assert.ok(html.includes('Add-AppxProvisionedPackage'))
 fixture.destroy()
})
test('Claude is a separate fallback group with complete MSIX and SkipLicense instructions',async()=>{
 const item={id:'windows-arm64',label:'Windows ARM64',architecture:'arm64',version:'1.0.0.0',fileName:'Claude-arm64.msix',url:COS_ROOT+'/claude/windows-arm64/sha256-'+ 'a'.repeat(64)+'/Claude-arm64.msix',bytes:500000000,format:'msix',sha256:'a'.repeat(64)}
 const fixture=setup(async product=>product==='claude'?[item]:[])
 fixture.mount();await flush()
 const html=render(fixture.state),primary=html.slice(0,html.indexOf('<details class="installer-more"'))
 assert.ok(primary.includes('Claude Desktop 离线包（备用）'))
 assert.ok(primary.includes('href="'+item.url+'"'))
 assert.ok(primary.includes('下载 Windows ARM64'))
 assert.ok(html.includes('-SkipLicense -Regions all'))
 assert.equal(html.includes('-LicensePath'),false)
 assert.equal(primary.includes('href="'+COS_ROOT+'/chatgpt/'),false)
 fixture.destroy()
})
test('an empty index renders preparation and retry without a guessed download URL',async()=>{
 const fixture=setup(async()=>[])
 fixture.mount()
 await flush()
 const html=render(fixture.state),primary=html.slice(0,html.indexOf('<details class="installer-more"'))
 assert.ok(primary.includes('安装包正在准备'))
 assert.ok(primary.includes('重新读取'))
 assert.equal(primary.includes('<a'),false)
 fixture.destroy()
})
test('an unavailable product keeps a retryable state without hiding the other product',async()=>{
 let failed=true
 const fixture=setup(async product=>{if(product==='manager'&&failed)throw Error('Mock index unavailable');return product==='manager'?[{id:'macos-arm64'}]:[]})
 fixture.mount()
 await flush()
 assert.equal(fixture.state.catalogs.value.manager.status,'error')
 assert.equal(fixture.state.catalogs.value.chatgpt.status,'ready')
 assert.equal(fixture.state.catalogs.value.claude.status,'ready')
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
test('site configuration restricts download routing to the manager anchor and exactly three indexes',()=>{
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
