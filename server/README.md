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
| `npm run migrate:heroes` | one-off for products saved before per-colour heroes: moves each product's old front shot (`images[0]`) into its colours' heroes. `-- --dry` shows what would change. The shop works without it (the front shot stands in as the hero), so there is no rush. Products with several colours get the same hero for each until you give every colour its own in the back office |

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
| GET | `/api/products` | `category`, `bestSeller`, `newArrival`, `limited`, `placement=hero\|featured\|bestsellers\|newarrivals`, `sort=newest\|price-asc\|price-desc` (`relevance` too, with `q`), `page`, `limit` (max 50), **`q`** = search (see below), **`slugs=a,b,c`** = exactly these products (up to 50, still on sale, in that order: the wishlist) |
| GET | `/api/products/:slug` | one product |

**Tagline:** every product has an optional `tagline` (up to 40 characters; the handwritten line under its name on the product page), set in the back office under *Details* with a live preview. It is `''` when none is set, and the storefront then shows its category's default (T-Shirts "Pick your fit", Hoodies "Wrap up in it", Bottoms "Move in style", Accessories "Finish the fit"; they are in the storefront's `src/data/shop.js` and say nothing about fit or cut, because not every tee is oversized). Products saved before this field existed read as empty, so nothing needs migrating.

**Search** (`GET /api/products?q=olive+tee`): every word (up to 5) has to match, from the start of a word, in the name, address, colour, category or description, so "ol" finds Olive but "live" doesn't. Everyday words find the right category ("tee", "tshirt" → t-shirts, "joggers" → bottoms, "cap" → accessories). Results come best match first (a name hit beats a colour or category hit, which beats a description hit; in stock beats sold out), or by `sort=newest|price-asc|price-desc`. Hidden products never appear. Search text is never used as a pattern (`.*`, `(` etc. are just text). The matching runs on at most 300 hits in memory, which is plenty for a shop this size; if the catalogue ever grows into the thousands, move it to a MongoDB Atlas Search index.
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
| GET | `/api/admin/products/:slug/history` | the change log: `page`, `limit` (max 50). Newest first, `{ data, meta }`. Owner and staff |
| POST | `/api/admin/products/:slug/stock` | `{ size, from, to }`: set one size's stock. Owner and staff |
| POST | `/api/admin/products/:slug/visibility` | `{ isActive }`: hide or show. Owner and staff |
| GET | `/api/admin/placements` | the four home-page rails, each in order |
| POST | `/api/admin/placements/:name` | **owner.** `{ slugs: [...] }`: that list becomes the rail (`hero`, `featured`, `bestsellers`, `newarrivals`) |
| POST | `/api/admin/uploads/sign` | **owner.** `{ kind?: product\|reel-poster\|reel-video, slug? }`: one-time signature for a browser-to-Cloudinary upload (reels go to `isaa/reels`; videos accept mp4, webm, mov) |
| GET | `/api/admin/reels` | the Instagram wall, hidden ones too, in wall order: `{ data, meta: { total, wallShows, max } }`. Owner and staff |
| POST | `/api/admin/reels` | **owner.** add a reel (goes to the end): `{ url, poster: { url, publicId }, video?: { url, publicId }, caption?, tag?, accent?, isActive? }` |
| PATCH | `/api/admin/reels/:id` | **owner.** change only what you send; `video: null` removes the video, `accent: null` resets the colour |
| POST | `/api/admin/reels/:id/visibility` | `{ isActive }`: hide or show. Owner and staff |
| POST | `/api/admin/reels/order` | **owner.** `{ ids: [...] }`: that list is the new order (reels you leave out go after it) |
| DELETE | `/api/admin/reels/:id` | **owner.** delete (the files stay in Cloudinary) |
| GET | `/api/admin/team` | **owner.** everyone with access: role, disabled / paused, last sign-in, browsers signed in now |
| POST | `/api/admin/team` | **owner.** `{ name, email, password }`: a new **staff** account (a role in the request is ignored) |
| PATCH | `/api/admin/team/:id` | **owner.** `{ name?, isActive? }`: disable (signs them out of every browser at once) or enable. You can't disable yourself |
| POST | `/api/admin/team/:id/password` | **owner.** `{ password }`: set a staff member's password and sign them out everywhere. An owner's password is only changed by that owner (403) |
| POST | `/api/admin/team/:id/unlock` | **owner.** lift the 15-minute pause after 5 wrong passwords |
| POST | `/api/admin/account/password` | anyone, for themselves: `{ currentPassword, newPassword }`. Signs out every *other* browser. A wrong current password is a 400 on `currentPassword` (never a 401), 10 wrong tries per 15 minutes per IP |
| GET | `/api/admin/dashboard` | the Overview screen in one call: sales (today / 7 / 30 days, each with the period before it, plus a 30-day daily series), action counts, the oldest orders to pack or ship, low-stock products, inbox numbers. Owner and staff |
| GET | `/api/admin/inbox/unread` | `{ unread }`: new messages, for the navigation badge |
| GET | `/api/admin/messages` | contact messages: `status=all\|new\|read\|replied`, `q` (name, email or message text), `page`, `limit`; answers `{ data, meta, counts }` |
| POST | `/api/admin/messages/:id/status` | `{ status: new\|read\|replied }`; records who and when |
| DELETE | `/api/admin/messages/:id` | **owner.** delete a message (spam) |
| GET | `/api/admin/subscribers` | newsletter sign-ups, newest first: `q`, `page`, `limit`; `counts: { total, last7Days }` |
| GET | `/api/admin/subscribers/export` | **owner.** the whole list as a CSV download |
| POST | `/api/newsletter` | `{ email }`, 10 per hour per IP; upserted into the `subscribers` collection (repeat sign-ups look identical to new ones) |

