import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../functions/cos-download-index/[product].js'
import { COS_ROOT, validateManagerIndex, validateChatgptIndex, catalogFailureDiagnostics } from './catalog.mjs'

const HASH = 'b'.repeat(64)
function managerFixture() {
  const version = '0.2.13'
  const fileName = `XingMang-AI-Manager-${version}-Setup.exe`
  const key = `xingmang/releases/${version}/${fileName}`
  return { schemaVersion: 1, product: 'xingmang-ai-manager', version, files: [{ fileName, version, platform: 'windows', architecture: 'x64', kind: 'installer', key, url: `${COS_ROOT}/${key}`, size: 120976942, sha256: HASH, type: 'application/vnd.microsoft.portable-executable' }] }
}
function context(name = 'xingmang.json', method = 'GET', suffix = '') {
  return { request: new Request(`https://docs-new.example/cos-download-index/${name}${suffix}`, { method, headers: { Cookie: 'account=session', Authorization: 'Bearer secret' } }), params: { product: name } }
}
function jsonResponse(value) { return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }) }

test('legacy Worker runtimes without RequestInit.cache can read every fixed index', async () => {
  const statuses = []
  for (const [name, value] of [
    ['xingmang.json', managerFixture()],
    ['chatgpt.json', { schemaVersion: 1, product: 'chatgpt', platforms: {} }],
    ['claude.json', { schemaVersion: 1, product: 'claude-desktop', files: [] }]
  ]) {
    const handler = createHandler({ fetchImpl: async (_url, options) => {
      // This matches the documented error before cache_option_enabled.
      if (Object.hasOwn(options, 'cache')) throw new Error("The 'cache' field on 'RequestInitializerDict' is not implemented.")
      assert.deepEqual(options.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
      assert.equal(Object.hasOwn(options, 'credentials'), false)
      assert.equal(options.redirect, 'error')
      return jsonResponse(value)
    } })
    const result = await handler(context(name))
    assert.equal(result.headers.get('Cache-Control'), 'no-store')
    statuses.push(result.status)
  }
  assert.deepEqual(statuses, [200, 200, 200])
})

test('Pages handler requests only the fixed COS object without forwarding cookies or authorization', async () => {
  const handler = createHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, `${COS_ROOT}/xingmang/latest.json`)
    assert.deepEqual(options.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
    assert.equal(Object.hasOwn(options, 'credentials'), false)
    assert.equal(options.redirect, 'error')
    return jsonResponse(managerFixture())
  } })
  const result = await handler(context())
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(validateManagerIndex(await result.json())[0].id, 'windows-x64')
})

test('ChatGPT fixed route returns a schema-compatible public manifest', async () => {
  const handler = createHandler({ fetchImpl: async url => {
    assert.equal(url, `${COS_ROOT}/chatgpt/latest.json`)
    return jsonResponse({ schemaVersion: 1, product: 'chatgpt', platforms: {} })
  } })
  const result = await handler(context('chatgpt.json'))
  assert.equal(result.status, 200)
  assert.deepEqual(validateChatgptIndex(await result.json()), [])
})

test('Claude fixed route returns an empty public manifest without guessing installer links', async () => {
  const handler = createHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, `${COS_ROOT}/xingmang/offline/claude/latest.json`)
    assert.deepEqual(options.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
    assert.equal(Object.hasOwn(options, 'credentials'), false)
    assert.equal(options.redirect, 'error')
    return jsonResponse({ schemaVersion: 1, product: 'claude-desktop', files: [] })
  } })
  const result = await handler(context('claude.json'))
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { schemaVersion: 1, product: 'claude-desktop', files: [] })
})

