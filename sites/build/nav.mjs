// Top navigation and sidebar: the site's nav.json plus the generated course groups.

const PRACTICE = [
  { text: '第一次任务练习', link: '/learn/first-task' },
  { text: '文件夹练习', link: '/learn/working-with-files' },
  { text: '检查结果与修改', link: '/learn/review-and-revise' }
]

/** Inserts the course groups after the site's first sidebar group. */
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
