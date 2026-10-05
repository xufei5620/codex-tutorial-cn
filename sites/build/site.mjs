// Read and validate one site's settings (site.json). Each site must only point at its own
// domains, so a copy-paste mistake can never send readers to the other site.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { INDEX_ROUTES } from '../downloads/catalog.mjs'
import { https } from './util.mjs'

const require = createRequire(import.meta.url)
require('./vendor/qr-local.cjs')

export const SITES = ['sub2api', 'newapi']
const FOREIGN = { sub2api: { host: 'xm.solov.cc', docs: 'docs-new.solov.cc' }, newapi: { host: 'api.solov.cc', docs: 'docs-sub.solov.cc' } }

export function validateDownloadConfiguration(site) {
  if (site.download_page_url !== '/guide/manager#download-installers') throw Error('Download page must use the same-site installer selector')
  const indexes = site.download_indexes
  if (
    !indexes ||
    typeof indexes !== 'object' ||
    Array.isArray(indexes) ||
    Object.keys(indexes).length !== 3 ||
    Object.entries(INDEX_ROUTES).some(([product, route]) => !Object.hasOwn(indexes, product) || indexes[product] !== route)
  )
    throw Error('Download indexes must use the three fixed same-site routes')
}

// Every site must keep a reachable customer-service contact of its own.
function validateContact(contact, siteDirectory) {
  if (!contact || typeof contact !== 'object') throw Error('site.json 缺少 contact')
  https(contact.wecom_url, 'contact.wecom_url')
  if (!['auto', 'upload'].includes(contact.qr_mode)) throw Error('contact.qr_mode 只能是 auto 或 upload')
  if (contact.telegram_url) https(contact.telegram_url, 'contact.telegram_url')
  for (const key of ['wecom_qr', 'telegram_qr']) {
    const image = contact[key]
    if (key === 'wecom_qr' && contact.qr_mode !== 'upload') continue
    if (!image) {
      if (key === 'wecom_qr') throw Error('qr_mode 为 upload 时必须提供 contact.wecom_qr')
      continue
    }
    if (!/^\/img\/[\w./-]+$/.test(image) || image.includes('..') || !fs.existsSync(path.join(siteDirectory, 'public', image)))
      throw Error(`contact.${key} 必须是本站 public/img 下存在的图片：${image}`)
  }
}

export function loadSite(id, siteDirectory) {
  if (!SITES.includes(id)) throw Error('Choose sub2api or newapi')
  const site = JSON.parse(fs.readFileSync(path.join(siteDirectory, 'site.json'), 'utf8'))
  if (site.id !== id) throw Error('Site ID mismatch')
  for (const key of ['site_url', 'base_url', 'keys_url', 'models_url', 'console_url']) https(site[key], key)
  if (!/^[a-zA-Z0-9.-]+$/.test(site.domain)) throw Error('Invalid documentation hostname')
  for (const key of ['site_url', 'base_url', 'codex_base_url', 'openclaw_base_url', 'keys_url', 'models_url', 'console_url'])
    if (site[key] && new URL(site[key]).hostname === FOREIGN[id].host) throw Error('Cross-site URL: ' + key)
  if (site.domain === FOREIGN[id].docs) throw Error('Cross-site docs hostname')
  for (const key of ['name', 'title', 'description']) if (typeof site[key] !== 'string' || !site[key].trim()) throw Error('site.json 缺少 ' + key)
  validateContact(site.contact, siteDirectory)
  validateDownloadConfiguration(site)
  for (const item of Object.values(site.downloads || {})) {
    if (item.url) https(item.url, 'Download URL')
    if (item.notes_url) https(item.notes_url, 'Release notes URL')
    if (item.checksum && !/^[a-f0-9]{64}$/i.test(item.checksum)) throw Error('Invalid SHA-256')
  }
  return site
}

/** Values for the %%NAME%% placeholders in shared pages. */
export function templateVars(site) {
  const origin = new URL(site.base_url).origin
  const vars = {
    SITE_NAME: site.name,
    SITE_URL: site.site_url,
    BASE_URL: site.base_url,
    CODEX_BASE_URL: site.codex_base_url || site.base_url,
    OPENCLAW_BASE_URL: site.openclaw_base_url || origin + '/v1',
    KEYS_URL: site.keys_url,
    MODELS_URL: site.models_url,
    CONSOLE_URL: site.console_url,
    DOCS_URL: 'https://' + site.domain,
    KEY_WORD: site.key_word || 'API 密钥',
    HOURS: site.contact?.hours || '',
    DOWNLOAD_URL: site.download_page_url
  }
  https(vars.CODEX_BASE_URL, 'Codex base URL')
  https(vars.OPENCLAW_BASE_URL, 'OpenClaw base URL')
  return vars
}

export const WECOM_QR = 'img/contact/wecom-auto.svg'

/** Contact settings as published; the WeCom QR is generated unless the site uploads its own. */
export function publicContact(site) {
  const contact = { ...site.contact }
  if (contact.wecom_url && contact.qr_mode !== 'upload') contact.wecom_qr = '/' + WECOM_QR
  return contact
}

/** The subset of site.json the browser may see. Operator-only settings stay out. */
export function publicSite(site, vars, contact) {
  return {
    id: site.id,
    name: site.name,
    title: site.title,
    description: site.description,
    domain: site.domain,
    site_url: site.site_url,
    base_url: site.base_url,
    codex_base_url: vars.CODEX_BASE_URL,
    openclaw_base_url: vars.OPENCLAW_BASE_URL,
    contact,
    downloads: site.downloads || {},
    download_page_url: site.download_page_url,
    download_indexes: site.download_indexes
  }
}

export function qrSVG(value) {
  const modules = globalThis.XMQR.matrix(https(value, 'Customer support')),
    size = modules.length + 8
  let shape = ''
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) shape += `M${x + 4} ${y + 4}h1v1h-1z`
    })
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path fill="black" d="${shape}"/></svg>`
}

/** Cloudflare Pages headers and Functions routing for one site. */
export function pagesHeaders(site) {
  const parent = new URL(site.site_url).origin
  return (
    `/*\n  Content-Security-Policy: frame-ancestors 'self' ${parent}\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n\n` +
    Object.values(INDEX_ROUTES)
      .map((route) => route + '\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n')
      .join('\n')
  )
}

export function pagesRoutes() {
  return JSON.stringify({ version: 1, include: Object.values(INDEX_ROUTES), exclude: Object.values(INDEX_ROUTES) }, null, 2) + '\n'
}
