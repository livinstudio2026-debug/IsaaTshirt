// Copy for the About + Why Isaa section. Edit freely; the component reads everything from here.
// Only claims we can stand behind are used: Est. 2025, garment-washed oversized cotton tees, screen-printed
// graphics, small limited runs, and the shipping / COD / returns lines that already sit in the announcement bar.

export const about = {
  eyebrow: 'Our Story',
  titleLines: ['Cut from a', 'different cloth'],
  script: 'Wear the vibe',
  paragraphs: [
    'Isaa started in 2025 with a simple idea: the tee you reach for first should also be the one people notice. Oversized silhouettes, bold graphics, and nothing generic.',
    'Every piece is garment-washed for a soft, lived-in feel from the very first wear, cut boxy with dropped shoulders, and finished with a screen-printed graphic. We keep our runs small, so every drop feels like a drop.',
  ],
  chips: ['Oversized fit', 'Garment-washed cotton', 'Screen-printed graphics', 'Small runs'],
  stripLabel: 'Garment-washed',
}

// icon names are resolved in About.jsx
export const reasons = [
  { icon: 'shirt', title: 'Oversized, done right', text: 'Dropped shoulders and a boxy cut that actually sit right. Not just a size up.' },
  { icon: 'droplets', title: 'Washed in, not worn in', text: 'Garment-washed for a soft, broken-in feel and a vintage fade from day one.' },
  { icon: 'stamp', title: 'Prints with presence', text: 'Screen-printed graphics with real weight and texture, made to be noticed.' },
  { icon: 'hourglass', title: 'Small runs, big energy', text: 'Limited drops mean you are not wearing what everyone else is.' },
]

// same promises as the announcement bar in Navbar.jsx
export const promises = [
  { icon: 'truck', label: 'Free shipping', note: 'On orders above ₹1,499' },
  { icon: 'banknote', label: 'COD available', note: 'Pay when it arrives' },
  { icon: 'rotate', label: 'Easy returns', note: 'Within 7 days' },
]
