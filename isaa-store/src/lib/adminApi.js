import { API_BASE } from './api'

// Back-office API client. The session lives in an httpOnly cookie that JavaScript can't read, so all we do is
// send `credentials: 'include'` and react to the status codes.
let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

// Server error -> Error with .status, .fields (field path -> message) and .network (true when the server couldn't be reached).
// `quiet` = don't treat a 401 as "your session ended" (used by sign-in and the start-up check, where 401 is a normal answer).
export async function adminRequest(path, { method = 'GET', body, signal, quiet = false, envelope = false } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { network: true })
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const details = json?.error?.details
    const fields = Array.isArray(details) ? Object.fromEntries(details.filter((d) => d.path && d.message).map((d) => [d.path, d.message])) : {}
    const message = res.status === 503 ? 'The server is having trouble right now. Please try again in a moment.' : json?.error?.message || 'Something went wrong. Please try again.'
    if (res.status === 401 && !quiet) onUnauthorized?.()
    throw Object.assign(new Error(message), { status: res.status, fields, details })
  }
  return envelope ? json : json.data
}

export const adminMe = (signal) => adminRequest('/auth/me', { signal, quiet: true })
export const adminLogin = ({ email, password, remember }) => adminRequest('/auth/login', { method: 'POST', body: { email, password, remember: Boolean(remember) }, quiet: true })
export const adminLogout = () => adminRequest('/auth/logout', { method: 'POST', quiet: true })

// ---------------------------------------------------------------- orders
// The API sends money in paise; the back office works in rupees.
const rupees = (p) => p / 100
const toRow = (o) => ({ ...o, total: rupees(o.total) })
const toOrder = (o) => ({
  ...o,
  items: o.items.map((i) => ({ ...i, price: rupees(i.price), mrp: rupees(i.mrp) })),
  totals: { subtotal: rupees(o.totals.subtotal), shipping: rupees(o.totals.shipping), codFee: rupees(o.totals.codFee), total: rupees(o.totals.total) },
})

// The list endpoint answers { data, meta, counts }; adminRequest only returns `data`, so this one reads the envelope itself.
export async function listOrders({ status = 'all', q = '', page = 1, limit = 20 } = {}, signal) {
  const qs = new URLSearchParams({ status, page, limit })
  if (q.trim()) qs.set('q', q.trim())
  const out = await adminRequest(`/orders?${qs}`, { signal, envelope: true })
  return { items: out.data.map(toRow), meta: out.meta, counts: out.counts }
}
export const getOrder = async (number, signal) => toOrder(await adminRequest(`/orders/${encodeURIComponent(number)}`, { signal }))
const act = async (number, action, body) => toOrder(await adminRequest(`/orders/${encodeURIComponent(number)}/${action}`, { method: 'POST', body }))
export const setOrderStatus = (number, status, extra = {}) => act(number, 'status', { status, ...extra })
export const cancelOrder = (number, reason) => act(number, 'cancel', reason ? { reason } : {})
export const markOrderPaid = (number) => act(number, 'mark-paid')
export const addOrderNote = (number, note) => act(number, 'note', { note })
// Re-send one of the status emails (kind: shipped | delivered | cancelled) when it didn't go out the first time.
export const resendOrderEmail = (number, kind) => act(number, 'resend-email', { kind })

// ---------------------------------------------------------------- products
// Same rule: paise on the wire, rupees in the screens.
const toProduct = (p) => ({ ...p, price: rupees(p.price), mrp: rupees(p.mrp) })
export const toPaise = (rupeeValue) => Math.round(Number(rupeeValue) * 100)
const toProductBody = ({ price, mrp, ...rest }) => ({ ...rest, ...(price !== undefined ? { price: toPaise(price) } : {}), ...(mrp !== undefined ? { mrp: toPaise(mrp) } : {}) })

