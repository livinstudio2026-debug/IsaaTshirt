import { Link } from 'react-router-dom'
import { ArrowUpRight, Flame, Heart, Sparkle } from 'lucide-react'
import { discount, sized, srcSet } from '../lib/api'
import { displayName, kindLine } from '../lib/format'

import circle from '../assets/hero/tshirts/circularBG.webp'
import newDrop from '../assets/hero/tshirts/NewDrop.webp'
import limitedTag from '../assets/featuredDrop/limited-tag.webp'

const inr = (n) => '₹' + n.toLocaleString('en-IN')
const pad = (n) => String(n).padStart(2, '0')

// One tee on the shelf. `big` = the hero card of the bento grid (2×2 on desktop, full width on mobile).
// The whole card opens the product page, where size and colour are picked before anything goes in the cart.
export default function ProductCard({ p, rank, big, kind, liked, onLike }) {
  const title = displayName(p)
  const isBest = kind === 'best'
  const isShop = kind === 'shop'
  const soldOut = p.inStock === false
  const to = `/product/${p.slug}`

  return (
    <li data-sb="card" className={`flex ${big ? 'col-span-2 lg:row-span-2' : ''}`}>
      <article className="group relative flex w-full flex-col rounded-[22px] sm:rounded-[28px] border border-sand bg-cream p-2 sm:p-2.5 shadow-[0_1px_0_rgba(13,13,13,.04)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_40px_-22px_rgba(70,45,15,.45)] focus-within:-translate-y-1.5">
        {/* media */}
        <div className={`@container relative isolate overflow-hidden rounded-[16px] sm:rounded-[20px] bg-gradient-to-b from-sand/80 to-sand/40 ${big ? 'aspect-[5/4] sm:aspect-[16/10] lg:aspect-auto lg:min-h-0 lg:flex-1' : 'aspect-[4/4.5]'}`}>
          {isBest && (
            <span aria-hidden className={`absolute select-none font-black italic leading-none tracking-tighter text-ink/[0.07] [font-stretch:125%] ${big ? 'left-[4%] top-[2%] text-[30cqw] lg:text-[34cqw]' : 'left-[5%] top-[3%] text-[40cqw]'}`}>
              {pad(rank)}
            </span>
          )}
          <div aria-hidden className="absolute left-1/2 top-1/2 w-[88%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <img src={circle} alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false" className="block w-full opacity-80 transition-transform duration-[1600ms] ease-out group-hover:rotate-[60deg]" />
          </div>
          <img
            src={sized(p.img, 700)}
            srcSet={srcSet(p.img)}
            sizes={big ? '(min-width:1024px) 40vw, 92vw' : '(min-width:1024px) 20vw, 46vw'}
            alt={p.name}
            width="1200" height="1300" loading="lazy" decoding="async" draggable="false"
            className={`absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_22px_22px_rgba(70,45,15,.3)] transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.06] group-hover:-rotate-2 ${p.back ? 'group-hover:opacity-0' : ''} ${soldOut ? 'opacity-60 saturate-50' : ''} ${big ? 'p-[6%]' : 'p-[8%]'}`}
          />
          {p.back && (
            <img src={sized(p.back, 700)} alt="" aria-hidden width="1200" height="1300" loading="lazy" decoding="async" draggable="false"
              className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain opacity-0 drop-shadow-[0_22px_22px_rgba(70,45,15,.3)] transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.06] group-hover:rotate-2 group-hover:opacity-100 ${big ? 'p-[6%]' : 'p-[8%]'}`} />
          )}

          {/* top-left: what makes it special */}
          {kind === 'fresh' && big ? (
            <img src={newDrop} alt="New drop" width="1536" height="1024" loading="lazy" decoding="async" draggable="false" className="pointer-events-none absolute left-[2%] top-[0%] w-[34%] max-w-[230px] -rotate-3" />
          ) : isShop && !p.isBest && !p.isNew ? null : (
            <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white">
              {isBest || (isShop && p.isBest) ? <Flame size={12} className="fill-amber-300 text-amber-300" /> : <Sparkle size={11} className="fill-amber-300 text-amber-300" />}
              {isShop ? (p.isBest ? 'Best Seller' : 'New') : isBest ? (big ? 'No. 1 Best Seller' : `Top ${rank}`) : 'New'}
            </span>
          )}

          {/* top-right: save */}
          <button type="button" onClick={() => onLike(p.id)} aria-pressed={liked} aria-label={`Save ${title}`}
            className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 z-[2] grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-cream/85 text-ink backdrop-blur transition hover:bg-ink hover:text-white active:scale-90">
            <Heart size={17} className={`transition-colors duration-300 ${liked ? 'fill-olive text-olive' : ''}`} />
          </button>

          {/* bottom: limited tag + discount */}
          {p.limited && (
            <img src={limitedTag} alt="Limited run" width="1539" height="501" loading="lazy" decoding="async" draggable="false" className={`pointer-events-none absolute bottom-[6%] left-[3%] rotate-[-4deg] drop-shadow-[0_5px_6px_rgba(0,0,0,.25)] ${big ? 'w-[30%] max-w-[210px]' : 'w-[44%] sm:w-[52%]'}`} />
          )}
          {soldOut ? (
            <span className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 rounded-full bg-ink px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-white">Sold out</span>
          ) : (
            <span className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 rounded-full bg-olive px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white">{discount(p)}% OFF</span>
          )}
        </div>

        {/* details */}
        <div className={`flex flex-col ${big ? 'flex-1 lg:flex-none gap-3 px-2 pb-2 pt-4 lg:px-3 lg:pb-3' : 'flex-1 gap-2 px-1.5 pb-1.5 pt-3 sm:px-2 sm:pb-2'}`}>
          <div className="min-w-0">
            <h3 className={`font-black italic uppercase leading-[0.95] tracking-tight [font-stretch:112%] text-balance ${big ? 'text-[clamp(22px,2.6vw,46px)]' : 'text-[clamp(14px,1.35vw,24px)]'}`}>
              {/* stretched link: the whole card opens the product, while save / add stay clickable above it */}
              <Link to={to} className="after:absolute after:inset-0 after:z-[1] after:rounded-[28px] focus-visible:outline-none">{title}</Link>
            </h3>
            <p className="mt-1 text-[11px] sm:text-[13px] text-ink/55">{kindLine(p)}</p>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <b className={`tabular-nums ${big ? 'text-[clamp(20px,1.9vw,34px)]' : 'text-[clamp(16px,1.3vw,22px)]'}`}>{inr(p.price)}</b>
              <s className="text-[11px] sm:text-[13px] tabular-nums text-ink/45">{inr(p.mrp)}</s>
            </p>
            <Link to={to} aria-label={soldOut ? `${title}, sold out. View product` : `Choose size for ${title}`}
              className={`group/go relative z-[2] inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-ink font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-olive active:scale-95 ${soldOut ? 'opacity-60' : ''} ${big ? 'h-12 px-6 text-xs sm:text-[13px]' : 'h-10 w-10 sm:h-11 sm:w-11'}`}>
              {big && <span>{soldOut ? 'View' : 'Choose size'}</span>}
              <ArrowUpRight size={17} className="transition-transform duration-300 group-hover/go:translate-x-0.5 group-hover/go:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </article>
    </li>
  )
}