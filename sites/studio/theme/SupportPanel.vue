<script setup>
import {useData} from 'vitepress'
const {theme}=useData()
</script>
<template><aside class="studio-support"><p class="eyebrow">A REAL PERSON, ON THE OTHER SIDE.</p><strong>卡住了？我们在这里。</strong><img :src="theme.studio.site.contact.wecom_qr" alt="微信扫码联系本站企业微信客服" width="176" height="176"><p>微信扫码，或直接打开客服</p><a :href="theme.studio.site.contact.wecom_url" target="_blank" rel="noopener noreferrer" class="gold-button">打开企业微信客服 ↗</a><small>{{theme.studio.site.contact.hours}}</small></aside></template>
