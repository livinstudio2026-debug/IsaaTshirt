# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Back office (`/admin`)
Sign in at `/admin/login` (accounts are created on the server with `npm run admin:create`). Orders: filter tabs with counts, search by order number, name, email or phone, a detail page with a status stepper, "Ship order" (courier, tracking number and link are required), cancel (puts the stock back), mark COD paid, a history of who did what, and a printable packing slip (`/admin/orders/:number/slip`). Owners and staff can do all of it.

**Products** (`/admin/products`): search and filter (Live, Hidden, Low stock, Sold out), stock by size with low-stock flags, tap a size to change its stock (saves at once), a switch to hide or show a product, and the **Home page order** screen (`/admin/products/placements`) to reorder Hero, Featured drop, Best sellers and New arrivals. The owner can also add and edit products (name, description, category, price, MRP, colours, sizes, stock, limited run), upload pictures straight to Cloudinary (front first, back second) and delete. Staff can change stock and hide or show; the rest is read-only for them.

**Production sign-in:** the cookie only sticks when the storefront and API are the same site. With Vercel + Render, copy `vercel.proxy.example.json` over `vercel.json`, put your Render URL in it and leave `VITE_API_URL` empty, so the browser only talks to your own domain. Then set `TRUST_PROXY=2` on the API. See the server README, "Deploying the back office".
