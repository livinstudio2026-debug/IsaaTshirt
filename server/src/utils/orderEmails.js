import { sendMail } from './mailer.js'
import { Order } from '../models/Order.js'
import { env } from '../config/env.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const money = (paise) => '₹' + Math.round(paise / 100).toLocaleString('en-IN')
const site = () => env.clientOrigins[0] ?? ''
const trackUrl = (o) => `${site()}/track?order=${encodeURIComponent(o.orderNumber)}`
const payLabel = (o) => (o.payment.method === 'cod' ? `Cash on delivery: pay ${money(o.totals.total)} when it arrives` : 'Paid online')

const addressLines = (a) => [a.line1, a.line2, a.landmark && `Near ${a.landmark}`, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean)

function itemRows(o) {
  return o.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e9dcc8;font:600 14px Arial,sans-serif;color:#0d0d0d">${esc(i.name)}<br><span style="font-weight:400;color:#6b6a62">${esc([i.color, i.size && `Size ${i.size}`].filter(Boolean).join(' · '))} · Qty ${i.qty}</span></td>
        <td style="padding:12px 0;border-bottom:1px solid #e9dcc8;font:600 14px Arial,sans-serif;color:#0d0d0d;text-align:right;white-space:nowrap">${money(i.price * i.qty)}</td></tr>`,
    )
    .join('')
}

function totalsRows(o) {
  const row = (l, v, strong) => `<tr><td style="padding:4px 0;font:${strong ? '700 16px' : '14px'} Arial,sans-serif;color:#0d0d0d">${l}</td><td style="padding:4px 0;font:${strong ? '700 16px' : '14px'} Arial,sans-serif;color:#0d0d0d;text-align:right">${v}</td></tr>`
  return (
    row('Subtotal', money(o.totals.subtotal)) +
    row('Shipping', o.totals.shipping ? money(o.totals.shipping) : 'Free') +
    (o.totals.codFee ? row('COD fee', money(o.totals.codFee)) : '') +
    row('Total', money(o.totals.total), true)
  )
}

const frame = (title, body) => `<!doctype html><html><body style="margin:0;background:#fbf2e6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf2e6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e9dcc8;border-radius:16px">
<tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:22px 28px;font:italic 900 26px Arial,sans-serif;letter-spacing:1px;color:#ffffff">ISAA</td></tr>
<tr><td style="padding:28px">${body}</td></tr></table>
<p style="font:12px Arial,sans-serif;color:#8a8577;margin:16px 0 0">${esc(title)}</p>
</td></tr></table></body></html>`

export function customerMail(o) {
  const first = o.customer.name.split(' ')[0]
  const html = frame(
    `Order ${o.orderNumber}`,
    `<p style="margin:0 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">Order confirmed</p>
     <h1 style="margin:0 0 12px;font:italic 900 28px Arial,sans-serif;color:#0d0d0d">Thanks, ${esc(first)}.</h1>
     <p style="margin:0 0 20px;font:15px/1.6 Arial,sans-serif;color:#3d3d3d">We've got your order <b>${esc(o.orderNumber)}</b>. We'll email you again when it ships, with tracking.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o)}</table>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${totalsRows(o)}</table>
     <p style="margin:20px 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">Delivering to</p>
     <p style="margin:0;font:14px/1.6 Arial,sans-serif;color:#0d0d0d">${esc(o.customer.name)}<br>${addressLines(o.address).map(esc).join('<br>')}<br>${esc(o.customer.phone)}</p>
     <p style="margin:20px 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">Payment</p>
     <p style="margin:0;font:14px Arial,sans-serif;color:#0d0d0d">${esc(payLabel(o))}</p>
     <p style="margin:28px 0 0"><a href="${esc(trackUrl(o))}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font:700 13px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:999px">Track your order</a></p>
     <p style="margin:24px 0 0;font:13px/1.6 Arial,sans-serif;color:#6b6a62">Questions? Just reply to this email and quote your order number.</p>`,
  )
  const text = [
    `Thanks, ${first}. Your Isaa order ${o.orderNumber} is confirmed.`,
    '',
    ...o.items.map((i) => `${i.name} (${[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(', ')}) x${i.qty}: ${money(i.price * i.qty)}`),
    '',
    `Subtotal: ${money(o.totals.subtotal)}`,
    `Shipping: ${o.totals.shipping ? money(o.totals.shipping) : 'Free'}`,
    ...(o.totals.codFee ? [`COD fee: ${money(o.totals.codFee)}`] : []),
    `Total: ${money(o.totals.total)}`,
    '',
    'Delivering to:',
    o.customer.name,
    ...addressLines(o.address),
    o.customer.phone,
    '',
    payLabel(o),
    '',
    `Track your order: ${trackUrl(o)}`,
  ].join('\n')
  return { subject: `Your Isaa order ${o.orderNumber} is confirmed`, html, text }
}

export function ownerMail(o) {
  const text = [
    `New order ${o.orderNumber}: ${money(o.totals.total)} (${o.payment.method.toUpperCase()})`,
    '',
    `${o.customer.name} · ${o.customer.phone} · ${o.customer.email}`,
    ...addressLines(o.address),
    '',
    ...o.items.map((i) => `${i.name} (${[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(', ')}) x${i.qty}`),
    '',
    `Subtotal ${money(o.totals.subtotal)} · Shipping ${money(o.totals.shipping)} · COD fee ${money(o.totals.codFee)} · Total ${money(o.totals.total)}`,
    o.notes ? `\nNote from customer: ${o.notes}` : '',
  ].join('\n')
  return { subject: `New order ${o.orderNumber}: ${money(o.totals.total)} ${o.payment.method.toUpperCase()}`, text }
}

export function shippedMail(o) {
  const first = o.customer.name.split(' ')[0]
  const t = o.tracking ?? {}
  const link = t.url ? `<p style="margin:24px 0 0"><a href="${esc(t.url)}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font:700 13px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:999px">Track shipment</a></p>` : ''
  const html = frame(
    `Order ${o.orderNumber}`,
    `<p style="margin:0 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">On its way</p>
     <h1 style="margin:0 0 12px;font:italic 900 28px Arial,sans-serif;color:#0d0d0d">Good news, ${esc(first)}.</h1>
     <p style="margin:0 0 20px;font:15px/1.6 Arial,sans-serif;color:#3d3d3d">Your order <b>${esc(o.orderNumber)}</b> has shipped.</p>
     <p style="margin:0 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">Courier</p>
     <p style="margin:0;font:14px/1.6 Arial,sans-serif;color:#0d0d0d">${esc(t.carrier)}<br>Tracking number: <b>${esc(t.number)}</b></p>
     ${link}
     <p style="margin:24px 0 8px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">In the box</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o)}</table>
     <p style="margin:20px 0 4px;font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22">Delivering to</p>
     <p style="margin:0;font:14px/1.6 Arial,sans-serif;color:#0d0d0d">${esc(o.customer.name)}<br>${addressLines(o.address).map(esc).join('<br>')}</p>
     ${o.payment.method === 'cod' ? `<p style="margin:20px 0 0;font:14px/1.6 Arial,sans-serif;color:#0d0d0d">${esc(payLabel(o))}.</p>` : ''}
     <p style="margin:24px 0 0;font:13px/1.6 Arial,sans-serif;color:#6b6a62">You can also follow it any time on <a href="${esc(trackUrl(o))}" style="color:#0d0d0d">your order page</a>. Questions? Just reply to this email.</p>`,
  )
  const text = [
    `Good news, ${first}. Your Isaa order ${o.orderNumber} has shipped.`,
    '',
    `Courier: ${t.carrier}`,
    `Tracking number: ${t.number}`,
    ...(t.url ? [`Track shipment: ${t.url}`] : []),
    '',
    ...o.items.map((i) => `${i.name} (${[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(', ')}) x${i.qty}`),
    '',
    'Delivering to:',
    o.customer.name,
    ...addressLines(o.address),
    ...(o.payment.method === 'cod' ? ['', payLabel(o)] : []),
    '',
    `Your order page: ${trackUrl(o)}`,
  ].join('\n')
  return { subject: `Your Isaa order ${o.orderNumber} has shipped`, html, text }
}

const EYEBROW_FONT = 'font:700 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#6b6a22'
const EYEBROW = `margin:0 0 4px;${EYEBROW_FONT}`
const H1 = 'margin:0 0 12px;font:italic 900 28px Arial,sans-serif;color:#0d0d0d'
const LEAD = 'margin:0 0 20px;font:15px/1.6 Arial,sans-serif;color:#3d3d3d'
const SMALL = 'margin:24px 0 0;font:13px/1.6 Arial,sans-serif;color:#6b6a62'
const button = (href, label) => `<p style="margin:28px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font:700 13px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border-radius:999px">${esc(label)}</a></p>`
const itemLine = (i) => `${i.name} (${[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(', ')}) x${i.qty}`

// What the customer is told about their money when an order is cancelled. The staff's cancel reason is internal and is never shown.
export function refundLine(o) {
  const { method, status } = o.payment
  if (method === 'cod') return 'You chose cash on delivery, so you have not paid anything and there is nothing to refund.'
  if (status === 'refunded') return `We have refunded ${money(o.totals.total)} to your original payment method. Banks usually take 5 to 7 working days to show it.`
  if (status === 'paid') return `We are refunding ${money(o.totals.total)} to your original payment method. Banks usually take 5 to 7 working days to show it. Reply to this email if it has not arrived after that.`
  return 'Your payment was not completed, so you have not been charged.'
}

export function cancelledMail(o) {
  const first = o.customer.name.split(' ')[0]
  const shop = `${site()}/shop`
  const html = frame(
    `Order ${o.orderNumber}`,
    `<p style="${EYEBROW}">Order cancelled</p>
     <h1 style="${H1}">Your order has been cancelled.</h1>
     <p style="${LEAD}">Hi ${esc(first)}, order <b>${esc(o.orderNumber)}</b> has been cancelled and nothing is on its way to you.</p>
     <p style="margin:0 0 20px;font:14px/1.6 Arial,sans-serif;color:#0d0d0d;background:#fbf2e6;border-radius:12px;padding:14px 16px">${esc(refundLine(o))}</p>
     <p style="margin:0 0 4px;${EYEBROW_FONT}">What was in the order</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o)}</table>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${totalsRows(o)}</table>
     ${button(shop, 'Back to the shop')}
     <p style="${SMALL}">Didn’t expect this, or want to order again? Just reply to this email and quote your order number.</p>`,
  )
  const text = [
    `Hi ${first}, your Isaa order ${o.orderNumber} has been cancelled and nothing is on its way to you.`,
    '',
    refundLine(o),
    '',
    ...o.items.map(itemLine),
    `Total: ${money(o.totals.total)}`,
    '',
    `Back to the shop: ${shop}`,
    'Didn’t expect this, or want to order again? Reply to this email and quote your order number.',
  ].join('\n')
  return { subject: `Your Isaa order ${o.orderNumber} has been cancelled`, html, text }
}

export function deliveredMail(o) {
  const first = o.customer.name.split(' ')[0]
  const shop = `${site()}/shop`
  const html = frame(
    `Order ${o.orderNumber}`,
    `<p style="${EYEBROW}">Delivered</p>
     <h1 style="${H1}">It’s here, ${esc(first)}.</h1>
     <p style="${LEAD}">Your order <b>${esc(o.orderNumber)}</b> has been delivered. We hope you love it. Tag us when you wear it, we’d love to see.</p>
     <p style="margin:0 0 4px;${EYEBROW_FONT}">In the box</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(o)}</table>
     ${button(shop, 'See what’s new')}
     <p style="${SMALL}">Not the right fit? You have 7 days from delivery for a return or exchange. Reply to this email with your order number and we’ll sort it out.</p>`,
  )
  const text = [
    `It’s here, ${first}. Your Isaa order ${o.orderNumber} has been delivered. We hope you love it.`,
    '',
    ...o.items.map(itemLine),
    '',
    'Not the right fit? You have 7 days from delivery for a return or exchange. Reply to this email with your order number and we’ll sort it out.',
    '',
    `See what’s new: ${shop}`,
  ].join('\n')
  return { subject: `Your Isaa order ${o.orderNumber} was delivered`, html, text }
}

// The customer emails that follow an order's life. `confirmation` is the one sent at checkout (sendOrderEmails below).
export const EMAIL_KINDS = {
  shipped: { mail: shippedMail, label: 'Shipped', when: ['shipped', 'delivered'] },
  delivered: { mail: deliveredMail, label: 'Delivered', when: ['delivered'] },
  cancelled: { mail: cancelledMail, label: 'Cancelled', when: ['cancelled'] },
}

// Sent when an order is marked shipped. Resolves true if it went out, false when SMTP isn't set up (the order is saved either way).
export async function sendShippedEmail(order) {
  return sendMail({ to: order.customer.email, replyTo: env.CONTACT_TO, ...shippedMail(order) })
}

// Emails the customer about a status change, then records that it went out (`emails.<kind>` on the order).
// Never throws: the order is already saved, and a failed email must not turn a successful action into an error.
// Resolves true when the mail was handed to the mail server.
export async function notifyCustomer(kind, order) {
  try {
    const sent = await sendMail({ to: order.customer.email, replyTo: env.CONTACT_TO, ...EMAIL_KINDS[kind].mail(order) })
    if (sent) await Order.updateOne({ _id: order._id }, { $set: { [`emails.${kind}`]: true } })
    return sent
  } catch (err) {
    console.error(`Order ${order.orderNumber}: ${kind} email failed:`, err.message)
    return false
  }
}

// Best-effort: the order is already saved. Returns which emails went out.
export async function sendOrderEmails(order) {
  const sent = { customer: false, owner: false }
  try {
    sent.customer = await sendMail({ to: order.customer.email, replyTo: env.CONTACT_TO, ...customerMail(order) })
  } catch (err) { console.error(`Order ${order.orderNumber}: customer email failed:`, err.message) }
  try {
    sent.owner = await sendMail({ to: env.CONTACT_TO, replyTo: order.customer.email, ...ownerMail(order) })
  } catch (err) { console.error(`Order ${order.orderNumber}: owner email failed:`, err.message) }
  return sent
}
