import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COS_ROOT,
  INDEX_ROUTES,
  validateManagerIndex,
  validateChatgptIndex,
  validateClaudeIndex,
  fetchCatalog,
  projectPublicIndex,
  catalogFailureDiagnostics,
  downloadPlatformGroups
} from './catalog.mjs'

const HASH = 'a'.repeat(64)

test('display metadata shares exact supported platforms without synthesizing download URLs', () => {
  const codex = downloadPlatformGroups('chatgpt')
  const claude = downloadPlatformGroups('claude')
  for (const product of ['manager', 'chatgpt', 'claude'])
    assert.deepEqual(
      downloadPlatformGroups(product).map((group) => group.title),
      ['Windows', 'macOS']
    )
  assert.deepEqual(
    codex.map((group) => group.packages.length),
    [2, 2]
  )
  assert.deepEqual(
    claude.map((group) => group.packages.length),
    [2, 2]
  )
  assert.deepEqual(
    claude[1].packages.map((item) => [item.architecture, item.format]),
    [
      ['universal', 'dmg'],
      ['universal', 'pkg']
    ]
  )
  assert.equal(codex.flatMap((group) => group.packages).filter((item) => item.requiresLicense).length, 2)
  assert.equal(JSON.stringify([codex, claude]).includes('https:'), false)
  assert.throws(() => downloadPlatformGroups('constructor'))
})

export function managerFixture() {
  const version = '0.2.13'
  const fileName = `XingMang-AI-Manager-${version}-Setup.exe`
  const key = `xingmang/releases/${version}/${fileName}`
  return {
    schemaVersion: 1,
    product: 'xingmang-ai-manager',
    version,
    files: [
      {
        fileName,
        version,
        platform: 'windows',
        architecture: 'x64',
        kind: 'installer',
        key,
        url: `${COS_ROOT}/${key}`,
        size: 120976942,
        sha256: HASH,
        type: 'application/vnd.microsoft.portable-executable'
      }
    ]
  }
}

export function chatgptFixture() {
  const version = '26.930.2377.0'
  function artifact(fileName, bytes, verification, contentType) {
    const key = `chatgpt/windows-x64/${version}/${fileName}`
    return { key, url: `${COS_ROOT}/${key}`, bytes, sha256: HASH, verification, contentType }
  }
  return {
    schemaVersion: 1,
    product: 'chatgpt',
    windows: { schemaVersion: 1, buildVersion: version, packageIdentity: 'OpenAI.Codex', storeProductId: '9PLM9XGG6VKS' },
    platforms: {
      'windows-x64': {
        platform: 'windows',
        architecture: 'x64',
        format: 'msix',
        packageVersion: version,
        artifact: artifact('ChatGPT-x64.msix', 910607781, 'windows-authenticode', 'application/vnd.ms-appx'),
        license: artifact('ChatGPT-License.xml', 2621, 'official-https-sha256-and-product-identity', 'application/xml')
      }
    }
  }
}

export function claudeFixture() {
  const key = `xingmang/offline/claude/windows-x64/sha256-${HASH}/Claude-x64.msix`
  return {
    schemaVersion: 1,
    product: 'claude-desktop',
    files: [
      {
        fileName: 'Claude-x64.msix',
        version: '1.0.0.0',
        platform: 'windows',
        architecture: 'x64',
        format: 'msix',
        kind: 'installer',
        key,
        url: `${COS_ROOT}/${key}`,
        size: 500000000,
        sha256: HASH,
        type: 'application/vnd.ms-appx',
        verification: 'windows-authenticode-msix-identity'
      }
    ]
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
  value.files = [
    {
      fileName,
      version,
      platform: 'macos',
      architecture: 'arm64',
      kind: 'installer',
      key,
      url: `${COS_ROOT}/${key}`,
      size: 10,
      sha256: HASH,
      type: 'application/x-apple-diskimage'
    }
  ]
  assert.deepEqual(
    validateManagerIndex(value).map((item) => [item.id, item.version, item.format]),
    [['macos-arm64', version, 'dmg']]
  )
})

