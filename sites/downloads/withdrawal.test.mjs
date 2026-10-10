import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareMirror, readMirrorState, saveMirrorState, writeMirror } from './mirror.mjs'
import { COS_ROOT, projectPublicIndex, validateManagerIndex } from './catalog.mjs'
import {
  SERVICE_STATUS_URL,
  loadWithdrawalStatus,
  parseWithdrawalStatus,
  selectManagerDownloads,
  withdrawalFailureDiagnostics
} from './withdrawal.mjs'

const PLATFORMS = {
  'windows-x64': [
    'windows',
    'x64',
    (version) => `XingMang-AI-Manager-${version}-Setup.exe`,
    'application/vnd.microsoft.portable-executable'
  ],
  'macos-arm64': ['macos', 'arm64', (version) => `XingMang-AI-Manager-${version}-Apple-Silicon-arm64.dmg`, 'application/x-apple-diskimage'],
  'macos-x64': ['macos', 'x64', (version) => `XingMang-AI-Manager-${version}-Intel-x64.dmg`, 'application/x-apple-diskimage']
}
const ALL = Object.keys(PLATFORMS)

function entry(version, id) {
  const [platform, architecture, name, type] = PLATFORMS[id]
  const fileName = name(version)
  const key = `xingmang/releases/${version}/${fileName}`
  return {
    fileName,
    version,
    platform,
    architecture,
    kind: 'installer',
    key,
    url: COS_ROOT + '/' + key,
    size: 10,
    sha256: 'a'.repeat(64),
    type
  }
}
function managerIndex(version, history = []) {
  return {
    schemaVersion: 1,
    product: 'xingmang-ai-manager',
    version,
    files: ALL.map((id) => entry(version, id)),
    ...(history.length ? { history } : {})
  }
}
// 0.2.18 current; 0.2.17 reached Windows only; 0.2.15 every platform.
function withHistory() {
  return managerIndex('0.2.18', [entry('0.2.17', 'windows-x64'), ...ALL.map((id) => entry('0.2.15', id))])
}
function json(value, init = {}) {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  })
}
function sources(manager, status) {
  const requests = []
  async function fetchImpl(url, init) {
    requests.push({ url, init })
    if (url === SERVICE_STATUS_URL) return typeof status === 'function' ? status() : json(status)
    return url.endsWith('/xingmang/latest.json') ? json(manager) : new Response(null, { status: 404 })
  }
  return { fetchImpl, requests }
}
async function managerEntry(manager, status) {
  return (await prepareMirror({ fetchImpl: sources(manager, status).fetchImpl }))[0]
}
function offered(entry) {
  return validateManagerIndex(JSON.parse(entry.json)).map((item) => [item.id, item.version])
}

test('every run reads the fixed withdrawal list once, anonymously and without following redirects', async () => {
  const { fetchImpl, requests } = sources(withHistory(), { badVersions: ['0.2.10'] })
  await prepareMirror({ fetchImpl })
  const status = requests.filter((request) => request.url === SERVICE_STATUS_URL)
  assert.equal(SERVICE_STATUS_URL, 'https://updatesnew.shenfengwl.fun/xingmang-manager/service-status.json')
  assert.equal(status.length, 1)
  assert.equal(status[0].init.method, 'GET')
  assert.equal(status[0].init.redirect, 'error')
  assert.deepEqual(status[0].init.headers, { Accept: 'application/json', 'Cache-Control': 'no-cache' })
  assert.equal(Object.hasOwn(status[0].init, 'credentials'), false)
})

test('with nothing withdrawn the published index stays exactly as before', async () => {
  for (const status of [{}, { badVersions: ['0.2.10'] }, { badVersions: [], minimumVersion: '0.2.18', maintenance: { active: true } }]) {
    const entry = await managerEntry(withHistory(), status)
    assert.equal(entry.json, JSON.stringify(projectPublicIndex('manager', withHistory()), null, 2) + '\n')
    assert.deepEqual(entry.withdrawal, [])
    assert.equal(entry.json.includes('history'), false)
  }
})

