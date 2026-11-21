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

// Back office uploads go straight from the browser to Cloudinary (the image never passes through this server, so the
// API's small body limit stays small). The browser first asks us for a signature: it is valid for one upload, of one
// folder / public id / format list, for about an hour. The API secret never leaves the server.
export const PRODUCT_FOLDER = 'isaa/products'
export const UPLOAD_FORMATS = 'webp,png,jpg,jpeg'

export function signProductUpload(publicId) {
  const timestamp = Math.round(Date.now() / 1000)
  const params = { allowed_formats: UPLOAD_FORMATS, folder: PRODUCT_FOLDER, public_id: publicId, timestamp }
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET)
  return {
    url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
  }
}
