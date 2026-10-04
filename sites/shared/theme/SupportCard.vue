<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
const props=withDefaults(defineProps<{compact?:boolean}>(),{compact:false})
const {theme}=useData()
const c=computed(()=>theme.value.site?.contact||theme.value.contact||{})
</script>
<template>
 <aside v-if="c.wecom_url" class="xm-support" :class="{compact:props.compact}" aria-label="企业微信客服">
  <div class="xm-support-title">有问题，直接找我们。</div>
  <p class="xm-support-desc">扫码或点击，联系本站客服</p>
  <img v-if="c.wecom_qr" class="xm-support-qr" :src="c.wecom_qr" alt="本站企业微信客服二维码" width="176" height="176" />
  <a class="xm-support-button" :href="c.wecom_url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">打开企业微信客服 ↗</a>
  <small v-if="c.hours_short">{{c.hours_short}}</small>
  <p class="xm-support-tip">求助时先遮盖密钥、密码与验证码。</p>
 </aside>
</template>
<style scoped>
.xm-support{margin:14px 0 18px;padding:18px 12px;border:1px solid #d4a35588;border-radius:14px;background:var(--vp-c-bg-elv);text-align:center;box-shadow:0 7px 26px #0b1f3b0b}.xm-support-title{font-size:16px;font-weight:700;color:var(--vp-c-text-1)}.xm-support-desc{font-size:12px;margin:4px 0 12px;color:var(--vp-c-text-2)}.xm-support-qr{display:block;width:176px;max-width:100%;height:auto;aspect-ratio:1;background:white;border-radius:6px;margin:10px auto 13px;object-fit:contain}.xm-support-button{display:block;background:#137346;color:white!important;padding:9px 10px;border-radius:8px;font-size:13px;font-weight:650;text-decoration:none}.xm-support small{display:block;margin-top:7px;color:var(--vp-c-text-2);font-size:11px}.xm-support-tip{color:var(--vp-c-text-3);font-size:11px;margin:7px 0 0}.compact{margin-top:18px}.xm-support-button:focus-visible{outline:3px solid #d4a355;outline-offset:4px}
</style>
