import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress'
import { completionKey, normalizeCompleted, resolveLearningPath, safeLearningHref } from '../theme/learning-paths.mjs'

test('Codex has a complete ordered route and permits direct entry at any step', () => {
  const hrefs = [
    '/clients/codex',
    '/guide/verify?track=codex',
    '/learn/first-task',
    '/learn/codex/ch01',
    '/learn/codex/ch02',
    '/learn/working-with-files',
    '/learn/review-and-revise',
    '/skills'
  ]
  for (const [index, href] of hrefs.entries()) {
    const path = resolveLearningPath(href)
    assert.equal(path.id, 'codex')
    assert.deepEqual(
      path.steps.map((step) => step.href),
      hrefs
    )
    assert.equal(path.index, index)
    assert.equal(path.currentStep.href, href)
    assert.equal(path.previous?.href || null, hrefs[index - 1] || null)
    assert.equal(path.next?.href || null, hrefs[index + 1] || null)
    assert.ok(path.steps.every((step) => step.id && step.title && step.goal))
    assert.equal(path.categoryHref, '/learn/codex/')
  }
})

test('Claude Code retains its track through verification, first task and review', () => {
  const hrefs = [
    '/clients/claude-code',
    '/guide/verify?track=claude-code',
    '/learn/claude/first-task?track=claude-code',
    '/learn/review-and-revise?track=claude-code'
  ]
  for (const [index, href] of hrefs.entries()) {
    const path = resolveLearningPath(href)
    assert.equal(path.id, 'claude-code')
    assert.deepEqual(
      path.steps.map((step) => step.href),
      hrefs
    )
    assert.equal(path.index, index)
    assert.equal(path.previous?.href || null, hrefs[index - 1] || null)
    assert.equal(path.next?.href || null, hrefs[index + 1] || null)
    assert.equal(path.categoryHref, '/learn/claude/')
  }
})

test('Desktop goes from installation to its task without entering CLI verification', () => {
  const start = resolveLearningPath('/clients/claude-desktop')
  const end = resolveLearningPath('/learn/claude/first-task', '?track=claude-desktop')
  assert.equal(start.id, 'claude-desktop')
  assert.equal(start.previous, null)
  assert.equal(start.next.href, '/learn/claude/first-task?track=claude-desktop')
  assert.equal(end.index, 1)
  assert.equal(end.previous.href, '/clients/claude-desktop')
  assert.equal(end.next, null)
  assert.equal(resolveLearningPath('/guide/verify', '?track=claude-desktop'), null)
  assert.equal(resolveLearningPath('/learn/review-and-revise', '?track=claude-desktop'), null)
})

test('shared pages use explicit tracks and known defaults without allowing route hijacking', () => {
  assert.equal(resolveLearningPath('/guide/verify'), null)
  assert.equal(resolveLearningPath('/learn/review-and-revise').id, 'codex')
  assert.equal(resolveLearningPath('/learn/claude/first-task').id, 'claude-code')
  assert.equal(resolveLearningPath('/clients/codex', '?track=claude-desktop').id, 'codex')
  assert.equal(resolveLearningPath('/clients/claude-code', '?track=codex').id, 'claude-code')
  assert.equal(resolveLearningPath('/learn/claude/first-task', '?track=codex'), null)
  assert.equal(resolveLearningPath('/guide/verify', '?track=manager'), null)
})

test('unknown and ambiguous query values are ignored and never become destinations', () => {
  for (const query of [
    '?track=unknown',
    '?track=__proto__',
    '?track=https://evil.example/',
    '?track=claude-code&track=claude-desktop',
    '?track=%E0%A4%A',
    '?next=//evil.example&redirect=javascript:alert(1)'
  ]) {
    const path = resolveLearningPath('/guide/verify', query)
    assert.equal(path, null, query)
    assert.equal(resolveLearningPath('/learn/review-and-revise', query).id, 'codex')
  }
  assert.equal(resolveLearningPath('/guide/verify', '?track=claude-code&next=https://evil.example').id, 'claude-code')
})

test('manager steps match actual rendered Markdown headings and the download component anchor', async () => {
  const source = readFileSync(new URL('../../shared/pages/guide/manager.md', import.meta.url), 'utf8')
  const download = readFileSync(new URL('../theme/DownloadLink.vue', import.meta.url), 'utf8')
  const markdown = await createMarkdownRenderer(process.cwd())
  try {
    const html = markdown.render(source)
    const path = resolveLearningPath('/guide/manager')
    const anchors = [
      'manager-install',
      'manager-account',
      'manager-environment',
      'manager-tool',
      'manager-config',
      'manager-verify',
      'manager-next'
    ]
    assert.deepEqual(
      path.steps.map((step) => step.href),
      anchors.map((anchor) => '/guide/manager#' + anchor)
    )
    assert.ok(download.includes('id="download-installers"'))
    for (const anchor of [...anchors, '安装后-按这四步开始', '离线包怎么选', 'offline-packages'])
      assert.ok(html.includes('id="' + anchor + '"'), anchor)
    assert.equal(path.categoryHref, '/guide/start')
    for (const [index, anchor] of anchors.entries()) {
      for (const hash of ['#' + anchor, '#' + encodeURIComponent(anchor)]) {
        const step = resolveLearningPath('/guide/manager', '', hash)
        assert.equal(step.index, index)
        assert.equal(step.previous?.id || null, path.steps[index - 1]?.id || null)
        assert.equal(step.next?.id || null, path.steps[index + 1]?.id || null)
      }
    }
  } finally {
    await disposeMdItInstance()
  }
})

