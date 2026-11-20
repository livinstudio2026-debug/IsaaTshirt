# Isaa API

Express 5 + MongoDB Atlas (Mongoose) + Cloudinary images. Node 22.9+.

## One-time setup

**1. MongoDB Atlas (free M0)**
1. Create a project and a free **M0** cluster at cloud.mongodb.com.
2. *Database Access* → add a database user (username + password, "Read and write to any database").
3. *Network Access* → add your current IP (for a deployed server, add its IP, or `0.0.0.0/0` while you test).
4. *Connect → Drivers* → copy the connection string into `MONGODB_URI` in `.env`, replacing `<password>` and ending the path with `/isaa`.

**2. Cloudinary (free plan)**
1. Sign up at cloudinary.com → *Dashboard* → *API Keys*.
2. Copy **Cloud name**, **API Key**, **API Secret** into `.env`.

**3. Run**
```bash
cd server
npm install
cp .env.example .env       # then fill in the values above
npm run seed               # uploads the 13 product images (5 hoodies, 5 bottoms, 3 accessories) from `seed-images/` to Cloudinary, then loads the products into Atlas
npm run dev                # http://localhost:5000
```
Then start the storefront (`npm run dev` in `isaa-store`); Vite proxies `/api` here. The storefront has no local tee images: every tee comes from this API (Cloudinary URLs).
Never commit `.env`. If a secret leaks (chat, screenshot, git), rotate it in Atlas / Cloudinary.

## Seeding
| Command | What it does |
|---|---|
| `npm run seed` | uploads `seed-images/<slug>.webp` to Cloudinary (`isaa/products/<slug>`, overwrites), upserts products by slug |
| `npm run seed:new` | adds only the products that are not in the database yet, uploading only their images. Existing products are never touched (use this to add new pieces without re-uploading everything) |
| `npm run seed:fresh` | same, but deletes all products first |
| `npm run seed:descriptions` | updates only the `description` of each product from `src/seed/descriptions.js` (matched by slug; safe to re-run). `seed:descriptions:check` validates without a database |
| `npm run seed:check` | validates the data and image files only, no network |

Image files must be named `<slug>.webp` (1200×1350, transparent). The 13 launch tees are already in the database and live in `src/seed/tees.js` (not seeded). Product data for `npm run seed` (names, prices, stock) is in `src/seed/products.js` — placeholders, edit freely. Plain `seed` doesn't clear a field you removed from the file (e.g. a `heroOrder`); use `seed:fresh` or edit it in Atlas.

## Which section a product appears in
- `heroOrder: 1…n` → hero carousel, in that order. `featuredOrder: 1…n` → Featured Drop rail, in that order.
- Leave a field out / `null` → not in that rail. A product can be in both, one, or neither.
- `bestSellerOrder: 1…n` → Best Sellers shelf, `newArrivalOrder: 1…n` → New Arrivals shelf (the home page shows the first 5 of each; `GET /api/products?placement=bestsellers&limit=5`).
- `isBestSeller`, `isNewArrival`, `isLimited` are the flags for filtering and the LIMITED RUN tag.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness + db state |
| GET | `/api/products` | `category`, `bestSeller`, `newArrival`, `limited`, `placement=hero\|featured\|bestsellers\|newarrivals`, `sort=newest\|price-asc\|price-desc`, `page`, `limit` (max 50) |
| GET | `/api/products/:slug` | one product |
| GET | `/api/reels` | Instagram wall: active reels by `order`, `limit` (max 12, default 8). Empty list = storefront shows its built-in images |
| POST | `/api/contact` | `{ name, email, phone?, topic?, message }` (`topic`: order, sizing, returns, collab, other), 5 per hour per IP; saved to MongoDB, emailed if SMTP is set |
| POST | `/api/newsletter` | `{ email }`, 10 per hour per IP; upserted into the `subscribers` collection (repeat sign-ups look identical to new ones) |

Responses: `{ data, meta }` for lists, `{ data }` for one, `{ error: { message, details? } }` on failure. **Prices are integers in paise** (89900 = ₹899). Cloudinary image URLs are returned with `f_auto,q_auto` so browsers get WebP/AVIF automatically.

## Notes
- `npm test` runs without a database or Cloudinary (validation, CORS, query building, upload flow with a fake uploader).
- Production: `NODE_ENV=production`, `CLIENT_ORIGIN` = your storefront URL, `TRUST_PROXY=1` behind one proxy, SMTP variables for contact emails. Set `VITE_API_URL` on the storefront build.

## Instagram reels
No reels are seeded. The storefront falls back to its own images while `GET /api/reels` returns an empty list.

Add a reel by inserting a document into the `reels` collection (Atlas → Browse Collections → Insert Document):

```json
{
  "url": "https://www.instagram.com/reel/XXXXXXXXXXX/",
  "poster": { "url": "https://res.cloudinary.com/<cloud>/image/upload/v1/isaa/reels/drop-04.webp", "publicId": "isaa/reels/drop-04" },
  "videoUrl": "https://res.cloudinary.com/<cloud>/video/upload/v1/isaa/reels/drop-04.mp4",
  "caption": "Drop 04 behind the scenes",
  "tag": "New drop",
  "accent": "#6b6a22",
  "order": 1,
  "isActive": true
}
```

- `url` and `poster.url` are required. `poster` is a 9:16 image you upload to Cloudinary (Instagram thumbnails expire, so don't hotlink them).
- `videoUrl` is optional: a muted vertical MP4 that plays on the active card. Leave it out for a poster-only card.
- `accent` is the glow colour for the card. `tag` is the short label (30 characters max). Lower `order` shows first. `isActive: false` hides a reel.
