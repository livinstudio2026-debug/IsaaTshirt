import { Package, Ruler, RotateCcw, Handshake, MessageCircle } from 'lucide-react'

// Copy + options for the Contact page. Edit freely: nothing here is read by the server except the topic ids,
// which must match CONTACT_TOPICS in server/src/models/ContactMessage.js.
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'hello@isaa.store'
export const HOURS = 'Mon to Sat, 10 AM to 7 PM IST'
export const REPLY_TIME = 'Within 24 hours'

export const TOPICS = [
  { id: 'order', label: 'Order help', icon: Package },
  { id: 'sizing', label: 'Sizing', icon: Ruler },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'collab', label: 'Collab', icon: Handshake },
  { id: 'other', label: 'Something else', icon: MessageCircle },
]

export const FAQS = [
  { q: 'How does shipping work?', a: 'Orders above ₹1,499 ship free. COD is available, so you can pay when it arrives.' },
  { q: 'Can I return or exchange a piece?', a: 'Yes. Returns and exchanges are easy within 7 days. Pick “Returns” above and tell us your order number.' },
  { q: 'Which size should I pick?', a: 'Our tees are oversized, with drop shoulders and a boxy fit. Take your usual size for the intended look, or size down for a closer fit. Not sure? Pick “Sizing” and ask us.' },
]
