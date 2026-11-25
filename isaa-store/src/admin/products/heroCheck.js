export const HERO = {
  types: ['image/png', 'image/webp', 'image/jpeg'],
  maxBytes: 25 * 1024 * 1024,
  minWidth: 500,
  outW: 1200,
  outH: 1300,
  pad: 0.06,
  work: 1600,
  tol: 34,
}

export const HERO_TIPS = [
  'PNG, WebP or JPG, any shape. We centre it and fit it to the shop frame for you',
  'A transparent background looks best. A plain white or single-colour background is removed automatically',
  'The piece on its own, front view',
  '1200 px wide or more looks sharpest',
]

const dist = (r, g, b, c) => Math.hypot(r - c[0], g - c[1], b - c[2])

export function hasTransparency(data) {
  let n = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) n++
  return n / (data.length / 4) > 0.002
}

export function trimBox(data, w, h, thr = 24) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function removePlainBackground(data, w, h, tol = HERO.tol) {
  const at = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]] }
  const cs = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
  const bg = [0, 1, 2].map((k) => cs.reduce((s, c) => s + c[k], 0) / 4)
  if (cs.some((c) => dist(c[0], c[1], c[2], bg) > 40)) return null
  const near = (p) => dist(data[p * 4], data[p * 4 + 1], data[p * 4 + 2], bg) <= tol
  const gone = new Uint8Array(w * h)
  const stack = []
  const push = (p) => { if (!gone[p] && near(p)) { gone[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (y > 0) push(p - w)
    if (y < h - 1) push(p + w)
  }
  let removed = 0
  for (let p = 0; p < gone.length; p++) {
    if (gone[p]) { data[p * 4 + 3] = 0; removed++; continue }
    const x = p % w, y = (p - x) / w
    if ((x > 0 && gone[p - 1]) || (x < w - 1 && gone[p + 1]) || (y > 0 && gone[p - w]) || (y < h - 1 && gone[p + w])) {
      const d = dist(data[p * 4], data[p * 4 + 1], data[p * 4 + 2], bg)
      if (d < tol * 2.2) data[p * 4 + 3] = Math.round(255 * Math.min(1, (d - tol) / (tol * 1.2)))
    }
  }
  return { removed: removed / (w * h) }
}

export async function prepareHero(file) {
  if (!HERO.types.includes(file.type)) return { error: 'Use a PNG, WebP or JPG picture. Other formats (like HEIC) can’t be used here, so export it as a PNG first.' }
  if (file.size > HERO.maxBytes) return { error: 'That picture is over 25 MB. Export a smaller one.' }
  let bmp
  try { bmp = await createImageBitmap(file) } catch { return { error: 'We couldn’t read that picture. Export it again as a PNG or WebP.' } }
  if (bmp.width < HERO.minWidth) { const w = bmp.width; bmp.close?.(); return { error: `That picture is only ${w}px wide and would look blurry. Use one at least ${HERO.minWidth}px wide (1200px is ideal).` } }

  const k = Math.min(1, HERO.work / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
  const src = document.createElement('canvas')
  src.width = w; src.height = h
  const sctx = src.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const img = sctx.getImageData(0, 0, w, h)
  const notes = []

  if (!hasTransparency(img.data)) {
    const copy = new Uint8ClampedArray(img.data)
    const r = removePlainBackground(copy, w, h)
    const box = r && r.removed > 0.05 && r.removed < 0.93 ? trimBox(copy, w, h) : null
    if (box && box.w > w * 0.2 && box.h > h * 0.2) {
      img.data.set(copy)
      notes.push({ tone: 'info', text: 'We removed the plain background. Check it looks right on the card; if not, upload a transparent PNG.' })
    } else notes.push({ tone: 'warn', text: 'This picture has a background, so it may show as a box in the shop. A transparent PNG looks best.' })
  }

  const box = trimBox(img.data, w, h)
  if (!box) return { error: 'This picture looks empty. Export it again with the piece visible.' }
  sctx.putImageData(img, 0, 0)

  const out = document.createElement('canvas')
  out.width = HERO.outW; out.height = HERO.outH
  const octx = out.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  const scale = Math.min((HERO.outW * (1 - 2 * HERO.pad)) / box.w, (HERO.outH * (1 - 2 * HERO.pad)) / box.h)
  const dw = box.w * scale, dh = box.h * scale
  octx.drawImage(src, box.x, box.y, box.w, box.h, (HERO.outW - dw) / 2, (HERO.outH - dh) / 2, dw, dh)
  if (scale / k > 1.5) notes.push({ tone: 'warn', text: 'This picture is on the small side and may look a little soft. 1200px wide or more is sharper.' })

  const blob = await new Promise((res) => out.toBlob(res, 'image/webp', 0.92))
  const png = !blob || blob.type !== 'image/webp' ? await new Promise((res) => out.toBlob(res, 'image/png')) : null
  const final = png || blob
  if (!final) return { error: 'We couldn’t process that picture. Try another file.' }
  const base = file.name.replace(/\.[^.]+$/, '') || 'hero'
  return { file: new File([final], `${base}.${final.type === 'image/png' ? 'png' : 'webp'}`, { type: final.type }), notes }
}
