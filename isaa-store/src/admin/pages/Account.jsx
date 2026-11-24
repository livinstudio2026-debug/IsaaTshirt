import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleAlert, LoaderCircle, ShieldCheck, Users } from 'lucide-react'
import { changeOwnPassword } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import { PageTitle } from '../products/ui'
import { PasswordField } from '../team/password'
import { ago } from '../orders/format'

// Your own account: who you are here, and your password. Everyone (owner and staff) can use it.
export default function Account() {
  useAdminPage('Account')
  const { admin } = useAdminAuth()
  const [form, setForm] = useState({ current: '', next: '', again: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState('')
  const [done, setDone] = useState(null) // { elsewhere }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setDone(null) }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const errs = {}
    if (!form.current) errs.current = 'Enter your current password.'
    if (form.next.length < 10) errs.next = 'Use at least 10 characters.'
    else if (form.next === form.current) errs.next = 'Choose a password you haven’t used just now.'
    if (form.again !== form.next) errs.again = 'The two passwords don’t match.'
    setErrors(errs); setFail(''); setDone(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await changeOwnPassword(form.current, form.next)
      setDone({ elsewhere: r.signedOutElsewhere })
      setForm({ current: '', next: '', again: '' })
    } catch (err) {
      const f = err.fields ?? {}
      setErrors({ current: f.currentPassword, next: f.newPassword })
      if (!Object.keys(f).length) setFail(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <PageTitle>Account</PageTitle>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:items-start">
        <section aria-label="You" className="rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-olive text-[20px] font-black text-white">{admin.name.trim()[0]?.toUpperCase()}</span>
          <h2 className="mt-4 break-words text-[22px] font-black">{admin.name}</h2>
          <p className="break-all text-[14.5px] text-ink/65">{admin.email}</p>
          <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink/65"><ShieldCheck size={16} className="shrink-0 text-olive" aria-hidden /><span><b className="capitalize text-ink">{admin.role}</b> · {admin.role === 'owner' ? 'full access' : 'orders, stock, visibility and the inbox'}</span></p>
          {admin.lastLoginAt && <p className="mt-1 text-[13px] text-ink/50">Signed in {ago(admin.lastLoginAt)}</p>}
          {admin.role === 'owner' && <Link to="/admin/team" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-olive underline-offset-4 hover:underline"><Users size={15} aria-hidden />Manage the team</Link>}
        </section>

        <form onSubmit={submit} noValidate className="rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6">
          <h2 className="text-[17px] font-black uppercase italic tracking-tight">Change password</h2>
          <p className="mt-1 text-[13.5px] text-ink/60">Other browsers signed in as you are signed out; this one stays.</p>
          <div className="mt-4">
            <PasswordField id="pw-current" label="Current password" autoComplete="current-password" value={form.current} onChange={set('current')} error={errors.current} />
            <PasswordField id="pw-new" label="New password" value={form.next} onChange={set('next')} error={errors.next} hint="10 or more characters. A few random words work well." />
            <PasswordField id="pw-again" label="New password again" value={form.again} onChange={set('again')} error={errors.again} />
          </div>
          <div aria-live="polite" className="empty:hidden">
            {fail && <p role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{fail}</p>}
            {done && <p role="status" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-olive/25 bg-olive/10 px-4 py-3 text-[14px] font-medium text-moss"><Check size={17} className="mt-0.5 shrink-0" aria-hidden />Password changed.{done.elsewhere > 0 && ` Signed out of ${done.elsewhere} other browser${done.elsewhere === 1 ? '' : 's'}.`}</p>}
          </div>
          <button type="submit" disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-olive disabled:cursor-wait disabled:opacity-80">
            {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  )
}
