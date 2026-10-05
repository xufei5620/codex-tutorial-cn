// One catalog serves the tool picker and site search. URLs come from site configuration.
export const tutorialTools = [
  {
    id: 'manager',
    name: '星芒 AI 管理工具',
    summary: '下载安装管理工具，完成账号登录、工具安装和配置；需要时使用备用离线包。',
    category: 'manager',
    interface: '推荐先安装',
    aliases: ['星芒', 'xingmang', '管理器', '安装包', '下载', 'windows', 'mac'],
    baseKind: null,
    href: '/guide/manager'
  },
  {
    id: 'codex',
    name: 'Codex',
    summary: '从桌面端、CLI 和编辑器扩展的接入开始，学习文件协作、图文任务和 Skill。',
    category: 'codex',
    interface: '桌面 / CLI / 扩展',
    aliases: ['chatgpt', 'openai', 'codex cli', '桌面端', '技能'],
    baseKind: 'codex',
    href: '/learn/codex/'
  },
  {
    id: 'claude',
    name: 'Claude',
    summary: '分别了解 Claude Code 和 Claude Desktop，按使用入口完成安装、配置和第一次任务。',
    category: 'claude',
    interface: 'Code / Desktop',
    aliases: ['anthropic', '克劳德', 'claude cli', 'claude code', 'claude desktop'],
    baseKind: null,
    href: '/learn/claude/'
  }
]

export function filterTutorialTools(query = '', category = 'all') {
  const terms = String(query).normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean)
  return tutorialTools.filter((tool) => {
    const text = [tool.name, tool.id, tool.summary, tool.interface, ...tool.aliases].join(' ').normalize('NFKC').toLowerCase()
    return (category === 'all' || tool.category === category) && terms.every((term) => text.includes(term))
  })
}

export function tutorialToolBase(id, site = {}) {
  const origin = site.base_url || site.site_url || ''
  if (id === 'codex') return site.codex_base_url || origin
  if (id === 'openclaw') return site.openclaw_base_url || (origin ? origin.replace(/\/$/, '') + '/v1' : '')
  if (id === 'claude-code' || id === 'gemini-cli') return origin
  return ''
}
