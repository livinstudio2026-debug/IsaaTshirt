import { Product } from '../models/Product.js'

// Stock lives on each product's size entry. Every change below is a single atomic update, so two shoppers
// can never both buy the last piece. `lines` are { product: ObjectId, size, qty }.

// Take stock for every line, or none: if any line can't be covered, what was taken is put back.
// Returns { ok: true } or { ok: false, failed: [{ product, size, qty }] }.
export async function reserveStock(lines) {
  const taken = []
  for (const l of lines) {
    const res = await Product.updateOne(
      { _id: l.product, isActive: true, sizes: { $elemMatch: { size: l.size, stock: { $gte: l.qty } } } },
      { $inc: { 'sizes.$.stock': -l.qty } },
    )
    if (res.modifiedCount === 1) taken.push(l)
    else {
      await releaseStock(taken)
      return { ok: false, failed: [l] }
    }
  }
  return { ok: true }
}

export async function releaseStock(lines) {
  for (const l of lines) {
    await Product.updateOne({ _id: l.product, 'sizes.size': l.size }, { $inc: { 'sizes.$.stock': l.qty } })
  }
}
