// What the product screens need to know about the catalogue. Keep in step with server/src/models/Product.js.
export const CATEGORIES = [
  { id: 't-shirts', label: 'T-shirts' },
  { id: 'hoodies', label: 'Hoodies' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'accessories', label: 'Accessories' },
]
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id

// canonical order, so sizes always read XS → XXL and 28 → 36
export const SIZE_GROUPS = [
  { label: 'Tops', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Waist (inches)', sizes: ['28', '30', '32', '34', '36'] },
  { label: 'One size', sizes: ['FREE'] },
]
export const SIZE_ORDER = SIZE_GROUPS.flatMap((g) => g.sizes)
export const bySize = (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)

// what each category usually comes in: a one-tap starting point
export const SUGGESTED_SIZES = { 't-shirts': ['S', 'M', 'L', 'XL'], hoodies: ['S', 'M', 'L', 'XL'], bottoms: ['28', '30', '32', '34', '36'], accessories: ['FREE'] }

export const PLACEMENTS = [
  { id: 'hero', label: 'Hero', short: 'Hero', hint: 'The big carousel at the top of the home page.' },
  { id: 'featured', label: 'Featured drop', short: 'Featured', hint: 'The sliding rail under the hero.' },
  { id: 'bestsellers', label: 'Best sellers', short: 'Best seller', hint: 'The Best Sellers shelf.' },
  { id: 'newarrivals', label: 'New arrivals', short: 'New arrival', hint: 'The New Arrivals shelf.' },
]

export const COLOR_PRESETS = [
  { name: 'Black', hex: '#1b1b1b' }, { name: 'Washed Black', hex: '#2b2b2b' }, { name: 'White', hex: '#f5f5f2' }, { name: 'Off White', hex: '#efece6' },
  { name: 'Cream', hex: '#e9dfcc' }, { name: 'Sand', hex: '#cdbfa6' }, { name: 'Brown', hex: '#5a3b2c' }, { name: 'Olive', hex: '#55612a' },
  { name: 'Navy', hex: '#2c3f63' }, { name: 'Maroon', hex: '#6b2230' },
]
