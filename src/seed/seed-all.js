// npm run seed:all          → restore the WHOLE catalogue (13 tees + 5 hoodies + 5 bottoms + 3 accessories) into an empty or partly filled products collection
// npm run seed:all:check    → validate the data only (no database / Cloudinary needed)
//
// Safe to re-run: products already in the database (matched by slug) are NEVER touched, only the missing ones are added.
// Pictures: for each product it first looks for the picture already in Cloudinary (isaa/products/<slug>) and reuses it, so nothing is
// re-uploaded. Only if that is not there does it upload seed-images/<slug>.webp. Add --reupload to force-upload from seed-images/ instead.
// Each product is saved the current way: its picture is the HERO of its colour (colors[].hero), so `migrate:heroes` is not needed.
// Prices are in PAISE (89900 = ₹899).
import { existsSync } from 'node:fs'
import { Product } from '../models/Product.js'
import { env } from '../config/env.js'
import { allProducts } from './products.js'
import { descriptions } from './descriptions.js'
import { imageFile } from './images.js'

const dry = process.argv.includes('--dry')
const reupload = process.argv.includes('--reupload')

// The handwritten line under each product's name on its page (max 40 characters). It is set in a one-line script font, so keep it
// short: about 22 characters fits a phone screen. A product without one shows its category's default ("Pick your fit", "Wrap up in it"...).
const taglines = {
  // tees
  'break-rules': 'Rules were made to break',
  'compass': 'Wrong turns, right places',
  'built-different': 'Not like the others',
  'good-times': 'Good vibes, on repeat',
  'est-2025': 'Where the story begins',
  'new-york': 'Loud walls, bright lights',
  'los-angeles': 'Chasing golden hour',
  'racing': 'Full throttle, no brakes',
  'athletic-dept': 'Game day, every day',
  'dream-bigger': 'Aim higher, go louder',
  'orbit-club': 'Stay in orbit',
  'coastal-society': 'Sun, salt, city lights',
  'wander-more': 'Wander often, pack light',
  // hoodies
  'los-angeles-hoodie': 'Cosy in the city of angels',
  'break-rules-hoodie': 'Break rules, stay warm',
  'orbit-club-hoodie': 'Calm, cosy, quietly cool',
  'athletic-dept-hoodie': 'Varsity, but make it cosy',
  'wander-more-zip-hoodie': 'Zip up, head out',
  // bottoms
  'compass-cargo-pants': 'Pockets for every journey',
  'night-shift-cargo-pants': 'Move after midnight',
  'streetline-baggy-jeans': 'Baggy never looked this good',
  'daily-drift-sweatpants': 'Drift through your day',
  'dune-cargo-shorts': 'Warm days, easy moves',
  // accessories
  'midnight-star-cap': 'Wish upon a star',
  'isaa-script-cap': 'Signed, sealed, Isaa',
  'court-wristband-set': 'Game face on',
}

// Where a product's picture lives in Cloudinary (same id the old seed used).
const publicIdOf = (slug) => `isaa/products/${slug}`

// The old MongoDB _id of a product, where descriptions.js knows it. Keeping it means `npm run seed:descriptions`
// (which checks slug and id belong together) keeps working, and old change-log rows still point at the right product.
const idBySlug = new Map(descriptions.filter((d) => d.id).map((d) => [d.slug, d.id]))

const catalogue = allProducts.map((p) => ({ ...p, tagline: taglines[p.slug] ?? '' }))

// ---- validate (no network) ----------------------------------------------------------------------------------
const problems = []
for (const p of catalogue) {
  try { await new Product(p).validate() } catch (err) { problems.push(...Object.values(err.errors).map((e) => `${p.slug}: ${e.message}`)) }
  if (!p.tagline) problems.push(`${p.slug}: no tagline`)
  if (p.tagline.length > 40) problems.push(`${p.slug}: tagline is ${p.tagline.length} characters (max 40)`)
}
for (const slug of Object.keys(taglines)) if (!catalogue.some((p) => p.slug === slug)) problems.push(`tagline for unknown product: ${slug}`)
const dupes = catalogue.map((p) => p.slug).filter((s, i, a) => a.indexOf(s) !== i)
if (dupes.length) problems.push(`duplicate slugs: ${dupes.join(', ')}`)
if (!dry && !env.cloudinaryEnabled) problems.push('Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env')

if (problems.length) {
  console.error('Cannot seed:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Seed data OK (${catalogue.length} products, every one with a tagline)`)
if (dry) process.exit(0)

// ---- seed -------------------------------------------------------------------------------------------------------
const { connectDB, disconnectDB } = await import('../config/db.js')
const { uploadProductImage } = await import('../config/cloudinary.js')
const { v2: cloudinary } = await import('cloudinary')

// { url, publicId } for a product's picture: the one already in Cloudinary, else a fresh upload of seed-images/<slug>.webp.
async function pictureFor(slug) {
  if (!reupload) {
    try {
      const res = await cloudinary.api.resource(publicIdOf(slug), { resource_type: 'image' })
      console.log(`  reused    ${slug}`)
      return { url: res.secure_url, publicId: res.public_id }
    } catch (err) {
      if (err?.error?.http_code !== 404) throw err // a real failure (bad keys, network): stop instead of re-uploading blindly
    }
  }
  if (!existsSync(imageFile(slug))) throw new Error(`no picture for ${slug}: not in Cloudinary as ${publicIdOf(slug)} and no file at ${imageFile(slug)}`)
  const up = await uploadProductImage(imageFile(slug), slug)
  console.log(`  uploaded  ${slug}`)
  return up
}

try {
  await connectDB()
  await Product.syncIndexes() // dropping the collection also dropped its indexes (the unique slug one included): rebuild them first

  const have = new Set((await Product.find({ slug: { $in: catalogue.map((p) => p.slug) } }, { slug: 1 }).lean()).map((d) => d.slug))
  const todo = catalogue.filter((p) => !have.has(p.slug))
  console.log(`${have.size} already in the database (left untouched). Adding ${todo.length}${todo.length ? `: ${todo.map((p) => p.slug).join(', ')}` : ''}`)
  if (!todo.length) process.exit(0)

  // pictures first: if any is missing nothing is written, so there are never half-built products
  const pics = new Map()
  for (const p of todo) pics.set(p.slug, await pictureFor(p.slug))

  // `createdAt` is staggered one second apart in catalogue order (tees first), so "Newest first" in the shop is stable
  const now = Date.now()
  const docs = todo.map((p, i) => {
    const pic = pics.get(p.slug)
    const { images, ...rest } = p
    const front = images?.[0]
    return {
      ...rest,
      ...(idBySlug.has(p.slug) ? { _id: idBySlug.get(p.slug) } : {}),
      colors: p.colors.map((c) => ({ ...c, hero: { url: pic.url, publicId: pic.publicId, alt: front?.alt || `${p.name} in ${c.name}` } })),
      images: [], // the hero is the front shot; back shot and detail pictures can be added later in the back office
      createdAt: new Date(now - (todo.length - i) * 1000),
    }
  })
  const res = await Product.insertMany(docs, { ordered: false })
  console.log(`Inserted ${res.length} product${res.length === 1 ? '' : 's'}`)
} catch (err) {
  console.error('Seeding failed:', err.writeErrors ? err.writeErrors.map((e) => e.errmsg ?? e.message).join('; ') : err.message)
  process.exitCode = 1
} finally {
  await disconnectDB()
}
