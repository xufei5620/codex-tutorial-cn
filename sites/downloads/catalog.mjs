export const COS_ROOT = 'https://xingmang-downloads-1342302199.cos.ap-shanghai.myqcloud.com'
export const INDEX_ROUTES = Object.freeze({
  manager: '/cos-download-index/xingmang.json',
  chatgpt: '/cos-download-index/chatgpt.json',
  claude: '/cos-download-index/claude.json'
})
const INDEX_KEYS = Object.freeze({ manager: 'xingmang/latest.json', chatgpt: 'chatgpt/latest.json', claude: 'claude/latest.json' })
const MAX_INDEX_BYTES = 256 * 1024
const TIMEOUT_MS = 10000
const FAILURE_DETAILS = new WeakMap()
const FAILURE_CODES = Object.freeze({
  init: ['setup', 'request-signal', 'product'],
  transport: ['fetch-failed'],
  response: ['metadata', 'redirect', 'url-mismatch'],
  status: ['upstream-status'],
  body: ['size-limit', 'content-type', 'missing-stream', 'invalid-content', 'read-failed'],
  schema: ['invalid-schema', 'projection'],
  internal: ['unexpected']
})

function failureDetails(stage, code, upstreamStatus) {
  if (!Object.hasOwn(FAILURE_CODES, stage) || (!FAILURE_CODES[stage].includes(code) && !['timeout', 'cancelled'].includes(code))) return { stage: 'internal', code: 'unexpected' }
  return { stage, code, ...(Number.isInteger(upstreamStatus) && upstreamStatus >= 100 && upstreamStatus <= 599 ? { upstreamStatus } : {}) }
}

function failureError(message, stage, code, upstreamStatus) {
  const error = new Error(message)
  FAILURE_DETAILS.set(error, failureDetails(stage, code, upstreamStatus))
  return error
}

// Never derive public diagnostics from an upstream error's message or fields.
export function catalogFailureDiagnostics(error, fallback = { stage: 'internal', code: 'unexpected' }) {
  const detail = FAILURE_DETAILS.get(error) || fallback
  return failureDetails(detail.stage, detail.code, detail.upstreamStatus)
}

function capturedFailure(error, stage, code, upstreamStatus) {
  const known = FAILURE_DETAILS.get(error)
  if (known) {
    FAILURE_DETAILS.set(error, failureDetails(known.stage, known.code, upstreamStatus ?? known.upstreamStatus))
    return error
  }
  const message = stage === 'transport' ? '安装包清单暂时无法连接，请稍后重试' : '安装包清单读取失败，请稍后重试'
  return failureError(message, stage, code, upstreamStatus)
}
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
const CLAUDE_PLATFORMS = Object.freeze([
  { id: 'windows-x64', platform: 'windows', architecture: 'x64', label: 'Windows x64', format: 'msix', fileName: 'Claude-x64.msix', contentType: 'application/vnd.ms-appx', verification: 'windows-authenticode-msix-identity' },
  { id: 'windows-arm64', platform: 'windows', architecture: 'arm64', label: 'Windows ARM64', format: 'msix', fileName: 'Claude-arm64.msix', contentType: 'application/vnd.ms-appx', verification: 'windows-authenticode-msix-identity' },
  { id: 'macos-dmg-universal', platform: 'macos', architecture: 'universal', label: 'macOS 通用（Intel / Apple 芯片）· DMG', format: 'dmg', fileName: 'Claude-universal.dmg', contentType: 'application/x-apple-diskimage', verification: 'macos-codesign-universal' },
  { id: 'macos-pkg-universal', platform: 'macos', architecture: 'universal', label: 'macOS 通用（Intel / Apple 芯片）· PKG', format: 'pkg', fileName: 'Claude-universal.pkg', contentType: 'application/vnd.apple.installer+xml', verification: 'macos-installer-signature' },
  { id: 'linux-deb-x64', platform: 'linux', architecture: 'x64', label: 'Linux 测试版 x64 · Ubuntu / Debian', format: 'deb', fileName: 'claude-desktop-amd64.deb', contentType: 'application/vnd.debian.binary-package', verification: 'official-https-package-index-sha256' },
  { id: 'linux-deb-arm64', platform: 'linux', architecture: 'arm64', label: 'Linux 测试版 ARM64 · Ubuntu / Debian', format: 'deb', fileName: 'claude-desktop-arm64.deb', contentType: 'application/vnd.debian.binary-package', verification: 'official-https-package-index-sha256' }
])

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

function claudeVersion(version, platform) {
  if (platform === 'windows') return windowsVersion(version)
  if (typeof version !== 'string' || version.length > 64) return false
  if (platform === 'macos') return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
  return /^[0-9][0-9A-Za-z.+:~_-]*$/.test(version)
}

