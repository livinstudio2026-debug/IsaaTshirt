import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, CircleAlert, Eye, EyeOff, Info, LoaderCircle, Lock } from 'lucide-react'
import { Field } from '../../components/form/Field'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import Splash from '../Splash'

import logoLight from '../../assets/logo/logoLight.webp'
import paper from '../../assets/ShopByCategory/panel-tshirts.webp'
import facade from '../../assets/hero/FadedNeoclassicalFacadeBorder.webp'
import hanger from '../../assets/featuredDrop/hanger.webp'
import brushRight from '../../assets/featuredDrop/brush-right.webp'
import brushLeft from '../../assets/hero/tshirts/brush-left.webp'

const NOTICES = {
  expired: 'Your session ended. Please sign in again.',
  signedout: 'You’re signed out. See you soon.',
}
// only ever send people back to a back-office page
const safeFrom = (from) => (typeof from === 'string' && from.startsWith('/admin') && !from.startsWith('/admin/login') ? from : '/admin')

export default function Login() {
  useAdminPage('Sign in')
  const { status, login, notice, bootError } = useAdminAuth()
  const { state } = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [caps, setCaps] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => { if (status === 'anon') emailRef.current?.focus() }, [status])

  if (status === 'loading') return <Splash />
  if (status === 'authed') return <Navigate to={safeFrom(state?.from)} replace />

  const shake = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    cardRef.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
      { duration: 420, easing: 'ease-out' },
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const next = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter your email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    setError('')
    if (next.email || next.password) { (next.email ? emailRef : passwordRef).current?.focus(); return }

    setBusy(true)
    try {
      await login({ email: email.trim(), password, remember })
      // success: the provider flips to "authed" and this page redirects
    } catch (err) {
      setBusy(false)
      setPassword('')
      setError(err.message)
      shake()
      passwordRef.current?.focus()
    }
  }

  const notice_ = NOTICES[notice]

  return (
    <div className="min-h-svh bg-cream lg:grid lg:grid-cols-[46fr_54fr]">
      {/* brand side */}
      <aside className="relative isolate overflow-hidden bg-moss text-cream lg:min-h-svh">
        <img src={facade} alt="" aria-hidden width="1536" height="1024" decoding="async" className="pointer-events-none absolute -bottom-[6%] -left-[10%] -z-10 hidden w-[120%] max-w-none opacity-[.13] lg:block" />
        <img src={brushRight} alt="" aria-hidden decoding="async" className="pointer-events-none absolute -right-6 top-0 -z-10 h-[140%] w-auto opacity-[.12] mix-blend-screen" />

        <div className="flex h-full flex-col justify-between gap-8 px-5 py-5 sm:px-8 lg:px-12 lg:py-11 xl:px-14">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="Isaa store" className="inline-block"><img src={logoLight} alt="Isaa" width="2113" height="744" className="h-8 w-auto sm:h-10" /></Link>
            <span className="rounded-full border border-cream/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cream/80 sm:text-[11px]">Back office</span>
          </div>

          {/* the torn green paper: large screens only */}
          <div className="relative mx-auto hidden w-[min(92%,460px)] -rotate-3 lg:block" style={{ aspectRatio: '1145 / 1374' }}>
            <img src={paper} alt="" aria-hidden width="1145" height="1374" decoding="async" className="absolute inset-0 h-full w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.45)]" />
            <div className="absolute inset-0 flex flex-col justify-center px-[13%] py-[10%]">
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-cream/75">Isaa Studio · Team only</p>
              <h2 className="mt-4 font-black italic uppercase leading-[0.88] tracking-tight text-[clamp(44px,5vw,84px)]" style={{ fontVariationSettings: '"wdth" 84' }}>Run<br />the rack</h2>
              <p className="mt-3 -rotate-2 font-script text-[clamp(24px,2.4vw,40px)] leading-tight text-[#e3dc9a]">Orders, drops &amp; stock</p>
              <p className="mt-5 max-w-[26ch] text-[clamp(13px,1vw,16px)] leading-relaxed text-cream/80">Everything behind the storefront, in one place. Sign in with your team account.</p>
            </div>
          </div>

          <p className="hidden text-[12px] tracking-wide text-cream/55 lg:block">© {new Date().getFullYear()} Isaa. Authorised use only.</p>
        </div>
      </aside>

      {/* form side */}
      <main className="relative isolate flex items-center justify-center overflow-hidden px-5 pb-12 pt-6 sm:px-8 lg:min-h-svh lg:py-12">
        <img src={brushLeft} alt="" aria-hidden decoding="async" className="pointer-events-none absolute -left-10 bottom-0 -z-10 w-[55%] max-w-[420px] opacity-60 lg:left-auto lg:right-0 lg:w-[34%]" />

        <div className="w-full max-w-[440px] animate-[rise_.7s_ease-out_both] motion-reduce:animate-none">
          <img src={hanger} alt="" aria-hidden width="1150" height="697" className="mx-auto -mb-1 w-20 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none sm:w-24" />

          <div ref={cardRef} className="rounded-[28px] border border-sand bg-white/75 p-6 shadow-[0_30px_60px_-34px_rgba(70,45,15,.4)] backdrop-blur sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">Team sign-in</p>
            <h1 className="mt-2 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(32px,3.2vw,44px)]" style={{ fontVariationSettings: '"wdth" 88' }}>Welcome back</h1>
            <p className="mt-2 text-[15px] text-ink/60">Sign in to manage orders, products and messages.</p>

            <div className="mt-5 space-y-3 empty:hidden" aria-live="polite">
              {notice_ && !error && (
                <p role="status" className="flex items-start gap-2.5 rounded-2xl border border-olive/25 bg-olive/10 px-4 py-3 text-[14px] text-moss"><Info size={17} className="mt-0.5 shrink-0" aria-hidden />{notice_}</p>
              )}
              {bootError && !error && (
                <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{bootError}</p>
              )}
              {error && (
                <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{error}</p>
              )}
            </div>

            <form onSubmit={submit} noValidate className="mt-5">
              <Field id="email" label="Email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254}
                ref={emailRef} value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((s) => ({ ...s, email: '' })) }} error={errors.email} readOnly={busy} />
              <Field id="password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="current-password" maxLength={128} className="mt-1"
                ref={passwordRef} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((s) => ({ ...s, password: '' })) }}
                onKeyUp={(e) => setCaps(Boolean(e.getModifierState?.('CapsLock')))} onBlur={() => setCaps(false)}
                error={errors.password} hint={caps ? 'Caps Lock is on.' : undefined} readOnly={busy}
                trailing={
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}
                    className="grid h-10 w-10 place-items-center rounded-full text-ink/55 transition-colors hover:bg-sand/60 hover:text-ink">
                    {showPw ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                } />

              <label className="mt-1 flex cursor-pointer select-none items-start gap-3 text-[14px]">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} className="peer sr-only" />
                <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink/35 bg-white transition-colors peer-checked:border-olive peer-checked:bg-olive peer-checked:[&>svg]:opacity-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive">
                  <Check size={14} strokeWidth={3} className="text-white opacity-0 transition-opacity" />
                </span>
                <span>Keep me signed in for 7 days<span className="block text-[12.5px] text-ink/50">Only on your own device.</span></span>
              </label>

              <button type="submit" disabled={busy}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-ink text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive active:scale-[.99] disabled:cursor-wait disabled:opacity-80">
                {busy ? <><LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />Signing in…</> : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink/50">
              <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
              Authorised team members only. Repeated failed attempts pause the account for 15 minutes. Forgot your password? Ask the owner to reset it.
            </p>
          </div>

          <p className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink/60 transition-colors hover:text-ink"><ArrowLeft size={15} /> Back to store</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
