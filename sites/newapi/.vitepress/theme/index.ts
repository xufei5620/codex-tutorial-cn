import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ContactCard from './ContactCard.vue'
import ContactFootNote from './ContactFootNote.vue'
import './custom.css'

// 客服入口三处（2026-09-06 用户在对照台上选定）：
//   1. 侧栏顶部卡片 —— sidebar-nav-before
//   2. 顶栏「联系客服」按钮 —— nav 里的 /contact 项，样式在 custom.css
//   3. 正文末尾提示条 —— doc-after（首页不显示）
export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'sidebar-nav-before': () => h(ContactCard),
      'doc-after': () => h(ContactFootNote),
    }),
} satisfies Theme
