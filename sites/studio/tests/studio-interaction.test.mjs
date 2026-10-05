import test from 'node:test'
import assert from 'node:assert/strict'
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress'
import {
  buildSearchEntries,
  decodeText,
  documentSearchEntries,
  headingAnchor,
  navigationActive,
  normalizeRoute,
  normalizeSearch,
  searchEntries,
  searchMatches
} from '../../theme/studio-search.mjs'

test('search normalizes pasted entities, escaped errors, fullwidth text and spaces without throwing', () => {
  assert.equal(normalizeSearch('  ＣＯＤＥＸ\n  429  '), 'codex 429')
  assert.equal(normalizeSearch('%E4%BD%99%E9%A2%9D &amp; &#x41;'), '余额 & a')
  assert.equal(normalizeSearch('100% quota'), '100% quota')
  assert.equal(decodeText('&#x110000; &#55296;'), '&#x110000; &#55296;')
  assert.equal(searchMatches('Codex 的余额不足，出现 429', ' Ｃｏｄｅｘ 429 '), true)
  assert.equal(searchMatches('Codex 429', 'Codex 401'), false)
})

test('search includes public hubs and skills while discarding the stale account text at guide start', () => {
  const entries = buildSearchEntries(
    {
      docs: [
        { route: '/guide/start', title: 'old account', text: 'stale-only' },
        { route: '/faq', title: '问题', text: '余额不足' },
        { route: '/clients/gemini-cli', title: 'Gemini', text: 'excluded-old-tool' }
      ]
    },
    [
      { id: 'codex', name: 'Codex', summary: '编程协作', aliases: ['OpenAI'] },
      { id: 'gemini-cli', name: 'Gemini', summary: 'excluded-old-tool' }
    ]
  )
  assert.equal(
    entries.some((entry) => entry.text.includes('stale-only')),
    false
  )
  assert.equal(
    entries.some((entry) => entry.text.includes('excluded-old-tool')),
    false
  )
  for (const [query, route] of [
    ['教程总览', '/guide/start'],
    ['工具教程', '/tools'],
    ['安装技能', '/skills?tab=install'],
    ['测试技能', '/skills?tab=test'],
    ['OpenAI', '/clients/codex']
  ]) {
    assert.ok(
      searchEntries(entries, query).some((entry) => entry.route === route),
      query
    )
  }
  assert.deepEqual(searchEntries(entries, '   '), [])
})

test('code identifiers and error strings keep their underscores when indexed', () => {
  const entries = documentSearchEntries({
    route: '/errors',
    title: '排错',
    markdown: '# 排错\n\n## 额度\n\n`insufficient_quota` 与 `OPENAI_API_KEY`。'
  })
  assert.equal(searchEntries(entries, 'insufficient_quota').length, 1)
  assert.equal(searchEntries(entries, 'OPENAI_API_KEY').length, 1)
})

test('category search merges repeated destinations without dropping registry aliases', () => {
  const entries = buildSearchEntries({}, [{ id: 'codex', name: 'Codex', href: '/learn/codex/', summary: '连接指南', aliases: ['OpenAI'] }])
  assert.equal(entries.filter((entry) => entry.route === '/learn/codex/').length, 1)
  assert.equal(searchEntries(entries, 'OpenAI')[0].route, '/learn/codex/')
})

test('document results preserve section boundaries and use actual VitePress heading anchors', async () => {
  const source =
    '# 示例文档\n\n开场。\n\n## 429 与额度\n\n请求太快。\n\n## 令牌 & 余额\n\n可用额度。\n\n## 令牌 & 余额\n\n第二段。\n\n## `config.toml` 与 [Key](https://example.com)\n\n文件。\n\n## 自定义 {#custom-id}\n\n自定义。\n\n```md\n## 不是标题\n```\n'
  const markdown = await createMarkdownRenderer(process.cwd())
  const html = markdown.render(source)
  const ids = [...html.matchAll(/<h[1-6] id="([^"]+)"/g)].map((match) => decodeText(match[1]))
  const entries = documentSearchEntries({ route: '/guide/example', title: '示例文档', markdown: source })
  assert.deepEqual(
    entries.map((entry) => decodeURIComponent(entry.route.split('#')[1])),
    ids
  )
  assert.equal(
    entries.some((entry) => entry.title.includes('不是标题')),
    false
  )
  assert.equal(headingAnchor('429 与额度'), '_429-与额度')
  await disposeMdItInstance()
})

test('search results show the matching passage, support multiple keywords and rank title matches first', () => {
  const entries = [
    { title: '安装教程', route: '/setup', text: '准备工作。'.repeat(50) + '最后检查余额不足。' },
    { title: '余额不足', route: '/errors#quota', text: '查看账户。' }
  ]
  const results = searchEntries(entries, '余额')
  assert.equal(results[0].route, '/errors#quota')
  assert.ok(results[1].excerpt.includes('余额不足'))
  assert.equal(results[1].excerpt.startsWith('…'), true)
  assert.equal(searchEntries(entries, '最后 余额')[0].route, '/setup')
  assert.equal(searchEntries(entries, '余额', 1).length, 1)
})

test('navigation remains selected for clean URLs, HTML URLs, course sections and client children', () => {
  assert.equal(normalizeRoute('/guide/manager.html?x=1#top'), '/guide/manager')
  assert.equal(normalizeRoute('/bad%2'), '/bad%2')
  assert.equal(navigationActive('/', '/guide/start'), true)
  assert.equal(navigationActive('/learn/codex/ch01#s2', '/learn/codex/'), true)
  assert.equal(navigationActive('/clients/codex', '/learn/codex/'), true)
  assert.equal(navigationActive('/clients/claude-desktop', '/learn/claude/'), true)
  assert.equal(navigationActive('/skills', '/learn/codex/'), true)
  assert.equal(navigationActive('/guide/manager', '/learn/codex/'), false)
  assert.equal(navigationActive('/tools-extra', '/tools'), false)
})
