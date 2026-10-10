import { compareManagerVersions, managerHistoryItems, validateManagerIndex } from './catalog.mjs'

// The withdrawal list the manager's service-status and rollback-release
// workflows write, and the file 0.2.10+ clients read before every update. A
// fixed constant: the build never takes this address from outside.
export const SERVICE_STATUS_URL = 'https://updatesnew.shenfengwl.fun/xingmang-manager/service-status.json'
const MAX_STATUS_BYTES = 16 * 1024
const TIMEOUT_MS = 10000
const MAX_BAD_VERSIONS = 100
// Same reading as the client (electron/service-status.ts in the manager
// repository), so a version the client treats as withdrawn is withdrawn here.
const STATUS_VERSION = /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[0-9A-Za-z.-]{1,40})?$/
const MINIMUM_VERSION = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/
const FAILURES = new WeakMap()
const FAILURE_CODES = Object.freeze(['timeout', 'fetch-failed', 'redirect', 'upstream-status', 'size-limit', 'invalid-content'])

function failure(message, code, upstreamStatus) {
  const error = new Error(message)
  FAILURES.set(error, {
    source: 'service-status',
    code,
    ...(Number.isInteger(upstreamStatus) && upstreamStatus >= 100 && upstreamStatus <= 599 ? { upstreamStatus } : {})
  })
  return error
}

// Only fixed codes reach the Actions log, never an upstream message or URL.
export function withdrawalFailureDiagnostics(error) {
  const detail = FAILURES.get(error)
  return detail && FAILURE_CODES.includes(detail.code) ? { ...detail } : null
}

function readVersion(value) {
  if (typeof value !== 'string') return null
  const version = value.trim().replace(/^v/i, '')
  return STATUS_VERSION.test(version) ? version : null
}

// The workflows delete badVersions once the list is empty, so a missing field
// means nothing is withdrawn. Anything else that is not a list is a broken file
// and must stop the deployment rather than put a withdrawn version back.
export function parseWithdrawalStatus(text) {
  let value
  try {
    value = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw failure('撤回名单不是合法的 JSON', 'invalid-content')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw failure('撤回名单不是 JSON 对象', 'invalid-content')
  if (value.badVersions !== undefined && !Array.isArray(value.badVersions)) throw failure('撤回名单格式无效', 'invalid-content')
  const badVersions = new Set()
  for (const entry of (value.badVersions || []).slice(0, MAX_BAD_VERSIONS)) {
    const version = readVersion(entry)
    if (version) badVersions.add(version)
  }
  const minimum = readVersion(value.minimumVersion)
  return { badVersions: [...badVersions], minimumVersion: minimum && MINIMUM_VERSION.test(minimum) ? minimum : null }
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    function aborted() {
      reject(signal.reason)
    }
    signal.addEventListener('abort', aborted, { once: true })
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', aborted))
  })
}

async function readBoundedText(response, signal) {
  const length = response.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_STATUS_BYTES)) throw failure('撤回名单过大', 'size-limit')
  const reader = response.body?.getReader()
  if (!reader) throw failure('撤回名单没有内容', 'invalid-content')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal)
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_STATUS_BYTES) throw failure('撤回名单过大', 'size-limit')
      text += decoder.decode(chunk.value, { stream: true })
    }
    return text + decoder.decode()
  } catch (error) {
    try {
      Promise.resolve(reader.cancel()).catch(() => {})
    } catch {}
    if (signal.aborted) throw signal.reason
    if (FAILURES.has(error)) throw error
    throw failure('撤回名单读取失败', error instanceof TypeError ? 'invalid-content' : 'fetch-failed')
  }
}

// Fails on every problem, a 404 included: the file has been written by both
// workflows since it was created, so a missing file means a wrong or moved
// address. The caller then keeps the deployed pages instead of guessing.
export async function loadWithdrawalStatus({ fetchImpl = fetch, signal } = {}) {
  const controller = new AbortController()
  function cancelled() {
    controller.abort(failure('撤回名单读取已取消', 'fetch-failed'))
  }
  if (signal?.aborted) cancelled()
  else signal?.addEventListener('abort', cancelled, { once: true })
  const timer = setTimeout(() => controller.abort(failure('撤回名单读取超时', 'timeout')), TIMEOUT_MS)
  try {
    let response
    try {
      response = await fetchImpl(SERVICE_STATUS_URL, {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal
      })
    } catch {
      if (controller.signal.aborted) throw controller.signal.reason
      throw failure('撤回名单暂时无法连接', 'fetch-failed')
    }
    if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== SERVICE_STATUS_URL))
      throw failure('撤回名单发生重定向', 'redirect', response.status)
    if (response.status !== 200) {
      Promise.resolve(response.body?.cancel()).catch(() => {})
      throw failure(`撤回名单暂不可用（${response.status}）`, 'upstream-status', response.status)
    }
    return parseWithdrawalStatus(await readBoundedText(response, controller.signal))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancelled)
  }
}

function sourceEntry(item) {
  return {
    fileName: item.fileName,
    version: item.version,
    platform: item.platform,
    architecture: item.architecture,
    kind: 'installer',
    key: item.key,
    url: item.url,
    size: item.bytes,
    sha256: item.sha256,
    type: item.contentType
  }
}

// Each platform keeps its current installer unless that version is withdrawn.
// A withdrawn one is replaced by the newest older installer that is neither
// withdrawn nor below the minimum version (which would block the customer at
// first launch); with none left the platform is not offered at all.
export function selectManagerDownloads(value, status) {
  const current = validateManagerIndex(value)
  const withdrawn = new Set(status.badVersions)
  if (!current.some((item) => withdrawn.has(item.version))) return { index: value, withdrawal: [] }
  const history = managerHistoryItems(value)
  const withdrawal = []
  const offered = current.flatMap((item) => {
    if (!withdrawn.has(item.version)) return [item]
    const fallback = history
      .filter(
        (candidate) =>
          candidate.id === item.id &&
          !withdrawn.has(candidate.version) &&
          (status.minimumVersion === null || compareManagerVersions(candidate.version, status.minimumVersion) >= 0)
      )
      .sort((left, right) => compareManagerVersions(right.version, left.version))[0]
    withdrawal.push({ platform: item.id, withdrawn: item.version, offered: fallback ? fallback.version : null })
    return fallback ? [fallback] : []
  })
  const version = offered.map((item) => item.version).sort((left, right) => compareManagerVersions(right, left))[0]
  return {
    index: { schemaVersion: 1, product: 'xingmang-ai-manager', ...(version ? { version } : {}), files: offered.map(sourceEntry) },
    withdrawal
  }
}
