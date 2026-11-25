import { dbState } from '../config/db.js'
import { env } from '../config/env.js'
import { store } from '../config/store.js'

// GET /api/admin/diagnostics  (owner): what this server believes about itself and about the request that reached it.
// It exists for the production dry run: behind Vercel -> Render, `ip` must be YOUR address (not Vercel's or Render's),
// or every visitor shares one rate-limit bucket. `npm run check:deploy` calls this and compares it with your real public IP.
export function getDiagnostics(req, res) {
  const forwarded = req.get('x-forwarded-for') ?? ''
  const chain = forwarded.split(',').map((s) => s.trim()).filter(Boolean)
  const warnings = []
  if (env.isProd && env.TRUST_PROXY === 0) warnings.push('TRUST_PROXY is 0: behind a proxy every visitor looks like the same IP, so the rate limits lock everyone out together. Set it to the number of proxies in front of this server.')
  if (env.isProd && !req.secure) warnings.push('This request did not arrive as HTTPS as far as the server can tell. The sign-in cookie is Secure in production, so sign-in only works if the proxy sets X-Forwarded-Proto: https and TRUST_PROXY counts it.')
  if (env.ADMIN_COOKIE_SAMESITE === 'none') warnings.push('ADMIN_COOKIE_SAMESITE=none: Safari and private windows block that cookie. Serve the storefront and the API from one site.')
  if (env.clientOrigins.some((o) => o.startsWith('http://localhost'))) warnings.push('CLIENT_ORIGIN still lists localhost.')
  if (!env.smtpEnabled) warnings.push('Email is not set up (SMTP_HOST and CONTACT_TO), so customers get no emails.')
  if (!env.cloudinaryEnabled) warnings.push('Cloudinary keys are missing, so product and reel uploads will not work.')
  res.json({
    data: {
      node: process.version,
      env: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      db: dbState(),
      request: {
        ip: req.ip, // what the rate limits see
        ips: req.ips, // the proxies that were trusted and skipped
        socket: req.socket.remoteAddress, // the machine that actually connected to us (the platform's load balancer)
        forwardedFor: forwarded,
        forwardedChain: chain.length, // how many proxies the chain implies: TRUST_PROXY should normally equal this
        protocol: req.protocol,
        secure: req.secure,
        host: req.get('host'),
      },
      config: {
        trustProxy: req.app.get('trust proxy'),
        cookie: { secure: env.isProd || env.ADMIN_COOKIE_SAMESITE === 'none', sameSite: env.ADMIN_COOKIE_SAMESITE, httpOnly: true },
        clientOrigins: env.clientOrigins,
        smtp: env.smtpEnabled,
        cloudinary: env.cloudinaryEnabled,
        onlinePayments: store.payments.online.enabled,
        lowStockAt: store.lowStockAt,
        freeShippingMin: store.freeShippingMin / 100,
        codFreeMin: store.codFreeMin / 100,
      },
      warnings,
    },
  })
}
