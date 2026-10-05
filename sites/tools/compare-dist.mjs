// Compare two VitePress build outputs while ignoring content-hash file names.
// Used to prove that a refactor leaves the published pages unchanged.
// Usage: node tools/compare-dist.mjs <base-dist> <head-dist> [--strict] [--label name]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HASH = '[A-Za-z0-9_-]{8}'
const TEXT = /\(每页内嵌的站点数据\)|\.(html|js|css|json|txt|xml|svg|yml|yaml|md)$|(^|\/)_(headers|redirects)$/i
const BUNDLE = /^assets\//
const LIMIT = 40

// Vite appends ".<8-char hash>" before the extension of bundled files.
export function normalizePath(name) {
  return name.replace(new RegExp('\\.' + HASH + '(?=(\\.lean)?\\.[a-z0-9]+$)', 'i'), '.#')
}

export function normalizeText(text) {
  return text
    .replace(new RegExp('(/assets/[^"\'\\s()]*?)\\.' + HASH + '((?:\\.lean)?\\.[a-z0-9]+)', 'gi'), '$1.#$2')
    .replace(new RegExp('((?:^|[/"\'])[\\w.-]+?)\\.' + HASH + '((?:\\.lean)?\\.(?:js|css))', 'g'), '$1.#$2')
    // Vue scoped-style IDs hash the component path; they change when the project root moves.
    .replace(/data-v-[0-9a-f]{8}/g, 'data-v-#')
    .replace(/__VP_HASH_MAP__=JSON\.parse\("((?:[^"\\]|\\.)*)"\)/, (_, map) => {
      const keys = Object.keys(JSON.parse(JSON.parse('"' + map + '"'))).sort()
      return '__VP_HASH_MAP__=' + JSON.stringify(keys)
    })
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) throw Error('Missing build output: ' + dir)
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).replaceAll('\\', '/')]
  })
}

function load(dir) {
  const files = new Map(), siteData = new Map()
  for (const name of walk(dir)) {
    const key = normalizePath(name)
    const raw = fs.readFileSync(path.join(dir, name))
    let body
    if (name === 'hashmap.json') body = JSON.stringify(Object.keys(JSON.parse(raw)).sort())
    else if (TEXT.test(name)) body = normalizeText(raw.toString('utf8'))
    else body = raw
    if (name.endsWith('.html')) {
      // Every page inlines the same site data; compare it once instead of once per page.
      body = body.replace(SITE_DATA, (_, data) => {
        const digest = crypto.createHash('sha256').update(data).digest('hex')
        if (!siteData.has(digest)) siteData.set(digest, { name, data: JSON.parse('"' + data + '"'), pages: 0 })
        siteData.get(digest).pages++
        return '__VP_SITE_DATA__=#'
      })
    }
    files.set(key, entry(name, body))
  }
  // Pages normally share one copy. The most common copy is the site data; any other copy is
  // keyed by the first page that carried it.
  const copies = [...siteData.values()].sort((a, b) => b.pages - a.pages)
  copies.forEach((item, i) => files.set(i ? SITE_DATA_KEY + ':' + item.name : SITE_DATA_KEY, entry(item.name, item.data)))
  return files
}

const SITE_DATA = /__VP_SITE_DATA__=deserializeFunctions\(JSON\.parse\("((?:[^"\\]|\\.)*)"\)\)/
const SITE_DATA_KEY = '(每页内嵌的站点数据)'
const entry = (name, body) => ({ name, digest: crypto.createHash('sha256').update(body).digest('hex'), body })

function excerpt(a, b) {
  const left = String(a), right = String(b)
  let i = 0
  while (i < left.length && i < right.length && left[i] === right[i]) i++
  const cut = (s) => s.slice(Math.max(0, i - 80), i + 160).replace(/\s+/g, ' ')
  return { at: i, base: cut(left), head: cut(right) }
}

export function compare(baseDir, headDir) {
  const base = load(baseDir), head = load(headDir)
  const result = { added: [], removed: [], changed: [] }
  for (const key of [...new Set([...base.keys(), ...head.keys()])].sort()) {
    const a = base.get(key), b = head.get(key)
    if (!a) result.added.push(key)
    else if (!b) result.removed.push(key)
    else if (a.digest !== b.digest) {
      const text = TEXT.test(key)
      result.changed.push({ file: key, bundle: BUNDLE.test(key), ...(text ? excerpt(a.body, b.body) : {}) })
    }
  }
  return result
}

// Pages, public files and generated config matter to readers; bundle code is reported separately.
export function readerFacing(result) {
  return {
    added: result.added.filter(f => !BUNDLE.test(f)),
    removed: result.removed.filter(f => !BUNDLE.test(f)),
    changed: result.changed.filter(c => !c.bundle)
  }
}

export function report(label, result) {
  const visible = readerFacing(result)
  const bundles = result.changed.length - visible.changed.length
    + (result.added.length - visible.added.length) + (result.removed.length - visible.removed.length)
  const lines = ['### ' + label]
  if (!visible.added.length && !visible.removed.length && !visible.changed.length) {
    lines.push('页面与公开文件：**无变化**。')
  } else {
    lines.push(`页面与公开文件：新增 ${visible.added.length}，删除 ${visible.removed.length}，改动 ${visible.changed.length}。`)
    for (const f of visible.added) lines.push('- 新增 `' + f + '`')
    for (const f of visible.removed) lines.push('- 删除 `' + f + '`')
    for (const c of visible.changed.slice(0, LIMIT)) {
      lines.push('- 改动 `' + c.file + '`')
      if (c.base !== undefined) lines.push('  - 之前：`' + c.base.replaceAll('`', "'") + '`', '  - 之后：`' + c.head.replaceAll('`', "'") + '`')
    }
  }
  if (visible.changed.length > LIMIT) lines.push(`- ……另有 ${visible.changed.length - LIMIT} 个文件改动`)
  lines.push(`脚本与样式包（不直接对读者可见）：${bundles} 个文件不同。`)
  return lines.join('\n')
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const labelAt = args.indexOf('--label')
  const label = labelAt >= 0 ? args[labelAt + 1] : 'build output'
  const [baseDir, headDir] = args.filter((a, i) => !a.startsWith('--') && (labelAt < 0 || i !== labelAt + 1))
  if (!baseDir || !headDir) {
    console.error('Usage: node tools/compare-dist.mjs <base-dist> <head-dist> [--strict] [--label name]')
    process.exit(2)
  }
  const result = compare(baseDir, headDir)
  const text = report(label, result)
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n\n')
  const visible = readerFacing(result)
  if (strict && (visible.added.length || visible.removed.length || visible.changed.length)) process.exitCode = 1
}
