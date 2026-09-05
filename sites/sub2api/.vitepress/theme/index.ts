import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ContactCard from './ContactCard.vue'
import './custom.css'

// 左侧目录下方常驻「联系客服」小卡（sidebar-nav-after 插槽）；
// 右侧「本页目录」下方也放一份（aside-outline-after），宽屏时两边都看得到，窄屏只剩左侧。
export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'sidebar-nav-after': () => h(ContactCard),
    }),
} satisfies Theme
