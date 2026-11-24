// Catalogue that `npm run seed` loads: the 5 hoodies, 5 bottoms and 3 accessories. (The 13 tees are already in the database: see ./tees.js.)
// Prices are in PAISE (89900 = ₹899). Prices, stock and descriptions are placeholders: edit, then run `npm run seed`.
// Images: seed-images/<slug>.webp is uploaded to Cloudinary by `npm run seed`; the url below is only a placeholder that the upload replaces.
import { descriptionBySlug } from './descriptions.js'
import { tees } from './tees.js'

const LETTER = ['S', 'M', 'L', 'XL'].map((size) => ({ size, stock: 20 }))
const WAIST = ['28', '30', '32', '34', '36'].map((size) => ({ size, stock: 15 }))
const FREE_SIZE = [{ size: 'FREE', stock: 30 }]

// Any non-tee piece. `name` is the full product name.
const item = (slug, name, category, color, hex, price, mrp, sizes, alt, extra = {}) => ({
  slug,
  name,
  description: descriptionBySlug[slug] ?? '',
  category,
  price,
  mrp,
  colors: [{ name: color, hex }],
  sizes,
  images: [{ url: `/products/${slug}.webp`, alt }],
  ...extra,
})

export const products = [
  // no home-page placements or flags yet (add heroOrder, isNewArrival + newArrivalOrder, etc. to promote one)
  item('los-angeles-hoodie', 'Los Angeles Oversized Hoodie', 'hoodies', 'Cream', '#e9dfcc', 179900, 259900, LETTER, 'Los Angeles oversized hoodie in cream'),
  item('break-rules-hoodie', 'Break Rules Oversized Hoodie', 'hoodies', 'Washed Black', '#2b2b2b', 189900, 279900, LETTER, 'Break Rules oversized hoodie in washed black'),
  item('orbit-club-hoodie', 'Orbit Club Oversized Hoodie', 'hoodies', 'Heather Grey', '#b8b8b8', 179900, 259900, LETTER, 'Orbit Club oversized hoodie in heather grey'),
  item('athletic-dept-hoodie', 'Athletic Dept. Oversized Hoodie', 'hoodies', 'Maroon', '#6b2230', 189900, 279900, LETTER, 'Athletic Dept. oversized hoodie in maroon'),
  item('wander-more-zip-hoodie', 'Wander More Zip Hoodie', 'hoodies', 'Brown', '#5a3b2c', 219900, 319900, LETTER, 'Wander More zip hoodie in brown'),

  item('compass-cargo-pants', 'Compass Cargo Pants', 'bottoms', 'Olive', '#55612a', 149900, 219900, LETTER, 'Compass cargo pants in olive'),
  item('night-shift-cargo-pants', 'Night Shift Cargo Pants', 'bottoms', 'Washed Black', '#2b2b2b', 159900, 229900, LETTER, 'Night Shift cargo pants in washed black'),
  item('streetline-baggy-jeans', 'Streetline Baggy Jeans', 'bottoms', 'Washed Blue', '#5d7ea3', 169900, 249900, WAIST, 'Streetline baggy jeans in washed blue'),
  item('daily-drift-sweatpants', 'Daily Drift Sweatpants', 'bottoms', 'Charcoal', '#4a4a4a', 129900, 189900, LETTER, 'Daily Drift sweatpants in charcoal'),
  item('dune-cargo-shorts', 'Dune Cargo Shorts', 'bottoms', 'Sand', '#cdbfa6', 99900, 149900, LETTER, 'Dune cargo shorts in sand'),

  item('midnight-star-cap', 'Midnight Star Cap', 'accessories', 'Washed Black', '#2b2b2b', 59900, 89900, FREE_SIZE, 'Midnight Star cap in washed black'),
  item('isaa-script-cap', 'Isaa Script Cap', 'accessories', 'Olive', '#55612a', 59900, 89900, FREE_SIZE, 'Isaa Script cap in olive'),
  item('court-wristband-set', 'Court Wristband Set', 'accessories', 'Black', '#1b1b1b', 39900, 59900, FREE_SIZE, 'Court wristband set in black'),
]

// tees + new pieces: the whole catalogue (used by the tests; `npm run seed` loads only `products` above)
export const allProducts = [...tees, ...products]
