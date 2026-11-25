// How an order looks in the back office: status names and colours, date formats, contact links.
export const STATUS = {
  placed: { label: 'New', tone: 'bg-amber-100 text-amber-900' },
  confirmed: { label: 'Confirmed', tone: 'bg-amber-100 text-amber-900' },
  packed: { label: 'Packed', tone: 'bg-sand text-ink' },
  shipped: { label: 'Shipped', tone: 'bg-sky-100 text-sky-900' },
  delivered: { label: 'Delivered', tone: 'bg-olive text-white' },
  cancelled: { label: 'Cancelled', tone: 'bg-red-100 text-red-800' },
}

export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
export const fullDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d < 8 ? `${d} day${d === 1 ? '' : 's'} ago` : dateTime(iso)
}

// whatsapp wants digits with the country code
export const whatsappLink = (phone) => `https://wa.me/91${String(phone).replace(/\D/g, '').slice(-10)}`