test('legacy Worker runtimes preserve unpublished indexes as uncached 404 responses', async () => {
  for (const name of ['xingmang.json', 'chatgpt.json', 'claude.json']) {
    const handler = createHandler({ fetchImpl: async (_url, options) => {
      if (Object.hasOwn(options, 'cache')) throw new Error("The 'cache' field on 'RequestInitializerDict' is not implemented.")
      return new Response(null, { status: 404 })
    } })
    const result = await handler(context(name))
    assert.equal(result.status, 404)
    assert.equal(result.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await result.json(), { error: '安装包清单尚未发布' })
  }
})

test('unpublished Claude manifests remain 404', async () => {
  const result = await createHandler({ fetchImpl: async url => {
    assert.equal(url, `${COS_ROOT}/xingmang/offline/claude/latest.json`)
    return new Response(null, { status: 404 })
  } })(context('claude.json'))
  assert.equal(result.status, 404)
  assert.deepEqual(await result.json(), { error: '安装包清单尚未发布' })
})

test('unknown routes, encoded routes, query inputs and unsupported methods never fetch upstream', async () => {
  let calls = 0
  const handler = createHandler({ fetchImpl: async () => { calls += 1; throw new Error('should not fetch') } })
  assert.equal((await handler(context('other.json'))).status, 404)
  assert.equal((await handler(context('xingmang.json', 'GET', '?url=https://evil.example'))).status, 404)
  assert.equal((await handler(context('claude.json', 'GET', '?url=https://evil.example'))).status, 404)
  const encoded = context()
  encoded.request = new Request('https://docs-new.example/cos-download-index/%78ingmang.json')
  assert.equal((await handler(encoded)).status, 404)
  const encodedClaude = context('claude.json')
  encodedClaude.request = new Request('https://docs-new.example/cos-download-index/%63laude.json')
  assert.equal((await handler(encodedClaude)).status, 404)
  const array = context()
  array.params.product = ['xingmang.json']
  assert.equal((await handler(array)).status, 404)
  const posted = await handler(context('xingmang.json', 'POST'))
  assert.equal(posted.status, 405)
  assert.equal(posted.headers.get('Allow'), 'GET, HEAD')
  assert.equal((await handler(context('claude.json', 'POST'))).status, 405)
  assert.equal(calls, 0)
})

test('HEAD validates the complete upstream index and returns no body', async () => {
  const handler = createHandler({ fetchImpl: async (_url, options) => {
    assert.equal(options.method, 'GET')
    return jsonResponse(managerFixture())
  } })
  const result = await handler(context('xingmang.json', 'HEAD'))
  assert.equal(result.status, 200)
  assert.equal(await result.text(), '')
})

test('Claude HEAD validates the upstream manifest and returns no body', async () => {
  const handler = createHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, `${COS_ROOT}/xingmang/offline/claude/latest.json`)
    assert.equal(options.method, 'GET')
    return jsonResponse({ schemaVersion: 1, product: 'claude-desktop', files: [] })
  } })
  const result = await handler(context('claude.json', 'HEAD'))
  assert.equal(result.status, 200)
  assert.equal(await result.text(), '')
})

test('Claude rejects another product manifest and upstream failures without reflecting credentials', async () => {
  for (const fetchImpl of [
    async () => jsonResponse({ schemaVersion: 1, product: 'chatgpt', platforms: {} }),
    async () => new Response(null, { status: 302 }),
    async () => new Response(new Uint8Array(262145), { headers: { 'Content-Type': 'application/json' } }),
    async () => { throw new Error('upstream secret-value') }
  ]) {
    const result = await createHandler({ fetchImpl })(context('claude.json'))
    assert.equal(result.status, 502)
    assert.equal((await result.text()).includes('secret-value'), false)
  }
})

test('missing upstream manifests remain 404 and malformed or oversized manifests fail closed', async () => {
  assert.equal((await createHandler({ fetchImpl: async () => new Response(null, { status: 404 }) })(context())).status, 404)
  for (const fetchImpl of [
    async () => jsonResponse({ schemaVersion: 1, product: 'chatgpt', platforms: {} }),
    async () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    async () => new Response(new Uint8Array(262145), { headers: { 'Content-Type': 'application/json' } }),
    async () => new Response(null, { status: 302 }),
    async () => { throw new Error('upstream secret-value') }
  ]) {
    const result = await createHandler({ fetchImpl })(context())
    const body = await result.text()
    assert.equal(result.status, 502)
    assert.equal(body.includes('secret-value'), false)
  }
})

