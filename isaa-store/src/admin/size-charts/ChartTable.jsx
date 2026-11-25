import { Plus, X } from 'lucide-react'
import { SIZE_GROUPS } from '../products/catalog'
import { bySizeOrder } from './table'

const MAX_COLUMNS = 6
const input = 'h-11 w-full min-w-[4.5rem] rounded-xl border border-sand bg-white/80 px-3 text-base tabular-nums outline-none hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] disabled:cursor-not-allowed disabled:bg-sand/30'

// The size table editor, used for a shared chart and for one product's own table. Measurements across the top (named by you), one row per size.
// `sizes` limits which sizes can be added (a product offers only its own sizes); omit it to offer every size.
// Values are in cm. `value` / `onChange` carry { columns, rows } with string values.
export default function ChartTable({ value, onChange, sizes, disabled = false, idPrefix = 'chart' }) {
  const { columns, rows } = value
  const offered = SIZE_GROUPS.flatMap((g) => g.sizes).filter((s) => s !== 'FREE' && (!sizes || sizes.includes(s)))
  const free = offered.filter((s) => !rows.some((r) => r.size === s))

  const setColumn = (i, name) => onChange({ ...value, columns: columns.map((c, n) => (n === i ? name : c)) })
  const addColumn = () => onChange({ columns: [...columns, ''], rows: rows.map((r) => ({ ...r, values: [...r.values, ''] })) })
  const removeColumn = (i) => onChange({ columns: columns.filter((_, n) => n !== i), rows: rows.map((r) => ({ ...r, values: r.values.filter((_, n) => n !== i) })) })
  const setValue = (size, i, v) => onChange({ ...value, rows: rows.map((r) => (r.size === size ? { ...r, values: r.values.map((x, n) => (n === i ? v.replace(/[^\d.]/g, '').slice(0, 6) : x)) } : r)) })
  const addSize = (size) => onChange({ ...value, rows: [...rows, { size, values: columns.map(() => '') }].sort(bySizeOrder) })
  const removeSize = (size) => onChange({ ...value, rows: rows.filter((r) => r.size !== size) })

  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1" role="region" aria-label="Size table, scrolls sideways if needed" tabIndex={0}>
        <table className="w-full min-w-[26rem] border-separate border-spacing-x-2 border-spacing-y-2 text-left">
          <thead>
            <tr className="align-bottom">
              <th scope="col" className="w-16 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Size</th>
              {columns.map((c, i) => (
                <th key={i} scope="col" className="min-w-[5.5rem] font-normal">
                  <div className="relative">
                    <input value={c} onChange={(e) => setColumn(i, e.target.value)} maxLength={24} placeholder="e.g. Chest" aria-label={`Measurement ${i + 1} name`} disabled={disabled} autoComplete="off" className={`${input} pr-9 font-bold`} />
                    {!disabled && columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(i)} aria-label={`Remove ${c.trim() || `measurement ${i + 1}`}`} className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink/45 hover:bg-ink hover:text-white"><X size={14} aria-hidden /></button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-9"><span className="sr-only">Remove size</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size}>
                <th scope="row" className="text-[15px] font-black">{r.size}</th>
                {r.values.map((v, i) => (
                  <td key={i}>
                    <input id={`${idPrefix}-${r.size}-${i}`} value={v} onChange={(e) => setValue(r.size, i, e.target.value)} inputMode="decimal" autoComplete="off" disabled={disabled} aria-label={`${r.size}, ${columns[i]?.trim() || `measurement ${i + 1}`}, in cm`} onFocus={(e) => e.target.select()} className={input} />
                  </td>
                ))}
                <td>{!disabled && <button type="button" onClick={() => removeSize(r.size)} aria-label={`Remove size ${r.size}`} className="grid size-9 place-items-center rounded-full border border-sand text-ink/55 hover:border-ink hover:text-ink"><X size={15} aria-hidden /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length + 2} className="rounded-xl border border-dashed border-sand px-4 py-5 text-center text-[13px] text-ink/55">No sizes yet. Add one below.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[12.5px] text-ink/55">All numbers in centimetres. Shoppers can switch to inches themselves.</p>

      {!disabled && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wide text-ink/50">Add size</span>
          {free.length ? free.map((s) => (
            <button key={s} type="button" onClick={() => addSize(s)} className="inline-flex h-9 min-w-11 items-center justify-center gap-1 rounded-full border border-sand bg-white/70 px-3 text-[13px] font-bold text-ink/70 hover:border-ink/40"><Plus size={12} aria-hidden />{s}</button>
          )) : <span className="text-[12.5px] text-ink/50">{sizes && !offered.length ? 'Pick this product’s sizes first.' : 'Every size is added.'}</span>}
          {columns.length < MAX_COLUMNS && <button type="button" onClick={addColumn} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/25 px-3.5 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white"><Plus size={14} aria-hidden />Add measurement</button>}
        </div>
      )}
    </div>
  )
}
