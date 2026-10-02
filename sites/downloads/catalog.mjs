export const COS_ROOT = 'https://xingmang-downloads-1342302199.cos.ap-shanghai.myqcloud.com'
export const INDEX_ROUTES = Object.freeze({
  manager: '/cos-download-index/xingmang.json',
  chatgpt: '/cos-download-index/chatgpt.json'
})
const INDEX_KEYS = Object.freeze({ manager: 'xingmang/latest.json', chatgpt: 'chatgpt/latest.json' })
const MAX_INDEX_BYTES = 256 * 1024
const TIMEOUT_MS = 10000
const SHA256 = /^[a-f0-9]{64}$/
const MANAGER_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const MANAGER_PLATFORMS = Object.freeze([
  { id: 'windows-x64', platform: 'windows', architecture: 'x64', label: 'Windows x64', format: 'exe', contentType: 'application/vnd.microsoft.portable-executable' },
  { id: 'macos-arm64', platform: 'macos', architecture: 'arm64', label: 'macOS Apple Silicon', format: 'dmg', contentType: 'application/x-apple-diskimage' },
  { id: 'macos-x64', platform: 'macos', architecture: 'x64', label: 'macOS Intel', format: 'dmg', contentType: 'application/x-apple-diskimage' },
  { id: 'linux-x64', platform: 'linux', architecture: 'x64', label: 'Linux x64', format: 'deb', contentType: 'application/vnd.debian.binary-package' },
  { id: 'linux-arm64', platform: 'linux', architecture: 'arm64', label: 'Linux ARM64', format: 'deb', contentType: 'application/vnd.debian.binary-package' }
])
const CHATGPT_PLATFORMS = Object.freeze({
  'windows-x64': { platform: 'windows', architecture: 'x64', label: 'Windows x64', format: 'msix', fileName: 'ChatGPT-x64.msix', contentType: 'application/vnd.ms-appx' },
  'windows-arm64': { platform: 'windows', architecture: 'arm64', label: 'Windows ARM64', format: 'msix', fileName: 'ChatGPT-arm64.msix', contentType: 'application/vnd.ms-appx' },
  'macos-arm64': { platform: 'macos', architecture: 'arm64', label: 'macOS Apple Silicon', format: 'zip', contentType: 'application/zip' },
  'macos-x64': { platform: 'macos', architecture: 'x64', label: 'macOS Intel', format: 'zip', contentType: 'application/zip' },
  'linux-deb-x64': { platform: 'linux', architecture: 'x64', label: 'Linux x64 · Debian / Ubuntu', format: 'deb', fileName: 'chatgpt_amd64.deb', contentType: 'application/vnd.debian.binary-package' },
  'linux-deb-arm64': { platform: 'linux', architecture: 'arm64', label: 'Linux ARM64 · Debian / Ubuntu', format: 'deb', fileName: 'chatgpt_arm64.deb', contentType: 'application/vnd.debian.binary-package' },
  'linux-rpm-x64': { platform: 'linux', architecture: 'x64', label: 'Linux x64 · Fedora', format: 'rpm', fileName: 'chatgpt.x86_64.rpm', contentType: 'application/x-rpm' },
  'linux-rpm-arm64': { platform: 'linux', architecture: 'arm64', label: 'Linux ARM64 · Fedora', format: 'rpm', fileName: 'chatgpt.aarch64.rpm', contentType: 'application/x-rpm' }
})

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function managerVersion(value) {
  return typeof value === 'string' && value.length <= 64 && MANAGER_VERSION.test(value)
}

function compareManagerVersions(left, right) {
  const [leftCore, ...leftSuffix] = left.split('+')[0].split('-')
  const [rightCore, ...rightSuffix] = right.split('+')[0].split('-')
  const leftParts = leftCore.split('.').map(BigInt)
  const rightParts = rightCore.split('.').map(BigInt)
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1
  }
  if (!leftSuffix.length || !rightSuffix.length) return leftSuffix.length === rightSuffix.length ? 0 : leftSuffix.length ? -1 : 1
  const leftIds = leftSuffix.join('-').split('.')
  const rightIds = rightSuffix.join('-').split('.')
  for (let index = 0; index < Math.max(leftIds.length, rightIds.length); index += 1) {
    if (leftIds[index] === rightIds[index]) continue
    if (leftIds[index] === undefined || rightIds[index] === undefined) return leftIds[index] === undefined ? -1 : 1
    const leftNumber = /^\d+$/.test(leftIds[index])
    const rightNumber = /^\d+$/.test(rightIds[index])
    if (leftNumber && rightNumber) return BigInt(leftIds[index]) > BigInt(rightIds[index]) ? 1 : -1
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1
    return leftIds[index] > rightIds[index] ? 1 : -1
  }
  return 0
}

