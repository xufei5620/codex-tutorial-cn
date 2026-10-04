<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {fetchCatalog,INDEX_ROUTES,downloadPlatformGroups} from '../../downloads/catalog.mjs'
import BrandIcon from './BrandIcon.vue'
import windowsIcon from '../assets/os/windows.svg'
import appleIcon from '../assets/os/apple.svg'
const systemIcons={windows:windowsIcon,macos:appleIcon}
const products=[
 {id:'manager',icon:'manager',title:'星芒 AI 管理工具',heading:'下载管理工具',description:'按引导检查环境、安装常用 AI 工具，再完成本站配置。'},
 {id:'chatgpt',icon:'codex',title:'Codex 桌面端离线包（备用）',heading:'Codex 桌面端',description:'完整离线包；Windows 需同时下载配套许可文件。'},
 {id:'claude',icon:'claude',title:'Claude Desktop 离线包（备用）',heading:'Claude Desktop',description:'Mac 通用版同时支持 Apple 芯片与 Intel。'}
]
const picker=ref(),activeSelection=ref(null),catalogs=ref(Object.fromEntries(products.map(product=>[product.id,{status:'idle',items:[]}]))),controllers=new Map()
let disposed=false,activeButton=null
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
 }finally{if(controllers.get(product)===controller)controllers.delete(product)}
}
function bytes(value){return value>=1024**3?(value/1024**3).toFixed(2)+' GB':(value/1024**2).toFixed(1)+' MB'}
function packageGroups(product){return downloadPlatformGroups(product).map(group=>({...group,packages:group.packages.map(definition=>({...definition,item:catalogs.value[product].items.find(item=>item.id===definition.id)}))}))}
function pendingLabel(product){return product==='manager'?'暂未提供':'准备中'}
function isActive(product,system){return activeSelection.value?.product===product&&activeSelection.value?.system===system}
function selectSystem(product,system,event){
 if(!Object.hasOwn(INDEX_ROUTES,product)||!downloadPlatformGroups(product).some(group=>group.platform===system))return
 activeSelection.value=isActive(product,system)?null:{product,system}
 activeButton=activeSelection.value?event?.currentTarget:null
}
function closeOnEscape(event){
 if(event.key!=='Escape'||!activeSelection.value)return
 activeSelection.value=null
 activeButton?.focus()
 activeButton=null
 event.preventDefault()
 event.stopPropagation()
}
function optionTitle(product,entry){
 if(product==='claude'&&entry.platform==='macos')return entry.format==='dmg'?'DMG · 拖拽安装':'PKG · 安装向导'
 if(entry.platform==='macos')return entry.architecture==='arm64'?'Apple 芯片':'Intel 芯片'
 return entry.architecture==='arm64'?'ARM 处理器':'Intel / AMD 处理器'
}
function optionDescription(product,entry){
 if(product==='claude'&&entry.platform==='macos')return entry.format==='dmg'?'打开后拖入“应用程序”，适合日常安装。':'按系统安装器提示完成，也适合统一部署。'
 if(entry.platform==='macos')return entry.architecture==='arm64'?'适用于 M 系列芯片的 Mac。':'适用于搭载 Intel 处理器的 Mac。'
 return entry.architecture==='arm64'?'适用于搭载 ARM 处理器的 Windows 电脑。':'适用于大多数 Windows 电脑（x64）。'
}
function panelHint(product,system){
 if(product==='claude'&&system==='macos')return '两种格式均为通用版，支持 Apple 芯片与 Intel。日常安装选择 DMG 即可。'
 return system==='windows'?'在“设置 → 系统 → 系统信息”中查看“系统类型”，确认电脑的处理器架构。':'在苹果菜单的“关于本机”中查看芯片或处理器。'
}
function windowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -LicensePath '.\\"+item.licenseFileName+"' -Regions all"}
function claudeWindowsCommand(item){return "Add-AppxProvisionedPackage -Online -PackagePath '.\\"+item.fileName+"' -SkipLicense -Regions all"}
onMounted(()=>{for(const product of products)if(catalogs.value[product.id].status==='idle')load(product.id)})
onBeforeUnmount(()=>{disposed=true;activeButton=null;for(const controller of controllers.values())controller.abort();controllers.clear()})
</script>
<template>
<section ref="picker" id="download-installers" class="installer-picker" aria-label="安装包下载" @keydown="closeOnEscape">
 <template v-for="product in products" :key="product.id">
  <div v-if="product.id==='chatgpt'" class="installer-backup-heading"><h2>桌面端离线安装包</h2><p>正常安装遇到网络问题时，使用下面的备用包。</p></div>
  <section class="installer-primary" :class="{'installer-featured':product.id==='manager'}" :data-product="product.id" :aria-labelledby="'download-title-'+product.id" :aria-busy="catalogs[product.id].status==='loading'">
   <header class="installer-product-header">
    <div class="installer-product-copy">
     <div class="installer-title-line"><BrandIcon :name="product.icon" :size="28" class="installer-product-icon"/><component :is="product.id==='manager'?'h2':'h3'" :id="'download-title-'+product.id">{{product.heading}}</component><span v-if="product.id==='manager'" class="installer-badge">推荐先安装</span></div>
     <p>{{product.description}}</p>
    </div>
    <div class="installer-system-groups" role="group" :aria-label="product.title+' 选择操作系统'">
     <button v-for="group in packageGroups(product.id)" :key="group.platform" type="button" class="soft-button installer-system-button" :data-system="group.platform" :aria-label="product.title+' '+group.title+' 安装选项'" :aria-expanded="isActive(product.id,group.platform)" :aria-controls="'download-options-'+product.id+'-'+group.platform" @click="selectSystem(product.id,group.platform,$event)"><img :src="systemIcons[group.platform]" alt="" aria-hidden="true" class="installer-os-icon" width="18" height="18">{{group.title}}<span class="installer-chevron" aria-hidden="true"></span></button>
    </div>
   </header>
   <p v-if="['idle','loading'].includes(catalogs[product.id].status)" class="installer-status" role="status">正在读取下载地址…</p>
   <div v-else-if="catalogs[product.id].status==='error'" class="installer-status" role="status"><p>下载地址暂时无法读取，请重试或联系<a href="/contact">本站客服</a>。</p><button type="button" class="soft-button" @click="load(product.id)">重新读取</button></div>
   <div v-else-if="!catalogs[product.id].items.length" class="installer-status" role="status"><p>安装包正在准备，暂时无法下载。</p><button type="button" class="soft-button" @click="load(product.id)">重新读取</button></div>
   <section v-for="group in packageGroups(product.id)" v-show="isActive(product.id,group.platform)" :id="'download-options-'+product.id+'-'+group.platform" :key="group.platform" class="installer-system-panel" :data-system-panel="group.platform" :aria-label="product.title+' '+group.title+' 下载选项'">
    <div class="installer-panel-heading"><h4>{{product.id==='claude'&&group.platform==='macos'?'选择安装方式':'选择电脑的芯片类型'}}</h4><p>{{panelHint(product.id,group.platform)}}</p></div>
    <ul class="installer-direct-list" :class="{'installer-single-option':group.packages.length===1}">
     <li v-for="entry in group.packages" :key="entry.id" class="installer-option" :data-package="entry.id">
      <div class="installer-option-copy"><h5>{{optionTitle(product.id,entry)}}</h5><p>{{optionDescription(product.id,entry)}}</p></div>
      <dl v-if="entry.item" class="installer-meta"><div><dt>版本</dt><dd>{{entry.item.version||'见安装包'}}</dd></div><div><dt>文件</dt><dd>{{entry.format.toUpperCase()}} / {{bytes(entry.item.bytes)}}</dd></div></dl>
      <div class="installer-actions">
       <a v-if="entry.item" class="gold-button" :href="entry.item.url" :aria-label="product.title+' '+entry.label+' 下载 '+entry.format.toUpperCase()" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载 {{entry.format.toUpperCase()}}</a>
       <button v-else type="button" class="installer-pending" disabled :aria-label="product.title+' '+entry.label+' '+entry.format.toUpperCase()+' '+pendingLabel(product.id)">{{pendingLabel(product.id)}}</button>
       <template v-if="entry.requiresLicense"><a v-if="entry.item&&entry.item.licenseUrl" class="soft-button installer-license" :href="entry.item.licenseUrl" :aria-label="product.title+' '+entry.label+' 许可文件'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">许可文件</a><button v-else type="button" class="installer-pending" disabled :aria-label="product.title+' '+entry.label+' 许可文件准备中'">许可文件准备中</button></template>
      </div>
      <p v-if="entry.requiresLicense" class="installer-license-note">MSIX 与许可文件都要下载，并放在同一文件夹。</p>
      <details v-if="entry.item" class="installer-details">
       <summary>安装说明与校验</summary>
       <div class="installer-instructions">
        <template v-if="product.id==='chatgpt'&&entry.item.format==='msix'&&entry.item.licenseUrl"><p>安装包与许可文件须保持相同版本和架构。在所在文件夹打开管理员 PowerShell，执行：</p><pre><code>{{windowsCommand(entry.item)}}</code></pre></template>
        <template v-else-if="product.id==='claude'&&entry.item.format==='msix'"><p>无需单独许可文件。在安装包所在文件夹打开管理员 PowerShell，执行：</p><pre><code>{{claudeWindowsCommand(entry.item)}}</code></pre></template>
        <p v-else-if="entry.item.format==='dmg'">打开 DMG，将应用拖入“应用程序”后启动。</p>
        <p v-else-if="entry.item.format==='pkg'">打开 PKG，按系统安装器提示完成安装。</p>
        <p v-else-if="entry.item.format==='zip'">解压 ZIP，将应用放入“应用程序”后启动。</p>
        <p v-else>打开安装包，按安装向导完成后启动应用。</p>
        <p class="installer-hash-label">安装包 SHA-256</p><code class="installer-hash">{{entry.item.sha256}}</code>
        <template v-if="entry.item.licenseSha256"><p class="installer-hash-label">许可文件 SHA-256</p><code class="installer-hash">{{entry.item.licenseSha256}}</code></template>
       </div>
      </details>
     </li>
    </ul>
   </section>
  </section>
 </template>
