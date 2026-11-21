import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'

try {
  await connectDB()
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  process.exit(1)
}

// Production misconfigurations that don't stop the server but quietly break things.
if (env.isProd) {
  if (env.TRUST_PROXY === 0) console.warn('⚠ TRUST_PROXY=0 in production: behind Render/Railway/Nginx every visitor looks like the same IP, so one person can lock everyone out of the rate limits. Set TRUST_PROXY=1.')
  if (env.ADMIN_COOKIE_SAMESITE === 'none') console.warn('⚠ ADMIN_COOKIE_SAMESITE=none: back-office sign-in will fail in Safari and private windows. Serve the storefront and API from one site (see README: "Same-site deploy").')
  if (env.clientOrigins.some((o) => o.startsWith('http://localhost'))) console.warn('⚠ CLIENT_ORIGIN still lists localhost.')
}

const server = createApp().listen(env.PORT, () => console.log(`Isaa API listening on :${env.PORT} (${env.NODE_ENV})`))

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => { await disconnectDB(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref() // don't hang on open connections
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
