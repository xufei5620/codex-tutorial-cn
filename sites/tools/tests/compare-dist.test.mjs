import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { compare, normalizePath, readerFacing, report } from '../compare-dist.mjs'

function dist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'))
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), body)
  }
  return dir
}
const page = (hash, title, data = '{\\"title\\":\\"站\\"}') =>
  `<html><head><title>${title}</title><script type="module" src="/assets/app.${hash}.js"></script>` +
  `<link rel="modulepreload" href="/assets/guide_start.md.${hash}.lean.js"></head>` +
  `<script>window.__VP_HASH_MAP__=JSON.parse("{\\"guide_start.md\\":\\"${hash}\\"}");window.__VP_SITE_DATA__=deserializeFunctions(JSON.parse("${data}"));</script></html>`

test('hash-only renames are not differences', () => {
  assert.equal(normalizePath('assets/guide_start.md.BjMNP-uP.lean.js'), 'assets/guide_start.md.#.lean.js')
  const a = dist({ 'guide/start.html': page('AAAAAAAA', '开始'), 'assets/app.AAAAAAAA.js': 'x', 'hashmap.json': '{"guide_start.md":"AAAAAAAA"}' })
  const b = dist({ 'guide/start.html': page('BBBBBBBB', '开始'), 'assets/app.BBBBBBBB.js': 'x', 'hashmap.json': '{"guide_start.md":"BBBBBBBB"}' })
  const result = compare(a, b)
  assert.deepEqual(result, { added: [], removed: [], changed: [] })
  assert.match(report('sub', result), /无变化/)
})

test('page text, public files and shared site data are reported', () => {
  const a = dist({ 'guide/start.html': page('AAAAAAAA', '开始'), 'faq.html': page('AAAAAAAA', '问题'), 'index.html': page('AAAAAAAA', '首页'), 'img/a.png': 'one', 'old.html': '' })
  const b = dist({ 'guide/start.html': page('AAAAAAAA', '开始了'), 'faq.html': page('AAAAAAAA', '问题', '{\\"title\\":\\"新\\"}'), 'index.html': page('AAAAAAAA', '首页'), 'img/a.png': 'two', 'new.html': '' })
  const visible = readerFacing(compare(a, b))
  assert.deepEqual(visible.added, ['(每页内嵌的站点数据):faq.html', 'new.html'])
  assert.deepEqual(visible.removed, ['old.html'])
  assert.deepEqual(visible.changed.map(c => c.file).sort(), ['guide/start.html', 'img/a.png'])
})

test('bundle code changes are counted but kept apart from reader-facing files', () => {
  const a = dist({ 'index.html': page('AAAAAAAA', '首页'), 'assets/chunks/theme.AAAAAAAA.js': 'a' })
  const b = dist({ 'index.html': page('AAAAAAAA', '首页'), 'assets/chunks/theme.AAAAAAAA.js': 'b' })
  const result = compare(a, b)
  assert.equal(result.changed.length, 1)
  assert.equal(readerFacing(result).changed.length, 0)
  assert.match(report('sub', result), /1 个文件不同/)
})
