<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {fetchCatalog,INDEX_ROUTES,downloadPlatformGroups} from '../../downloads/catalog.mjs'
import windowsIcon from '../assets/os/windows.svg'
import appleIcon from '../assets/os/apple.svg'
import linuxIcon from '../assets/os/linux.png'
const systemIcons={windows:windowsIcon,macos:appleIcon,linux:linuxIcon}
const products=[{id:'manager',title:'星芒 AI 管理工具',description:'先下载管理工具，按工具内的正常流程安装与配置所需工具。'},{id:'chatgpt',title:'Codex 桌面端离线包（备用）',description:'正常安装失败或网络异常时使用。按系统与芯片选择；Windows 需一并下载许可文件。'},{id:'claude',title:'Claude Desktop 离线包（备用）',description:'正常安装失败或网络异常时使用。按系统与芯片选择官方安装包。'}]
const picker=ref(),catalogs=ref(Object.fromEntries(products.map(product=>[product.id,{status:'idle',items:[]}]))),controllers=new Map()
let disposed=false
async function load(product){
 if(disposed||!Object.hasOwn(INDEX_ROUTES,product))return
 controllers.get(product)?.abort()
 const controller=new AbortController()
 controllers.set(product,controller)
 catalogs.value[product]={status:'loading',items:[]}
 try{
  const items=await fetchCatalog(product,{fetchImpl:fetch,signal:controller.signal})
  if(!disposed&&controllers.get(product)===controller)catalogs.value[product]={status:'ready',items}
 }catch{
  if(!disposed&&controllers.get(product)===controller)catalogs.value[product]={status:'error',items:[]}
 }finally{
  if(controllers.get(product)===controller)controllers.delete(product)
 }
}
function bytes(value){return value>=1024**3?(value/1024**3).toFixed(2)+' GB':(value/1024**2).toFixed(1)+' MB'}
function packageGroups(product){return downloadPlatformGroups(product).map(group=>({...group,packages:group.packages.map(definition=>({...definition,item:catalogs.value[product].items.find(item=>item.id===definition.id)}))}))}
function pendingLabel(product){return product==='manager'?'暂未提供':'准备中'}
function systemToggled(event){
 if(!event.target.open)return
 for(const item of picker.value?.querySelectorAll('details.installer-system[open]')||[])if(item!==event.target)item.open=false
}
function closeOnEscape(event){
 if(event.key!=='Escape')return
 const item=event.target.closest('details.installer-system[open]')
 if(!item)return
 item.open=false
 item.querySelector('summary')?.focus()
 event.preventDefault()
 event.stopPropagation()
}
function windowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -LicensePath '.\\"+item.licenseFileName+"' -Regions all"}
function claudeWindowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -SkipLicense -Regions all"}
onMounted(()=>{for(const product of products)if(catalogs.value[product.id].status==='idle')load(product.id)})
onBeforeUnmount(()=>{disposed=true;for(const controller of controllers.values())controller.abort();controllers.clear()})
</script>
<template>
<section ref="picker" id="download-installers" class="installer-picker" aria-label="安装包下载" @keydown="closeOnEscape">
 <section v-for="product in products" :key="product.id" class="installer-primary" :aria-labelledby="'download-title-'+product.id" :aria-busy="catalogs[product.id].status==='loading'">
  <h2 :id="'download-title-'+product.id">{{product.title}}</h2>
  <p>{{product.description}}</p>
  <p v-if="['idle','loading'].includes(catalogs[product.id].status)" role="status">正在读取安装包下载地址…</p>
  <div v-else-if="catalogs[product.id].status==='error'" class="installer-status" role="status"><p>下载地址暂时无法读取，请重试或联系<a href="/contact">本站客服</a>。</p><button type="button" @click="load(product.id)">重新读取</button></div>
  <div v-else-if="!catalogs[product.id].items.length" class="installer-status" role="status"><p>安装包正在准备，请按下方系统与架构查看。</p><button type="button" @click="load(product.id)">重新读取</button></div>
  <div class="installer-system-groups">
   <details v-for="group in packageGroups(product.id)" :key="group.platform" class="installer-system" :data-system="group.platform" @toggle="systemToggled">
    <summary class="soft-button installer-system-button" :aria-label="product.title+' '+group.title+' 安装选项'"><img :src="systemIcons[group.platform]" alt="" aria-hidden="true" class="installer-os-icon" width="18" height="18">{{group.title}} <span aria-hidden="true">⌄</span></summary>
    <div class="installer-system-menu">
    <h3>{{group.title}} · 选择架构与格式</h3>
    <ul class="installer-direct-list">
     <li v-for="entry in group.packages" :key="entry.id" :data-package="entry.id">
      <div class="installer-package-label"><strong>{{entry.label}}</strong><span>{{entry.architecture}} · {{entry.format.toUpperCase()}}</span></div>
      <div class="installer-actions">
       <a v-if="entry.item" class="gold-button" :href="entry.item.url" :title="product.title+' '+entry.label+' · '+(entry.item.version||'版本见安装包')" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载 {{entry.label}} ↗</a>
       <button v-else type="button" class="installer-pending" disabled :aria-label="product.title+' '+entry.label+' '+entry.format.toUpperCase()+' '+pendingLabel(product.id)">{{pendingLabel(product.id)}}</button>
       <template v-if="entry.requiresLicense"><a v-if="entry.item&&entry.item.licenseUrl" class="soft-button" :href="entry.item.licenseUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{entry.label}} 许可文件 ↗</a><button v-else type="button" class="installer-pending" disabled :aria-label="product.title+' '+entry.label+' 许可文件准备中'">许可文件准备中</button></template>
      </div>
      <small v-if="entry.item">{{entry.item.version||'版本见安装包'}} · {{bytes(entry.item.bytes)}}</small>
     </li>
    </ul>
    </div>
   </details>
  </div>
 </section>
 <details class="installer-more">
 <summary class="soft-button">安装说明与文件校验 <span aria-hidden="true">⌄</span></summary>
 <div class="installer-options">
  <p class="installer-intro">按上方按钮对应的系统、芯片与版本核对文件。各产品提供的系统版本可能不同。</p>
  <p v-if="products.every(product=>!catalogs[product.id].items.length)" role="status">安装说明与校验信息会随可下载版本一并显示。</p>
  <section v-for="product in products" :key="product.id" class="installer-product" :aria-labelledby="'download-instructions-'+product.id" :hidden="!catalogs[product.id].items.length">
   <h3 :id="'download-instructions-'+product.id">{{product.title}}</h3>
   <ul class="installer-list">
    <li v-for="item in catalogs[product.id].items" :key="item.id" class="installer-item">
     <div class="installer-heading"><strong>{{item.label}}</strong><span>{{item.architecture}} · {{item.version||'版本见安装包'}}</span></div>
     <p class="installer-meta">{{item.format.toUpperCase()}} · {{bytes(item.bytes)}}</p>
     <div v-if="product.id==='chatgpt'&&item.format==='msix'&&item.licenseUrl" class="installer-instructions"><p>将安装包与许可文件放在同一文件夹。在该目录打开管理员 PowerShell，执行：</p><pre><code>{{windowsCommand(item)}}</code></pre><p>许可文件必须与上方安装包的版本和架构一致。该命令用于离线安装，不需要进入微软商店。</p></div>
     <div v-else-if="product.id==='claude'&&item.format==='msix'" class="installer-instructions"><p>在安装包所在目录打开管理员 PowerShell，执行：</p><pre><code>{{claudeWindowsCommand(item)}}</code></pre><p>Claude 官方 MSIX 使用 SkipLicense，不需要下载单独的许可文件。</p></div>
     <p v-else-if="product.id==='claude'&&item.format==='dmg'">macOS：打开 DMG，将 Claude 拖入“应用程序”。Universal 包同时适用于 Apple 芯片与 Intel。</p>
     <p v-else-if="product.id==='claude'&&item.format==='pkg'">macOS：打开 PKG，按系统安装器提示安装。Universal 包同时适用于 Apple 芯片与 Intel。</p>
     <p v-else-if="product.id==='chatgpt'&&item.format==='zip'">macOS：解压 ZIP 后将应用放入“应用程序”，再打开。</p>
     <p v-else-if="product.id==='chatgpt'&&['deb','rpm'].includes(item.format)">Linux：使用系统的软件安装器打开对应的 {{item.format.toUpperCase()}} 包。</p>
     <p v-else-if="product.id==='claude'&&item.format==='deb'">Linux 测试版：适用于 Ubuntu 22.04+ 或 Debian 12+。使用系统的软件安装器打开对应架构的 DEB 包，缺失依赖时仍需通过 APT 安装。</p>
     <details class="installer-checksum"><summary>核对 SHA-256</summary><code>{{item.sha256}}</code><template v-if="item.licenseSha256"><p>许可文件：</p><code>{{item.licenseSha256}}</code></template></details>
    </li>
   </ul>
  </section>
 </div>
 </details>
