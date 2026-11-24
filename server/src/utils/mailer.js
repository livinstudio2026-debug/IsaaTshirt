import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transport
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  }))

// Tests swap the transport for a fake so they can see what would have been sent (nothing else uses this).
let override = null
export const setMailOverride = (fn) => { override = fn }

// Generic sender. Returns false when SMTP isn't configured. `from` is the shop address; replies go to `replyTo`.
export async function sendMail({ to, subject, text, html, replyTo }) {
  if (override) { await override({ to, subject: oneLine(subject), text, html, replyTo }); return true }
  if (!env.smtpEnabled) return false
  await getTransport().sendMail({ from: env.CONTACT_FROM ?? env.CONTACT_TO, to, replyTo, subject: oneLine(subject), text, html })
  return true
}

const TOPIC_LABEL = { order: 'Order help', sizing: 'Sizing', returns: 'Returns & exchanges', collab: 'Collab / wholesale', other: 'General' }
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim()

// Notifies the shop owner of a new contact message. Plain text only (no HTML to inject into).
// Returns false when SMTP isn't configured.
export async function sendContactEmail(msg) {
  if (!env.smtpEnabled) return false
  await getTransport().sendMail({
    from: env.CONTACT_FROM ?? env.CONTACT_TO,
    to: env.CONTACT_TO,
    replyTo: msg.email,
    subject: `Isaa contact [${TOPIC_LABEL[msg.topic] ?? 'General'}]: ${oneLine(msg.name)}`,
    text: [`Topic: ${TOPIC_LABEL[msg.topic] ?? 'General'}`, `Name: ${oneLine(msg.name)}`, `Email: ${msg.email}`, msg.phone ? `Phone: ${msg.phone}` : null, '', msg.message].filter((l) => l !== null).join('\n'),
  })
  return true
}
