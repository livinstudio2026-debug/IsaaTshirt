// The shop runs on Indian time (IST, UTC+05:30, no daylight saving). "Today" in the back office means today in India,
// whatever time zone the server happens to run in. These helpers keep that rule in one place.
export const IST_ZONE = 'Asia/Kolkata'
const IST_MS = 5.5 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

// The moment today (in India) began.
export const istDayStart = (date = new Date()) => new Date(Math.floor((date.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS)

// '2026-11-21': the calendar day a moment falls on in India.
export const istKey = (date) => new Date(date.getTime() + IST_MS).toISOString().slice(0, 10)

// The last `days` calendar days in India as 'YYYY-MM-DD', oldest first, ending today.
export const istDayKeys = (days, now = new Date()) => {
  const today = istDayStart(now).getTime()
  return Array.from({ length: days }, (_, i) => istKey(new Date(today - (days - 1 - i) * DAY_MS)))
}
