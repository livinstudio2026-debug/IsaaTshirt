import { v2 as cloudinary } from 'cloudinary'
import { env } from './env.js'

if (env.cloudinaryEnabled) {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true })
}

// Uploads (or overwrites) one product image as isaa/products/<slug>. Returns { url, publicId }.
export async function uploadProductImage(file, slug) {
  const res = await cloudinary.uploader.upload(file, {
    folder: 'isaa/products',
    public_id: slug,
    overwrite: true,
    invalidate: true, // purge the CDN copy when an image is replaced
    resource_type: 'image',
  })
  return { url: res.secure_url, publicId: res.public_id }
}
