import test from 'node:test'
import assert from 'node:assert/strict'
import { appendLearningVisit, parseLearningVisits } from '../theme/learning-history.mjs'

test('stored visits retain only canonical allowlisted locations', () => {
  const visits = parseLearningVisits(JSON.stringify([
    '/clients/codex.html?next=https://evil.example',
    '/guide/verify?track=claude-code&unused=1',
    '/guide/manager#manager-config',
    '/guide/manager#' + encodeURIComponent('离线包怎么选'),
    'https://evil.example/clients/codex', '//evil.example', 'javascript:alert(1)',
    '/unknown', '/guide/verify', null, 12, {}, []
  ]))
  assert.deepEqual(visits, [
    '/clients/codex', '/guide/verify?track=claude-code',
    '/guide/manager#manager-config', '/guide/manager#离线包怎么选'
  ])
})

test('invalid stored JSON and non-array values start with no visits', () => {
  for (const value of [undefined, null, 12, [], {}, '', '{', 'null', '{}', '"/clients/codex"', 'true']) {
    assert.deepEqual(parseLearningVisits(value), [])
  }
})

test('revisiting an earlier page appends a location instead of truncating history', () => {
  let state = { visits: [], previousHref: null }
  for (const href of ['/clients/codex', '/guide/verify?track=codex', '/learn/first-task', '/clients/codex']) {
    state = appendLearningVisit(state.visits, href)
  }
  assert.deepEqual(state.visits, ['/clients/codex', '/guide/verify?track=codex', '/learn/first-task', '/clients/codex'])
  assert.equal(state.previousHref, '/learn/first-task')
})

test('only consecutive canonical duplicate locations are collapsed', () => {
  const visits = ['/clients/codex', '/guide/verify?track=codex', '/clients/codex']
  const state = appendLearningVisit(visits, '/clients/codex.html?unused=1')
  assert.deepEqual(state.visits, visits)
  assert.equal(state.previousHref, '/guide/verify?track=codex')
  assert.deepEqual(parseLearningVisits(JSON.stringify(['/clients/codex', '/clients/codex.html', '/learn/first-task', '/clients/codex'])), [
    '/clients/codex', '/learn/first-task', '/clients/codex'
  ])
})

test('manager step hashes and explicit tool tracks remain distinct browsing locations', () => {
  let state = appendLearningVisit([], '/guide/manager#manager-install')
  state = appendLearningVisit(state.visits, '/guide/manager#manager-next')
  assert.equal(state.previousHref, '/guide/manager#manager-install')
  state = appendLearningVisit(state.visits, '/clients/claude-code')
  assert.equal(state.previousHref, '/guide/manager#manager-next')
  state = appendLearningVisit(state.visits, '/guide/verify?track=claude-code')
  state = appendLearningVisit(state.visits, '/guide/verify?track=codex')
  assert.equal(state.previousHref, '/guide/verify?track=claude-code')
})

test('unknown current locations clear stale learning return links', () => {
  for (const href of ['/unknown', '/guide/verify', 'https://evil.example/clients/codex', '//evil.example', 'javascript:alert(1)', null, {}]) {
    assert.deepEqual(appendLearningVisit(['/clients/codex'], href), { visits: [], previousHref: null })
  }
})

test('every incoming visit is sanitized without mutating the source array', () => {
  const input = ['/clients/codex', 'https://evil.example', '/learn/first-task']
  const state = appendLearningVisit(input, '/guide/manager#manager-config')
  assert.deepEqual(input, ['/clients/codex', 'https://evil.example', '/learn/first-task'])
  assert.deepEqual(state.visits, ['/clients/codex', '/learn/first-task', '/guide/manager#manager-config'])
  assert.equal(state.previousHref, '/learn/first-task')
  assert.deepEqual(appendLearningVisit({}, '/clients/codex'), { visits: ['/clients/codex'], previousHref: null })
})

test('both loading and appending retain at most thirty recent locations', () => {
  const visits = Array.from({ length: 35 }, (_, index) => index % 2 ? '/learn/first-task' : '/clients/codex')
  assert.deepEqual(parseLearningVisits(JSON.stringify(visits)), visits.slice(-30))
  const state = appendLearningVisit(visits, '/guide/manager#manager-account')
  assert.equal(state.visits.length, 30)
  assert.deepEqual(state.visits, [...visits, '/guide/manager#manager-account'].slice(-30))
  assert.equal(state.previousHref, '/clients/codex')
})