test('a withdrawn version falls back per platform to the newest older installer that is not withdrawn', async () => {
  const one = await managerEntry(withHistory(), { badVersions: ['0.2.18'] })
  assert.deepEqual(offered(one), [
    ['windows-x64', '0.2.17'],
    ['macos-arm64', '0.2.15'],
    ['macos-x64', '0.2.15']
  ])
  assert.equal(JSON.parse(one.json).version, '0.2.17')
  assert.deepEqual(one.withdrawal, [
    { platform: 'windows-x64', withdrawn: '0.2.18', offered: '0.2.17' },
    { platform: 'macos-arm64', withdrawn: '0.2.18', offered: '0.2.15' },
    { platform: 'macos-x64', withdrawn: '0.2.18', offered: '0.2.15' }
  ])
  const two = await managerEntry(withHistory(), { badVersions: ['0.2.17', 'v0.2.18 '] })
  assert.deepEqual(offered(two), [
    ['windows-x64', '0.2.15'],
    ['macos-arm64', '0.2.15'],
    ['macos-x64', '0.2.15']
  ])
  assert.equal(JSON.parse(two.json).version, '0.2.15')
})

test('a platform with no allowed older installer is not offered, and with none left the page shows its preparing state', async () => {
  const partial = await managerEntry(withHistory(), { badVersions: ['0.2.18', '0.2.15'] })
  assert.deepEqual(offered(partial), [['windows-x64', '0.2.17']])
  assert.deepEqual(
    partial.withdrawal.map((item) => item.offered),
    ['0.2.17', null, null]
  )
  // Older than the minimum version would block the customer at first launch.
  const minimum = await managerEntry(withHistory(), { badVersions: ['0.2.18'], minimumVersion: '0.2.16' })
  assert.deepEqual(offered(minimum), [['windows-x64', '0.2.17']])
  for (const [manager, status] of [
    [withHistory(), { badVersions: ['0.2.18', '0.2.17', '0.2.15'] }],
    [withHistory(), { badVersions: ['0.2.18'], minimumVersion: '0.2.18' }],
    [managerIndex('0.2.18'), { badVersions: ['0.2.18'] }]
  ]) {
    const entry = await managerEntry(manager, status)
    assert.deepEqual(JSON.parse(entry.json), { schemaVersion: 1, product: 'xingmang-ai-manager', files: [] })
    assert.deepEqual(validateManagerIndex(JSON.parse(entry.json)), [])
    assert.ok(entry.withdrawal.every((item) => item.offered === null))
  }
})

test('withdrawn mirrors pass the same write and cache validation as any other index', async () => {
  const entries = await prepareMirror({ fetchImpl: sources(withHistory(), { badVersions: ['0.2.18'] }).fetchImpl })
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xm-withdrawal-mirror-'))
  await writeMirror(entries, { root })
  await saveMirrorState(entries, { cacheDir: root })
  assert.deepEqual(
    validateManagerIndex((await readMirrorState({ cacheDir: root })).manager),
    validateManagerIndex(JSON.parse(entries[0].json))
  )
})

test('Codex and Claude indexes never carry or depend on withdrawal results', async () => {
  const entries = await prepareMirror({ fetchImpl: sources(withHistory(), { badVersions: ['0.2.18'] }).fetchImpl })
  assert.deepEqual(
    entries.map((entry) => Object.hasOwn(entry, 'withdrawal')),
    [true, false, false]
  )
  const plain = await prepareMirror({ fetchImpl: sources(withHistory(), {}).fetchImpl })
  assert.deepEqual(
    entries.slice(1).map((entry) => entry.json),
    plain.slice(1).map((entry) => entry.json)
  )
})

