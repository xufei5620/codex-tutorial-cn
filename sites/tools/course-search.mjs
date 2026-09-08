// VitePress 1.6's default local-search splitter expects Markdown-generated
// heading permalinks. The imported HTML chapters intentionally retain their
// original headings, so index each complete chapter without changing its source.
const plain = (s) => String(s).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
export function courseSearchSections(file, html) {
  if (!/[/\\]learn[/\\]codex[/\\](?:ch\d{2}|prompts)\.md$/.test(file)) return undefined
  const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
  if (!title || !html) return []
  return [{anchor:'', titles:[title], text:plain(html)}]
}