test('empty valid indexes return no guessed installer links', async () => {
  const result = await createHandler({ fetchImpl: async () => jsonResponse({ schemaVersion: 1, product: 'xingmang-ai-manager', files: [] }) })(context())
  assert.equal(result.status, 200)
  assert.deepEqual(validateManagerIndex(await result.json()), [])
})

test('cancelled requests interrupt a stalled upstream body', async () => {
  const controller = new AbortController()
  const request = new Request('https://docs-new.example/cos-download-index/xingmang.json', { signal: controller.signal })
  const result = createHandler({ fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } }) })({ request, params: { product: 'xingmang.json' } })
  controller.abort()
  assert.equal((await result).status, 502)
})

test('request signal getter failures are identified before fetch without exposing the error', async () => {
  const fixture = context()
  Object.defineProperty(fixture.request, 'signal', { get() { throw new Error('private-cookie https://private.example/?key=private-key') } })
  let calls = 0
  const result = await createHandler({ fetchImpl: async () => { calls += 1; return jsonResponse(managerFixture()) } })(fixture)
  assert.equal(calls, 0)
  assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'init', code: 'request-signal' })
  assert.equal(result.headers.get('X-Xingmang-Index-Stage'), 'init')
  assert.equal(result.headers.get('X-Xingmang-Upstream-Status'), null)
})

test('Worker requests succeed when the runtime rejects the browser credentials option', async () => {
  for (const [name, value] of [
    ['xingmang.json', managerFixture()],
    ['chatgpt.json', { schemaVersion: 1, product: 'chatgpt', platforms: {} }],
    ['claude.json', { schemaVersion: 1, product: 'claude-desktop', files: [] }]
  ]) {
    let calls = 0
    const result = await createHandler({ fetchImpl: async (url, options) => {
      calls += 1
      if (Object.hasOwn(options, 'credentials')) throw new TypeError('private-runtime-credentials-error')
      assert.ok(url.startsWith(COS_ROOT + '/'))
      assert.equal(options.method, 'GET')
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal instanceof AbortSignal)
      assert.deepEqual(options.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
      return jsonResponse(value)
    } })(context(name))
    assert.equal(result.status, 200)
    assert.equal(calls, 1)
    assert.equal(result.headers.get('Cache-Control'), 'no-store')
  }
})

test('the preserved cancellation signal still reports simulated runtime transport failures safely', async () => {
    const result = await createHandler({ fetchImpl: async (_url, options) => {
      if (Object.hasOwn(options, 'signal')) throw new TypeError('private-runtime-signal-error')
      return jsonResponse(managerFixture())
    } })(context())
    assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'transport', code: 'fetch-failed' })
})

test('upstream statuses, redirects and response API failures have bounded diagnostics', async () => {
  for (const [fetchImpl, stage, code, upstreamStatus] of [
    [async () => new Response(null, { status: 403 }), 'status', 'upstream-status', 403],
    [async () => new Response(null, { status: 500 }), 'status', 'upstream-status', 500],
    [async () => new Response(null, { status: 302 }), 'response', 'redirect', 302],
    [async () => { const r = jsonResponse(managerFixture()); Object.defineProperty(r, 'url', { value: 'https://private.example/?token=private' }); return r }, 'response', 'url-mismatch', 200],
    [async () => { const r = jsonResponse(managerFixture()); Object.defineProperty(r, 'url', { get() { throw new Error('private-response-url') } }); return r }, 'response', 'metadata', 200]
  ]) {
    const result = await createHandler({ fetchImpl })(context())
    assert.equal(result.status, 502)
    assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage, code, upstreamStatus })
    assert.equal(result.headers.get('X-Xingmang-Upstream-Status'), String(upstreamStatus))
  }
})