</section>
</template>
<style scoped>
.installer-picker{scroll-margin-top:90px;margin:4px 0 20px}
.installer-primary{margin-bottom:12px}
.installer-primary>h2{font-size:18px;margin:14px 0 6px}
.installer-primary>p{font-size:13px;color:var(--muted);margin:6px 0 12px}
.installer-primary+.installer-primary{margin-top:24px}
.installer-system-groups{position:relative;display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 20px}
.installer-system{min-width:0}
.installer-system-groups>.installer-system{margin:0;padding:0;border:0;background:transparent;box-shadow:none}
.installer-system-button{cursor:pointer;gap:9px;min-height:44px;list-style:none}
.installer-os-icon{display:block;width:18px;height:18px;object-fit:contain;flex-shrink:0}
.installer-system-button::-webkit-details-marker{display:none}
.installer-system-button:focus-visible{outline:3px solid #93bceb;outline-offset:3px}
.installer-system[open]>.installer-system-button{border-color:#b99653;background:#f9f2e5}
.installer-system[open]>.installer-system-button>span{transform:rotate(180deg)}
.installer-system-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:30;width:min(480px,100%);max-height:65vh;overflow:auto;background:white;border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px #10203824;padding:16px}
.installer-system-menu>h3{font-size:15px;margin:0 0 12px}
.installer-direct-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;list-style:none!important;margin:0!important;padding:0!important}
.installer-direct-list>li{margin:0!important;min-width:0}
.installer-package-label{display:flex;flex-direction:column;gap:4px;margin-bottom:9px;overflow-wrap:anywhere}
.installer-package-label>strong{font-size:13px}
.installer-package-label>span{font-size:12px;color:var(--muted)}
.installer-pending{background:#eef1f5;color:#56677c;border-color:var(--line);font-size:12px}
.installer-actions>a,.installer-actions>button{max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:center}
.installer-direct-list small{display:block;color:var(--muted);margin-top:6px}
.installer-more>summary{cursor:pointer;gap:12px;min-height:44px;list-style:none}
.installer-more>summary::-webkit-details-marker{display:none}
.installer-more>summary:focus-visible{outline:3px solid #93bceb;outline-offset:4px}
.installer-more[open]>summary>span{transform:rotate(180deg)}
.installer-options{border:1px solid var(--line);border-radius:12px;background:white;margin-top:14px;padding:20px}
.installer-intro,.installer-product>p,.installer-meta,.installer-instructions{font-size:13px;color:var(--muted)}
.installer-product+.installer-product{border-top:1px solid var(--line);margin-top:25px;padding-top:8px}
.installer-product>h3{font-size:18px;margin:15px 0 8px}
.installer-list{display:grid;gap:12px;list-style:none!important;padding:0!important;margin:16px 0!important}
.installer-item{border:1px solid var(--line);border-radius:10px;padding:16px;min-width:0}
.installer-heading{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between}
.installer-heading>span{font-size:12px;color:var(--muted)}
.installer-actions{display:flex;gap:10px;flex-wrap:wrap}
.installer-instructions pre{margin:10px 0;padding:14px}
.installer-checksum{font-size:12px;margin-top:14px}
.installer-checksum>summary{cursor:pointer;color:#6f7f93}
.installer-checksum code{display:block;overflow-wrap:anywhere;word-break:break-all;margin-top:8px}
.installer-status button{font-size:12px}
@media(max-width:760px){.installer-options{padding:14px}.installer-heading{flex-direction:column}.installer-item{padding:13px}.installer-direct-list{grid-template-columns:1fr}.installer-system-button{padding:9px 12px}.installer-system-menu{padding:13px}}
</style>
