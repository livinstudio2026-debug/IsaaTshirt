// npm run seed          → upload images to Cloudinary, then upsert the catalogue into MongoDB by slug (safe to re-run)
// npm run seed:fresh    → same, but delete ALL products first
// npm run seed:new      → add ONLY products that are not in the database yet (uploads only their images; existing products are never touched)
// npm run seed:check    → validate the data only (no database / Cloudinary needed)
import { Product } from '../models/Product.js'
import { env } from '../config/env.js'
import { products } from './products.js'
import { attachImages, missingImages } from './images.js'

const flag = (f) => process.argv.includes(f)
const dry = flag('--dry'), fresh = flag('--fresh'), onlyNew = flag('--new')

const problems = []
for (const p of products) {
  try { await new Product(p).validate() } catch (err) { problems.push(...Object.values(err.errors).map((e) => `${p.slug}: ${e.message}`)) }
}
const dupes = products.map((p) => p.slug).filter((s, i, a) => a.indexOf(s) !== i)
if (dupes.length) problems.push(`duplicate slugs: ${dupes.join(', ')}`)
if (onlyNew && (fresh || dry)) problems.push('--new cannot be combined with --fresh or --dry')
if (!onlyNew) problems.push(...missingImages(products).map((f) => `missing image file: ${f}`)) // with --new only the products being added need an image (checked below)
if (!dry && !env.cloudinaryEnabled) problems.push('Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env')

if (problems.length) {
  console.error('Cannot seed:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Seed data OK (${products.length} products)`)
if (dry) process.exit(0)

const { connectDB, disconnectDB } = await import('../config/db.js')
try {
  await connectDB()
  let list = products
  if (onlyNew) {
    const have = new Set((await Product.find({ slug: { $in: products.map((p) => p.slug) } }, { slug: 1 }).lean()).map((d) => d.slug))
    list = products.filter((p) => !have.has(p.slug))
    console.log(`${have.size} already in the database (left untouched). Adding ${list.length}${list.length ? `: ${list.map((p) => p.slug).join(', ')}` : ''}`)
    const missing = missingImages(list)
    if (missing.length) throw new Error('missing image files:\n' + missing.map((f) => `  - ${f}`).join('\n'))
  }
  if (list.length) {
    console.log('Uploading images to Cloudinary…')
    const { uploadProductImage } = await import('../config/cloudinary.js')
    const docs = await attachImages(list, uploadProductImage)
    if (fresh) console.log(`Removed ${(await Product.deleteMany({})).deletedCount} existing products`)
    await Product.syncIndexes()
    const res = await Product.bulkWrite(docs.map((p) => ({ updateOne: { filter: { slug: p.slug }, update: onlyNew ? { $setOnInsert: p } : { $set: p }, upsert: true } })))
    console.log(`Inserted ${res.upsertedCount}, updated ${res.modifiedCount}`)
  }
} catch (err) {
  console.error('Seeding failed:', err.message)
  process.exitCode = 1
} finally {
  await disconnectDB()
}
