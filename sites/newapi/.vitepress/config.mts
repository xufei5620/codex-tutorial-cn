import { defineConfig } from 'vitepress'
import { readFileSync } from 'node:fs'

const site = JSON.parse(readFileSync(new URL('../site.json', import.meta.url), 'utf8'))
const nav = JSON.parse(readFileSync(new URL('../nav.json', import.meta.url), 'utf8'))

// 中文分词：拆成单字 + 相邻双字，英文按单词；搜索时要求全部命中
function cjkTokenize(text: string): string[] {
  const out: string[] = []
  const re = /[一-鿿㐀-䶿]+|[a-zA-Z0-9_./\-]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = m[0]
    if (/[一-鿿㐀-䶿]/.test(s)) { for (let i = 0; i < s.length; i++) { out.push(s[i]); if (i + 1 < s.length) out.push(s.slice(i, i + 2)) } }
    else out.push(s.toLowerCase())
  }
  return out
}

export default defineConfig({
  lang: 'zh-CN',
  title: site.title,
  description: site.description,
  cleanUrls: true,
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#0d9488' }],
    ['meta', { name: 'robots', content: 'noindex' }],
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: site.name,
    site,                       // 站点信息（主题组件读取）
    contact: site.contact,      // 侧栏常驻客服卡
    nav: nav.nav,
    sidebar: nav.sidebar,
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    search: {
      provider: 'local',
      options: {
        miniSearch: { options: { tokenize: cjkTokenize }, searchOptions: { tokenize: cjkTokenize, combineWith: 'AND', prefix: false, fuzzy: 0 } },
        translations: { button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: { noResultsText: '没有找到相关内容', resetButtonTitle: '清除', footer: { selectText: '打开', navigateText: '切换', closeText: '关闭' } } },
      },
    },
    footer: { message: '遇到问题请先看「错误码对照」，仍无法解决请联系客服。', copyright: '© 2026 ' + site.name },
  },
})
