import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Clock, Copy, LoaderCircle, Mail, Plus, Sparkle } from 'lucide-react'
import { sendContact } from '../lib/api'
import { HANDLE, PROFILE_URL } from '../data/instagram'
import { CONTACT_EMAIL, FAQS, HOURS, REPLY_TIME, TOPICS } from '../data/contact'

import hanger from '../assets/featuredDrop/hanger.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'

gsap.registerPlugin(useGSAP)

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------- validation (mirrors the server's rules)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/
const MAX_MESSAGE = 2000

const RULES = {
  name: (v) => (v.trim().length < 2 ? 'Please enter your name' : ''),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email'),
  phone: (v) => (!v.trim() || PHONE_RE.test(v.trim()) ? '' : 'Please enter a valid phone number'),
  message: (v) => (v.trim().length < 10 ? 'Tell us a little more (at least 10 characters)' : ''),
}
const validateAll = (values) => Object.fromEntries(Object.keys(RULES).map((k) => [k, RULES[k](values[k])]).filter(([, msg]) => msg))

const EMPTY = { topic: 'other', name: '', email: '', phone: '', message: '', website: '' }

// ---------------------------------------------------------------- small pieces

function InstagramGlyph({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </svg>
  )
}

// Floating-label input / textarea. The label sits inside the field and lifts when it has focus or a value.
function Field({ id, label, optional, error, multiline, counter, className = '', ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  const errId = `${id}-error`
  return (
    <div className={className}>
      <div className="relative">
        <Tag
          id={id}
          name={id}
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errId : undefined}
          {...props}
          className={`peer block w-full rounded-2xl border bg-white/80 px-4 pb-2.5 pt-6 text-base text-ink shadow-[0_1px_0_rgba(13,13,13,.03)] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-ink/40 focus:border-olive focus:bg-white focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] ${multiline ? 'min-h-[9.5rem] resize-y leading-relaxed' : 'h-[3.75rem]'} ${error ? 'border-red-600/70 bg-red-50/40' : 'border-sand'}`}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-[1.15rem] origin-left text-[15px] text-ink/50 transition-all duration-200 peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[0.14em] peer-focus:text-olive peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:text-[11px] peer-[&:not(:placeholder-shown)]:font-bold peer-[&:not(:placeholder-shown)]:uppercase peer-[&:not(:placeholder-shown)]:tracking-[0.14em]"
        >
          {label}{optional && <span className="font-normal normal-case tracking-normal"> (optional)</span>}
        </label>
      </div>
      <div className="mt-1.5 flex min-h-[1.25rem] items-start justify-between gap-3 px-1">
        <p id={errId} role={error ? 'alert' : undefined} className="flex items-center gap-1.5 text-[13px] font-medium text-red-700">
          {error && (<><CircleAlert size={14} className="shrink-0" aria-hidden />{error}</>)}
        </p>
        {counter}
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, title, children, href, external, dark }) {
  const body = (
    <>
      <span className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300 ${dark ? 'bg-cream/10 text-amber-300' : 'bg-olive/10 text-olive group-hover:bg-olive group-hover:text-white'}`}>
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] font-bold uppercase tracking-[0.16em] ${dark ? 'text-cream/55' : 'text-ink/50'}`}>{title}</span>
        <span className="mt-0.5 block break-words text-[17px] font-bold leading-snug">{children}</span>
      </span>
    </>
  )
  const cls = `group flex items-center gap-4 rounded-[22px] p-4 sm:p-5 ${dark ? 'bg-moss text-cream' : 'border border-sand bg-white/60'}`
  if (!href) return <div className={cls}>{body}</div>
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`${cls} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(13,13,13,.45)]`}>
      {body}
      <ArrowUpRight size={20} className={`shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${dark ? 'text-cream/60' : 'text-ink/35'}`} aria-hidden />
    </a>
  )
}

function EmailCard() {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    try { await navigator.clipboard.writeText(CONTACT_EMAIL) } catch { return } // blocked (e.g. http): the mailto link still works
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="flex items-center gap-2 rounded-[22px] bg-moss p-4 text-cream sm:p-5">
      <a href={`mailto:${CONTACT_EMAIL}`} className="group flex min-w-0 flex-1 items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cream/10 text-amber-300"><Mail size={20} aria-hidden /></span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-cream/55">Email us</span>
          <span className="mt-0.5 block break-words text-[17px] font-bold leading-snug underline decoration-cream/25 decoration-2 underline-offset-4 transition-colors group-hover:decoration-amber-300">{CONTACT_EMAIL}</span>
        </span>
      </a>
      <button type="button" onClick={copy} aria-label={copied ? 'Email copied' : 'Copy email address'} className="grid size-11 shrink-0 place-items-center rounded-full border border-cream/20 text-cream/80 transition-colors hover:bg-cream/10 hover:text-white">
        {copied ? <Check size={18} className="text-amber-300" aria-hidden /> : <Copy size={18} aria-hidden />}
      </button>
      <span className="sr-only" role="status">{copied ? 'Email address copied' : ''}</span>
    </div>
  )
}

