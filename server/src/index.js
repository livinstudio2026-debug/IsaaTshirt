import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'

try {
  await connectDB()
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  process.exit(1)
}

const server = createApp().listen(env.PORT, () => console.log(`Isaa API listening on :${env.PORT} (${env.NODE_ENV})`))

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`)
  server.close(async () => { await disconnectDB(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref() // don't hang on open connections
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
