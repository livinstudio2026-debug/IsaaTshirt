import { Link } from 'react-router-dom'
import { categories } from '../data/categories'

// The four shelves as picture tiles: a quick way in when nothing has been typed yet (search panel and search page).
export default function CategoryTiles({ onPick, stop = false, cols = 'grid-cols-2' }) {
  return (
    <ul className={`grid ${cols} gap-2.5 sm:gap-3`}>
      {categories.map((c) => (
        <li key={c.id}>
          <Link {...(stop ? { 'data-stop': true } : {})} to={`/shop/${c.id}`} onClick={onPick}
            className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-sand bg-gradient-to-b from-sand/70 to-sand/30 outline-none transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_14px_26px_-18px_rgba(70,45,15,.5)] focus-visible:ring-2 focus-visible:ring-olive">
            <span className="grid aspect-[4/3] place-items-center p-2">
              <img src={c.product} alt="" loading="lazy" decoding="async" draggable="false" className="max-h-full max-w-full object-contain drop-shadow-[0_10px_10px_rgba(70,45,15,.28)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2" />
            </span>
            <span className="flex items-center justify-between gap-2 px-3 pb-2.5 text-[12px] font-black uppercase italic tracking-tight sm:text-[13px]">
              {c.label}<span aria-hidden className="text-olive transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
