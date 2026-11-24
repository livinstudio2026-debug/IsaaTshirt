// Production dry run for the Vercel -> Render setup. Run it from your laptop against the LIVE storefront address:
//
//   npm run check:deploy -- https://isaa.in
//   ADMIN_EMAIL=you@isaa.in ADMIN_PASSWORD='...' npm run check:deploy -- https://isaa.in     (adds the sign-in and proxy checks)
//
// It talks to the storefront's own domain, exactly like a browser does, so it exercises the Vercel rewrite and the Render server together.
// Nothing is changed on the shop: it only reads, and signs in once if you give it an owner account. Needs Node 22.
const base = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/+$/, '')
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: npm run check:deploy -- https://your-storefront-address')
  process.exit(2)
}
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
let failed = 0
let warned = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m, fix) => { failed += 1; console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ''}`) }
const warn = (m) => { warned += 1; console.log(`  ! ${m}`) }
const head = (t) => console.log(`\n${t}`)
const get = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init })
const json = async (res) => res.json().catch(() => ({}))

head(`Checking ${base}`)

head('1. The storefront reaches the API through the proxy')
let res
try { res = await get('/api/health') } catch (e) { bad(`Could not reach ${base}/api/health (${e.message})`, 'Is the site deployed, and does vercel.json forward /api to Render? See vercel.proxy.example.json.'); process.exit(1) }
const health = await json(res)
if (res.status === 200 && health.status === 'ok') ok('/api/health answers through the storefront address')
else bad(`/api/health answered ${res.status}${res.status === 200 ? ' but not as the API' : ''}`, res.headers.get('content-type')?.includes('html') ? 'You got the storefront page back: the /api rewrite is missing or comes after the catch-all in vercel.json.' : 'Check the Render service is running.')
if (health.db === 'connected') ok('database connected')
else bad(`database is "${health.db}"`, 'Check MONGODB_URI and the Atlas network access list on Render.')

head('2. The public shop is cached briefly, never for minutes')
res = await get('/api/products?limit=1')
const cc = res.headers.get('cache-control') ?? ''
if (res.status === 200) ok('/api/products answers')
else bad(`/api/products answered ${res.status}`)
if (/max-age=0/.test(cc) && /s-maxage=(\d+)/.test(cc) && Number(/s-maxage=(\d+)/.exec(cc)[1]) <= 30) ok(`Cache-Control: ${cc}`)
else bad(`Cache-Control is "${cc}"`, 'Expected max-age=0 and s-maxage of 30 or less, so hidden or sold-out products disappear within seconds.')
res = await get('/api/products/this-product-does-not-exist-xyz')
if (res.status === 404 && res.headers.get('cache-control') === 'no-store') ok('a 404 is never cached')
else bad(`unknown product: ${res.status}, Cache-Control "${res.headers.get('cache-control')}"`, 'Errors must be no-store.')

head('3. Cross-site writes are refused')
res = await get('/api/admin/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) })
if (res.status === 403) ok('a sign-in attempt from another website is blocked (403)')
else bad(`a cross-site sign-in got ${res.status}, expected 403`, 'CLIENT_ORIGIN on the server must be exactly your storefront address, e.g. https://isaa.in.')

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  head('4. Sign-in and the proxy count')
  warn('Skipped. Add ADMIN_EMAIL and ADMIN_PASSWORD (an owner account) to check the sign-in cookie and TRUST_PROXY.')
} else {
  head('4. Sign-in works through the proxy')
  res = await get('/api/admin/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) })
  const cookie = res.headers.getSetCookie?.().find((c) => c.startsWith('isaa_admin='))
  if (res.status !== 200 || !cookie) {
    bad(`sign-in answered ${res.status}${cookie ? '' : ' with no cookie'}`, res.status === 401 ? 'Wrong email or password for that account.' : res.status === 403 ? 'CLIENT_ORIGIN does not match the storefront address.' : 'Check the server logs on Render.')
  } else {
    ok('signed in')
    const attrs = cookie.toLowerCase()
    attrs.includes('httponly') ? ok('cookie is HttpOnly') : bad('cookie is not HttpOnly')
    base.startsWith('https') && !attrs.includes('secure') ? bad('cookie is not Secure on an https site', 'NODE_ENV must be production on the server.') : ok(base.startsWith('https') ? 'cookie is Secure' : 'cookie (http: Secure not expected)')
    attrs.includes('samesite=lax') ? ok('SameSite=Lax (same-site deploy)') : bad(`cookie says ${/samesite=\w+/.exec(attrs)?.[0] ?? 'no SameSite'}`, 'Use ADMIN_COOKIE_SAMESITE=lax with the Vercel proxy (storefront and API on one address).')
    const session = cookie.split(';')[0]

    head('5. The server sees the real visitor address (TRUST_PROXY)')
    const diag = await json(await get('/api/admin/diagnostics', { headers: { cookie: session } }))
    const d = diag.data
    if (!d) bad('diagnostics did not answer', 'The account must be an owner.')
    else {
      let mine = ''
      try { mine = (await (await fetch('https://api.ipify.org')).text()).trim() } catch { /* offline */ }
      console.log(`      server sees ip=${d.request.ip}  chain="${d.request.forwardedFor}"  socket=${d.request.socket}  TRUST_PROXY=${d.config.trustProxy}`)
      if (!mine) warn('Could not look up your public IP, so the address check was skipped.')
      else if (d.request.ip === mine || d.request.ip === `::ffff:${mine}`) ok(`the server sees your real address (${mine}): the rate limits count each visitor separately`)
      else bad(`the server sees ${d.request.ip}, but your address is ${mine}`, `Set TRUST_PROXY=${d.request.forwardedChain || 2} on Render (the chain has ${d.request.forwardedChain} address${d.request.forwardedChain === 1 ? '' : 'es'}). With Vercel in front of Render it is normally 2.`)
      if (d.request.secure) ok('requests arrive as HTTPS')
      else if (base.startsWith('https')) bad('the server thinks the request is plain HTTP', 'TRUST_PROXY must count the proxy that sets X-Forwarded-Proto, or the Secure cookie breaks.')
      d.warnings.forEach(warn)
      if (!d.warnings.length) ok('the server reports no configuration warnings')
    }
    await get('/api/admin/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie: session }, body: '{}' })
  }
}

console.log(`\n${failed ? `✗ ${failed} problem${failed === 1 ? '' : 's'} to fix` : '✓ All checks passed'}${warned ? `, ${warned} note${warned === 1 ? '' : 's'}` : ''}.`)
process.exit(failed ? 1 : 0)
