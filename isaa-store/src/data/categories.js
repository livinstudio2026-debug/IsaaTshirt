const files = import.meta.glob('../assets/ShopByCategory/*.webp', { eager: true, import: 'default' })
const pick = (name) => files[Object.keys(files).find((k) => k.endsWith(`/${name}.webp`))]

export const categories = [
  {
    id: 't-shirts',
    size: 9,
    label: 'T-Shirts',
    alt: 'Dream Bigger washed black oversized t-shirt',
    panel: pick('panel-tshirts'),
    product: pick('cat-tshirts'),
    ratio: 1202 / 1309,
    fit: { w: 86, left: 7, top: 12 },
    tilt: -2,
    sparkle: true,
  },
  {
    id: 'hoodies',
    size: 9.5,
    label: 'Hoodies',
    alt: 'Los Angeles cream hoodie',
    panel: pick('panel-hoodies'),
    product: pick('cat-hoodies'),
    ratio: 1203 / 1308,
    fit: { w: 80, left: 10, top: 9 },
    tilt: 1.5,
  },
  {
    id: 'bottoms',
    size: 9.5,
    label: 'Bottoms',
    alt: 'Olive cargo pants',
    panel: pick('panel-bottoms'),
    product: pick('cat-bottoms'),
    ratio: 1024 / 1536,
    fit: { w: 64, left: 18, top: 7 },
    tilt: -1.5,
  },
  {
    id: 'accessories',
    size: 7.2,
    label: 'Accessories',
    alt: 'Washed black cap with star embroidery',
    panel: pick('panel-accessories'),
    product: pick('cat-accessories'),
    ratio: 1536 / 1024,
    fit: { w: 86, left: 6, top: 24 },
    tilt: 2,
    sparkle: true,
  },
]

export const decor = {
  script: pick('find-your-vibe'),
  label: pick('label-paper'),
  texture: pick('category-title-texture'),
}
