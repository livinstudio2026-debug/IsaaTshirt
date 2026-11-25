import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Ban, CircleAlert, KeyRound, LoaderCircle, LockOpen, RefreshCw, ShieldCheck, UserPlus, UserRoundCheck } from 'lucide-react'
import { addTeamMember, listTeam, setTeamPassword, unlockTeamMember, updateTeamMember } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { Field } from '../../components/form/Field'
import { useAdminPage } from '../useAdminPage'
import { Dialog } from '../orders/shared'
import ConfirmDialog from '../orders/ConfirmDialog'
import { ago } from '../orders/format'
import { btnGhost, btnSolid, ErrorBanner, PageTitle } from '../products/ui'
import { useToast } from '../products/useToast'
import { CopyChip, PasswordField } from '../team/password'
import { generatePassword } from '../team/generatePassword'

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide'

function Badges({ m }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${pill} ${m.role === 'owner' ? 'bg-ink text-white' : 'bg-sand text-ink'}`}>{m.role}</span>
      {m.isYou && <span className={`${pill} bg-olive/12 text-olive`}>You</span>}
      {!m.isActive && <span className={`${pill} bg-red-100 text-red-800`}>Disabled</span>}
      {m.locked && <span className={`${pill} bg-amber-100 text-amber-900`}>Paused</span>}
    </span>
  )
}

// One dialog for both "add someone" and "set a new password": a password field, a generator, and (once saved) the details to hand over.
function CredentialsDialog({ open, onClose, mode, member, onDone }) {
  const adding = mode === 'add'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { email, password } shown once after saving
  const [fail, setFail] = useState('')
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })) }
  const close = () => { if (!busy) onClose() }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const errs = {}
    if (adding && form.name.trim().length < 2) errs.name = 'Enter their name.'
    if (adding && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Enter a valid email.'
    if (form.password.length < 10) errs.password = 'Use at least 10 characters. “Make one” does it for you.'
    setErrors(errs); setFail('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      if (adding) await addTeamMember({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      else await setTeamPassword(member.id, form.password)
      setDone({ email: adding ? form.email.trim().toLowerCase() : member.email, password: form.password })
      onDone()
    } catch (err) {
      setErrors(err.fields ?? {})
      if (!Object.keys(err.fields ?? {}).length) setFail(err.message)
    } finally { setBusy(false) }
  }

  const sign = `${location.origin}/admin/login`
  return (
    <Dialog open={open} onClose={close} title={adding ? 'Add a team member' : 'Set a new password'} busy={busy} wide>
      {done ? (
        <div>
          <span className="grid size-12 place-items-center rounded-full bg-olive/15 text-olive"><UserRoundCheck size={22} aria-hidden /></span>
          <h2 className="mt-4 text-[26px] font-black uppercase italic leading-none tracking-tight">{adding ? 'Account ready' : 'Password changed'}</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink/70">Share these with {adding ? form.name.trim() : member.name} privately. This is the only time the password is shown{adding ? '; they can change it under Account' : '. They’ve been signed out everywhere'}.</p>
          <dl className="mt-4 space-y-2 rounded-2xl border border-sand bg-white/70 p-4 text-[14.5px]">
            <div className="flex justify-between gap-3"><dt className="text-ink/55">Sign in at</dt><dd className="break-all text-right font-semibold">{sign}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/55">Email</dt><dd className="break-all text-right font-semibold">{done.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/55">Password</dt><dd className="break-all text-right font-mono font-bold">{done.password}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2"><CopyChip text={`Sign in at ${sign}\nEmail: ${done.email}\nPassword: ${done.password}`} label="Copy all three" /></div>
          <div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className={btnSolid}>Done</button></div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h2 className="text-[26px] font-black uppercase italic leading-none tracking-tight">{adding ? 'Add a team member' : 'Set a new password'}</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink/70">{adding ? 'They get the staff role: orders, stock, visibility, the inbox. Prices, pictures, the team and reels stay with the owner.' : <>For <b className="text-ink">{member.name}</b>. They’ll be signed out everywhere and use this next time.</>}</p>
          <div className="mt-5">
            {adding && <Field id="t-name" label="Name" autoComplete="off" maxLength={80} value={form.name} onChange={set('name')} error={errors.name} />}
            {adding && <Field id="t-email" label="Email" type="email" autoComplete="off" value={form.email} onChange={set('email')} error={errors.email} />}
            <PasswordField id="t-pw" label="Password" value={form.password} onChange={set('password')} error={errors.password} hint="10 or more characters." />
            <button type="button" onClick={() => { setForm((f) => ({ ...f, password: generatePassword() })); setErrors((x) => ({ ...x, password: '' })) }} className="-mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-olive underline-offset-4 hover:underline"><KeyRound size={14} aria-hidden />Make one for me</button>
          </div>
          {fail && <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{fail}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={busy} className="h-12 rounded-full border border-ink/25 px-6 text-[13px] font-bold uppercase tracking-wide hover:border-ink disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-olive disabled:cursor-wait disabled:opacity-80">
              {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : adding ? 'Create account' : 'Save password'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

export default function Team() {
  useAdminPage('Team')
  const { admin } = useAdminAuth()
  const [toast, say] = useToast()
  const [team, setTeam] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [dialog, setDialog] = useState(null) // { kind: 'add' } | { kind: 'password' | 'disable' | 'enable', member }
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    const ac = new AbortController()
    listTeam(ac.signal).then((t) => { setTeam(t); setError('') }, (err) => { if (err.name !== 'AbortError') setError(err.message) })
    return () => ac.abort()
  }, [tick])
  const reload = () => setTick((n) => n + 1)

  if (admin.role !== 'owner') return <Navigate to="/admin" replace />
  if (error) return <div className="space-y-5"><PageTitle>Team</PageTitle><ErrorBanner onRetry={() => { setError(''); reload() }}>{error}</ErrorBanner></div>

  const unlock = async (m) => {
    setBusyId(m.id)
    try { await unlockTeamMember(m.id); say(`${m.name} can sign in again.`); reload() } catch (err) { say(err.message, 'error') } finally { setBusyId('') }
  }
  const active = team?.filter((m) => m.isActive).length ?? 0

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Team</PageTitle>
          <p className="mt-3 max-w-xl text-[15px] text-ink/65">Who can sign in to the back office. Everything you do here also works from the terminal, but this is easier when you’re hiring.</p>
        </div>
        <button type="button" onClick={() => setDialog({ kind: 'add' })} className={btnSolid}><UserPlus size={16} aria-hidden />Add staff</button>
      </div>

      {!team ? (
        <div aria-hidden className="mt-6 space-y-3">{[0, 1].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none" />)}</div>
      ) : (
        <>
          <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.14em] text-ink/50">{active} active · {team.length - active} disabled</p>
          <ul className="mt-3 space-y-3">
            {team.map((m) => (
              <li key={m.id} className={`rounded-[22px] border border-sand bg-white/70 p-4 sm:p-5 ${m.isActive ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-full text-[17px] font-black text-white ${m.role === 'owner' ? 'bg-ink' : 'bg-olive'}`}>{m.name.trim()[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><b className="break-words text-[17px]">{m.name}</b><Badges m={m} /></p>
                    <p className="break-all text-[14px] text-ink/65">{m.email}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink/50">{m.lastLoginAt ? `Last signed in ${ago(m.lastLoginAt)}` : 'Hasn’t signed in yet'}{m.signedIn > 0 && ` · ${m.signedIn} browser${m.signedIn === 1 ? '' : 's'} signed in now`}</p>
                  </div>
                  {!m.isYou && (
                    <div className="flex flex-wrap gap-2">
                      {m.locked && <button type="button" disabled={busyId === m.id} onClick={() => unlock(m)} className={btnGhost}>{busyId === m.id ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LockOpen size={14} aria-hidden />}Unlock</button>}
                      {m.role === 'staff' && <button type="button" onClick={() => setDialog({ kind: 'password', member: m })} className={btnGhost}><KeyRound size={14} aria-hidden />New password</button>}
                      {m.isActive
                        ? <button type="button" onClick={() => setDialog({ kind: 'disable', member: m })} className="inline-flex h-10 items-center gap-2 rounded-full border border-red-700/40 px-4 text-[12px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-700 hover:text-white"><Ban size={14} aria-hidden />Disable</button>
                        : <button type="button" onClick={() => setDialog({ kind: 'enable', member: m })} className={btnGhost}><ShieldCheck size={14} aria-hidden />Enable</button>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2 text-[13px] text-ink/55"><RefreshCw size={14} className="mt-0.5 shrink-0" aria-hidden />Disabling someone signs them out of every browser straight away. Their past work stays in each order’s and product’s history under their name. An owner’s password is changed by that owner, under Account.</p>
        </>
      )}

      {dialog?.kind === 'add' && <CredentialsDialog open mode="add" onClose={() => setDialog(null)} onDone={reload} />}
      {dialog?.kind === 'password' && <CredentialsDialog open mode="password" member={dialog.member} onClose={() => setDialog(null)} onDone={reload} />}
      {(dialog?.kind === 'disable' || dialog?.kind === 'enable') && (
        <ConfirmDialog open danger={dialog.kind === 'disable'} onClose={() => setDialog(null)} title={dialog.kind === 'disable' ? `Disable ${dialog.member.name}?` : `Enable ${dialog.member.name}?`}
          confirmLabel={dialog.kind === 'disable' ? 'Disable and sign out' : 'Enable'} busyLabel="Saving…"
          onConfirm={async () => { await updateTeamMember(dialog.member.id, { isActive: dialog.kind === 'enable' }); say(dialog.kind === 'disable' ? `${dialog.member.name} is disabled and signed out.` : `${dialog.member.name} can sign in again.`); setDialog(null); reload() }}>
          <p>{dialog.kind === 'disable' ? 'They’re signed out of every browser right now and can’t sign in until you enable them again. Nothing they did is deleted.' : 'They can sign in again with their existing password.'}</p>
        </ConfirmDialog>
      )}
      {toast}
    </div>
  )
}
