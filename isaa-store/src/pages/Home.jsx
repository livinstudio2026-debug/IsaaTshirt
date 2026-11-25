import { useState, useEffect } from 'react'
import Hero from '../components/Hero'
import FeaturedDrop from '../components/FeaturedDrop'
import BestSellers from '../components/BestSellers'
import ShopByCategory from '../components/ShopByCategory'
import About from '../components/About'
import Reviews from '../components/Reviews'
import InstagramWall from '../components/InstagramWall'
import { fetchHomeRails } from '../lib/api'

export default function Home() {
  // status: 'loading' | 'ready' | 'error'
  const [state, setState] = useState({ status: 'loading', hero: [], featured: [] })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const ac = new AbortController()
    const fail = () => setState({ status: 'error', hero: [], featured: [] })
    fetchHomeRails(ac.signal)
      .then(({ hero, featured }) => (hero.length && featured.length ? setState({ status: 'ready', hero, featured }) : fail()))
      .catch((err) => { if (err.name !== 'AbortError') fail() })
    return () => ac.abort()
  }, [attempt])
  const retry = () => { setState({ status: 'loading', hero: [], featured: [] }); setAttempt((n) => n + 1) }

  return (
    <>
      {state.status === 'ready' ? (
        <>
          <Hero products={state.hero} />
          <FeaturedDrop featured={state.featured} />
          <BestSellers />
        </>
      ) : (
        <section className="min-h-[80vh] bg-cream grid place-items-center px-5 text-center" aria-live="polite">
          {state.status === 'loading' ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ink/50">Loading the drop…</p>
          ) : (
            <div>
              <p className="font-bold text-lg">We couldn’t load the collection.</p>
              <p className="mt-1 text-ink/60">Check your connection and try again.</p>
              <button type="button" onClick={retry} className="mt-5 bg-ink text-white font-bold uppercase tracking-wide text-sm px-8 py-3 rounded-full transition-colors hover:bg-olive">Retry</button>
            </div>
          )}
        </section>
      )}
      <ShopByCategory />
      <About />
      <Reviews />
      <InstagramWall />
    </>
  )
}