Responses: `{ data, meta }` for lists, `{ data }` for one, `{ error: { message, details? } }` on failure. **Prices are integers in paise** (89900 = ₹899). Cloudinary image URLs are returned with `f_auto,q_auto` so browsers get WebP/AVIF automatically.

## Products (back office)
Everything in `/admin/products` works from the storefront's back office, so the seed file is only for the very first load.

| | Owner | Staff |
|---|---|---|
| See products (hidden too), search and filter | yes | yes |
| Change a size's stock, hide / show | yes | yes |
| Add, edit details and prices, pictures, home-page placements, delete | yes | no (403) |

- **Pictures:** every colour has its own **hero picture** (`colors[].hero`, required): a transparent PNG/WebP cut-out, about 1200 × 1300 px, the piece alone. It is what shoppers see for that colour in lists and first on the product page. The pictures after it are **shared by all colours** (`images`, optional, up to 5): the first is the back shot, the rest are details. The browser checks a hero (transparent, right shape and size) before uploading it, then uploads straight to Cloudinary using a one-time signature from `/uploads/sign` (folder `isaa/products`), so images never pass through this server. On save the API accepts only pictures that came from that uploader. Pictures are never deleted from Cloudinary automatically, because old orders and packing slips still show them. The public API sends `colors: [{ name, hex, hero: { url, alt } }]` and `images` (the shared ones only); an order line keeps the hero of the colour that was bought.
- **Stock is safe against orders:** `/stock` only applies if the number is still what the screen showed (otherwise 409 with the real figure), and editing a product never overwrites the stock of a size it already has. Stock changes always go through `/stock`.
- **Placements:** `heroOrder`, `featuredOrder`, `bestSellerOrder`, `newArrivalOrder` are set from the screens: switching a product onto a rail puts it at the end, and the Home page order screen sets positions 1…n. Best Sellers and New Arrivals also keep `isBestSeller` / `isNewArrival` in step.
- **Change log:** every product action is written to its own `productchanges` collection with who did it, when, and old → new values: add, edit (name, tagline, description, category, price, MRP, colours, sizes, pictures, Limited run), a size's stock, hide / show, home-page rail moves, delete. A save that changes nothing writes nothing. Stock taken or returned by orders is not here (it is in each order's history), and stock numbers inside an edit are never compared (orders move them all day). A log row survives the product's deletion, and history is looked up by the product's id, so a new product that reuses an old address starts clean. Writing the log is best effort: if it fails the change still succeeds (and the error is printed). The product screen shows it at the bottom ("Change log").
- **Low stock:** a size at `LOW_STOCK_AT` pieces or fewer (default 5) is "low"; a product with nothing left is "sold out".
- **Freshness:** a change reaches shoppers within seconds, not minutes. Browsers always ask "has it changed?" (ETag, a tiny 304 when not), the CDN / Vercel proxy may keep an answer for at most 10 seconds (`s-maxage=10`), and this server keeps its own copy for 20 seconds that is **thrown away the moment** the back office writes anything or an order takes or returns stock. Hidden, sold-out or re-priced products therefore disappear / update at once on the same server, and within about 10 seconds through the proxy. Error responses (a 404 for a hidden product) are never cached. Responses carry `X-Cache: HIT|MISS`. Checkout stays safe regardless: it re-checks price and stock itself.

