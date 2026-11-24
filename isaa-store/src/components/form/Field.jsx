import { CircleAlert, ChevronDown } from 'lucide-react'

// Floating-label inputs shared by checkout and order tracking (same look as the Contact form).
const base = 'peer block w-full rounded-2xl border bg-white/80 px-4 text-base text-ink shadow-[0_1px_0_rgba(13,13,13,.03)] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-ink/40 focus:border-olive focus:bg-white focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)]'
const floated = 'peer-focus:top-2 peer-focus:text-[11px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[0.14em] peer-focus:text-olive peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:text-[11px] peer-[&:not(:placeholder-shown)]:font-bold peer-[&:not(:placeholder-shown)]:uppercase peer-[&:not(:placeholder-shown)]:tracking-[0.14em]'

function Message({ id, error, hint }) {
  return (
    <div className="mt-1.5 flex min-h-[1.25rem] items-start gap-3 px-1">
      <p id={id} role={error ? 'alert' : undefined} className={`flex items-center gap-1.5 text-[13px] ${error ? 'font-medium text-red-700' : 'text-ink/50'}`}>
        {error ? (<><CircleAlert size={14} className="shrink-0" aria-hidden />{error}</>) : hint}
      </p>
    </div>
  )
}

export function Field({ id, label, optional, error, hint, multiline, trailing, className = '', ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  const msgId = `${id}-msg`
  return (
    <div className={className}>
      <div className="relative">
        <Tag id={id} name={id} placeholder=" " aria-invalid={error ? 'true' : undefined} aria-describedby={error || hint ? msgId : undefined} {...props}
          className={`${base} pb-2.5 pt-6 ${trailing ? 'pr-14!' : ''} ${multiline ? 'min-h-[6.5rem] resize-y leading-relaxed' : 'h-[3.75rem]'} ${error ? 'border-red-600/70 bg-red-50/40' : 'border-sand'}`} />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
        <label htmlFor={id} className={`pointer-events-none absolute left-4 top-[1.15rem] origin-left text-[15px] text-ink/50 transition-all duration-200 ${floated}`}>
          {label}{optional && <span className="font-normal normal-case tracking-normal"> (optional)</span>}
        </label>
      </div>
      <Message id={msgId} error={error} hint={hint} />
    </div>
  )
}

// A native <select> (best on phones) with an always-lifted label.
export function SelectField({ id, label, error, hint, options, placeholder = 'Select', className = '', value, ...props }) {
  const msgId = `${id}-msg`
  return (
    <div className={className}>
      <div className="relative">
        <select id={id} name={id} value={value} aria-invalid={error ? 'true' : undefined} aria-describedby={error || hint ? msgId : undefined} {...props}
          className={`${base} h-[3.75rem] appearance-none pb-2.5 pr-11 pt-6 ${value ? '' : 'text-ink/40'} ${error ? 'border-red-600/70 bg-red-50/40' : 'border-sand'}`}>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o} className="text-ink">{o}</option>)}
        </select>
        <label htmlFor={id} className="pointer-events-none absolute left-4 top-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50 transition-colors peer-focus:text-olive">{label}</label>
        <ChevronDown size={18} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink/50" />
      </div>
      <Message id={msgId} error={error} hint={hint} />
    </div>
  )
}