function Faq() {
  return (
    <div className="divide-y divide-sand rounded-[22px] border border-sand bg-white/60">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-bold">
            {f.q}
            <Plus size={18} className="shrink-0 text-olive transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="pb-4 text-[15px] leading-relaxed text-ink/65">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

function Sent({ onAgain }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center px-2 py-8 text-center animate-[zoom-in_.45s_ease-out] motion-reduce:animate-none">
      <span className="grid size-20 place-items-center rounded-full bg-olive text-white shadow-[0_14px_30px_-12px_rgba(107,106,34,.7)]"><Check size={36} strokeWidth={3} aria-hidden /></span>
      <h2 ref={ref} tabIndex={-1} className="mt-6 font-black italic uppercase leading-[0.95] tracking-tight text-4xl outline-none sm:text-5xl" style={{ fontVariationSettings: '"wdth" 84' }}>Message sent</h2>
      <p className="mt-2 -rotate-2 font-script text-[26px] leading-none text-olive">Talk soon</p>
      <p role="status" className="mt-5 max-w-sm text-[15px] text-ink/65">Thanks! We’ve got it and will get back to you. Our usual reply time: {REPLY_TIME.toLowerCase()}.</p>
      <button type="button" onClick={onAgain} className="mt-7 inline-flex items-center rounded-full border border-ink px-7 py-3 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">Send another message</button>
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function Contact() {
  const [params] = useSearchParams()
  const presetTopic = TOPICS.some((t) => t.id === params.get('topic')) ? params.get('topic') : 'other'
  const [values, setValues] = useState({ ...EMPTY, topic: presetTopic })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [serverError, setServerError] = useState('')
  const root = useRef(null)
  const form = useRef(null)

  useEffect(() => {
    document.title = 'Contact — Isaa'
    return () => { document.title = 'Isaa — Wear the Vibe' }
  }, [])

  useGSAP(() => {
    if (calm()) return
    gsap.from('[data-c=rise]', { y: 28, opacity: 0, duration: 0.75, ease: 'power3.out', stagger: 0.09, clearProps: 'all' })
  }, { scope: root })

  const set = (name) => (e) => {
    const v = e.target.value
    setValues((s) => ({ ...s, [name]: v }))
    if (errors[name] && RULES[name]) setErrors((er) => ({ ...er, [name]: RULES[name](v) })) // clear the message as soon as it's fixed
  }
  const blur = (name) => () => { if (RULES[name] && values[name]) setErrors((er) => ({ ...er, [name]: RULES[name](values[name]) })) }

  const submit = async (e) => {
    e.preventDefault()
    if (status === 'sending') return
    const found = validateAll(values)
    setErrors(found)
    setServerError('')
    if (Object.keys(found).length) {
      requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    setStatus('sending')
    try {
      await sendContact({ topic: values.topic, name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), message: values.message.trim(), website: values.website })
      setStatus('sent')
    } catch (err) {
      setStatus('idle')
      setErrors(err.fields ?? {})
      setServerError(err.message)
    }
  }

  const again = () => { setValues({ ...EMPTY, topic: presetTopic }); setErrors({}); setServerError(''); setStatus('idle') }
  const left = MAX_MESSAGE - values.message.length

  return (
    <section ref={root} aria-labelledby="contact-heading" className="relative isolate overflow-hidden bg-cream pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pb-[7vw] lg:pt-[4vw]">
      <div className="mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">

        {/* header */}
        <header className="relative">
          <p data-c="rise" className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em]">
            <Sparkle size={13} className="fill-amber-400 text-amber-400" aria-hidden /> Contact
          </p>
          <h1 id="contact-heading" data-c="rise" className="mt-5 font-black italic uppercase leading-[0.88] tracking-tight text-[clamp(3.25rem,11vw,9.5rem)]" style={{ fontVariationSettings: '"wdth" 84' }}>
            Let’s talk
          </h1>
          <div data-c="rise" className="mt-2 inline-block -rotate-2">
            <p className="whitespace-nowrap font-script text-[clamp(1.75rem,4.2vw,3.5rem)] leading-[1.1] text-olive">We actually reply</p>
            <img src={underline} alt="" aria-hidden className="mt-1 h-[clamp(8px,1.1vw,16px)] w-[94%] object-fill" />
          </div>
          <p data-c="rise" className="mt-6 max-w-xl text-[clamp(15px,1.15vw,18px)] leading-relaxed text-ink/65">
            Order question, sizing doubt, a collab idea or just a hello. Send it over and a real person from the crew will write back.
          </p>
          <img src={hanger} alt="" aria-hidden width="1150" height="697" className="pointer-events-none absolute -top-2 right-0 hidden w-[9vw] max-w-40 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none md:block" />
        </header>

        <div className="mt-10 grid gap-6 sm:mt-14 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)] lg:items-start lg:gap-[3.5vw]">

          {/* ways to reach us */}
          <aside data-c="rise" aria-label="Other ways to reach us" className="order-2 space-y-3 lg:order-1 lg:sticky lg:top-[140px]">
            <EmailCard />
            <InfoCard icon={InstagramGlyph} title="Instagram" href={PROFILE_URL} external>@{HANDLE}</InfoCard>
            <InfoCard icon={Clock} title="Reply time">{REPLY_TIME}<span className="mt-0.5 block text-[14px] font-medium text-ink/55">{HOURS}</span></InfoCard>
            <div className="pt-5">
              <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-[0.18em] text-ink/55">Quick answers</h2>
              <Faq />
            </div>
          </aside>

          {/* the form */}
          <div data-c="rise" className="order-1 lg:order-2">
            <div className="relative rounded-[28px] border border-sand bg-white/70 p-5 shadow-[0_30px_60px_-40px_rgba(13,13,13,.45)] backdrop-blur-sm sm:p-8 lg:p-[2.6vw]">
              {status === 'sent' ? <Sent onAgain={again} /> : (
                <form ref={form} onSubmit={submit} noValidate aria-label="Contact form" aria-busy={status === 'sending'}>
                  <fieldset className="min-w-0">
                    <legend className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-ink/55">What’s it about?</legend>
                    <div className="flex flex-wrap gap-2">
                      {TOPICS.map(({ id, label, icon: Icon }) => (
                        <label key={id} className="cursor-pointer">
                          <input type="radio" name="topic" value={id} checked={values.topic === id} onChange={set('topic')} className="peer sr-only" />
                          <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 py-2.5 text-[13px] font-bold transition-all duration-200 hover:border-ink/50 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive">
                            <Icon size={15} aria-hidden />{label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="mt-7 grid gap-x-4 sm:grid-cols-2">
                    <Field id="name" label="Your name" autoComplete="name" maxLength={80} value={values.name} onChange={set('name')} onBlur={blur('name')} error={errors.name} />
                    <Field id="email" type="email" label="Email" autoComplete="email" inputMode="email" maxLength={254} value={values.email} onChange={set('email')} onBlur={blur('email')} error={errors.email} />
                  </div>
                  <Field id="phone" type="tel" label="Phone" optional autoComplete="tel" inputMode="tel" maxLength={20} className="mt-1" value={values.phone} onChange={set('phone')} onBlur={blur('phone')} error={errors.phone} />
                  <Field
                    id="message" multiline label="How can we help?" maxLength={MAX_MESSAGE} className="mt-1"
                    value={values.message} onChange={set('message')} onBlur={blur('message')} error={errors.message}
                    counter={<span className={`shrink-0 text-[12px] tabular-nums ${left < 100 ? 'font-bold text-red-700' : 'text-ink/40'}`} aria-live="off">{values.message.length}/{MAX_MESSAGE}</span>}
                  />

                  {/* honeypot: people never see or reach it, bots fill it */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label>Leave this empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} /></label>
                  </div>

                  {serverError && (
                    <p role="alert" className="mt-2 flex items-start gap-2 rounded-2xl border border-red-600/30 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-800">
                      <CircleAlert size={18} className="mt-px shrink-0" aria-hidden />{serverError}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-ink/50">We only use your details to reply to you.</p>
                    <button type="submit" disabled={status === 'sending'} className="group inline-flex items-center justify-center gap-3 rounded-full bg-ink px-9 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive disabled:cursor-wait disabled:opacity-80">
                      {status === 'sending'
                        ? (<><LoaderCircle size={18} className="animate-spin" aria-hidden /> Sending…</>)
                        : (<>Send message <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden /></>)}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
