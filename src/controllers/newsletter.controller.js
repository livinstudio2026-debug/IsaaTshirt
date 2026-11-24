import { z } from 'zod'
import { Subscriber } from '../models/Subscriber.js'

export const newsletterBody = z.object({
  email: z.email('Please enter a valid email').max(254),
  website: z.string().max(200).optional(), // honeypot: real people never see or fill this field
})

// POST /api/newsletter
export async function subscribe(req, res) {
  const { website, email } = req.valid.body
  const message = "You're in! Watch your inbox for the next drop."
  // bots fill the hidden field: pretend it worked, store nothing
  if (website) return res.status(201).json({ ok: true, message })

  // upsert: a repeat sign-up gets the same answer as a new one, so the API can't be used to probe who is subscribed
  await Subscriber.updateOne(
    { email: email.toLowerCase() },
    { $setOnInsert: { email: email.toLowerCase(), source: 'footer', ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300) } },
    { upsert: true },
  )
  res.status(201).json({ ok: true, message })
}
