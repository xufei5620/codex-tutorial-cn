<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
type Download={label:string;architecture?:string;enabled?:boolean;url?:string;version?:string;date?:string;checksum?:string;notes_url?:string;notes?:string}
const {theme}=useData()
const packages=computed(()=>Object.entries((theme.value.site?.downloads||{}) as Record<string,Download>).filter(([,d])=>d.enabled!==false).map(([id,d])=>({id,...d})))
function https(v:unknown){try{const u=new URL(String(v));return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
</script>
<template>
 <div class="xm-downloads">
  <article v-for="d in packages" :key="d.id" :id="d.id" class="xm-download">
   <h3>{{d.label}}</h3><p class="muted">{{d.architecture}}<span v-if="d.version"> · {{d.version}}</span><span v-if="d.date"> · {{d.date}}</span></p>
   <p v-if="d.notes">{{d.notes}}</p>
   <a v-if="https(d.url)" class="dl-button" :href="d.url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">下载 {{d.label}} ↗</a>
   <template v-else><p class="pending">本安装包暂未公开发布下载地址。</p><a href="/contact">向本站客服确认适用版本 →</a></template>
   <a v-if="https(d.notes_url)" :href="d.notes_url" target="_blank" rel="noopener noreferrer">查看更新说明 ↗</a>
   <details v-if="d.checksum"><summary>文件 SHA-256</summary><code>{{d.checksum}}</code><small>下载后核对；摘要不能替代发行签名验证。</small></details>
  </article>
 </div>
 <p v-if="!packages.length">暂无公开安装包，请联系本站客服。</p>
</template>
<style scoped>
.xm-downloads{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin:25px 0}.xm-download{border:1px solid var(--vp-c-divider);background:var(--vp-c-bg-soft);border-radius:14px;padding:22px 18px;min-width:0;scroll-margin-top:95px}.xm-download h3{font-size:17px;margin:0}.xm-download p{font-size:13px;line-height:1.9}.xm-download a{display:block;font-size:13px;margin-top:12px}.dl-button{background:#0b1f3b;color:#faf7ee!important;padding:10px 12px;border-radius:7px;text-decoration:none!important;text-align:center}.muted,.pending{color:var(--vp-c-text-2)}.xm-download code{display:block;overflow-wrap:anywhere;white-space:normal;font-size:11px}.xm-download small{display:block;font-size:11px;color:var(--vp-c-text-2)}.xm-download details{font-size:12px;margin-top:15px}@media(max-width:740px){.xm-downloads{grid-template-columns:1fr}}
</style>
