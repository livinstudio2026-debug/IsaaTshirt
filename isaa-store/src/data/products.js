import black from '../assets/hero/tshirts/tshirt1.webp'
import cream from '../assets/hero/tshirts/tshirt2.webp'
import olive from '../assets/hero/tshirts/tshirt3.webp'
import brown from '../assets/hero/tshirts/tshirt4.webp'
import goodtimes from '../assets/hero/tshirts/tshirt5.webp'

// Carousel order (left → right in the design). Prices for tees 2–5 are placeholders.
export const products = [
  { id: 'break-rules', name: 'Break Rules Oversized Tee', color: 'Black', price: 899, mrp: 1299, img: black },
  { id: 'compass', name: 'Compass Oversized Tee', color: 'Olive', price: 849, mrp: 1199, img: olive },
  { id: 'built-different', name: 'Built Different Oversized Tee', color: 'Cream', price: 799, mrp: 1099, img: cream },
  { id: 'good-times', name: 'Good Times Oversized Tee', color: 'Bone', price: 899, mrp: 1299, img: goodtimes },
  { id: 'est-2025', name: 'Isaa Est. 2025 Oversized Tee', color: 'Brown', price: 799, mrp: 1199, img: brown },
]
export const discount = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100)
