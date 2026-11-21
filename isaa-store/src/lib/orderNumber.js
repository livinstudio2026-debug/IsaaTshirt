// Mirrors the server (utils/orderNumber.js): "isa 241121 7k3m9q", "ISA2411217K3M9Q" and the older "isa 7k3m9qx2" all find their order.
// O is read as 0 and I / L as 1, because those letters never appear in a number.
export const ORDER_RE = /^ISA-(?:\d{6}-[0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{8})$/

export function normaliseOrderNumber(input) {
  const typed = String(input ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!typed.startsWith('ISA')) return typed
  const raw = typed.slice(3).replace(/O/g, '0').replace(/[IL]/g, '1')
  if (raw.length === 12) return `ISA-${raw.slice(0, 6)}-${raw.slice(6)}`
  if (raw.length === 8) return `ISA-${raw}`
  return typed
}
