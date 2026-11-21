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

## Back office (admin) sign-in
No public sign-up: you create each account from the terminal, then sign in at **`/admin/login`** on the storefront.

```bash
npm run admin:create            # asks for email, name and password (hidden). The first account becomes the owner
npm run admin:password          # set a new password; signs that person out everywhere
npm run admin:list              # who has access
npm run admin:disable -- a@b.com            # block sign-in and end their sessions (add --enable to restore)
```
Non-interactive: `ADMIN_PASSWORD='...' npm run admin:create -- --email=a@b.com --name=Leo --role=owner`. Passwords need 10+ characters; they are hashed with scrypt and never stored or logged in plain text.

How it is protected
- **Session:** a random token in an `httpOnly` cookie (path `/api/admin`, `Secure` in production). Only the token's SHA-256 is saved in MongoDB (`adminsessions`), so a leaked database can't be used to sign in, and deleting a row signs that browser out at once. A normal sign-in lasts 12 hours and ends when the browser closes; "keep me signed in" lasts 7 days.
- **Brute force:** 10 failed attempts per 15 minutes per IP, and an account pauses for 15 minutes after 5 wrong passwords in a row. Unknown emails and wrong passwords get the same answer and take the same time.
- **CSRF:** every write must come from an origin listed in `CLIENT_ORIGIN` and be JSON. CORS allows credentials for those origins only.
- **Disabling** an account (or changing its password with `admin:password`) ends its sessions immediately.

Deploying: put the storefront and API on the same site (e.g. `isaa.in` and `api.isaa.in`) and keep `ADMIN_COOKIE_SAMESITE=lax`. If they must be on different sites, set it to `none` (HTTPS only), and expect Safari and private windows to block the cookie.

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
| POST | `/api/admin/auth/login` | `{ email, password, remember? }` → sets the session cookie; 401 wrong credentials, 429 too many attempts |
| POST | `/api/admin/auth/logout` | ends the session and clears the cookie |
| GET | `/api/admin/auth/me` | the signed-in admin, or 401 |
| GET | `/api/admin/products` | back office list (hidden ones too): `q`, `category`, `status=all\|active\|hidden\|low\|out`, `placement`, `sort`, `page`, `limit`; answers `{ data, meta, counts }` |
| GET | `/api/admin/products/:slug` | one product, any status |
| POST | `/api/admin/products` | **owner.** add a product (see Products below) |
| PATCH | `/api/admin/products/:slug` | **owner.** edit details, prices, colours, sizes, pictures, placements. The slug never changes |
| DELETE | `/api/admin/products/:slug` | **owner.** delete (past orders keep their own copy of the item) |
| POST | `/api/admin/products/:slug/stock` | `{ size, from, to }`: set one size's stock. Owner and staff |
| POST | `/api/admin/products/:slug/visibility` | `{ isActive }`: hide or show. Owner and staff |
| GET | `/api/admin/placements` | the four home-page rails, each in order |
| POST | `/api/admin/placements/:name` | **owner.** `{ slugs: [...] }`: that list becomes the rail (`hero`, `featured`, `bestsellers`, `newarrivals`) |
| POST | `/api/admin/uploads/sign` | **owner.** one-time signature for a browser-to-Cloudinary image upload |
| POST | `/api/newsletter` | `{ email }`, 10 per hour per IP; upserted into the `subscribers` collection (repeat sign-ups look identical to new ones) |

Responses: `{ data, meta }` for lists, `{ data }` for one, `{ error: { message, details? } }` on failure. **Prices are integers in paise** (89900 = ₹899). Cloudinary image URLs are returned with `f_auto,q_auto` so browsers get WebP/AVIF automatically.

## Products (back office)
Everything in `/admin/products` works from the storefront's back office, so the seed file is only for the very first load.

| | Owner | Staff |
|---|---|---|
| See products (hidden too), search and filter | yes | yes |
| Change a size's stock, hide / show | yes | yes |
| Add, edit details and prices, pictures, home-page placements, delete | yes | no (403) |

- **Pictures:** the browser uploads straight to Cloudinary using a one-time signature from `/uploads/sign` (folder `isaa/products`, WebP/PNG/JPG), so images never pass through this server. On save the API accepts only pictures that came from that uploader. The **first** picture is the front shot, the **second** the back. Pictures are never deleted from Cloudinary automatically, because old orders and packing slips still show them.
- **Stock is safe against orders:** `/stock` only applies if the number is still what the screen showed (otherwise 409 with the real figure), and editing a product never overwrites the stock of a size it already has. Stock changes always go through `/stock`.
- **Placements:** `heroOrder`, `featuredOrder`, `bestSellerOrder`, `newArrivalOrder` are set from the screens: switching a product onto a rail puts it at the end, and the Home page order screen sets positions 1…n. Best Sellers and New Arrivals also keep `isBestSeller` / `isNewArrival` in step.
- **Low stock:** a size at `LOW_STOCK_AT` pieces or fewer (default 5) is "low"; a product with nothing left is "sold out".
- The public shop caches product lists for 60 seconds, so a change reaches shoppers within about a minute.

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


