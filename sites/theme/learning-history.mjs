import { safeLearningHref } from './learning-paths.mjs'

const maxLearningVisits = 30

function normalizeLearningVisits(value) {
  if (!Array.isArray(value)) return []
  const visits = []
  for (const item of value) {
    const href = safeLearningHref(item)
    if (href && href !== visits.at(-1)) visits.push(href)
  }
  return visits.slice(-maxLearningVisits)
}

export function parseLearningVisits(serialized) {
  if (typeof serialized !== 'string') return []
  try {
    return normalizeLearningVisits(JSON.parse(serialized))
  } catch {
    return []
  }
}

// This records the previous learning location, not the browser's back stack.
// Reopening an older page is a new visit; only consecutive duplicates collapse.
export function appendLearningVisit(value, locationHref) {
  const href = safeLearningHref(locationHref)
  if (!href) return { visits: [], previousHref: null }
  const visits = normalizeLearningVisits(value)
  if (visits.at(-1) !== href) visits.push(href)
  const recent = visits.slice(-maxLearningVisits)
  return { visits: recent, previousHref: recent.at(-2) || null }
}
