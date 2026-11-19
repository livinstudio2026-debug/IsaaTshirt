// "Featured Drop" rail — 8 tees, in rail order. `limited` tees get the LIMITED RUN tag.
// Prices / MRPs below are placeholders until real catalogue data is wired in.
const tees = import.meta.glob('../assets/featuredDrop/tshirts/*.webp', { eager: true, import: 'default' })
const byName = (files, name) => files[Object.keys(files).find((k) => k.endsWith(`/${name}.webp`))]

const meta = [
  { id: 'new-york', name: 'New York Graffiti Oversized Tee', price: 899, mrp: 1299, color: 'Washed Black', limited: true },
  { id: 'los-angeles', name: 'Los Angeles Oversized Tee', price: 799, mrp: 1199, color: 'Sand' },
  { id: 'racing', name: 'Racing Championship Oversized Tee', price: 849, mrp: 1249, color: 'Olive' },
  { id: 'athletic-dept', name: 'Athletic Dept. Oversized Tee', price: 799, mrp: 1199, color: 'Maroon' },
  { id: 'dream-bigger', name: 'Dream Bigger Oversized Tee', price: 899, mrp: 1299, color: 'Washed Black', limited: true },
  { id: 'orbit-club', name: 'Orbit Club Oversized Tee', price: 849, mrp: 1199, color: 'Off White' },
  { id: 'coastal-society', name: 'Coastal Society Oversized Tee', price: 799, mrp: 1199, color: 'Navy' },
  { id: 'wander-more', name: 'Wander More Oversized Tee', price: 849, mrp: 1249, color: 'Brown' },
]

export const featured = meta.map((m, i) => ({
  ...m,
  img: byName(tees, `tshirt${i + 1}`),
}))

export const marquee = [
  'Cut from a different cloth',
  'Small runs. Big energy.',
  'Your daily rotation',
  'Designed to stand out',
  'No uniform required',
]
