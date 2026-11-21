import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const IMAGE_DIR = fileURLToPath(new URL('../../seed-images/', import.meta.url))
export const imageFile = (slug) => `${IMAGE_DIR}${slug}.webp`

export const missingImages = (products) => products.filter((p) => !existsSync(imageFile(p.slug))).map((p) => imageFile(p.slug))

// Uploads each product's front image (seed-images/<slug>.webp) and returns copies of the products
// whose images[0] points at the hosted file. `upload(file, slug) → { url, publicId }` is injected.
export async function attachImages(products, upload, concurrency = 4) {
  const out = []
  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency)
    out.push(
      ...(await Promise.all(
        batch.map(async (p) => {
          const { url, publicId } = await upload(imageFile(p.slug), p.slug)
          console.log(`  uploaded ${p.slug}`)
          return { ...p, images: [{ ...p.images[0], url, publicId }, ...p.images.slice(1)] }
        }),
      )),
    )
  }
  return out
}
