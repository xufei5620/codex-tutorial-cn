<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import DefaultTheme from 'vitepress/theme'
import SupportCard from './SupportCard.vue'
import MobileHelp from './MobileHelp.vue'
const Layout=DefaultTheme.Layout
onMounted(()=>{
 const embedded=window.self!==window.top||new URLSearchParams(location.search).get('ui_mode')==='embedded'
 document.documentElement.classList.toggle('xm-doc-embedded',embedded)
})
onUnmounted(()=>document.documentElement.classList.remove('xm-doc-embedded'))
</script>
<template><Layout><template #sidebar-nav-before><SupportCard /></template><template #doc-before><MobileHelp /></template><template #doc-after><div class="xm-doc-end"><a href="/learn/codex/">Codex 零基础课程 →</a><a href="/contact">联系本站客服 →</a></div></template></Layout></template>
<style>
html.xm-doc-embedded{--vp-nav-height:48px}html.xm-doc-embedded .VPNavBarTitle .title{font-size:14px}html.xm-doc-embedded .VPNavBarMenu .VPNavBarMenuLink{font-size:12px}.xm-doc-end{display:flex;gap:25px;flex-wrap:wrap;border-top:1px solid var(--vp-c-divider);padding:20px 0;margin-top:30px;font-size:13px}.xm-doc-end a{color:var(--vp-c-brand-1)}
</style>
