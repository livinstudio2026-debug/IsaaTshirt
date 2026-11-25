// Shows `text` with the words the shopper typed picked out (from the start of a word, like the server matches them).
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default function Highlight({ text, q }) {
  const words = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 5)
  if (!words.length) return text
  const parts = text.split(new RegExp(`(?<![a-z0-9])(${words.map(escapeRe).join('|')})`, 'gi'))
  return parts.map((part, i) => (i % 2 ? <mark key={i} className="bg-olive/15 text-inherit rounded-[3px] px-px">{part}</mark> : part))
}
