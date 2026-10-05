<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';
defineProps({ compact: Boolean });
const { theme } = useData();
const historical = computed(() => theme.value.studio?.site?.id === 'sub2api');
</script>
<template>
  <aside class="manager-account-notice" :class="{ 'is-history': historical, 'is-compact': compact }" role="note">
    <strong>{{ historical ? '本站请使用「历史账号」登录管理工具' : '使用本站「星芒账号」登录管理工具' }}</strong>
    <p v-if="historical">本站如需使用星芒 AI 管理工具，请选择「用历史账号登录」，使用 api.solov.cc 的账号登录。</p>
    <p v-else>在管理工具的登录框使用本站账号和密码，保持默认的「星芒账号」来源。</p>
    <p v-if="!compact">登录后核对账号昵称与可用额度。已有其他来源的登录状态时，先退出并切换到正确入口；不要把调用密钥填进账号密码栏。</p>
  </aside>
</template>
<style scoped>
.manager-account-notice {
  margin: 18px 0;
  padding: 16px 18px;
  border-left: 3px solid #8eafc7;
  background: #edf3f9;
  border-radius: 0 8px 8px 0;
  color: #294967;
  font-size: 14px;
  line-height: 1.8;
}
.manager-account-notice strong {
  display: block;
  font-size: 15px;
}
.manager-account-notice p {
  margin: 5px 0 0;
}
.manager-account-notice.is-history {
  border-left-color: #bb9148;
  background: #fbf4e4;
  color: #6b5125;
}
.manager-account-notice.is-compact {
  font-size: 13px;
  padding: 12px 16px;
}
.manager-account-notice.is-compact strong {
  font-size: 14px;
}
</style>
