import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/isaa'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // proxies in front of the API (Render = 1; Vercel proxying to Render = 2). Render sets RENDER=true, so it defaults to 1 there.
  TRUST_PROXY: z.coerce.number().int().min(0).default(process.env.RENDER ? 1 : 0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CONTACT_TO: z.email().optional(),
  CONTACT_FROM: z.string().optional(),
  // store rules (rupees). Change them here or in .env: no code edit needed.
  FREE_SHIPPING_MIN_INR: z.coerce.number().min(0).default(1499),
  SHIPPING_FEE_INR: z.coerce.number().min(0).default(0), // charged below the free-shipping minimum
  COD_FEE_INR: z.coerce.number().min(0).default(0),
  LOW_STOCK_AT: z.coerce.number().int().min(0).default(5), // a size with this many pieces or fewer is flagged "low" in the back office
  // back-office sign-in cookie: 'lax' when the storefront and API share a site, 'none' when they don't (needs HTTPS)
  ADMIN_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
})

// treat `KEY=` (empty) in .env as "not set"
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''))
// `node --test` marks its child processes with NODE_TEST_CONTEXT: treat that as NODE_ENV=test (rate limits off, quiet logs)
if (process.env.NODE_TEST_CONTEXT && !raw.NODE_ENV) raw.NODE_ENV = 'test'
const parsed = schema.safeParse(raw)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  console.error(`Invalid environment configuration:\n${issues}`)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  clientOrigins: parsed.data.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  cloudinaryEnabled: Boolean(parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET),
  smtpEnabled: Boolean(parsed.data.SMTP_HOST && parsed.data.CONTACT_TO),
}
