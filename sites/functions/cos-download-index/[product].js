import { loadCatalogIndex, projectPublicIndex, catalogFailureDiagnostics } from '../../downloads/catalog.mjs'

const PRODUCTS = Object.freeze({ 'xingmang.json': 'manager', 'chatgpt.json': 'chatgpt', 'claude.json': 'claude' })

function response(body, status, head = false, extraHeaders = {}) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  })
}

export function createHandler({ fetchImpl = fetch } = {}) {
  return async function handle({ request, params }) {
    const head = request.method === 'HEAD'
    if (request.method !== 'GET' && !head) return response({ error: '仅支持读取安装包清单' }, 405, false, { Allow: 'GET, HEAD' })
    const name = params?.product
    const url = new URL(request.url)
    if (typeof name !== 'string' || !Object.hasOwn(PRODUCTS, name)
      || url.pathname !== `/cos-download-index/${name}` || url.search) return response({ error: '安装包清单地址无效' }, 404, head)
    let fallback = { stage: 'init', code: 'request-signal' }
    try {
      const product = PRODUCTS[name]
      const signal = request.signal
      fallback = { stage: 'internal', code: 'unexpected' }
      const value = await loadCatalogIndex(product, { fetchImpl, signal, upstream: true })
      if (value === null) return response({ error: '安装包清单尚未发布' }, 404, head)
      fallback = { stage: 'schema', code: 'projection' }
      return response(projectPublicIndex(product, value), 200, head)
    } catch (error) {
      // Never reflect arbitrary upstream errors, URLs or request credentials.
      const diagnostic = catalogFailureDiagnostics(error, fallback)
      return response({ error: '安装包清单暂不可用，请稍后重试', ...diagnostic }, 502, head, {
        'X-Xingmang-Index-Stage': diagnostic.stage,
        'X-Xingmang-Index-Code': diagnostic.code,
        ...(diagnostic.upstreamStatus === undefined ? {} : { 'X-Xingmang-Upstream-Status': String(diagnostic.upstreamStatus) })
      })
    }
  }
}

export const onRequest = createHandler()