function publicUrl(key) {
  return `${COS_ROOT}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function validateArtifact(value, key, contentType, maxBytes) {
  // Exact equality excludes host suffixes, URL credentials, encoded traversal,
  // alternate ports and signed query strings from externally supplied indexes.
  if (!isObject(value) || value.key !== key || value.url !== publicUrl(key)
    || !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || value.bytes > maxBytes
    || typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)
    || value.contentType !== contentType) throw new Error('安装包地址或校验信息无效')
}

function managerFileName(version, platform) {
  if (platform.platform === 'windows') return `XingMang-AI-Manager-${version}-Setup.exe`
  if (platform.platform === 'macos') return `XingMang-AI-Manager-${version}-${platform.architecture === 'arm64' ? 'Apple-Silicon' : 'Intel'}-${platform.architecture}.dmg`
  return `xingmang-ai-manager_${version}_${platform.architecture === 'x64' ? 'amd64' : 'arm64'}.deb`
}

export function validateManagerIndex(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || value.product !== 'xingmang-ai-manager'
    || !Array.isArray(value.files) || value.files.length > 24
    || (value.version !== undefined && value.version !== null && !managerVersion(value.version))
    || (value.files.length && !managerVersion(value.version))) throw new Error('星芒安装包清单无效')
  const items = new Map()
  for (const entry of value.files) {
    if (!isObject(entry)) throw new Error('星芒安装包条目无效')
    // Update archives, block maps and updater manifests are not installers.
    if (entry.kind !== 'installer') continue
    const platform = MANAGER_PLATFORMS.find(item => item.platform === entry.platform && item.architecture === entry.architecture)
    if (!platform || !managerVersion(entry.version) || compareManagerVersions(entry.version, value.version) > 0 || items.has(platform.id)
      || entry.fileName !== managerFileName(entry.version, platform)) throw new Error('星芒安装包系统或版本无效')
    validateArtifact({ ...entry, bytes: entry.size, contentType: entry.type }, `xingmang/releases/${entry.version}/${entry.fileName}`, platform.contentType, 1024 * 1024 * 1024)
    items.set(platform.id, { ...platform, version: entry.version, fileName: entry.fileName, key: entry.key, url: entry.url, bytes: entry.size, sha256: entry.sha256 })
  }
  return MANAGER_PLATFORMS.flatMap(platform => items.has(platform.id) ? [items.get(platform.id)] : [])
}

function windowsVersion(value) {
  return typeof value === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(value)
    && value.split('.').every(part => Number(part) <= 65535)
}

export function validateChatgptIndex(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || value.product !== 'chatgpt'
    || !isObject(value.platforms) || Object.keys(value.platforms).length > 8) throw new Error('ChatGPT 安装包清单无效')
  if (value.windows !== undefined && (!isObject(value.windows) || value.windows.schemaVersion !== 1
    || value.windows.packageIdentity !== 'OpenAI.Codex' || value.windows.storeProductId !== '9PLM9XGG6VKS'
    || !windowsVersion(value.windows.buildVersion))) throw new Error('ChatGPT Windows 产品身份无效')
  const items = []
  for (const [id, entry] of Object.entries(value.platforms)) {
    const platform = Object.hasOwn(CHATGPT_PLATFORMS, id) ? CHATGPT_PLATFORMS[id] : null
    if (!platform || !isObject(entry) || entry.platform !== platform.platform
      || entry.architecture !== platform.architecture || entry.format !== platform.format
      || !isObject(entry.artifact)) throw new Error('ChatGPT 安装包系统无效')
    let fileName = platform.fileName
    let directory = `sha256-${entry.artifact.sha256}`
    let version = null
    let license = {}
    if (platform.platform === 'windows') {
      if (!windowsVersion(entry.packageVersion) || entry.artifact.verification !== 'windows-authenticode'
        || (value.windows && entry.packageVersion !== value.windows.buildVersion)) throw new Error('ChatGPT Windows 版本或签名记录无效')
      directory = version = entry.packageVersion
      validateArtifact(entry.license, `chatgpt/${id}/${directory}/ChatGPT-License.xml`, 'application/xml', 1024 * 1024)
      if (entry.license.verification !== 'official-https-sha256-and-product-identity') throw new Error('ChatGPT 离线许可记录无效')
      license = { licenseUrl: entry.license.url, licenseKey: entry.license.key, licenseSha256: entry.license.sha256, licenseBytes: entry.license.bytes, licenseFileName: 'ChatGPT-License.xml' }
    } else {
      if (entry.license !== undefined || entry.artifact.verification !== 'official-https-sha256') throw new Error('ChatGPT 官方包校验记录无效')
      if (platform.platform === 'macos') {
        if (typeof entry.appVersion !== 'string' || entry.appVersion.length > 64 || !/^\d+\.\d+\.\d+$/.test(entry.appVersion)
          || typeof entry.buildVersion !== 'string' || !/^\d+$/.test(entry.buildVersion)
          || !Number.isSafeInteger(Number(entry.buildVersion))) throw new Error('ChatGPT Mac 版本无效')
        fileName = `ChatGPT-darwin-${platform.architecture}-${entry.appVersion}.zip`
        version = entry.appVersion
      }
    }
    validateArtifact(entry.artifact, `chatgpt/${id}/${directory}/${fileName}`, platform.contentType, 2 * 1024 * 1024 * 1024)
    items.push({ ...platform, id, fileName, version, key: entry.artifact.key, url: entry.artifact.url, bytes: entry.artifact.bytes, sha256: entry.artifact.sha256, verification: entry.artifact.verification, ...license })
  }
  return Object.keys(CHATGPT_PLATFORMS).flatMap(id => items.filter(item => item.id === id))
}

function validateIndex(product, value) {
  if (!Object.hasOwn(INDEX_ROUTES, product)) throw new Error('安装包类型无效')
  return product === 'manager' ? validateManagerIndex(value) : validateChatgptIndex(value)
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    function aborted() { reject(signal.reason) }
    signal.addEventListener('abort', aborted, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted))
  })
}

async function readJsonResponse(response, signal) {
  const length = response.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_INDEX_BYTES)) throw new Error('安装包清单过大')
  const type = response.headers.get('Content-Type') || ''
  if (!/^application\/json(?:\s*;|$)/i.test(type)) throw new Error('安装包清单响应类型无效')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取安装包清单')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal)
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_INDEX_BYTES) throw new Error('安装包清单过大')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text)
  } catch (error) {
    // A stalled underlying stream must not delay the deadline while cancelling.
    Promise.resolve(reader.cancel()).catch(() => {})
    if (signal.aborted) throw signal.reason
    if (error instanceof SyntaxError || error instanceof TypeError) throw new Error('安装包清单格式无效')
    throw error
  } finally {
    reader.releaseLock()
  }
}

// Both browser requests and the Pages Function use this reader. The upstream
// option chooses only a fixed key; it never accepts a user supplied proxy URL.
export async function loadCatalogIndex(product, { fetchImpl = fetch, signal, upstream = false } = {}) {
  if (!Object.hasOwn(INDEX_ROUTES, product)) throw new Error('安装包类型无效')
  const controller = new AbortController()
  function cancelled() { controller.abort(new Error('安装包清单读取已取消')) }
  if (signal?.aborted) cancelled()
  else signal?.addEventListener('abort', cancelled, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('安装包清单读取超时，请稍后重试')), TIMEOUT_MS)
  const url = upstream ? `${COS_ROOT}/${INDEX_KEYS[product]}` : INDEX_ROUTES[product]
  try {
    if (controller.signal.aborted) throw controller.signal.reason
    const response = await abortable(Promise.resolve().then(() => fetchImpl(url, {
      method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: controller.signal
    })), controller.signal)
    const expectedUrl = upstream ? url : typeof location !== 'undefined' ? new URL(url, location.origin).href : url
    if (response.redirected || response.status >= 300 && response.status < 400
      || (response.url && response.url !== expectedUrl)) throw new Error('安装包清单发生重定向')
    if (response.status === 404) return null
    if (response.status !== 200) throw new Error(`安装包清单暂不可用（${response.status}）`)
    const value = await readJsonResponse(response, controller.signal)
    validateIndex(product, value)
    return value
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    if (error instanceof TypeError) throw new Error('安装包清单暂时无法连接，请稍后重试')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelled)
  }
}

export async function fetchCatalog(product, options = {}) {
  const value = await loadCatalogIndex(product, options)
  return value === null ? [] : validateIndex(product, value)
}

// Keep account-independent index responses small and remove source internals
// and updater-only artifacts before they are exposed by the public function.
export function projectPublicIndex(product, value) {
  const items = validateIndex(product, value)
  if (product === 'manager') return {
    schemaVersion: 1, product: 'xingmang-ai-manager', version: value.version,
    files: items.map(item => ({ fileName: item.fileName, version: item.version, platform: item.platform, architecture: item.architecture, kind: 'installer', key: item.key, url: item.url, size: item.bytes, sha256: item.sha256, type: item.contentType }))
  }
  const platforms = {}
  for (const item of items) {
    const entry = value.platforms[item.id]
    platforms[item.id] = {
      platform: item.platform, architecture: item.architecture, format: item.format,
      ...(item.platform === 'windows' ? { packageVersion: item.version } : {}),
      ...(item.platform === 'macos' ? { appVersion: item.version, buildVersion: entry.buildVersion } : {}),
      artifact: { key: item.key, url: item.url, bytes: item.bytes, sha256: item.sha256, contentType: item.contentType, verification: item.verification },
      ...(item.licenseUrl ? { license: { key: item.licenseKey, url: item.licenseUrl, bytes: item.licenseBytes, sha256: item.licenseSha256, contentType: 'application/xml', verification: 'official-https-sha256-and-product-identity' } } : {})
    }
  }
  return {
    schemaVersion: 1, product: 'chatgpt',
    ...(value.windows ? { windows: { schemaVersion: 1, buildVersion: value.windows.buildVersion, packageIdentity: 'OpenAI.Codex', storeProductId: '9PLM9XGG6VKS' } } : {}),
    platforms
  }
}
