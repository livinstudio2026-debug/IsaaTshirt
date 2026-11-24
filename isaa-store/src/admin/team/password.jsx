import { useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { Field } from '../../components/form/Field'

const iconBtn = 'grid size-11 place-items-center rounded-full text-ink/60 transition-colors hover:bg-sand/60 hover:text-ink'

// The shared Field with a show / hide eye.
export function PasswordField({ id, label, error, hint, autoComplete = 'new-password', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <Field id={id} label={label} type={show ? 'text' : 'password'} autoComplete={autoComplete} maxLength={128} error={error} hint={hint} {...props}
      trailing={<button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className={iconBtn}>{show ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}</button>} />
  )
}

export function CopyChip({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* the text is on screen to select */ } }
  return (
    <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/20 px-3.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white">
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{done ? 'Copied' : label}
    </button>
  )
}