export async function listProducts({ q = '', category = '', status = 'all', placement = '', sort = 'newest', page = 1, limit = 20 } = {}, signal) {
  const qs = new URLSearchParams({ status, sort, page, limit })
  if (q.trim()) qs.set('q', q.trim())
  if (category) qs.set('category', category)
  if (placement) qs.set('placement', placement)
  const out = await adminRequest(`/products?${qs}`, { signal, envelope: true })
  return { items: out.data.map(toProduct), meta: out.meta, counts: out.counts }
}

// Every product, name order (the catalogue is small; used by the home-page order screen to offer products to add).
export async function listAllProducts(signal) {
  const items = []
  for (let page = 1; page <= 10; page++) {
    const d = await listProducts({ sort: 'name', page, limit: 50 }, signal)
    items.push(...d.items)
    if (page >= d.meta.pages) break
  }
  return items
}

const slugPath = (slug) => `/products/${encodeURIComponent(slug)}`
export const getProduct = async (slug, signal) => toProduct(await adminRequest(slugPath(slug), { signal }))
export const createProduct = async (form) => toProduct(await adminRequest('/products', { method: 'POST', body: toProductBody(form) }))
export const updateProduct = async (slug, form) => toProduct(await adminRequest(slugPath(slug), { method: 'PATCH', body: toProductBody(form) }))
// Who changed what on one product (price, stock, pictures, visibility, home-page rails), newest first.
export async function getProductHistory(slug, { page = 1, limit = 15 } = {}, signal) {
  const out = await adminRequest(`${slugPath(slug)}/history?page=${page}&limit=${limit}`, { signal, envelope: true })
  return { items: out.data, meta: out.meta }
}
export const deleteProduct = (slug) => adminRequest(slugPath(slug), { method: 'DELETE' })
export const setProductVisibility = async (slug, isActive) => toProduct(await adminRequest(`${slugPath(slug)}/visibility`, { method: 'POST', body: { isActive } }))

// One size's stock. `from` is what the screen showed: if an order changed it meanwhile the server says 409 and the error carries `.current`, the fresh product.
export async function setProductStock(slug, size, from, to) {
  try {
    return toProduct(await adminRequest(`${slugPath(slug)}/stock`, { method: 'POST', body: { size, from, to } }))
  } catch (err) {
    if (err.status === 409 && err.details?.current) err.current = toProduct(err.details.current)
    throw err
  }
}

// The four home-page rails, each as an ordered list.
export const getPlacements = async (signal) => { const out = await adminRequest('/placements', { signal, envelope: true }); return { rails: out.data, homeShows: out.meta.homeShows } }
export const savePlacement = async (name, slugs) => { const out = await adminRequest(`/placements/${name}`, { method: 'POST', body: { slugs }, envelope: true }); return out.data }

// Files go from the browser straight to Cloudinary with a one-time signature from our server, so they never pass through the API.
// kind: 'product' (default) | 'reel-poster' | 'reel-video'. Resolves { url, publicId }.
export async function uploadToCloudinary(file, { kind = 'product', slug, onProgress, signal } = {}) {
  const { url, fields } = await adminRequest('/uploads/sign', { method: 'POST', body: { kind, ...(slug ? { slug } : {}) } })
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
    xhr.onload = () => {
      let json = {}
      try { json = JSON.parse(xhr.responseText) } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.secure_url) resolve({ url: json.secure_url, publicId: json.public_id })
      else reject(new Error(json?.error?.message || 'The image couldn’t be uploaded. Check the file and try again.'))
    }
    xhr.onerror = () => reject(Object.assign(new Error('Could not reach the image service. Check your connection and try again.'), { network: true }))
    signal?.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')) })
    xhr.send(form)
  })
}

export const uploadProductImage = (file, opts = {}) => uploadToCloudinary(file, { ...opts, kind: 'product' })

