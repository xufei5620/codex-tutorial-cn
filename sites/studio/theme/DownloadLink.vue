<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {fetchCatalog,INDEX_ROUTES} from '../../downloads/catalog.mjs'
const products=[{id:'manager',title:'星芒 AI 管理工具',description:'按操作系统与芯片选择；安装后登录并配置工具。'},{id:'chatgpt',title:'ChatGPT 桌面端离线包',description:'这是官方客户端安装文件；中转接入后可用功能以客户端与服务支持范围为准。'}]
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
function expand(event){
 if(!event.target.open)return
 for(const product of products)if(catalogs.value[product.id].status==='idle')load(product.id)
}
function reveal(){
 if(location.hash!=='#download-installers'||!picker.value)return
 picker.value.open=true
 expand({target:picker.value})
}
function bytes(value){return value>=1024**3?(value/1024**3).toFixed(2)+' GB':(value/1024**2).toFixed(1)+' MB'}
function windowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -LicensePath '.\\"+item.licenseFileName+"' -Regions all"}
onMounted(()=>{window.addEventListener('hashchange',reveal);reveal()})
onBeforeUnmount(()=>{disposed=true;window.removeEventListener('hashchange',reveal);for(const controller of controllers.values())controller.abort();controllers.clear()})
</script>
<template>
<details ref="picker" id="download-installers" class="installer-picker" @toggle="expand">
 <summary class="gold-button">下载安装包 <span aria-hidden="true">⌄</span></summary>
 <div class="installer-options">
  <p class="installer-intro">选择与你的电脑对应的系统和芯片。这里提供存储桶直链；没有列出的版本正在准备，请联系<a href="/contact">本站客服</a>。</p>
  <section v-for="product in products" :key="product.id" class="installer-product" :aria-labelledby="'download-title-'+product.id" :aria-busy="catalogs[product.id].status==='loading'">
   <h2 :id="'download-title-'+product.id">{{product.title}}</h2>
   <p>{{product.description}}</p>
   <p v-if="catalogs[product.id].status==='loading'" role="status">正在读取可下载版本…</p>
   <div v-else-if="catalogs[product.id].status==='error'" class="installer-status" role="status"><p>下载清单暂时无法读取，请重试或联系<a href="/contact">本站客服</a>。</p><button type="button" @click="load(product.id)">重新读取</button></div>
   <div v-else-if="!catalogs[product.id].items.length" class="installer-status" role="status"><p>安装包正在准备，暂时没有可下载版本。</p><button type="button" @click="load(product.id)">重新读取</button></div>
   <ul v-else class="installer-list">
    <li v-for="item in catalogs[product.id].items" :key="item.id" class="installer-item">
     <div class="installer-heading"><strong>{{item.label}}</strong><span>{{item.architecture}} · {{item.version||'版本见安装包'}}</span></div>
     <p class="installer-meta">{{item.format.toUpperCase()}} · {{bytes(item.bytes)}}</p>
     <div class="installer-actions"><a class="gold-button" :href="item.url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载安装包 ↗</a><a v-if="item.licenseUrl" class="soft-button" :href="item.licenseUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载许可文件 ↗</a></div>
     <div v-if="product.id==='chatgpt'&&item.format==='msix'&&item.licenseUrl" class="installer-instructions"><p>将安装包与许可文件放在同一文件夹。在该目录打开管理员 PowerShell，执行：</p><pre><code>{{windowsCommand(item)}}</code></pre><p>许可文件必须与上方安装包的版本和架构一致。该命令用于离线安装，不需要进入微软商店。</p></div>
     <p v-else-if="product.id==='chatgpt'&&item.format==='zip'">macOS：解压 ZIP 后将应用放入“应用程序”，再打开。</p>
     <p v-else-if="product.id==='chatgpt'&&['deb','rpm'].includes(item.format)">Linux：使用系统的软件安装器打开对应的 {{item.format.toUpperCase()}} 包。</p>
     <details class="installer-checksum"><summary>核对 SHA-256</summary><code>{{item.sha256}}</code><template v-if="item.licenseSha256"><p>许可文件：</p><code>{{item.licenseSha256}}</code></template></details>
    </li>
   </ul>
  </section>
 </div>
</details>
</template>
<style scoped>
.installer-picker{scroll-margin-top:90px;margin:4px 0 20px}
.installer-picker>summary{cursor:pointer;gap:12px;min-height:44px;list-style:none}
.installer-picker>summary::-webkit-details-marker{display:none}
.installer-picker>summary:focus-visible{outline:3px solid #93bceb;outline-offset:4px}
.installer-picker[open]>summary>span{transform:rotate(180deg)}
.installer-options{border:1px solid var(--line);border-radius:12px;background:white;margin-top:14px;padding:20px}
.installer-intro,.installer-product>p,.installer-meta,.installer-instructions{font-size:13px;color:var(--muted)}
.installer-product+.installer-product{border-top:1px solid var(--line);margin-top:25px;padding-top:8px}
.installer-product>h2{font-size:20px;margin:15px 0 8px}
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
@media(max-width:760px){.installer-options{padding:14px}.installer-heading{flex-direction:column}.installer-item{padding:13px}.installer-product>h2{font-size:18px}}
</style>
