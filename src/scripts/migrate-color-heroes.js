// One-off: give products saved before per-colour heroes their hero pictures.
//   npm run migrate:heroes -- --dry     shows what would change, writes nothing
//   npm run migrate:heroes              does it (safe to run twice: products already migrated are skipped)
//
// Before: images[0] = front shot, images[1] = back shot. Now: each colour has its own hero, and images = the shared pictures after it.
// For every product with a colour that has no hero yet, the old front shot becomes that colour's hero and leaves images[].
// A product with SEVERAL colours gets the same picture for all of them (that is what shoppers saw before): they are listed at the end,
// open each in the back office and give every other colour its own hero.
// The shop works without this script (it lends images[0] as the hero), so there is no rush: run it whenever it suits you.
import { argv, exit } from 'node:process'
import { connectDB, disconnectDB } from '../config/db.js'
import { Product } from '../models/Product.js'

const dry = argv.includes('--dry')
await connectDB()
try {
  const products = await Product.find({}).lean()
  let moved = 0, skipped = 0
  const needAttention = []
  for (const p of products) {
    const missing = (p.colors ?? []).some((c) => !c.hero?.url)
    if (!missing || !p.images?.length) { skipped++; continue }
    const [front, ...rest] = p.images
    const colors = p.colors.map((c) => (c.hero?.url ? c : { name: c.name, hex: c.hex, hero: { url: front.url, publicId: front.publicId ?? '', alt: front.alt || `${p.name} in ${c.name}` } }))
    if (colors.length > 1) needAttention.push(`${p.slug} (${colors.map((c) => c.name).join(', ')})`)
    console.log(`${dry ? '[dry] ' : ''}${p.slug}: front shot -> hero of ${colors.length} colour${colors.length > 1 ? 's' : ''}, ${rest.length} shared picture${rest.length === 1 ? '' : 's'} kept`)
    if (!dry) await Product.updateOne({ _id: p._id }, { $set: { colors, images: rest } })
    moved++
  }
  console.log(`\n${dry ? 'Would migrate' : 'Migrated'} ${moved} product${moved === 1 ? '' : 's'}; ${skipped} already fine.`)
  if (needAttention.length) console.log(`\nThese have more than one colour and now show the same hero for each: give every colour its own in the back office:\n  - ${needAttention.join('\n  - ')}`)
} finally {
  await disconnectDB()
}
