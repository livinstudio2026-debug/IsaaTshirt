// npm run seed:descriptions         → write src/seed/descriptions.js into MongoDB (only the `description` field changes)
// npm run seed:descriptions:check   → validate the file only (no database needed)
// Matches products by slug. If an `id` is given for a slug it must match that product's _id, otherwise nothing is written.
import { allProducts as products } from './products.js'
import { descriptions } from './descriptions.js'

const dry = process.argv.includes('--dry')
const MAX = 2000
const problems = []

const known = new Set(products.map((p) => p.slug))
const seen = new Set()
for (const d of descriptions) {
  if (seen.has(d.slug)) problems.push(`duplicate slug: ${d.slug}`)
  seen.add(d.slug)
  if (!known.has(d.slug)) problems.push(`${d.slug}: not in src/seed/tees.js or products.js`)
  if (!d.description?.trim()) problems.push(`${d.slug}: empty description`)
  else if (d.description.length > MAX) problems.push(`${d.slug}: ${d.description.length} characters (max ${MAX})`)
  if (d.id && !/^[0-9a-f]{24}$/i.test(d.id)) problems.push(`${d.slug}: "${d.id}" is not a valid ObjectId`)
}
for (const slug of known) if (!seen.has(slug)) problems.push(`${slug}: no description yet`)

if (problems.length) {
  console.error('Cannot update:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Descriptions OK (${descriptions.length} products)`)
if (dry) {
  for (const d of descriptions) console.log(`  ${d.slug.padEnd(16)} ${d.description.split(/\s+/).length} words`)
  process.exit(0)
}

const { connectDB, disconnectDB } = await import('../config/db.js')
const { Product } = await import('../models/Product.js')
try {
  await connectDB()
  const docs = await Product.find({ slug: { $in: descriptions.map((d) => d.slug) } }, { slug: 1 }).lean()
  const idOf = new Map(docs.map((d) => [d.slug, String(d._id)]))
  const issues = []
  for (const d of descriptions) {
    if (!idOf.has(d.slug)) issues.push(`${d.slug}: not found in the database`)
    else if (d.id && d.id.toLowerCase() !== idOf.get(d.slug)) issues.push(`${d.slug}: id ${d.id} does not match the database (${idOf.get(d.slug)})`)
  }
  if (issues.length) {
    console.error('Nothing written:\n' + issues.map((p) => `  - ${p}`).join('\n'))
    process.exitCode = 1
  } else {
    const res = await Product.bulkWrite(descriptions.map((d) => ({ updateOne: { filter: { slug: d.slug }, update: { $set: { description: d.description.trim() } } } })))
    console.log(`Updated ${res.modifiedCount} of ${descriptions.length} (${descriptions.length - res.modifiedCount} already up to date)`)
  }
} catch (err) {
  console.error('Update failed:', err.message)
  process.exitCode = 1
} finally {
  await disconnectDB()
}
