// The 13 launch tees. They are ALREADY IN THE DATABASE, so `npm run seed` does not touch them (it only seeds ./products.js).
// Kept here as the source of truth for their placements and prices, and so the tests can check the home-page rails.
// Prices are in PAISE (89900 = ₹899).
import { descriptionBySlug } from './descriptions.js'

const SIZES = ['S', 'M', 'L', 'XL'].map((size) => ({ size, stock: 20 }))
const DESC = 'Oversized, garment-washed cotton tee with a screen-printed graphic. Drop shoulders, boxy fit.'

const tee = (slug, name, color, hex, price, mrp, extra = {}) => ({
  slug,
  name: `${name} Oversized Tee`,
  description: descriptionBySlug[slug] ?? DESC,
  category: 't-shirts',
  price,
  mrp,
  colors: [{ name: color, hex }],
  sizes: SIZES,
  images: [{ url: `/products/${slug}.webp`, alt: `${name} oversized t-shirt in ${color.toLowerCase()}` }],
  ...extra,
})

export const tees = [
  // hero carousel (heroOrder)
  tee('break-rules', 'Break Rules', 'Black', '#1b1b1b', 89900, 129900, { heroOrder: 1, isBestSeller: true, bestSellerOrder: 1 }),
  tee('compass', 'Compass', 'Olive', '#55612a', 84900, 119900, { heroOrder: 2, isNewArrival: true, newArrivalOrder: 4 }),
  tee('built-different', 'Built Different', 'Cream', '#e9dfcc', 79900, 109900, { heroOrder: 3 }),
  tee('good-times', 'Good Times', 'Bone', '#e4dccb', 89900, 129900, { heroOrder: 4, isBestSeller: true, bestSellerOrder: 6 }),
  tee('est-2025', 'Isaa Est. 2025', 'Brown', '#4a2f24', 79900, 119900, { heroOrder: 5, isNewArrival: true, newArrivalOrder: 5 }),
  // featured drop rail (featuredOrder). bestSellerOrder / newArrivalOrder place a tee on the Best Sellers / New Arrivals shelf (the shelf shows the first 5).
  tee('new-york', 'New York Graffiti', 'Washed Black', '#2b2b2b', 89900, 129900, { featuredOrder: 1, isLimited: true, isBestSeller: true, bestSellerOrder: 2 }),
  tee('los-angeles', 'Los Angeles', 'Sand', '#cdbfa6', 79900, 119900, { featuredOrder: 2 }),
  tee('racing', 'Racing Championship', 'Olive', '#5a6330', 84900, 124900, { featuredOrder: 3, isBestSeller: true, bestSellerOrder: 3 }),
  tee('athletic-dept', 'Athletic Dept.', 'Maroon', '#6b2230', 79900, 119900, { featuredOrder: 4, isBestSeller: true, bestSellerOrder: 5 }),
  tee('dream-bigger', 'Dream Bigger', 'Washed Black', '#2b2b2b', 89900, 129900, { featuredOrder: 5, isLimited: true, isBestSeller: true, bestSellerOrder: 4 }),
  tee('orbit-club', 'Orbit Club', 'Off White', '#efece6', 84900, 119900, { featuredOrder: 6, isNewArrival: true, newArrivalOrder: 3 }),
  tee('coastal-society', 'Coastal Society', 'Navy', '#2c3f63', 79900, 119900, { featuredOrder: 7, isNewArrival: true, newArrivalOrder: 2 }),
  tee('wander-more', 'Wander More', 'Brown', '#5a3b2c', 84900, 124900, { featuredOrder: 8, isNewArrival: true, newArrivalOrder: 1 }),
]
