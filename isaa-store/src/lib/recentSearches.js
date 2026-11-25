// The last few things a shopper searched for, kept on this device so the search box can offer them again.
const KEY = 'isaa:recent-searches:v1'
const MAX = 5

export function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX) : []
  } catch {
    return []
  }
}
export function rememberSearch(term) {
  const t = term.trim().replace(/\s+/g, ' ')
  if (t.length < 2) return readRecent()
  const next = [t, ...readRecent().filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  return next
}
export function forgetSearches() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  return []
}
