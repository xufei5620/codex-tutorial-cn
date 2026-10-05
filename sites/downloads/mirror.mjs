import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INDEX_ROUTES, loadCatalogIndex, projectPublicIndex, catalogFailureDiagnostics } from './catalog.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cos-index-cache')
const EMPTY_INDEXES = {
  manager: { schemaVersion: 1, product: 'xingmang-ai-manager', files: [] },
  chatgpt: { schemaVersion: 1, product: 'chatgpt', platforms: {} },
  claude: { schemaVersion: 1, product: 'claude-desktop', files: [] }
}

function hasInstallers(product, value) {
  const projected = projectPublicIndex(product, value)
  return product === 'chatgpt' ? Object.keys(projected.platforms).length > 0 : projected.files.length > 0
}

export async function prepareMirror({ fetchImpl = fetch, signal, previousIndexes = {}, chatgptBaseline = null } = {}) {
  const baseline = chatgptBaseline === null ? null : projectPublicIndex('chatgpt', chatgptBaseline)
  if (baseline && !hasInstallers('chatgpt', baseline)) throw Error('已核验备用清单缺少安装包')
  const results = await Promise.all(
    Object.keys(INDEX_ROUTES).map(async (product) => {
      const value = await loadCatalogIndex(product, { fetchImpl, signal, upstream: true })
      const fallback = product === 'chatgpt' ? baseline : null
      const previouslyBaseline =
        fallback !== null &&
        Object.hasOwn(previousIndexes, product) &&
        JSON.stringify(projectPublicIndex(product, previousIndexes[product])) === JSON.stringify(fallback)
      if (value === null && Object.hasOwn(previousIndexes, product) && hasInstallers(product, previousIndexes[product])) {
        // Reusing this exact baseline is safe; a different published catalog may
        // contain newer or additional packages and must never be replaced by it.
        if (!previouslyBaseline) throw Error('已发布清单暂时缺失，保留现有镜像')
      }
      // The first source publication arrives one platform at a time. Keep an
      // already published baseline intact until the source covers its platforms;
      // an explicitly empty source still clears it, and later catalogs stand alone.
      const awaitingPlatforms =
        previouslyBaseline &&
        value !== null &&
        hasInstallers(product, value) &&
        Object.keys(fallback.platforms).some((id) => !Object.hasOwn(value.platforms, id))
      const resolved = value === null || awaitingPlatforms ? fallback : value
      const projected = projectPublicIndex(product, resolved === null ? EMPTY_INDEXES[product] : resolved)
      const json = JSON.stringify(projected, null, 2) + '\n'
      if (Buffer.byteLength(json) > 256 * 1024) throw Error('公开安装包清单过大')
      return {
        product,
        route: INDEX_ROUTES[product],
        pending: resolved === null,
        verifiedBaseline: (value === null && fallback !== null) || awaitingPlatforms,
        json
      }
    })
  )
  return results
}

export async function readMirrorState({ cacheDir = CACHE } = {}) {
  const indexes = {}
  for (const product of Object.keys(INDEX_ROUTES)) {
    const target = path.join(cacheDir, product + '.json')
    try {
      const stat = await fs.lstat(target)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 256 * 1024) throw Error('镜像历史清单无效')
      const text = await fs.readFile(target, 'utf8')
      if (Buffer.byteLength(text) > 256 * 1024) throw Error('镜像历史清单过大')
      const value = JSON.parse(text)
      indexes[product] = projectPublicIndex(product, value)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return indexes
}

export async function saveMirrorState(entries, { cacheDir = CACHE } = {}) {
  validateEntries(entries)
  await fs.mkdir(cacheDir, { recursive: true })
  for (const entry of entries) await fs.writeFile(path.join(cacheDir, entry.product + '.json'), entry.json, 'utf8')
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length !== Object.keys(INDEX_ROUTES).length) throw Error('安装包镜像清单不完整')
  const products = new Set()
  for (const entry of entries) {
    if (
      !entry ||
      !Object.hasOwn(INDEX_ROUTES, entry.product) ||
      products.has(entry.product) ||
      entry.route !== INDEX_ROUTES[entry.product] ||
      typeof entry.json !== 'string'
    )
      throw Error('安装包镜像路径无效')
    const value = JSON.parse(entry.json)
    const projected = JSON.stringify(projectPublicIndex(entry.product, value), null, 2) + '\n'
    if (projected !== entry.json || Buffer.byteLength(entry.json) > 256 * 1024) throw Error('安装包镜像内容无效')
    products.add(entry.product)
  }
}

export async function writeMirror(entries, { root = ROOT } = {}) {
  validateEntries(entries)
  for (const site of ['newapi', 'sub2api'])
    for (const entry of entries) {
      const target = path.join(root, site, 'public', entry.route)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, entry.json, 'utf8')
    }
}

async function main() {
  const previousIndexes = await readMirrorState()
  const chatgptBaseline = JSON.parse(await fs.readFile(new URL('./chatgpt-verified-baseline.json', import.meta.url), 'utf8'))
  const entries = await prepareMirror({ previousIndexes, chatgptBaseline })
  await writeMirror(entries)
  await saveMirrorState(entries)
  console.log(
    JSON.stringify({ mirrored: entries.map(({ product, pending, verifiedBaseline }) => ({ product, pending, verifiedBaseline })) })
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: '安装包镜像准备失败', ...catalogFailureDiagnostics(error) }))
    process.exitCode = 1
  })
}
