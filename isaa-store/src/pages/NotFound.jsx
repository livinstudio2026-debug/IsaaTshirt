import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import hanger from '../assets/featuredDrop/hanger.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'

export default function NotFound() {
  return (
    <section aria-labelledby="nf-heading" className="relative isolate overflow-hidden bg-cream px-5 py-[16vw] text-center sm:py-[10vw] lg:py-[6vw]">
      <img src={hanger} alt="" aria-hidden width="1150" height="697" className="mx-auto w-28 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none sm:w-36 lg:w-[11vw]" />
      <h1 id="nf-heading" className="mt-4 font-black italic uppercase leading-[0.9] tracking-tight text-[22vw] sm:text-[16vw] lg:text-[10vw]" style={{ fontVariationSettings: '"wdth" 84' }}>404</h1>
      <div className="mt-2 inline-block -rotate-2">
        <p className="whitespace-nowrap font-script text-[9vw] leading-[1.1] text-olive sm:text-[6vw] lg:text-[3vw]">Lost in the streets</p>
        <img src={underline} alt="" aria-hidden className="mt-1 h-[2.4vw] w-[92%] object-fill lg:h-[1vw]" />
      </div>
      <p className="mx-auto mt-6 max-w-md text-[clamp(15px,1.1vw,18px)] text-ink/65">That page isn’t on the rack. Head back and keep browsing.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className="group inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">
          Shop all <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <Link to="/" className="inline-flex items-center rounded-full border border-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">Home</Link>
      </div>
    </section>
  )
}
