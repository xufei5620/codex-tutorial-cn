<script setup lang="ts">
import SupportCard from './SupportCard.vue'
</script>
<template><details class="xm-mobile-help"><summary>企业微信客服 <span>展开二维码与联系入口 ↗</span></summary><SupportCard compact /></details></template>
<style scoped>
.xm-mobile-help{display:none;margin:0 0 20px;padding:11px 14px;border:1px solid #d4a35588;background:var(--vp-c-bg-soft);border-radius:10px}.xm-mobile-help summary{cursor:pointer;font-weight:650;font-size:13px;color:var(--vp-c-text-1)}.xm-mobile-help summary span{font-weight:400;margin-left:8px;color:var(--vp-c-text-2);font-size:11px}@media(max-width:959px){.xm-mobile-help{display:block}}
</style>
