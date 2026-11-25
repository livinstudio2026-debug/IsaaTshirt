// One-off: create the starter size charts and attach them to products that have no size guide yet.
//   npm run seed:sizecharts -- --dry     shows what would happen, writes nothing
//   npm run seed:sizecharts              does it (safe to run twice: charts that exist and products that already have a chart are left alone)
//
// The numbers below are TYPICAL garment measurements (cm) for an oversized cut, not your factory's. Before launch, open each chart in the
// back office (Products > Size charts) and replace them with the real measurements of your own pieces. A product that fits differently
// can switch on its own table on its edit screen.
import { argv, exit } from 'node:process'
import { connectDB, disconnectDB } from '../config/db.js'
import { Product } from '../models/Product.js'
import { SizeChart } from '../models/SizeChart.js'

const dry = argv.includes('--dry')
const NOTE = 'Garment measurements in cm, laid flat (chest is the full circumference). Allow 1–2 cm either way.'

const CHARTS = [
  { slug: 'oversized-tee', name: 'Oversized Tee', category: 't-shirts', note: NOTE, columns: ['Chest', 'Length', 'Shoulder', 'Sleeve'], rows: [
    { size: 'S', values: [112, 70, 50, 22] }, { size: 'M', values: [116, 72, 52, 23] }, { size: 'L', values: [120, 74, 54, 24] }, { size: 'XL', values: [124, 76, 56, 25] },
  ] },
  { slug: 'hoodie', name: 'Hoodie', category: 'hoodies', note: NOTE, columns: ['Chest', 'Length', 'Shoulder', 'Sleeve'], rows: [
    { size: 'S', values: [118, 66, 54, 59] }, { size: 'M', values: [122, 68, 56, 60] }, { size: 'L', values: [126, 70, 58, 61] }, { size: 'XL', values: [130, 72, 60, 62] },
  ] },
  { slug: 'bottoms', name: 'Bottoms', category: 'bottoms', note: 'Garment measurements in cm, laid flat (waist and hip are the full circumference). Sizes are waist in inches.', columns: ['Waist', 'Hip', 'Length'], rows: [
    { size: '28', values: [71, 104, 98] }, { size: '30', values: [76, 109, 100] }, { size: '32', values: [81, 114, 102] }, { size: '34', values: [86, 119, 104] }, { size: '36', values: [91, 124, 106] },
  ] },
]

await connectDB()
try {
  for (const c of CHARTS) {
    if (await SizeChart.exists({ slug: c.slug })) { console.log(`chart "${c.name}": already there, left alone`); continue }
    console.log(`${dry ? '[dry] ' : ''}chart "${c.name}": created (${c.rows.length} sizes)`)
    if (!dry) await SizeChart.create(c)
  }
  const byCategory = Object.fromEntries(CHARTS.map((c) => [c.category, c.slug]))
  let attached = 0
  for (const p of await Product.find({ $or: [{ sizeChart: '' }, { sizeChart: { $exists: false } }] }, 'slug category').lean()) {
    const chart = byCategory[p.category]
    if (!chart) continue
    console.log(`${dry ? '[dry] ' : ''}${p.slug}: ${chart}`)
    if (!dry) await Product.updateOne({ _id: p._id }, { $set: { sizeChart: chart } })
    attached++
  }
  console.log(`\n${dry ? 'Would attach' : 'Attached'} a chart to ${attached} product${attached === 1 ? '' : 's'}.`)
  console.log('These are typical numbers. Replace them with your own pieces\' real measurements (Products > Size charts) before launch.')
} finally {
  await disconnectDB()
}
exit(0)
