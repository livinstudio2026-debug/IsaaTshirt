// Copy + options for the Shop page. Category ids match the API (t-shirts | hoodies | bottoms | accessories).
export const SHOP_CATEGORIES = [
  { id: '', label: 'All', to: '/shop', title: 'Shop All', script: 'Find your vibe', blurb: 'Every piece on the rack, from the newest drops to the all-time favourites.', empty: 'The rack is empty right now. Check back soon.' },
  { id: 't-shirts', label: 'T-Shirts', to: '/shop/t-shirts', title: 'T-Shirts', script: 'Pick your fit', blurb: 'Garment-washed cotton tees with bold screen-printed graphics, cut the way you like to wear them.', empty: 'No tees match these filters right now.' },
  { id: 'hoodies', label: 'Hoodies', to: '/shop/hoodies', title: 'Hoodies', script: 'Wrap up in it', blurb: 'Boxy, cosy and made to be lived in.', empty: 'Hoodies are landing soon.' },
  { id: 'bottoms', label: 'Bottoms', to: '/shop/bottoms', title: 'Bottoms', script: 'Move in style', blurb: 'Cargos and everyday bottoms to go with every tee.', empty: 'Bottoms are landing soon.' },
  { id: 'accessories', label: 'Accessories', to: '/shop/accessories', title: 'Accessories', script: 'Finish the fit', blurb: 'Caps and little extras that complete the look.', empty: 'Accessories are landing soon.' },
]

export const COLLECTIONS = [
  { id: '', label: 'Everything' },
  { id: 'new', label: 'New arrivals' },
  { id: 'bestsellers', label: 'Best sellers' },
  { id: 'limited', label: 'Limited run' },
]

export const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
]

// The line shown under a product's name. Each product can have its own (set in the back office); until it does, the shop uses its
// category's line, which says nothing about fit or cut, because a category holds pieces that differ (not every tee is oversized).
export const defaultTagline = (category) => (SHOP_CATEGORIES.find((c) => c.id === category) ?? SHOP_CATEGORIES[0]).script
export const taglineFor = (p) => p.tagline?.trim() || defaultTagline(p.category)
