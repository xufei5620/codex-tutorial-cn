import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../functions/cos-download-index/[product].js'
import { COS_ROOT, validateManagerIndex, validateChatgptIndex } from './catalog.mjs'

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

test('Pages handler requests only the fixed COS object without forwarding cookies or authorization', async () => {
  const handler = createHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, `${COS_ROOT}/xingmang/latest.json`)
    assert.deepEqual(options.headers, { Accept: 'application/json' })
    assert.equal(options.credentials, 'omit')
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

test('unknown routes, encoded routes, query inputs and unsupported methods never fetch upstream', async () => {
  let calls = 0
  const handler = createHandler({ fetchImpl: async () => { calls += 1; throw new Error('should not fetch') } })
  assert.equal((await handler(context('other.json'))).status, 404)
  assert.equal((await handler(context('xingmang.json', 'GET', '?url=https://evil.example'))).status, 404)
  const encoded = context()
  encoded.request = new Request('https://docs-new.example/cos-download-index/%78ingmang.json')
  assert.equal((await handler(encoded)).status, 404)
  const array = context()
  array.params.product = ['xingmang.json']
  assert.equal((await handler(array)).status, 404)
  const posted = await handler(context('xingmang.json', 'POST'))
  assert.equal(posted.status, 405)
  assert.equal(posted.headers.get('Allow'), 'GET, HEAD')
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