## Notes
- `npm test` runs without a database or Cloudinary (validation, CORS, query building, upload flow with a fake uploader).
- Production: `NODE_ENV=production`, `CLIENT_ORIGIN` = your storefront URL, `TRUST_PROXY=1` behind one proxy, SMTP variables for contact emails. Set `VITE_API_URL` on the storefront build.

## Instagram reels
Reels are managed from the back office (**Reels**): the owner uploads a poster (9:16) and an optional short muted video straight to Cloudinary, pastes the Instagram link, sets caption, tag and glow colour, drags them into order (up / down, then *Save order*), hides or deletes them; staff can hide and show. The screen shows exactly which spots on the home page are filled. The home page shows the first 8 visible reels, and up to 24 can be kept. The server only accepts pictures and videos that were uploaded through the signed uploader (folder `isaa/reels`) and real `instagram.com/reel|p|tv` links.

No reels are seeded. The storefront falls back to its own images while `GET /api/reels` returns an empty list.

The old way still works: add a reel by inserting a document into the `reels` collection (Atlas → Browse Collections → Insert Document):

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
- **Fees and the COD threshold are editable in the back office** (owner, *Settings*): free-shipping minimum, shipping fee, COD fee, and "COD is free from ₹X" (0 = the COD fee is never waived). The values in `.env` (`FREE_SHIPPING_MIN_INR`, `SHIPPING_FEE_INR`, `COD_FEE_INR`, `COD_FREE_MIN_INR`; defaults 1499 / 0 / 0 / 0) are only the defaults: what the owner saves (one `settings` document, key `store`) wins, takes effect on the next checkout with no restart, and *Use the defaults* deletes it. The server re-reads it at most every 5 seconds, so several servers stay in step. The COD fee is waived when the bag subtotal (before shipping and fees) is at or above the threshold; the order stores the fee actually charged. The storefront reads everything from `GET /api/store-config`, so it can't drift.
- **Prices are never taken from the browser.** The API reads price and stock from the database and computes totals itself.
- **Stock** is reduced atomically per size (`src/utils/stock.js`). If a later line fails, earlier reservations are put back; if saving the order fails, stock is put back. Cancelling an order in the back office calls the same `releaseStock`.
- **Double submits:** each checkout sends an `idempotencyKey`; the same key returns the same order.
- **Order numbers** look like `ISA-241121-7K3M9Q`: `ISA`, the date in India (YYMMDD), then 6 random characters (no I, L, O, U). The date makes them readable at a glance and means the random part only has to be unique within a day; the database's unique index is the final check and checkout draws again on a clash. Older orders (`ISA-7K3M9QX2`) keep working. Tracking needs the number **and** the email, and a wrong guess looks the same as no such order. Typing is forgiving: `isa 241121 7k3m9q`, `ISA2411217K3M9Q`, O for 0.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/store-config` | fees, free-shipping minimum, COD-free minimum, payment options, states (paise) |
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
| GET / PUT / DELETE | `/api/admin/settings` | owner only. Shipping and COD rules in whole rupees: `freeShippingMin`, `shippingFee`, `codFee`, `codFreeMin` (PUT needs all four; DELETE goes back to `.env`) |
| POST | `/api/admin/orders/:number/mark-paid` | COD only, once shipped or delivered |
| POST | `/api/admin/orders/:number/note` | `{ note }`, an internal note on the history |
| POST | `/api/admin/orders/:number/resend-email` | `{ kind: shipped\|delivered\|cancelled }`: send that customer email again (only the one that matches where the order is now). 502 if the mail server refuses it |

