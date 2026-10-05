// Top navigation and sidebar: shared/nav.json for both sites, plus the generated course groups.

const PRACTICE = [
  { text: '第一次任务练习', link: '/learn/first-task' },
  { text: '文件夹练习', link: '/learn/working-with-files' },
  { text: '检查结果与修改', link: '/learn/review-and-revise' }
]

/** Page title from frontmatter, else the first level-one heading. */
export function pageTitle(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/)
  const title = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2')
  return title || text.match(/^#\s+(.+)$/m)?.[1].trim()
}

/**
 * Applies one site's view of the shared navigation: entries limited to other sites (`sites`)
 * are dropped, and entries without `text` are labelled with the page's own title.
 */
export function siteNav(shared, id, pages) {
  const visible = (entry) => !entry.sites || entry.sites.includes(id)
  const entry = ({ sites, ...rest }) => {
    if (rest.items) return { ...rest, items: rest.items.filter(visible).map(entry) }
    if (rest.text) return rest
    const page = pages.get(rest.link.replace(/^\//, '').replace(/\/$/, '/index') + '.md')
    const text = page && pageTitle(page)
    if (!text) throw Error('导航条目缺少 text，且找不到页面标题：' + rest.link)
    return { text, ...rest }
  }
  return { nav: shared.nav.filter(visible).map(entry), sidebar: shared.sidebar.filter(visible).map(entry) }
}

/** Inserts the course groups after the first sidebar group. */
export function buildNav(sourceNav, catalog, promptsSidebar) {
  const nav = sourceNav.nav.map((item) => (item.link === '/learn/codex/' ? { ...item, text: 'Codex 零基础' } : item))
  const course = [
    { text: '课程目录', items: [{ text: '从界面到交付', link: '/learn/codex/' }] },
    {
      text: 'Codex 零基础',
      items: catalog.chapters.map((ch) => ({ text: String(ch.n).padStart(2, '0') + ' · ' + ch.shortTitle, link: '/learn/codex/' + ch.id }))
    },
    { text: '配套练习', items: [...promptsSidebar, ...PRACTICE] }
  ]
  return { nav, sidebar: [sourceNav.sidebar[0], ...course, ...sourceNav.sidebar.slice(1)] }
}