test('an unreadable withdrawal list fails the whole run, a 404 included', async () => {
  const cases = [
    [() => new Response(null, { status: 404 }), 'upstream-status'],
    [() => new Response(null, { status: 500 }), 'upstream-status'],
    [() => new Response(null, { status: 302, headers: { Location: 'https://example.invalid/' } }), 'redirect'],
    [() => json({}, { headers: { 'Content-Length': String(16 * 1024 + 1) } }), 'size-limit'],
    [() => new Response('x'.repeat(16 * 1024 + 1)), 'size-limit'],
    [() => json('{broken'), 'invalid-content'],
    [() => json([]), 'invalid-content'],
    [() => json({ badVersions: '0.2.18' }), 'invalid-content'],
    [
      () => {
        throw Error('private-upstream-detail')
      },
      'fetch-failed'
    ]
  ]
  for (const [status, code] of cases) {
    await assert.rejects(prepareMirror({ fetchImpl: sources(withHistory(), status).fetchImpl }), (error) => {
      assert.equal(withdrawalFailureDiagnostics(error)?.code, code)
      assert.equal(JSON.stringify(withdrawalFailureDiagnostics(error)).includes('private'), false)
      return true
    })
  }
})

test('the list is read the way the client reads it', () => {
  assert.deepEqual(parseWithdrawalStatus('{}'), { badVersions: [], minimumVersion: null })
  assert.deepEqual(
    parseWithdrawalStatus(
      '﻿' +
        JSON.stringify({
          badVersions: [' v0.2.18 ', '0.2.19-beta.1', '0.2', 18, null, '0.2.18', 'V0.2.11'],
          minimumVersion: 'v0.2.13'
        })
    ),
    { badVersions: ['0.2.18', '0.2.19-beta.1', '0.2.11'], minimumVersion: '0.2.13' }
  )
  for (const minimumVersion of ['0.2.13-beta', '0.2', 13, 'latest'])
    assert.equal(parseWithdrawalStatus(JSON.stringify({ minimumVersion })).minimumVersion, null)
  const many = Array.from({ length: 101 }, (_, index) => `0.0.${index}`)
  assert.equal(parseWithdrawalStatus(JSON.stringify({ badVersions: many })).badVersions.includes('0.0.100'), false)
  for (const text of ['null', '"text"', '[]', '{"badVersions":{}}', '{'])
    assert.throws(
      () => parseWithdrawalStatus(text),
      (error) => withdrawalFailureDiagnostics(error)?.code === 'invalid-content'
    )
})

test('a cancelled build stops reading the list without a partial result', async () => {
  const controller = new AbortController()
  controller.abort()
  let requests = 0
  await assert.rejects(
    loadWithdrawalStatus({
      signal: controller.signal,
      fetchImpl: async (url, init) => {
        requests++
        if (init.signal.aborted) throw init.signal.reason
        return json({})
      }
    }),
    (error) => withdrawalFailureDiagnostics(error)?.code === 'fetch-failed'
  )
  assert.equal(requests <= 1, true)
})

test('history entries are validated like current files and never published as they are', () => {
  const source = withHistory()
  assert.equal(validateManagerIndex(source).length, 3)
  assert.equal(JSON.stringify(projectPublicIndex('manager', source)).includes('0.2.15'), false)
  const archive = { ...entry('0.2.15', 'windows-x64'), kind: 'update', fileName: 'ignored.zip' }
  assert.equal(validateManagerIndex({ ...source, history: [...source.history, archive] }).length, 3)
  for (const mutate of [
    (value) => {
      value.history = 'not a list'
    },
    (value) => {
      value.history[0].url = 'https://evil.invalid/setup.exe'
    },
    (value) => {
      value.history[0].sha256 = 'invalid'
    },
    (value) => {
      value.history.push(structuredClone(value.files[0]))
    },
    (value) => {
      value.history.push(structuredClone(value.history[0]))
    },
    (value) => {
      value.history.push(entry('0.2.19', 'windows-x64'))
    }
  ]) {
    const value = structuredClone(source)
    mutate(value)
    assert.throws(() => validateManagerIndex(value))
    assert.throws(() => selectManagerDownloads(value, { badVersions: ['0.2.18'], minimumVersion: null }))
  }
})