- **History:** every change is logged with who did it and when (`history` on the order). Customers never see it; the tracking page only gets the public `statusHistory`, the courier, number and link.
- **Customer emails:** the customer hears about every step that matters: *confirmation* (checkout), *shipped* (courier, number, link, items), *delivered* (thanks, 7-day return note) and *cancelled* (what was in the order, and what happens to their money: nothing to refund for COD, a refund note for a paid online order). They go out right after the change is saved, once (a refused or repeated click sends nothing), and only if SMTP is set up; the order is saved either way. `emails.<kind>` on the order records whether each went out, and the order screen shows it with a **Send again** button. The reason you type when cancelling is internal and is never put in the email.
- **Packing slip:** printed from the storefront at `/admin/orders/:number/slip`.

## Back office: team and passwords
The terminal commands above still work, but you no longer need them day to day. On the storefront the owner sees **Team** (add staff, disable / enable, set a staff password, unlock) and everyone sees **Account** (tap your name, top right) to change their own password. Passwords follow the same rules everywhere (10+ characters, not a common one, not your email name), hashed with scrypt. The screen can make a random password and shows it once, with a copy button. More owners are made on purpose, from the terminal (`npm run admin:create -- --role=owner`), not from the screen.

## Deploying the back office
- **Same-site deploy (recommended).** The sign-in cookie is `SameSite=Lax`, which only works when the storefront and the API are the same *site*. Two ways: put them on one domain (`isaa.in` + `api.isaa.in`), or keep Vercel + Render and let Vercel forward `/api` to Render (copy `isaa-store/vercel.proxy.example.json` over `vercel.json`, put your Render URL in it, and leave `VITE_API_URL` empty). The browser then only ever talks to the storefront's own domain.
- `ADMIN_COOKIE_SAMESITE=none` only exists as a last resort for two different sites; Safari and private windows will block it. The server prints a warning at start-up if it's set in production.
- **`TRUST_PROXY`:** set it to the number of proxies in front of the API: `1` on Render (it defaults to 1 there, because Render sets `RENDER`), `2` with Vercel forwarding to Render. Without it every visitor shares one IP and the login rate limit locks everyone out together. The server warns at start-up if it's `0` in production.
- **Locked out?** Five wrong passwords in a row pause an account for 15 minutes (anyone can trigger that on yours). `npm run admin:unlock -- you@isaa.in` lifts it straight away.

## Back office: dashboard and inbox
- **"Today" is Indian time.** Days are grouped in `Asia/Kolkata` whatever time zone the server runs in (`src/utils/istDates.js`), so an order at 00:10 IST counts for the new day.
- **Revenue** is every order that wasn't cancelled, on the day it was placed. Cash on delivery counts when ordered, not when the cash arrives; the "Cash to record" card lists delivered COD orders not yet marked paid. Each window (today, 7 days, 30 days) comes with the window before it so the screen can show up / down.
- **Needs attention:** new orders and packed orders (oldest first; the screen flags new orders older than 24 h and packed ones older than 48 h), shipped orders still not delivered after 7 days, and unread messages.
- **Low stock** uses `LOW_STOCK_AT`. Sold-out products come first, then the product whose scarcest size is lowest.
- **Inbox:** owner and staff read messages and subscribers and mark messages read / replied (the sender's IP and browser stay in the database and are never sent to the screen). Deleting a message and downloading the subscriber list are owner-only. The CSV is UTF-8 with a BOM for Excel, and any cell starting with `= + - @` gets a leading apostrophe so a hostile sign-up can't run as a spreadsheet formula.
