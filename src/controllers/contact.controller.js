import { z } from 'zod'
import { ContactMessage, CONTACT_TOPICS } from '../models/ContactMessage.js'
import { sendContactEmail } from '../utils/mailer.js'

export const contactBody = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.email('Please enter a valid email').max(254),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Please enter a valid phone number').optional().or(z.literal('').transform(() => undefined)),
  topic: z.enum(CONTACT_TOPICS).optional(),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(2000),
  website: z.string().max(200).optional(), // honeypot: real people never see or fill this field
})

// POST /api/contact
export async function createContact(req, res) {
  const { website, ...data } = req.valid.body
  // bots fill the hidden field: pretend it worked, store nothing
  if (website) return res.status(201).json({ ok: true })

  const doc = await ContactMessage.create({ ...data, ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300) })

  // the message is safe in the database; email is a best-effort notification
  try {
    if (await sendContactEmail(doc)) await ContactMessage.updateOne({ _id: doc._id }, { emailed: true })
  } catch (err) {
    console.error('Contact email failed:', err.message)
  }
  res.status(201).json({ ok: true, message: "Thanks! We'll get back to you soon." })
}
