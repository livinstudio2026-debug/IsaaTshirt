import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import Lightbox from './Lightbox'
import { sized, srcSet } from '../../lib/api'

import circle from '../../assets/hero/tshirts/circularBG.webp'
import limitedTag from '../../assets/featuredDrop/limited-tag.webp'

gsap.registerPlugin(useGSAP)
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const label = (i) => (i === 0 ? 'Front' : i === 1 ? 'Back' : `View ${i + 1}`)

// Front/back photos. Swipe on phones (scroll-snap), thumbnails + arrows on desktop, hover to zoom with a mouse,
// tap/click a photo (or the magnifier) for the full-screen viewer, which pinches, drags and double-taps.
export default function Gallery({ product }) {
  const { images, limited, inStock } = product
  const n = images.length
  const [active, setActive] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const stage = useRef(null)
  const track = useRef(null)

  const go = (i) => {
    const j = Math.max(0, Math.min(n - 1, i))
    track.current?.scrollTo({ left: j * track.current.clientWidth, behavior: calm() ? 'auto' : 'smooth' })
    setActive(j)
  }
  const onScroll = () => {
    const t = track.current
    if (t) setActive(Math.round(t.scrollLeft / t.clientWidth))
  }

  // ---- arrival: the stage rises, the ring spins in, the tee settles into place ----
  useGSAP(() => {
    if (calm()) return
    const q = gsap.utils.selector(stage)
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(stage.current, { autoAlpha: 0, y: 36, duration: 0.9, clearProps: 'transform,opacity,visibility' }, 0)
      .from(q('[data-pd=circle]'), { scale: 0.7, rotate: -50, autoAlpha: 0, duration: 1.4 }, 0.1)
      .from(q('[data-pd=photo]')[0], { yPercent: -8, scale: 0.94, autoAlpha: 0, duration: 1.1, clearProps: 'transform,opacity,visibility' }, 0.2)
      .from(q('[data-pd=chip]'), { autoAlpha: 0, scale: 0.6, rotate: 8, duration: 0.8, ease: 'back.out(1.8)', clearProps: 'opacity,visibility' }, 0.9)
  }, { scope: stage })

  // ---- mouse hover zoom (large screens only): the tee scales up and follows the pointer ----
  const hoverOk = (e) => e.pointerType === 'mouse' && window.matchMedia('(min-width: 1024px)').matches
  const zoomEl = (e) => e.currentTarget.querySelector('[data-pd=zoom]')
  const move = (e) => {
    if (!hoverOk(e)) return
    const r = e.currentTarget.getBoundingClientRect()
    zoomEl(e).style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`
  }
  const enter = (e) => {
    if (!hoverOk(e)) return
    move(e)
    zoomEl(e).style.transform = 'scale(1.8)'
  }
  const leave = (e) => { if (e.pointerType === 'mouse') zoomEl(e).style.transform = '' }

  const arrow = 'hidden lg:grid absolute top-1/2 z-10 h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink/80 bg-cream/90 backdrop-blur transition-[background-color,color,opacity] hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-0'

  return (
    // the thumbnail column only exists when there are several photos; with one photo the stage takes the full width
    <div className={n > 1 ? 'lg:grid lg:grid-cols-[84px_minmax(0,1fr)] lg:items-start lg:gap-4 xl:grid-cols-[96px_minmax(0,1fr)]' : ''}>
      {n > 1 && (
        <ul className="hidden list-none flex-col gap-3 p-0 lg:flex" aria-label="Photos">
          {images.map((im, i) => (
            <li key={im.url}>
              <button type="button" onClick={() => go(i)} aria-label={`Show ${label(i).toLowerCase()} photo`} aria-current={i === active || undefined}
                className={`block aspect-[1/1.1] w-full overflow-hidden rounded-[16px] border bg-gradient-to-b from-sand/80 to-sand/40 p-1.5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 ${i === active ? 'border-ink' : 'border-sand hover:border-ink/50'}`}>
                <img src={sized(im.url, 240)} alt="" width="1200" height="1300" loading="lazy" decoding="async" draggable="false" className="h-full w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={stage} className="relative isolate min-w-0 overflow-hidden rounded-[22px] border border-sand bg-gradient-to-b from-sand/80 to-sand/40 sm:rounded-[32px]">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[92%] -translate-x-1/2 -translate-y-1/2">
          <img data-pd="circle" src={circle} alt="" width="1024" height="1024" decoding="async" draggable="false" className="block w-full opacity-80" />
        </div>

        <div ref={track} onScroll={onScroll} role="group" aria-roledescription="carousel" aria-label={`${product.name} photos`}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((im, i) => (
            <div key={im.url} role="group" aria-roledescription="slide" aria-label={`${label(i)}, ${i + 1} of ${n}`}
              onPointerEnter={enter} onPointerMove={move} onPointerLeave={leave} onClick={() => setZoomOpen(true)}
              className="relative aspect-[4/4.5] w-full shrink-0 cursor-zoom-in snap-center overflow-hidden">
              <div data-pd="zoom" className="absolute inset-0 transition-transform duration-500 ease-out will-change-transform motion-reduce:transition-none">
                <img data-pd="photo" data-active={i === active} src={sized(im.url, 700)} srcSet={srcSet(im.url, [700, 1000, 1400])} sizes="(min-width:1024px) 44vw, 92vw"
                  alt={im.alt} width="1200" height="1300" decoding="async" fetchPriority={i === 0 ? 'high' : undefined} loading={i === 0 ? 'eager' : 'lazy'} draggable="false"
                  className={`absolute inset-0 h-full w-full select-none object-contain p-[7%] drop-shadow-[0_22px_22px_rgba(70,45,15,.3)] ${inStock ? '' : 'opacity-60 saturate-50'}`} />
              </div>
            </div>
          ))}
        </div>

        {limited && <img data-pd="chip" src={limitedTag} alt="Limited run" width="1539" height="501" decoding="async" draggable="false" className="pointer-events-none absolute bottom-[5%] left-[4%] w-[34%] max-w-[210px] rotate-[-4deg] drop-shadow-[0_5px_6px_rgba(0,0,0,.25)]" />}

        <button type="button" onClick={() => setZoomOpen(true)} aria-label="Zoom photo"
          className="absolute bottom-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-cream/90 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-white active:scale-90 sm:bottom-4 sm:right-4">
          <Maximize2 size={18} />
        </button>

        {n > 1 && (
          <>
            <button type="button" aria-label="Previous photo" disabled={active === 0} onClick={() => go(active - 1)} className={`${arrow} left-3`}><ChevronLeft size={20} /></button>
            <button type="button" aria-label="Next photo" disabled={active === n - 1} onClick={() => go(active + 1)} className={`${arrow} right-3`}><ChevronRight size={20} /></button>
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center gap-2 lg:hidden" aria-hidden>
              {images.map((im, i) => <span key={im.url} className={`h-2 rounded-full bg-ink transition-all duration-300 ${i === active ? 'w-6' : 'w-2 opacity-25'}`} />)}
            </div>
          </>
        )}
      </div>

      {/* rendered on <body>: inside the page it would sit under the sticky header and the mobile add-to-cart bar */}
      {zoomOpen && createPortal(<Lightbox images={images} index={active} onClose={() => setZoomOpen(false)} onIndex={go} />, document.body)}
    </div>
  )
}