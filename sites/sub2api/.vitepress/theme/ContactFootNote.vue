<script setup lang="ts">
// 正文末尾的客服提示条：读完一页正好看到
import { useData } from 'vitepress'
const { theme, frontmatter } = useData()
const c = theme.value.contact as { wecom_url?: string; hours_short?: string }
</script>

<template>
  <div class="xm-foot-note" v-if="c && c.wecom_url && frontmatter.layout !== 'home'">
    <span>这一页没解决你的问题？企业微信客服 {{ c.hours_short }} 在线。</span>
    <a class="go" :href="c.wecom_url" target="_blank" rel="noopener noreferrer">联系客服</a>
  </div>
</template>

<style scoped>
.xm-foot-note {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 32px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.go {
  margin-left: auto;
  padding: 7px 16px;
  border-radius: 9px;
  background: #07c160;
  color: #fff !important;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none !important;
  white-space: nowrap;
}
.go:hover { background: #06ad56; }
@media (max-width: 480px) { .go { margin-left: 0; } }
</style>