test('manager historical Linux packages remain valid but are excluded from public and browser catalogs', async () => {
  const value = managerFixture(),
    version = value.version
  const fileName = `xingmang-ai-manager_${version}_amd64.deb`,
    key = `xingmang/releases/${version}/${fileName}`
  value.files.push({
    fileName,
    version,
    platform: 'linux',
    architecture: 'x64',
    kind: 'installer',
    key,
    url: `${COS_ROOT}/${key}`,
    size: 10,
    sha256: HASH,
    type: 'application/vnd.debian.binary-package'
  })
  assert.equal(validateManagerIndex(value).length, 2)
  assert.deepEqual(
    validateManagerIndex(projectPublicIndex('manager', value)).map((item) => item.id),
    ['windows-x64']
  )
  assert.deepEqual(
    (await fetchCatalog('manager', { fetchImpl: async () => jsonResponse(value) })).map((item) => item.id),
    ['windows-x64']
  )
  value.files[1].sha256 = 'invalid'
  assert.throws(() => projectPublicIndex('manager', value))
})

test('manager rejects duplicated platforms, wrong schema, missing digest and fake installer names', () => {
  for (const mutate of [
    (value) => {
      value.files.push(value.files[0])
    },
    (value) => {
      value.schemaVersion = 2
    },
    (value) => {
      value.files[0].sha256 = ''
    },
    (value) => {
      value.files[0].size = 0
    },
    (value) => {
      value.files[0].architecture = 'arm64'
    },
    (value) => {
      value.files[0].fileName = 'Setup.exe'
    },
    (value) => {
      value.version = '0.2.12'
    },
    (value) => {
      value.files[0].version = '../0.2.13'
    }
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
    `${original}?token=secret`,
    `${original}#fragment`,
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
    (value) => {
      value.platforms['windows-x64'].license.key = 'chatgpt/ChatGPT-License.xml'
    },
    (value) => {
      value.platforms['windows-x64'].license.verification = 'unverified'
    },
    (value) => {
      value.platforms['windows-x64'].artifact.verification = 'official-https-sha256'
    },
    (value) => {
      value.platforms['windows-x64'].packageVersion = '26.930.65536.0'
    },
    (value) => {
      value.windows.buildVersion = '26.931.1.0'
    },
    (value) => {
      value.windows.packageIdentity = 'Fake.ChatGPT'
    },
    (value) => {
      value.platforms['windows-x64'].artifact.contentType = 'text/plain'
    },
    (value) => {
      value.platforms['other'] = value.platforms['windows-x64']
    }
  ]) {
    const value = chatgptFixture()
    mutate(value)
    assert.throws(() => validateChatgptIndex(value))
  }
})

test('historical macOS and Linux packages validate while public catalogs include only macOS', async () => {
  const platforms = {}
  for (const [id, platform, architecture, format, fileName, contentType] of [
    ['macos-arm64', 'macos', 'arm64', 'zip', 'ChatGPT-darwin-arm64-26.930.1.zip', 'application/zip'],
    ['linux-deb-x64', 'linux', 'x64', 'deb', 'chatgpt_amd64.deb', 'application/vnd.debian.binary-package']
  ]) {
    const key = `chatgpt/${id}/sha256-${HASH}/${fileName}`
    platforms[id] = {
      platform,
      architecture,
      format,
      ...(platform === 'macos' ? { appVersion: '26.930.1', buildVersion: '1000' } : {}),
      artifact: { key, url: `${COS_ROOT}/${key}`, bytes: 10, sha256: HASH, contentType, verification: 'official-https-sha256' }
    }
  }
  const value = { schemaVersion: 1, product: 'chatgpt', platforms }
  const items = validateChatgptIndex(value)
  assert.deepEqual(
    items.map((item) => [item.id, item.format, item.version]),
    [
      ['macos-arm64', 'zip', '26.930.1'],
      ['linux-deb-x64', 'deb', null]
    ]
  )
  assert.equal(
    items.some((item) => item.licenseUrl),
    false
  )
  assert.deepEqual(
    validateChatgptIndex(projectPublicIndex('chatgpt', value)).map((item) => item.id),
    ['macos-arm64']
  )
  assert.deepEqual(
    (await fetchCatalog('chatgpt', { fetchImpl: async () => jsonResponse(value) })).map((item) => item.id),
    ['macos-arm64']
  )
  platforms['macos-arm64'].artifact.key = platforms['macos-arm64'].artifact.key.replace(`sha256-${HASH}`, '26.930.1')
  assert.throws(() => validateChatgptIndex({ schemaVersion: 1, product: 'chatgpt', platforms }))
})

