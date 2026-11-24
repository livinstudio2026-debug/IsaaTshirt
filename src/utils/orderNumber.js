import crypto from 'node:crypto'

// ISA-241121-7K3M9Q: ISA, today's date in India (YYMMDD), then 6 random characters.
// Crockford base32 (no I, L, O, U) so nothing is mistaken for a 1 or a 0 when read aloud or copied by hand.
// The date makes numbers readable at a glance and means the random part only has to be unique within a day;
// the database's unique index is still the final judge (createOrder draws again on the rare clash).
// Orders placed before the date was added (ISA-7K3M9QX2) keep working everywhere.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RANDOM_LENGTH = 6

const istDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' })
export function dateStamp(date = new Date()) {
  const p = Object.fromEntries(istDate.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.year}${p.month}${p.day}`
}

export const newOrderNumber = (date = new Date()) =>
  `ISA-${dateStamp(date)}-${Array.from({ length: RANDOM_LENGTH }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}`

export const ORDER_NUMBER_RE = /^ISA-(?:\d{6}-[0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{8})$/

// Forgiving input: "isa 241121 7k3m9q", "ISA2411217K3M9Q", "isa-241121-7k3m9q" and the old "isa 7k3m9qx2" all find their order.
// O is read as 0 and I / L as 1, because those letters never appear in a number.
// Returns the canonical number, or null when it can't be one.
export function normaliseOrderNumber(input) {
  const typed = String(input ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!typed.startsWith('ISA')) return null
  const raw = typed.slice(3).replace(/O/g, '0').replace(/[IL]/g, '1')
  const canonical = raw.length === 12 ? `ISA-${raw.slice(0, 6)}-${raw.slice(6)}` : raw.length === 8 ? `ISA-${raw}` : null
  return canonical && ORDER_NUMBER_RE.test(canonical) ? canonical : null
}
