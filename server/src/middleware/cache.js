// Public, CDN/browser-cacheable GET responses.
export const cache = (seconds) => (_req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`)
  next()
}
