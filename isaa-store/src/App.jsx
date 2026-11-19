import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturedDrop from './components/FeaturedDrop'
import ShopByCategory from './components/ShopByCategory'

export default function App() {
  const [cart, setCart] = useState([])
  const addToCart = (p) => setCart((c) => [...c, p])

  return (
    <>
      <Navbar cartCount={cart.length} />
      <main>
        <Hero />
        <FeaturedDrop onAdd={addToCart} />
        <ShopByCategory />
      </main>
    </>
  )
}
