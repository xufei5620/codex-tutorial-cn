import test from 'node:test'
import assert from 'node:assert/strict'
import { COS_ROOT, INDEX_ROUTES, validateManagerIndex, validateChatgptIndex, fetchCatalog, projectPublicIndex } from './catalog.mjs'

const HASH = 'a'.repeat(64)

export function managerFixture() {
  const version = '0.2.13'
  const fileName = `XingMang-AI-Manager-${version}-Setup.exe`
  const key = `xingmang/releases/${version}/${fileName}`
  return {
    schemaVersion: 1, product: 'xingmang-ai-manager', version,
    files: [{ fileName, version, platform: 'windows', architecture: 'x64', kind: 'installer', key, url: `${COS_ROOT}/${key}`, size: 120976942, sha256: HASH, type: 'application/vnd.microsoft.portable-executable' }]
  }
}

export function chatgptFixture() {
  const version = '26.930.2377.0'
  function artifact(fileName, bytes, verification, contentType) {
    const key = `chatgpt/windows-x64/${version}/${fileName}`
    return { key, url: `${COS_ROOT}/${key}`, bytes, sha256: HASH, verification, contentType }
  }
  return {
    schemaVersion: 1, product: 'chatgpt',
    windows: { schemaVersion: 1, buildVersion: version, packageIdentity: 'OpenAI.Codex', storeProductId: '9PLM9XGG6VKS' },
    platforms: {
      'windows-x64': {
        platform: 'windows', architecture: 'x64', format: 'msix', packageVersion: version,
        artifact: artifact('ChatGPT-x64.msix', 910607781, 'windows-authenticode', 'application/vnd.ms-appx'),
        license: artifact('ChatGPT-License.xml', 2621, 'official-https-sha256-and-product-identity', 'application/xml')
      }
    }
  }
}

function jsonResponse(value, options = {}) {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' }, ...options })
}

test('manager schema exposes only present installers with exact platform and digest', () => {
  const value = managerFixture()
  value.files.push({ kind: 'manifest', fileName: 'latest.yml' })
  const [item] = validateManagerIndex(value)
  assert.equal(item.id, 'windows-x64')
  assert.equal(item.format, 'exe')
  assert.equal(item.bytes, 120976942)
  assert.equal(item.sha256, HASH)
  assert.equal(validateManagerIndex(value).length, 1)
  assert.deepEqual(validateManagerIndex({ schemaVersion: 1, product: 'xingmang-ai-manager', files: [] }), [])
  const projected = projectPublicIndex('manager', value)
  assert.equal(projected.files.length, 1)
  assert.deepEqual(validateManagerIndex(projected), [item])
})

test('manager preserves older platform versions and never substitutes a missing Windows package', () => {
  const value = managerFixture()
  const version = '0.2.12'
  const fileName = `XingMang-AI-Manager-${version}-Apple-Silicon-arm64.dmg`
  const key = `xingmang/releases/${version}/${fileName}`
  value.files = [{ fileName, version, platform: 'macos', architecture: 'arm64', kind: 'installer', key, url: `${COS_ROOT}/${key}`, size: 10, sha256: HASH, type: 'application/x-apple-diskimage' }]
  assert.deepEqual(validateManagerIndex(value).map(item => [item.id, item.version, item.format]), [['macos-arm64', version, 'dmg']])
})

test('manager rejects duplicated platforms, wrong schema, missing digest and fake installer names', () => {
  for (const mutate of [
    value => { value.files.push(value.files[0]) },
    value => { value.schemaVersion = 2 },
    value => { value.files[0].sha256 = '' },
    value => { value.files[0].size = 0 },
    value => { value.files[0].architecture = 'arm64' },
    value => { value.files[0].fileName = 'Setup.exe' },
    value => { value.version = '0.2.12' },
    value => { value.files[0].version = '../0.2.13' }
  ]) {
    const value = managerFixture()
    mutate(value)
    assert.throws(() => validateManagerIndex(value))
  }
})

test('catalog rejects host confusion, userinfo, query strings, ports and encoded traversal', () => {
  const original = managerFixture().files[0].url
  for (const url of [
    original.replace('.myqcloud.com/', '.myqcloud.com.evil.example/'),
    original.replace('https://', 'https://user:password@'),
    `${original}?token=secret`, `${original}#fragment`,
    original.replace('.myqcloud.com/', '.myqcloud.com:443/'),
    original.replace('/releases/', '/releases/%2e%2e/'),
    original.replace('https:', 'http:')
  ]) {
    const value = managerFixture()
    value.files[0].url = url
    assert.throws(() => validateManagerIndex(value), /地址或校验/)
  }
})

test('Windows official schema exposes MSIX and its matching license without claiming other platforms', () => {
  const value = chatgptFixture()
  value.windows.accessToken = 'must not project'
  value.platforms['windows-x64'].source = { account: 'must not project' }
  const [item] = validateChatgptIndex(value)
  assert.equal(item.format, 'msix')
  assert.equal(item.version, '26.930.2377.0')
  assert.equal(item.licenseFileName, 'ChatGPT-License.xml')
  assert.equal(item.licenseSha256, HASH)
  assert.equal(item.licenseBytes, 2621)
  assert.equal(validateChatgptIndex(value).length, 1)
  const projected = projectPublicIndex('chatgpt', value)
  assert.deepEqual(validateChatgptIndex(projected), [item])
  assert.equal(JSON.stringify(projected).includes('must not project'), false)
})