test('manager defaults to the first step for missing, arbitrary and malformed hashes', () => {
  for (const hash of ['', '#unknown', '#%E0%A4%A', '#遇到问题']) assert.equal(resolveLearningPath('/guide/manager', '', hash).index, 0)
})

test('manager legacy and offline reference anchors select a position without adding completed steps', () => {
  for (const [anchor, index] of [
    ['download-installers', 0],
    ['安装后-按这四步开始', 0],
    ['offline-packages', 6],
    ['离线包怎么选', 6],
    ['manager-help', 6]
  ]) {
    const href = '/guide/manager#' + anchor
    const path = resolveLearningPath(href)
    assert.equal(path.index, index)
    assert.equal(path.steps.length, 7)
    assert.equal(safeLearningHref(href), href)
    assert.equal(safeLearningHref('/guide/manager#' + encodeURIComponent(anchor)), href)
    assert.equal(
      path.steps.some((step) => Object.hasOwn(step, 'completed')),
      false
    )
  }
  assert.deepEqual(normalizeCompleted(['manager:install', 'manager:offline']), ['manager:install'])
  assert.equal(completionKey('manager', 'offline'), null)
})

test('history canonicalizes fixed routes and meaningful queries and hashes', () => {
  assert.equal(safeLearningHref('/clients/codex.html?next=https://evil.example#other'), '/clients/codex')
  assert.equal(safeLearningHref('/learn/codex'), '/learn/codex/')
  assert.equal(safeLearningHref('/learn/claude/?track=claude-code'), '/learn/claude/')
  assert.equal(safeLearningHref('/guide/start#top'), '/guide/start')
  assert.equal(safeLearningHref('/guide/verify'), null)
  assert.equal(safeLearningHref('/guide/verify?track=claude-code&redirect=https://evil.example#test'), '/guide/verify?track=claude-code')
  assert.equal(
    safeLearningHref('/learn/claude/first-task?track=claude-desktop#ordinary-heading'),
    '/learn/claude/first-task?track=claude-desktop'
  )
  assert.equal(safeLearningHref('/skills?tab=build'), '/skills')
  assert.equal(safeLearningHref('/guide/manager#' + encodeURIComponent('安装后-按这四步开始')), '/guide/manager#安装后-按这四步开始')
  assert.equal(safeLearningHref('/guide/manager#unknown'), '/guide/manager')
  assert.equal(safeLearningHref('/guide/verify?track=claude-desktop'), null)
})

test('history rejects external URLs, browser schemes, path repairs and unlisted routes', () => {
  for (const value of [
    null,
    undefined,
    12,
    {},
    [],
    '',
    'https://example.com/clients/codex',
    '//evil.example/clients/codex',
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///clients/codex',
    '/\\evil.example/clients/codex',
    '/clients/codex\n',
    ' /clients/codex',
    '/clients/../clients/codex',
    '/%63lients/codex',
    '/guide/unknown',
    '/clients/codex-evil',
    '/learn/codex/ch03',
    '/'
  ]) {
    assert.equal(safeLearningHref(value), null, String(value))
    assert.equal(resolveLearningPath(value), null, String(value))
  }
  assert.equal(resolveLearningPath('/clients/codex', {}, ''), null)
  assert.equal(resolveLearningPath('/clients/codex', '', {}), null)
})

test('completion keys are distinct per track and only known input keys survive', () => {
  assert.equal(completionKey('codex', 'verify'), 'codex:verify')
  assert.equal(completionKey('claude-code', 'verify'), 'claude-code:verify')
  assert.equal(completionKey('claude-desktop', 'verify'), null)
  assert.equal(completionKey('manager', 'account'), 'manager:account')
  assert.equal(completionKey('unknown', 'install'), null)
  assert.equal(completionKey({}, 'install'), null)
  assert.deepEqual(
    normalizeCompleted([
      'codex:verify',
      'claude-code:verify',
      'codex:verify',
      'claude-desktop:verify',
      'manager:account',
      'unknown:install',
      {},
      null
    ]),
    ['codex:verify', 'claude-code:verify', 'manager:account']
  )
  for (const value of [null, undefined, '', '[]', '{}', {}, 0, false]) assert.deepEqual(normalizeCompleted(value), [])
})

test('visiting, revisiting and mutating a returned path cannot complete or alter any other step', () => {
  const completed = ['codex:verify']
  const path = resolveLearningPath('/skills')
  assert.deepEqual(normalizeCompleted(completed), ['codex:verify'])
  assert.deepEqual(completed, ['codex:verify'])
  assert.equal(Object.hasOwn(path.currentStep, 'completed'), false)
  path.steps[0].href = 'https://evil.example/'
  path.steps.push({ id: 'injected' })
  path.currentStep.title = 'changed'
  const fresh = resolveLearningPath('/skills')
  assert.equal(fresh.steps[0].href, '/clients/codex')
  assert.equal(fresh.steps.length, 8)
  assert.equal(fresh.currentStep.title, '制作与验证 Skill')
  assert.deepEqual(normalizeCompleted([]), [])
})
