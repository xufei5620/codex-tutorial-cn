<script setup lang="ts">
// 侧栏常驻的联系客服小卡：二维码图片（site.json → contact.wecom_qr，后台可替换）+ 一键打开 + 工作时间
import { useData } from 'vitepress'
const { theme } = useData()
const c = theme.value.contact as { wecom_url?: string; wecom_qr?: string; hours_short?: string; telegram_url?: string }
</script>

<template>
  <div class="xm-side-contact" v-if="c && c.wecom_url">
    <img class="qr" :src="c.wecom_qr" alt="企业微信客服二维码">
    <div class="t">微信扫码联系客服</div>
    <div class="h">{{ c.hours_short }}</div>
    <a class="btn" :href="c.wecom_url" target="_blank" rel="noopener noreferrer">打开微信客服</a>
    <a v-if="c.telegram_url" class="lnk" :href="c.telegram_url" target="_blank" rel="noopener noreferrer">Telegram 频道</a>
  </div>
</template>

<style scoped>
.xm-side-contact { margin: 18px 0 8px; padding: 14px 12px 12px; border: 1px solid var(--vp-c-border); border-radius: 12px; background: var(--vp-c-bg-elv); text-align: center; }
.qr { display: block; width: 132px; height: 132px; margin: 0 auto; padding: 6px; background: #fff; border: 1px solid var(--vp-c-border); border-radius: 10px; object-fit: contain; }
.t { margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--vp-c-text-1); }
.h { margin-top: 2px; font-size: 12px; color: var(--vp-c-text-3); }
.btn { display: block; margin-top: 10px; padding: 7px 10px; border-radius: 8px; background: #07c160; color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
.btn:hover { background: #06ad56; }
.lnk { display: block; margin-top: 8px; font-size: 12px; color: var(--vp-c-brand-1); text-decoration: none; }
.lnk:hover { text-decoration: underline; }
</style>