export function validateClaudeIndex(value) {
  if (!isObject(value) || value.schemaVersion !== 1 || value.product !== 'claude-desktop'
    || !Array.isArray(value.files) || value.files.length > CLAUDE_PLATFORMS.length) throw new Error('Claude Desktop 安装包清单无效')
  const items = new Map()
  for (const entry of value.files) {
    if (!isObject(entry) || entry.kind !== 'installer') throw new Error('Claude Desktop 安装包条目无效')
    const platform = CLAUDE_PLATFORMS.find(item => item.platform === entry.platform && item.architecture === entry.architecture && item.format === entry.format)
    if (!platform || items.has(platform.id) || entry.fileName !== platform.fileName
      || entry.verification !== platform.verification || !claudeVersion(entry.version, platform.platform)
      || entry.license !== undefined || entry.licenseUrl !== undefined) throw new Error('Claude Desktop 安装包系统或校验记录无效')
    validateArtifact({ ...entry, bytes: entry.size, contentType: entry.type }, `claude/${platform.id}/sha256-${entry.sha256}/${platform.fileName}`, platform.contentType, 2 * 1024 * 1024 * 1024)
    items.set(platform.id, { ...platform, version: entry.version, key: entry.key, url: entry.url, bytes: entry.size, sha256: entry.sha256 })
  }
  return CLAUDE_PLATFORMS.flatMap(platform => items.has(platform.id) ? [items.get(platform.id)] : [])
}

function validateIndex(product, value) {
  if (!Object.hasOwn(INDEX_ROUTES, product)) throw new Error('安装包类型无效')
  if (product === 'manager') return validateManagerIndex(value)
  if (product === 'chatgpt') return validateChatgptIndex(value)
  return validateClaudeIndex(value)
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
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_INDEX_BYTES)) throw failureError('安装包清单过大', 'body', 'size-limit')
  const type = response.headers.get('Content-Type') || ''
  if (!/^application\/json(?:\s*;|$)/i.test(type)) throw failureError('安装包清单响应类型无效', 'body', 'content-type')
  const reader = response.body?.getReader()
  if (!reader) throw failureError('无法读取安装包清单', 'body', 'missing-stream')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal)
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_INDEX_BYTES) throw failureError('安装包清单过大', 'body', 'size-limit')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text)
  } catch (error) {
    // A stalled underlying stream must not delay the deadline while cancelling.
    try { Promise.resolve(reader.cancel()).catch(() => {}) } catch {}
    if (signal.aborted) throw signal.reason
    if (error instanceof SyntaxError || error instanceof TypeError) throw failureError('安装包清单格式无效', 'body', 'invalid-content')
    throw error
  } finally {
    // Cleanup failures must not replace the original bounded-read diagnostic.
    try { reader.releaseLock() } catch {}
  }
}

// Both browser requests and the Pages Function use this reader. The upstream
// option chooses only a fixed key; it never accepts a user supplied proxy URL.
export async function loadCatalogIndex(product, { fetchImpl = fetch, signal, upstream = false } = {}) {
  let controller, timer, attached = false
  let stage = 'init', code = 'setup', upstreamStatus
  function cancelled() { controller.abort(failureError('安装包清单读取已取消', stage, 'cancelled', upstreamStatus)) }
  try {
    if (!Object.hasOwn(INDEX_ROUTES, product)) throw failureError('安装包类型无效', 'init', 'product')
    controller = new AbortController()
    if (signal?.aborted) cancelled()
    else if (signal) { signal.addEventListener('abort', cancelled, { once: true }); attached = true }
    timer = setTimeout(() => controller.abort(failureError('安装包清单读取超时，请稍后重试', stage, 'timeout', upstreamStatus)), TIMEOUT_MS)
    const url = upstream ? `${COS_ROOT}/${INDEX_KEYS[product]}` : INDEX_ROUTES[product]
    if (controller.signal.aborted) throw controller.signal.reason
    // RequestInit.cache requires a compatibility flag in older Workers.
    // A standard HTTP header keeps the shared browser/edge reader portable.
    stage = 'transport'; code = 'fetch-failed'
    const response = await abortable(Promise.resolve().then(() => fetchImpl(url, {
      method: 'GET', credentials: 'omit', redirect: 'error',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: controller.signal
    })), controller.signal)
    stage = 'response'; code = 'metadata'
    const status = response.status
    if (Number.isInteger(status) && status >= 100 && status <= 599) upstreamStatus = status
    const expectedUrl = upstream ? url : typeof location !== 'undefined' ? new URL(url, location.origin).href : url
    if (response.redirected || status >= 300 && status < 400) throw failureError('安装包清单发生重定向', 'response', 'redirect', upstreamStatus)
    if (response.url && response.url !== expectedUrl) throw failureError('安装包清单发生重定向', 'response', 'url-mismatch', upstreamStatus)
    stage = 'status'; code = 'upstream-status'
    if (status === 404) return null
    if (status !== 200) throw failureError(upstreamStatus ? `安装包清单暂不可用（${upstreamStatus}）` : '安装包清单响应状态无效', stage, code, upstreamStatus)
    stage = 'body'; code = 'read-failed'
    const value = await readJsonResponse(response, controller.signal)
    stage = 'schema'; code = 'invalid-schema'
    validateIndex(product, value)
    return value
  } catch (error) {
    if (controller?.signal.aborted) throw capturedFailure(controller.signal.reason, stage, code, upstreamStatus)
    throw capturedFailure(error, stage, code, upstreamStatus)
  } finally {
    clearTimeout(timer)
    if (attached) { try { signal.removeEventListener('abort', cancelled) } catch {} }
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
  if (product === 'claude') return {
    schemaVersion: 1, product: 'claude-desktop',
    files: items.map(item => ({ fileName: item.fileName, version: item.version, platform: item.platform, architecture: item.architecture, format: item.format, kind: 'installer', key: item.key, url: item.url, size: item.bytes, sha256: item.sha256, type: item.contentType, verification: item.verification }))
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
