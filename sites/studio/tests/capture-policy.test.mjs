import test from 'node:test'
import assert from 'node:assert/strict'
import {capturePolicy, addShots} from '../prepare.mjs'

test('explicit section policy overrides chapter defaults', () => {
  for (const policy of ['required', 'optional', 'none']) {
    assert.equal(capturePolicy({capturePolicy: policy}, '', 'ch01', 1), policy)
  }
})

test('unknown chapters use safe defaults without generated files', () => {
  assert.equal(capturePolicy({}, '<p>概念说明</p>', 'new-chapter', 0), 'none')
  assert.equal(capturePolicy({}, '<ol><li>操作</li></ol>', 'new-chapter', 0), 'optional')
  assert.equal(capturePolicy({unitId: 'u01'}, '', 'new-chapter', 0), 'optional')
  assert.equal(capturePolicy({visual: 'workspace'}, '', 'new-chapter', 0), 'optional')
})

test('every generated step inherits its explicit capture policy', () => {
  for (const policy of ['required', 'optional', 'none']) {
    const manifest = []
    addShots('<ol><li>选择文件夹</li><li>检查结果</li></ol>', 'lesson', {
      route: '/learn/codex/ch01', group: '新手课', section: '练习', capturePolicy: policy
    }, manifest)
    assert.deepEqual(manifest.map(s => s.id), ['lesson-step02', 'lesson-step01'])
    assert.ok(manifest.every(s => s.capturePolicy === policy))
  }
})

test('explanation overview uses the provided policy', () => {
  const manifest = []
  addShots('<p>文字说明</p>', 'lesson', {
    route: '/learn/codex/ch01', group: '新手课', section: '说明', capturePolicy: 'none'
  }, manifest)
  assert.equal(manifest[0].id, 'lesson-overview')
  assert.equal(manifest[0].capturePolicy, 'none')
})
