// Search text and screenshot slots for the ordinary Markdown pages.
import { plain } from './util.mjs'

export function searchableMarkdown(value) {
  // Search is reader-facing content. Raw SFC blocks also break inline site-data scripts.
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, '')
    .replace(/<\/script/gi, '&lt;/script')
}

const markdownPlain = (value) =>
  plain(
    String(value ?? '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|`)/g, '')
  )

/** Every numbered step in a page gets a screenshot slot with an ID derived from its position. */
export function addDocumentShots(text, { rel, route, title }, manifest) {
  let section = 0,
    step = 0,
    fence = null,
    last = null
  for (const line of text.split(/\r?\n/)) {
    let codeLine = !!fence
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null
    } else {
      const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
      if (open && (open[1][0] === '~' || !open[2].includes('`'))) {
        fence = open[1]
        codeLine = true
      }
    }
    // Keep legacy counters, including code examples, so existing real-step backup IDs do not shift.
    if (/^##\s/.test(line)) {
      section++
      step = 0
    }
    if (/^#{2,6}\s/.test(line)) last = null
    // A step already followed by a real image in the page needs no extra empty slot.
    if (!codeLine && last && /!\[[^\]]*\]\(|<img\b/i.test(line)) {
      last.capturePolicy = 'none'
      last.optional = true
    }
    if (/^\d+[.)]\s+/.test(line)) {
      step++
      if (codeLine) continue
      const label = markdownPlain(line.replace(/^\d+[.)]\s+/, ''))
      manifest.push(
        (last = {
          id:
            'doc-' +
            rel.replace(/\.md$/, '').replaceAll('/', '-') +
            '-s' +
            String(section || 1).padStart(2, '0') +
            '-step' +
            String(step).padStart(2, '0'),
          route,
          group: title,
          section: label,
          title: label.slice(0, 90),
          target: label,
          highlight: '只拍本页真实操作。',
          optional: false,
          capturePolicy: 'required',
          siteOnly: true
        })
      )
    }
  }
}

// Pages rendered by studio components carry no Markdown of their own.
const STUDIO_PAGES = ['skills.md', 'screenshots.md', 'tools.md']
const NO_SLOTS = ['errors.md', 'faq.md', 'contact.md']

/** Collects search entries for every Markdown page and screenshot slots for step-by-step pages. */
export function collectDocs(pages, manifest) {
  const docs = []
  for (const [rel, text] of pages) {
    const route = '/' + rel.replace(/index\.md$/, '').replace(/\.md$/, '')
    if (rel.startsWith('learn/codex/') || STUDIO_PAGES.includes(rel)) continue
    const title = text.match(/^#\s+(.+)$/m)?.[1] || rel
    const markdown = searchableMarkdown(text)
    docs.push({ route, title, text: plain(markdown).slice(0, 22000), markdown })
    if (NO_SLOTS.includes(rel)) continue
    addDocumentShots(text, { rel, route, title }, manifest)
  }
  return docs
}
