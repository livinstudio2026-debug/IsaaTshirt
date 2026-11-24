import { env } from '../config/env.js'

// How the public catalogue (products, one product, reels) is cached. Goal: a shopper never sees a product you hid, a size that sold out,
// or a price you changed, for longer than a few seconds, while the database isn't asked the same question on every page view.
//
//   Browsers:  max-age=0 + ETag. They keep a copy but ask "has it changed?" every time; the answer is a tiny 304 when it hasn't.
//   CDN / Vercel proxy: s-maxage=EDGE_SECONDS. This is the longest anything outside this server can be out of date (we can't purge it).
//   This server: an in-memory copy for MEMORY_SECONDS that is thrown away the moment the back office (or checkout) writes anything.
//     With one server that makes changes instant; with several servers each one's copy is at most MEMORY_SECONDS old.

export const EDGE_SECONDS = 10
export const MEMORY_SECONDS = 20
const MAX_ENTRIES = 500

export const cache = (seconds = EDGE_SECONDS) => (_req, res, next) => {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, must-revalidate`)
  next()
}

const copies = new Map() // url -> { body, gen, expires }
let generation = 0
let enabled = env.NODE_ENV !== 'test' // tests turn it on only where they test it
export const setMemoryCache = (on) => { enabled = on; purgeCatalog() }

// Forget everything. `generation` also stops a read that was already running when the write happened from saving its (old) answer afterwards.
export function purgeCatalog() {
  generation += 1
  copies.clear()
}

export const memoryCache = (seconds = MEMORY_SECONDS) => (req, res, next) => {
  if (!enabled) return next()
  const key = req.originalUrl
  const hit = copies.get(key)
  if (hit && hit.gen === generation && hit.expires > Date.now()) {
    res.set('X-Cache', 'HIT')
    return res.type('json').send(hit.body) // send() answers 304 itself when the browser's ETag still matches
  }
  const startedAt = generation
  res.json = (obj) => {
    const body = JSON.stringify(obj)
    if (res.statusCode === 200 && startedAt === generation) {
      if (copies.size >= MAX_ENTRIES) copies.clear()
      copies.set(key, { body, gen: startedAt, expires: Date.now() + seconds * 1000 })
    }
    res.set('X-Cache', 'MISS')
    return res.type('json').send(body)
  }
  next()
}

// Anything that changes what the shop shows (products, stock, placements, reels, orders taking or returning stock) purges the copies.
// Runs when the response is finished, for every write that didn't fail validation: a half-done 500 must not leave old data cached either.
export const purgeOnWrite = (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path !== '/track') { // an order look-up changes nothing
    res.on('finish', () => { if (res.statusCode < 400 || res.statusCode >= 500) purgeCatalog() })
  }
  next()
}
