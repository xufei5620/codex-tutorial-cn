/** Pure presentation rules shared by screenshot UI and tests. */
export function slotVisibility({editing=false, hidden=false, imageCount=0, capturePolicy='optional', showOptional=false, hideMissing=false, active=false}={}) {
  const hasImage = imageCount > 0
  if (capturePolicy === 'published') return editing || !hidden
  // “无需截图” is explanatory content only until a legacy image exists.
  if (capturePolicy === 'none' && !hasImage && !hidden) return false
  if (editing) {
    if (hidden || hasImage || capturePolicy === 'required') return true
    return capturePolicy === 'optional' && (showOptional || active)
  }
  if (hidden) return false
  return hasImage || !hideMissing
}

export function catalogHref(spec, record={}) {
  const hasImage = (record.images?.length || 0) > 0
  if (spec.capturePolicy === 'none' && !hasImage && !record.hidden) {
    const section = spec.id.match(/^ch\d+-s(\d+)/)?.[1]
    return `${spec.route}?info=1#${section ? `s${Number(section)}` : 'top'}`
  }
  return `${spec.route}?edit=1${spec.capturePolicy === 'optional' ? '&showOptional=1' : ''}#shot-${spec.id}`
}

export function chapterRecommendation(manifest, records, route, isCatalog=false) {
  const all = manifest.filter(s => s.capturePolicy === 'required')
  const chapter = all.filter(s => s.route === route)
  const list = chapter.length || !isCatalog ? chapter : all
  return { list, label: chapter.length ? '本章建议截图' : (isCatalog ? '全站建议截图' : '本章暂无建议截图') }
}
