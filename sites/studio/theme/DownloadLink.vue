<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {fetchCatalog,INDEX_ROUTES} from '../../downloads/catalog.mjs'
const products=[{id:'manager',title:'星芒 AI 管理工具',description:'先下载管理工具，按工具内的正常流程安装与配置所需工具。'},{id:'chatgpt',title:'Codex 桌面端离线包（备用）',description:'正常安装失败或网络异常时使用。按系统与芯片选择；Windows 需一并下载许可文件。'},{id:'claude',title:'Claude Desktop 离线包（备用）',description:'正常安装失败或网络异常时使用。按系统与芯片选择官方安装包。'}]
const catalogs=ref(Object.fromEntries(products.map(product=>[product.id,{status:'idle',items:[]}]))),controllers=new Map()
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
function windowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -LicensePath '.\\"+item.licenseFileName+"' -Regions all"}
function claudeWindowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -SkipLicense -Regions all"}
onMounted(()=>{for(const product of products)if(catalogs.value[product.id].status==='idle')load(product.id)})
onBeforeUnmount(()=>{disposed=true;for(const controller of controllers.values())controller.abort();controllers.clear()})
</script>
<template>
<section id="download-installers" class="installer-picker" aria-label="安装包下载">
 <section v-for="product in products" :key="product.id" class="installer-primary" :aria-labelledby="'download-title-'+product.id" :aria-busy="catalogs[product.id].status==='loading'">
  <h2 :id="'download-title-'+product.id">{{product.title}}</h2>
  <p>{{product.description}}</p>
  <ul v-if="catalogs[product.id].status==='ready'&&catalogs[product.id].items.length" class="installer-direct-list"><li v-for="item in catalogs[product.id].items" :key="item.id"><div class="installer-actions"><a class="gold-button" :href="item.url" :title="product.title+' '+item.label+' · '+(item.version||'版本见安装包')" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载 {{item.label}} ↗</a><a v-if="item.licenseUrl" class="soft-button" :href="item.licenseUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{item.label}} 许可文件 ↗</a></div><small>{{item.format.toUpperCase()}} · {{item.version||'版本见安装包'}} · {{bytes(item.bytes)}}</small></li></ul>
  <p v-else-if="['idle','loading'].includes(catalogs[product.id].status)" role="status">正在读取安装包下载地址…</p>
  <div v-else-if="catalogs[product.id].status==='error'" class="installer-status" role="status"><p>下载地址暂时无法读取，请重试或联系<a href="/contact">本站客服</a>。</p><button type="button" @click="load(product.id)">重新读取</button></div>
  <div v-else class="installer-status" role="status"><p>{{product.title}}安装包正在准备，暂时没有可下载版本。</p><button type="button" @click="load(product.id)">重新读取</button></div>
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
.installer-direct-list{display:flex;gap:16px;flex-wrap:wrap;list-style:none!important;margin:0 0 18px!important;padding:0!important}
.installer-direct-list>li{margin:0!important;min-width:0}
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
@media(max-width:760px){.installer-options{padding:14px}.installer-heading{flex-direction:column}.installer-item{padding:13px}.installer-direct-list{display:grid}}
</style>