// ---------------------------------------------------------------- reels
// The Instagram wall. Lists answer { data, meta }; the server does the ordering, so the screens just show what they get.
export async function listReels(signal) {
  const out = await adminRequest('/reels', { signal, envelope: true })
  return { items: out.data, meta: out.meta }
}
export const createReel = (body) => adminRequest('/reels', { method: 'POST', body })
export const updateReel = (id, body) => adminRequest(`/reels/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const setReelVisibility = (id, isActive) => adminRequest(`/reels/${encodeURIComponent(id)}/visibility`, { method: 'POST', body: { isActive } })
export const deleteReel = (id) => adminRequest(`/reels/${encodeURIComponent(id)}`, { method: 'DELETE' })
export async function saveReelOrder(ids) {
  const out = await adminRequest('/reels/order', { method: 'POST', body: { ids }, envelope: true })
  return { items: out.data, meta: out.meta }
}

// ---------------------------------------------------------------- inbox
// Contact messages and newsletter sign-ups. Lists answer { data, meta, counts }, so they read the envelope.
export async function listMessages({ status = 'new', q = '', page = 1, limit = 20 } = {}, signal) {
  const qs = new URLSearchParams({ status, page, limit })
  if (q.trim()) qs.set('q', q.trim())
  const out = await adminRequest(`/messages?${qs}`, { signal, envelope: true })
  return { items: out.data, meta: out.meta, counts: out.counts }
}
export const setMessageStatus = (id, status) => adminRequest(`/messages/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } })
export const deleteMessage = (id) => adminRequest(`/messages/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const getInboxUnread = async (signal) => (await adminRequest('/inbox/unread', { signal })).unread

export async function listSubscribers({ q = '', page = 1, limit = 25 } = {}, signal) {
  const qs = new URLSearchParams({ page, limit })
  if (q.trim()) qs.set('q', q.trim())
  const out = await adminRequest(`/subscribers?${qs}`, { signal, envelope: true })
  return { items: out.data, meta: out.meta, counts: out.counts }
}

// The subscriber list as a file. It isn't JSON, so this skips adminRequest: fetch with the cookie, then hand the browser a download.
export async function downloadSubscribersCsv() {
  let res
  try {
    res = await fetch(`${API_BASE}/api/admin/subscribers/export`, { credentials: 'include', cache: 'no-store' })
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { network: true })
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) onUnauthorized?.()
    throw Object.assign(new Error(json?.error?.message || 'The download failed. Please try again.'), { status: res.status })
  }
  const blob = await res.blob()
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'isaa-subscribers.csv'
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return name
}

// ---------------------------------------------------------------- dashboard
// One request for the whole Overview screen. Money arrives in paise and leaves in rupees, like everything else here.
export async function getDashboard(signal) {
  const d = await adminRequest('/dashboard', { signal })
  const win = (w) => ({ ...w, revenue: rupees(w.revenue), avgOrder: rupees(w.avgOrder), prev: { ...w.prev, revenue: rupees(w.prev.revenue) } })
  return {
    ...d,
    sales: {
      today: win(d.sales.today),
      week: win(d.sales.week),
      month: win(d.sales.month),
      series: d.sales.series.map((day) => ({ ...day, revenue: rupees(day.revenue) })),
    },
    actions: { ...d.actions, codToCollect: { ...d.actions.codToCollect, amount: rupees(d.actions.codToCollect.amount) } },
    queue: d.queue.map(toRow),
  }
}

// ---------------------------------------------------------------- team and account
// Owner only: the people with back-office access.
export const listTeam = (signal) => adminRequest('/team', { signal })
export const addTeamMember = (body) => adminRequest('/team', { method: 'POST', body })
export const updateTeamMember = (id, body) => adminRequest(`/team/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const setTeamPassword = (id, password) => adminRequest(`/team/${encodeURIComponent(id)}/password`, { method: 'POST', body: { password } })
export const unlockTeamMember = (id) => adminRequest(`/team/${encodeURIComponent(id)}/unlock`, { method: 'POST' })
// Anyone, for themselves. Resolves { signedOutElsewhere }; a wrong current password rejects with .fields.currentPassword.
export const changeOwnPassword = (currentPassword, newPassword) => adminRequest('/account/password', { method: 'POST', body: { currentPassword, newPassword } })