</section>
</template>
<style scoped>
.installer-picker{--muted:#5f7188;scroll-margin-top:90px;margin:26px 0 36px}
.installer-primary{border:1px solid var(--line);border-radius:12px;background:#fff;margin:12px 0;min-width:0}
.installer-featured{border-color:#dac69f;border-top:3px solid var(--gold);margin-bottom:34px}
.installer-product-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 24px}
.installer-featured .installer-product-header{padding:28px}
.installer-product-copy{min-width:0}
.installer-title-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.installer-title-line h2,.installer-title-line h3{margin:0;border:0;padding:0;font-size:19px;line-height:1.4;color:var(--ink)}
.installer-featured .installer-title-line h2{font-size:24px}
.installer-product-icon{flex-shrink:0;width:28px;height:28px}
.installer-badge{font-size:11px;line-height:1.5;padding:3px 8px;border-radius:4px;color:#745823;background:#f8efd9}
.installer-product-copy>p{font-size:13px;line-height:1.7;color:var(--muted);margin:7px 0 0;max-width:440px}
.installer-backup-heading{margin:0 0 16px}
.installer-backup-heading>h2{font-size:20px;margin:0 0 7px;padding:0;border:0}
.installer-backup-heading>p{font-size:13px;line-height:1.7;color:var(--muted);margin:0}
.installer-system-groups{display:flex;gap:8px;flex-shrink:0}
.installer-system-button{cursor:pointer;gap:9px;min-height:44px;min-width:110px;justify-content:center;white-space:nowrap}
.installer-os-icon{display:block;width:18px;height:18px;object-fit:contain;flex-shrink:0}
.installer-system-button[aria-expanded=true]{border-color:var(--navy);background:var(--navy);color:#fff}
.installer-system-button[aria-expanded=true] .installer-os-icon{filter:brightness(0) invert(1)}
.installer-chevron{display:block;width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg);margin-left:5px}
.installer-system-button[aria-expanded=true] .installer-chevron{transform:translateY(2px) rotate(225deg)}
.installer-system-button:focus-visible,.installer-details>summary:focus-visible,.installer-actions>a:focus-visible{outline:3px solid #35658a;outline-offset:3px}
.installer-system-panel{position:static;padding:22px 24px 24px;border-top:1px solid var(--line);background:#f8fafc;border-radius:0 0 12px 12px}
.installer-panel-heading{margin-bottom:17px}
.installer-panel-heading>h4{font-size:15px;margin:0 0 6px;line-height:1.5}
.installer-panel-heading>p{font-size:12px;line-height:1.7;color:#52667f;margin:0}
.installer-direct-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;list-style:none!important;margin:0!important;padding:0!important}
.installer-direct-list.installer-single-option{grid-template-columns:minmax(0,1fr);max-width:480px}
.installer-option{margin:0!important;min-width:0;padding:20px;border:1px solid var(--line);border-radius:8px;background:#fff;display:flex;flex-direction:column;align-items:stretch}
.installer-option-copy>h5{font-size:16px;line-height:1.5;margin:0 0 6px;color:var(--ink)}
.installer-option-copy>p{font-size:13px;line-height:1.7;margin:0 0 16px;color:#52667f}
.installer-meta{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 16px;font-size:12px;line-height:1.6}
.installer-meta>div{min-width:0}
.installer-meta dt{color:var(--muted);margin-bottom:2px}
.installer-meta dd{margin:0;color:var(--ink);overflow-wrap:anywhere}
.installer-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:auto}
.installer-actions>a,.installer-actions>button{min-height:44px;justify-content:center;text-align:center;font-size:13px}
.installer-actions>.gold-button,.installer-actions>.installer-pending:first-child{flex:1}
.installer-license{min-width:90px}
.installer-pending{background:#eef1f5;color:#65758a;border:1px solid var(--line);border-radius:7px;padding:10px 16px}
.installer-license-note{font-size:12px;line-height:1.65;color:#52667f;margin:11px 0 0}
.installer-details{margin-top:16px;border-top:1px solid #edf0f4;padding-top:12px;font-size:12px}
.installer-details>summary{cursor:pointer;color:#536782;line-height:1.7;width:fit-content}
.installer-instructions{padding-top:6px;font-size:12px;line-height:1.8;color:#52667f;min-width:0}
.installer-instructions>p{margin:8px 0}
.installer-instructions pre{margin:10px 0;padding:12px;border:1px solid var(--line);background:#f5f7fa;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.installer-instructions pre code{font-size:11px}
.installer-hash{display:block;font-size:11px;line-height:1.65;overflow-wrap:anywhere;word-break:break-all}
.installer-instructions .installer-hash-label{font-weight:600;margin-top:13px}
.installer-status{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0;padding:0 24px 18px;color:#52667f;font-size:13px;line-height:1.7}
.installer-status p{margin:0}
.installer-status button{font-size:12px}
@media(max-width:800px){.installer-product-header,.installer-featured .installer-product-header{align-items:flex-start;flex-direction:column;gap:17px;padding:22px}.installer-product-copy>p{max-width:none}.installer-system-panel{padding:20px}.installer-system-groups{width:100%}.installer-system-button{flex:1}.installer-featured .installer-title-line h2{font-size:22px}}
@media(max-width:520px){.installer-picker{margin-top:22px}.installer-product-header,.installer-featured .installer-product-header{padding:19px}.installer-system-panel{padding:16px}.installer-direct-list{grid-template-columns:minmax(0,1fr)}.installer-option{padding:17px}.installer-system-button{min-width:0;padding:10px 12px}.installer-status{padding:0 19px 16px}.installer-meta{gap:24px}}
</style>
