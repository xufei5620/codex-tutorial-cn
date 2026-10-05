const entityNames = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeText(value) {
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, name) => {
    if (name[0] !== '#') return entityNames[name.toLowerCase()] ?? match
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match
  })
}

export function plainSearchText(value) {
  return decodeText(
    String(value ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/(?:^|\n)\s*(`{3,}|~{3,})[^\n]*/g, '\n')
      .replace(/[*`]/g, '')
      .replace(/(?:^|\n)\s*#{1,6}\s+/g, '\n')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeSearch(value) {
  let text = decodeText(value)
  // Pasted encoded error messages should search the same text as their readable form.
  try {
    text = decodeURIComponent(text)
  } catch {
    /* A literal percent sign is a valid search term. */
  }
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function searchMatches(text, query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  const haystack = normalizeSearch(text)
  return words.every((word) => haystack.includes(word))
}

// Match the configured VitePress 1.6 heading slugger; tests compare real Markdown output.
export function headingAnchor(text) {
  return decodeText(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
}

export function documentSearchEntries(doc) {
  if (!doc.markdown) return [{ ...doc, text: plainSearchText(doc.text) }]
  const source = doc.markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const entries = []
  const used = new Set()
  let entry = { title: doc.title, route: doc.route, text: '' },
    fence = null
  for (const line of source.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null
      continue
    }
    const heading = !fence && line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const explicit = heading[2].match(/\s*\{#([^}]+)\}\s*$/)
      const title = plainSearchText(heading[2].replace(/\s*\{#[^}]+\}\s*$/, ''))
      const base = explicit?.[1] || headingAnchor(title)
      let anchor = base,
        suffix = 1
      while (used.has(anchor)) anchor = base + '-' + suffix++
      used.add(anchor)
      if (entry.text.trim()) entries.push({ ...entry, text: plainSearchText(entry.text) })
      entry = {
        title: heading[1].length === 1 ? title : doc.title + ' · ' + title,
        route: doc.route + '#' + encodeURIComponent(anchor),
        text: ''
      }
    } else entry.text += '\n' + line
  }
  if (entry.text.trim()) entries.push({ ...entry, text: plainSearchText(entry.text) })
  return entries.length ? entries : [{ title: doc.title, route: doc.route, text: plainSearchText(source) }]
}

export function buildSearchEntries(data, tools = [], skills = []) {
  const pages = [
    {
      title: '教程总览 · 从这里开始',
      route: '/guide/start',
      text: '第一次连接、工具选择、学习路线、管理工具、Codex 零基础、验证调用与遇到问题。'
    },
    { title: '工具教程', route: '/tools', text: '选择 Codex、Claude 或星芒 AI 管理工具，阅读对应的安装、认证、配置和使用教程。' },
    { title: 'Codex 零基础 · 课程目录', route: '/learn/codex/', text: '从界面到交付，阅读课程目录、章节和练习。' },
    { title: 'Claude 教程', route: '/learn/claude/', text: 'Claude Code、Claude Desktop 的安装、配置、首次使用与排错。' },
    {
      title: 'Skill 工坊 · 制作技能',
      route: '/skills?tab=build',
      text: '制作 Skill 技能、SKILL.md、教程口吻、办公交付、认界面、底稿、YAML、name、description、保存文件、基础格式检查。'
    },
    {
      title: 'Skill 工坊 · 安装与调用',
      route: '/skills?tab=install',
      text: '安装技能、.agents/skills/技能名/SKILL.md、技能目录、发现技能、显式调用、保存文件不等于安装。'
    },
    { title: 'Skill 工坊 · 测试与改进', route: '/skills?tab=test', text: '测试技能、正常、缺失、跑偏、三个小例子、验收标准与实际结果。' }
  ]
  pages.find((page) => page.route === '/skills?tab=build').text +=
    ' ' +
    skills.map((skill) => [skill.label, skill.name, skill.summary, skill.description, plainSearchText(skill.body)].join(' ')).join(' ')
  pages.find((page) => page.route === '/skills?tab=test').text +=
    ' ' + skills.flatMap((skill) => (skill.cases || []).map((item) => [item.label, item.prompt, item.expected].join(' '))).join(' ')
  const chapters = (data.chapters || []).flatMap((chapter) =>
    (chapter.sections || []).map((section, index) => ({
      title: chapter.n + '.' + (index + 1) + ' ' + section.title,
      route: '/learn/codex/' + chapter.id + '#' + encodeURIComponent(section.anchor),
      text: plainSearchText(section.body)
    }))
  )
  const clientRoutes = new Set(['/clients/codex', '/clients/claude-code', '/clients/claude-desktop', '/clients/nodejs'])
  const docs = (data.docs || [])
    .filter(
      (doc) =>
        !['/', '/guide/start', '/tools', '/skills'].includes(doc.route) &&
        (!doc.route.startsWith('/clients/') || clientRoutes.has(normalizeRoute(doc.route)))
    )
    .flatMap(documentSearchEntries)
  const clients = tools
    .filter((tool) => ['codex', 'claude', 'claude-code', 'claude-desktop', 'manager'].includes(tool.id))
    .map((tool) => ({
      title: '工具教程 · ' + tool.name,
      route: tool.href || '/clients/' + tool.id,
      text: [tool.summary, ...(tool.aliases || [])].join(' ')
    }))
  const unique = new Map()
  for (const entry of [...pages, ...clients, ...chapters, ...docs]) {
    const existing = unique.get(entry.route)
    if (existing) existing.text += ' ' + entry.title + ' ' + entry.text
    else unique.set(entry.route, { ...entry })
  }
  return [...unique.values()]
}

export function searchExcerpt(text, query, length = 150) {
  const readable = plainSearchText(text)
  const normalized = normalizeSearch(readable)
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  const positions = words.map((word) => normalized.indexOf(word)).filter((index) => index >= 0)
  const start = positions.length ? Math.max(0, Math.min(...positions) - 35) : 0
  return (start ? '…' : '') + readable.slice(start, start + length) + (start + length < readable.length ? '…' : '')
}

export function searchEntries(entries, query, limit = 35) {
  if (!normalizeSearch(query)) return []
  const words = normalizeSearch(query).split(' ')
  return entries
    .filter((entry) => searchMatches(entry.title + ' ' + entry.text, query))
    .map((entry, index) => ({
      ...entry,
      excerpt: searchExcerpt(entry.text, query),
      score: words.filter((word) => normalizeSearch(entry.title).includes(word)).length,
      index
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
}

export function normalizeRoute(value) {
  let path = String(value ?? '').split(/[?#]/)[0]
  try {
    path = decodeURIComponent(path)
  } catch {
    /* Keep malformed paths comparable without throwing. */
  }
  return path.replace(/\.html$/, '').replace(/\/$/, '') || '/'
}

export function navigationActive(path, href) {
  const current = normalizeRoute(path),
    target = normalizeRoute(href)
  if (target === '/guide/start') return current === '/' || current === target
  if (target === '/learn/codex')
    return (
      current === target ||
      current.startsWith(target + '/') ||
      current === '/clients/codex' ||
      current === '/skills' ||
      ['/learn/first-task', '/learn/firsttask', '/learn/working-with-files', '/learn/review-and-revise', '/learn/project-rules'].includes(
        current
      )
    )
  if (target === '/learn/claude')
    return current === target || current.startsWith(target + '/') || ['/clients/claude-code', '/clients/claude-desktop'].includes(current)
  return current === target
}