## Orders (guest checkout)
- **COD only for now.** `payments.online.enabled` is `false` in `src/config/store.js`; the API rejects `paymentMethod: "online"` and the checkout shows it as "Coming soon". Wire Razorpay later and flip the flag.
- **Fees live in `.env`:** `FREE_SHIPPING_MIN_INR`, `SHIPPING_FEE_INR`, `COD_FEE_INR` (defaults 1499 / 0 / 0). The storefront reads them from `GET /api/store-config`, so they can't drift.
- **Prices are never taken from the browser.** The API reads price and stock from the database and computes totals itself.
- **Stock** is reduced atomically per size (`src/utils/stock.js`). If a later line fails, earlier reservations are put back; if saving the order fails, stock is put back. Cancelling an order in the back office calls the same `releaseStock`.
- **Double submits:** each checkout sends an `idempotencyKey`; the same key returns the same order.
- **Order numbers** look like `ISA-241121-7K3M9Q`: `ISA`, the date in India (YYMMDD), then 6 random characters (no I, L, O, U). The date makes them readable at a glance and means the random part only has to be unique within a day; the database's unique index is the final check and checkout draws again on a clash. Older orders (`ISA-7K3M9QX2`) keep working. Tracking needs the number **and** the email, and a wrong guess looks the same as no such order. Typing is forgiving: `isa 241121 7k3m9q`, `ISA2411217K3M9Q`, O for 0.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/store-config` | fees, free-shipping minimum, payment options, states (paise) |
| POST | `/api/orders` | `{ items:[{slug,size,color,qty}], customer:{name,phone,email}, address:{line1,line2?,landmark?,city,state,pincode}, notes?, paymentMethod, idempotencyKey }`. 201 new, 200 repeat, 409 stock conflict with `details:[{slug,size,reason,requested,available}]`. 10/hour/IP |
| POST | `/api/orders/track` | `{ orderNumber, email }`. 30/hour/IP |

Order emails (customer confirmation + owner alert) use the same SMTP settings as the contact form.

## Back office: orders
Everything below needs a signed-in admin (cookie). **Owner and staff can do all of it, including cancelling.** The roles are checked by `requireRole(...)` in `src/middleware/adminAuth.js`; nothing uses it yet, so the day something should be owner-only (products, team accounts) it is one line on the route.

An order moves **placed → (confirmed) → packed → shipped → delivered**, one step at a time. The server rejects skips and backward moves, so nothing can be delivered before it ships. "Confirmed" is optional. Cancelling is only possible before shipping, and puts the stock back with the same `releaseStock` checkout uses (an atomic status flip first, so a double click can never restock twice).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/orders?status=new\|packed\|shipped\|delivered\|cancelled\|all&q=&page=&limit=` | `q` matches order number, name, email or phone. Returns `{ data, meta, counts }` (`new` = placed + confirmed) |
| GET | `/api/admin/orders/:number` | full order, full phone, and the audit trail (`history`) |
| POST | `/api/admin/orders/:number/status` | `{ status: confirmed\|packed\|shipped\|delivered, tracking?: { carrier, number, url }, note? }`. `shipped` requires all three tracking fields (`url` must be http/https). 409 if the move isn't allowed or someone else changed the order first |
| POST | `/api/admin/orders/:number/cancel` | `{ reason? }`. Only placed / confirmed / packed |
| POST | `/api/admin/orders/:number/mark-paid` | COD only, once shipped or delivered |
| POST | `/api/admin/orders/:number/note` | `{ note }`, an internal note on the history |

- **History:** every change is logged with who did it and when (`history` on the order). Customers never see it; the tracking page only gets the public `statusHistory`, the courier, number and link.
- **Shipped email:** sent to the customer when you mark an order shipped (courier, number, link, items). Like the other emails it only goes out if SMTP is set up; the order is saved either way (`emails.shipped` records whether it went).
- **Packing slip:** printed from the storefront at `/admin/orders/:number/slip`.

## Deploying the back office
- **Same-site deploy (recommended).** The sign-in cookie is `SameSite=Lax`, which only works when the storefront and the API are the same *site*. Two ways: put them on one domain (`isaa.in` + `api.isaa.in`), or keep Vercel + Render and let Vercel forward `/api` to Render (copy `isaa-store/vercel.proxy.example.json` over `vercel.json`, put your Render URL in it, and leave `VITE_API_URL` empty). The browser then only ever talks to the storefront's own domain.
- `ADMIN_COOKIE_SAMESITE=none` only exists as a last resort for two different sites; Safari and private windows will block it. The server prints a warning at start-up if it's set in production.
- **`TRUST_PROXY`:** set it to the number of proxies in front of the API: `1` on Render (it defaults to 1 there, because Render sets `RENDER`), `2` with Vercel forwarding to Render. Without it every visitor shares one IP and the login rate limit locks everyone out together. The server warns at start-up if it's `0` in production.
- **Locked out?** Five wrong passwords in a row pause an account for 15 minutes (anyone can trigger that on yours). `npm run admin:unlock -- you@isaa.in` lifts it straight away.