test('body and schema failures expose only fixed codes with the successful upstream status', async () => {
  for (const [value, stage, code] of [
    [new Response(null, { headers: { 'Content-Type': 'application/json' } }), 'body', 'missing-stream'],
    [new Response('private-html', { headers: { 'Content-Type': 'text/html' } }), 'body', 'content-type'],
    [new Response(new Uint8Array(262145), { headers: { 'Content-Type': 'application/json' } }), 'body', 'size-limit'],
    [new Response('{private-broken', { headers: { 'Content-Type': 'application/json' } }), 'body', 'invalid-content'],
    [jsonResponse({ schemaVersion: 1, product: 'private-product', files: [] }), 'schema', 'invalid-schema']
  ]) {
    const result = await createHandler({ fetchImpl: async () => value })(context())
    assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage, code, upstreamStatus: 200 })
  }
})

test('HEAD failures keep diagnostics in headers with no body', async () => {
  const result = await createHandler({ fetchImpl: async () => new Response(null, { status: 403 }) })(context('claude.json', 'HEAD'))
  assert.equal(await result.text(), '')
  assert.equal(result.headers.get('X-Xingmang-Index-Stage'), 'status')
  assert.equal(result.headers.get('X-Xingmang-Index-Code'), 'upstream-status')
  assert.equal(result.headers.get('X-Xingmang-Upstream-Status'), '403')
  assert.equal(result.headers.get('Cache-Control'), 'no-store')
})

test('forged error fields and nonnumeric statuses cannot become public diagnostics', async () => {
  const forged = Object.assign(new Error('private-message'), { stage: 'private-stage', code: 'private-code', upstreamStatus: 'private-status' })
  assert.deepEqual(catalogFailureDiagnostics(forged), { stage: 'internal', code: 'unexpected' })
  const result = await createHandler({ fetchImpl: async () => {
    const value = jsonResponse(managerFixture())
    Object.defineProperty(value, 'status', { value: 'private-status' })
    return value
  } })(context())
  assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'status', code: 'upstream-status' })
  assert.equal(result.headers.get('X-Xingmang-Upstream-Status'), null)
})

test('signal setup and response stream failures remain distinct and private', async () => {
  const fixture = context()
  Object.defineProperty(fixture.request, 'signal', { value: { aborted: false, addEventListener() { throw new Error('private-signal-setup') } } })
  let calls = 0
  const early = await createHandler({ fetchImpl: async () => { calls += 1; return jsonResponse(managerFixture()) } })(fixture)
  assert.equal(calls, 0)
  assert.deepEqual(await early.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'init', code: 'setup' })
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('private-stream-body')) } })
  const late = await createHandler({ fetchImpl: async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } }) })(context())
  assert.deepEqual(await late.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'body', code: 'read-failed', upstreamStatus: 200 })
})

test('reader cleanup errors cannot replace the original size limit diagnostic', async () => {
  for (const cleanup of ['cancel', 'releaseLock']) {
    const value = jsonResponse(managerFixture())
    const calls = { cancel: 0, releaseLock: 0 }
    Object.defineProperty(value, 'body', { value: { getReader() { return {
      async read() { return { done: false, value: new Uint8Array(262145) } },
      cancel() { calls.cancel += 1; if (cleanup === 'cancel') throw new Error('private-cancel-error') },
      releaseLock() { calls.releaseLock += 1; if (cleanup === 'releaseLock') throw new Error('private-release-error') }
    } } } })
    const result = await createHandler({ fetchImpl: async () => value })(context())
    assert.deepEqual(await result.json(), { error: '安装包清单暂不可用，请稍后重试', stage: 'body', code: 'size-limit', upstreamStatus: 200 })
    assert.deepEqual(calls, { cancel: 1, releaseLock: 1 })
  }
})