test('Claude full Windows MSIX exposes no license and public projection removes source internals', () => {
  const value = claudeFixture()
  value.files[0].source = { cookie: 'must not project' }
  const [item] = validateClaudeIndex(value)
  assert.equal(item.id, 'windows-x64')
  assert.equal(item.format, 'msix')
  assert.equal(item.licenseUrl, undefined)
  const projected = projectPublicIndex('claude', value)
  assert.deepEqual(validateClaudeIndex(projected), [item])
  assert.equal(JSON.stringify(projected).includes('must not project'), false)
  assert.deepEqual(validateClaudeIndex({ schemaVersion: 1, product: 'claude-desktop', files: [] }), [])
})

test('Claude historical formats validate while public catalogs keep only Windows and universal Mac packages', async () => {
  const files = []
  for (const [id, platform, architecture, format, fileName, type, verification, version] of [
    [
      'windows-x64',
      'windows',
      'x64',
      'msix',
      'Claude-x64.msix',
      'application/vnd.ms-appx',
      'windows-authenticode-msix-identity',
      '1.0.0.0'
    ],
    [
      'windows-arm64',
      'windows',
      'arm64',
      'msix',
      'Claude-arm64.msix',
      'application/vnd.ms-appx',
      'windows-authenticode-msix-identity',
      '1.0.0.0'
    ],
    [
      'macos-dmg-universal',
      'macos',
      'universal',
      'dmg',
      'Claude-universal.dmg',
      'application/x-apple-diskimage',
      'macos-codesign-universal',
      '1.0.0'
    ],
    [
      'macos-pkg-universal',
      'macos',
      'universal',
      'pkg',
      'Claude-universal.pkg',
      'application/vnd.apple.installer+xml',
      'macos-installer-signature',
      '1.0.0'
    ],
    [
      'linux-deb-x64',
      'linux',
      'x64',
      'deb',
      'claude-desktop-amd64.deb',
      'application/vnd.debian.binary-package',
      'official-https-package-index-sha256',
      '1.0.0-1'
    ],
    [
      'linux-deb-arm64',
      'linux',
      'arm64',
      'deb',
      'claude-desktop-arm64.deb',
      'application/vnd.debian.binary-package',
      'official-https-package-index-sha256',
      '1:1.0.0-1'
    ]
  ]) {
    const key = `xingmang/offline/claude/${id}/sha256-${HASH}/${fileName}`
    files.push({
      fileName,
      version,
      platform,
      architecture,
      format,
      kind: 'installer',
      key,
      url: `${COS_ROOT}/${key}`,
      size: 10,
      sha256: HASH,
      type,
      verification
    })
  }
  const value = { schemaVersion: 1, product: 'claude-desktop', files }
  const items = validateClaudeIndex(value)
  assert.deepEqual(
    items.map((item) => item.id),
    ['windows-x64', 'windows-arm64', 'macos-dmg-universal', 'macos-pkg-universal', 'linux-deb-x64', 'linux-deb-arm64']
  )
  assert.equal(
    items.filter((item) => item.platform === 'macos').every((item) => item.architecture === 'universal'),
    true
  )
  assert.equal(
    items.some((item) => item.licenseUrl),
    false
  )
  const published = items.filter((item) => item.platform !== 'linux')
  assert.deepEqual(validateClaudeIndex(projectPublicIndex('claude', value)), published)
  assert.deepEqual(await fetchCatalog('claude', { fetchImpl: async () => jsonResponse(value) }), published)
})

test('Claude rejects bootstrap names, fabricated platforms, unsupported signatures and mismatched immutable keys', () => {
  for (const mutate of [
    (value) => {
      value.product = 'chatgpt'
    },
    (value) => {
      value.schemaVersion = 2
    },
    (value) => {
      value.files.push(value.files[0])
    },
    (value) => {
      value.files[0].fileName = 'ClaudeSetup.exe'
    },
    (value) => {
      value.files[0].format = 'exe'
    },
    (value) => {
      value.files[0].platform = 'linux'
      value.files[0].format = 'rpm'
    },
    (value) => {
      value.files[0].architecture = 'universal'
    },
    (value) => {
      value.files[0].verification = 'official-https-sha256'
    },
    (value) => {
      value.files[0].version = 'unknown'
    },
    (value) => {
      value.files[0].licenseUrl = `${COS_ROOT}/chatgpt/license.xml`
    },
    (value) => {
      value.files[0].key = value.files[0].key.replace(`sha256-${HASH}`, '1.0.0.0')
    },
    (value) => {
      value.files[0].sha256 = 'b'.repeat(64)
    },
    (value) => {
      value.files[0].url += '?token=secret'
    },
    (value) => {
      value.files[0].url = value.files[0].url.replace('.myqcloud.com/', '.myqcloud.com.evil.example/')
    },
    (value) => {
      value.files[0].size = 0
    },
    (value) => {
      value.files[0].type = 'text/plain'
    },
    (value) => {
      value.files[0].kind = 'manifest'
    }
  ]) {
    const value = claudeFixture()
    mutate(value)
    assert.throws(() => validateClaudeIndex(value))
  }
})