test('official packages reject mismatched license, signatures, version, content type and unknown platforms', () => {
  for (const mutate of [
    value => { value.platforms['windows-x64'].license.key = 'chatgpt/ChatGPT-License.xml' },
    value => { value.platforms['windows-x64'].license.verification = 'unverified' },
    value => { value.platforms['windows-x64'].artifact.verification = 'official-https-sha256' },
    value => { value.platforms['windows-x64'].packageVersion = '26.930.65536.0' },
    value => { value.windows.buildVersion = '26.931.1.0' },
    value => { value.windows.packageIdentity = 'Fake.ChatGPT' },
    value => { value.platforms['windows-x64'].artifact.contentType = 'text/plain' },
    value => { value.platforms['other'] = value.platforms['windows-x64'] }
  ]) {
    const value = chatgptFixture()
    mutate(value)
    assert.throws(() => validateChatgptIndex(value))
  }
})

test('macOS ZIP and Linux deb use hash directories without Windows fallback or invented versions', () => {
  const platforms = {}
  for (const [id, platform, architecture, format, fileName, contentType] of [
    ['macos-arm64', 'macos', 'arm64', 'zip', 'ChatGPT-darwin-arm64-26.930.1.zip', 'application/zip'],
    ['linux-deb-x64', 'linux', 'x64', 'deb', 'chatgpt_amd64.deb', 'application/vnd.debian.binary-package']
  ]) {
    const key = `chatgpt/${id}/sha256-${HASH}/${fileName}`
    platforms[id] = { platform, architecture, format,
      ...(platform === 'macos' ? { appVersion: '26.930.1', buildVersion: '1000' } : {}),
      artifact: { key, url: `${COS_ROOT}/${key}`, bytes: 10, sha256: HASH, contentType, verification: 'official-https-sha256' } }
  }
  const items = validateChatgptIndex({ schemaVersion: 1, product: 'chatgpt', platforms })
  assert.deepEqual(items.map(item => [item.id, item.format, item.version]), [['macos-arm64', 'zip', '26.930.1'], ['linux-deb-x64', 'deb', null]])
  assert.equal(items.some(item => item.licenseUrl), false)
  platforms['macos-arm64'].artifact.key = platforms['macos-arm64'].artifact.key.replace(`sha256-${HASH}`, '26.930.1')
  assert.throws(() => validateChatgptIndex({ schemaVersion: 1, product: 'chatgpt', platforms }))
})

test('fetchCatalog uses fixed same-origin routes and omits account credentials', async () => {
  const items = await fetchCatalog('manager', { fetchImpl: async (url, options) => {
    assert.equal(url, INDEX_ROUTES.manager)
    assert.equal(options.method, 'GET')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    assert.deepEqual(options.headers, { Accept: 'application/json' })
    assert.equal(options.signal.aborted, false)
    return jsonResponse(managerFixture())
  } })
  assert.equal(items[0].id, 'windows-x64')
  await assert.rejects(fetchCatalog('constructor'), /类型无效/)
})

test('404 returns empty results while redirects and HTTP errors remain visible errors', async () => {
  assert.deepEqual(await fetchCatalog('chatgpt', { fetchImpl: async () => new Response(null, { status: 404 }) }), [])
  for (const status of [301, 302, 304, 403, 500]) {
    await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => new Response(null, { status }) }), /重定向|暂不可用/)
  }
  await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => {
    const result = jsonResponse(managerFixture())
    Object.defineProperty(result, 'url', { value: 'https://evil.example/index.json' })
    return result
  } }), /重定向/)
})

test('header and streamed body caps reject oversized indexes before parsing', async () => {
  await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => jsonResponse({}, { headers: { 'Content-Type': 'application/json', 'Content-Length': '262145' } }) }), /过大/)
  await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => new Response(new Uint8Array(262145), { headers: { 'Content-Type': 'application/json' } }) }), /过大/)
  await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => jsonResponse({}, { headers: { 'Content-Type': 'application/json', 'Content-Length': '-1' } }) }), /过大/)
})

test('UTF-8, JSON and response type validation fail closed', async () => {
  for (const response of [
    new Response(Uint8Array.from([0xff]), { headers: { 'Content-Type': 'application/json' } }),
    new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    new Response('{}', { headers: { 'Content-Type': 'text/html' } })
  ]) await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => response }), /格式无效|响应类型无效/)
})

test('cancellation interrupts both a stalled fetch and a stalled response body', async () => {
  for (const fetchImpl of [
    async () => new Promise(() => {}),
    async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } })
  ]) {
    const controller = new AbortController()
    const result = fetchCatalog('manager', { fetchImpl, signal: controller.signal })
    setTimeout(() => controller.abort(), 10)
    await assert.rejects(result, /已取消/)
  }
})

test('an already cancelled request does not start a network request', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  await assert.rejects(fetchCatalog('manager', { signal: controller.signal, fetchImpl: async () => { calls += 1; return jsonResponse(managerFixture()) } }), /已取消/)
  assert.equal(calls, 0)
})

test('the total ten-second deadline also covers a body that never finishes', { timeout: 12000 }, async () => {
  const start = Date.now()
  await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } }) }), /超时/)
  assert.ok(Date.now() - start < 11500)
})
