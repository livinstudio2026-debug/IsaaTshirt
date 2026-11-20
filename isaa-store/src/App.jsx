import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Product from './pages/Product'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import { MAX_QTY } from './lib/format'

// New page -> top. A #hash -> glide to that section (it may still be mounting, so retry briefly).
// Moving between /shop/... pages keeps the scroll position; the Shop page handles that itself.
// Every product is its own page, so going from one product to another (e.g. via "You may also like") starts at the top.
function ScrollManager() {
  const { pathname, hash, key } = useLocation()
  const lastPage = useRef(null)
  useEffect(() => {
    const section = pathname.split('/')[1] || 'home'
    const page = section === 'shop' ? 'shop' : pathname
    const changed = lastPage.current !== page
    lastPage.current = page
    if (hash) {
      let tries = 0
      const t = setInterval(() => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)))
        if (el || ++tries > 25) { clearInterval(t); el?.scrollIntoView({ behavior: 'smooth' }) }
      }, 60)
      return () => clearInterval(t)
    }
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [key, pathname, hash])
  return null
}

// Scroll animations measure the page once. Pages here change height after they mount (skeleton -> products,
// images loading, route changes), so re-measure whenever the page's height changes. Without this, triggers go stale
// and sections further down can stay hidden until a refresh.
function TriggerRefresh() {
  const { pathname } = useLocation()
  useEffect(() => {
    let t
    const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 200) }
    const ro = new ResizeObserver(refresh)
    ro.observe(document.body)
    window.addEventListener('load', refresh)
    refresh()
    return () => { clearTimeout(t); ro.disconnect(); window.removeEventListener('load', refresh) }
  }, [pathname])
  return null
}

export default function App() {
  // A cart line is one piece in one size and colour: { id, slug, name, img, price, mrp, size, color, qty }.
  // Adding the same piece again just raises its quantity.
  const [cart, setCart] = useState([])
  const addToCart = (item) => setCart((c) => {
    const at = c.findIndex((l) => l.id === item.id)
    if (at < 0) return [...c, item]
    return c.map((l, i) => (i === at ? { ...l, qty: Math.min(MAX_QTY, l.qty + item.qty) } : l))
  })
  const cartCount = cart.reduce((n, l) => n + l.qty, 0)
  const { pathname } = useLocation()

  return (
    <>
      <ScrollManager />
      <TriggerRefresh />
      <Navbar cartCount={cartCount} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:category" element={<Shop />} />
          <Route path="/product/:slug" element={<Product onAdd={addToCart} />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {/* on the home page the Instagram section (moss) sits right above the footer's newsletter card */}
      <Footer above={pathname === '/' ? 'moss' : 'cream'} />
    </>
  )
}