test('Claude rejects the old root namespace rather than accepting two storage prefixes', () => {
  const value = claudeFixture()
  value.files[0].key = value.files[0].key.replace('xingmang/offline/claude/', 'claude/')
  value.files[0].url = `${COS_ROOT}/${value.files[0].key}`
  assert.throws(() => validateClaudeIndex(value), /地址或校验/)
})

test('Claude catalog reads only the fixed same-origin route and retains an empty state on 404', async () => {
  const items = await fetchCatalog('claude', {
    fetchImpl: async (url, options) => {
      assert.equal(url, '/cos-download-index/claude.json')
      assert.equal(options.credentials, 'omit')
      assert.equal(options.redirect, 'error')
      return jsonResponse(claudeFixture())
    }
  })
  assert.equal(items[0].fileName, 'Claude-x64.msix')
  assert.deepEqual(await fetchCatalog('claude', { fetchImpl: async () => new Response(null, { status: 404 }) }), [])
})

test('fetchCatalog uses fixed same-origin routes and omits account credentials', async () => {
  const items = await fetchCatalog('manager', {
    fetchImpl: async (url, options) => {
      assert.equal(url, INDEX_ROUTES.manager)
      assert.equal(options.method, 'GET')
      assert.equal(options.credentials, 'omit')
      assert.equal(options.redirect, 'error')
      assert.deepEqual(options.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
      assert.equal(options.signal.aborted, false)
      return jsonResponse(managerFixture())
    }
  })
  assert.equal(items[0].id, 'windows-x64')
  await assert.rejects(fetchCatalog('constructor'), /类型无效/)
})

test('404 returns empty results while redirects and HTTP errors remain visible errors', async () => {
  assert.deepEqual(await fetchCatalog('chatgpt', { fetchImpl: async () => new Response(null, { status: 404 }) }), [])
  for (const status of [301, 302, 304, 403, 500]) {
    await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => new Response(null, { status }) }), /重定向|暂不可用/)
  }
  await assert.rejects(
    fetchCatalog('manager', {
      fetchImpl: async () => {
        const result = jsonResponse(managerFixture())
        Object.defineProperty(result, 'url', { value: 'https://evil.example/index.json' })
        return result
      }
    }),
    /重定向/
  )
})

test('header and streamed body caps reject oversized indexes before parsing', async () => {
  await assert.rejects(
    fetchCatalog('manager', {
      fetchImpl: async () => jsonResponse({}, { headers: { 'Content-Type': 'application/json', 'Content-Length': '262145' } })
    }),
    /过大/
  )
  await assert.rejects(
    fetchCatalog('manager', {
      fetchImpl: async () => new Response(new Uint8Array(262145), { headers: { 'Content-Type': 'application/json' } })
    }),
    /过大/
  )
  await assert.rejects(
    fetchCatalog('manager', {
      fetchImpl: async () => jsonResponse({}, { headers: { 'Content-Type': 'application/json', 'Content-Length': '-1' } })
    }),
    /过大/
  )
})

test('UTF-8, JSON and response type validation fail closed', async () => {
  for (const response of [
    new Response(Uint8Array.from([0xff]), { headers: { 'Content-Type': 'application/json' } }),
    new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    new Response('{}', { headers: { 'Content-Type': 'text/html' } })
  ])
    await assert.rejects(fetchCatalog('manager', { fetchImpl: async () => response }), /格式无效|响应类型无效/)
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
  await assert.rejects(
    fetchCatalog('manager', {
      signal: controller.signal,
      fetchImpl: async () => {
        calls += 1
        return jsonResponse(managerFixture())
      }
    }),
    /已取消/
  )
  assert.equal(calls, 0)
})

test('the total ten-second deadline also covers a body that never finishes', { timeout: 12000 }, async () => {
  const start = Date.now()
  await assert.rejects(
    fetchCatalog('manager', {
      fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } })
    }),
    (error) => {
      assert.match(error.message, /超时/)
      assert.deepEqual(catalogFailureDiagnostics(error), { stage: 'body', code: 'timeout', upstreamStatus: 200 })
      return true
    }
  )
  assert.ok(Date.now() - start < 11500)
})
