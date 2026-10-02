import { loadCatalogIndex, projectPublicIndex } from '../../downloads/catalog.mjs'

const PRODUCTS = Object.freeze({ 'xingmang.json': 'manager', 'chatgpt.json': 'chatgpt' })

function response(body, status, head = false, extraHeaders = {}) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
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
    try {
      const product = PRODUCTS[name]
      const value = await loadCatalogIndex(product, { fetchImpl, signal: request.signal, upstream: true })
      if (value === null) return response({ error: '安装包清单尚未发布' }, 404, head)
      return response(projectPublicIndex(product, value), 200, head)
    } catch {
      // Never reflect arbitrary upstream errors, URLs or request credentials.
      return response({ error: '安装包清单暂不可用，请稍后重试' }, 502, head)
    }
  }
}

export const onRequest = createHandler()
