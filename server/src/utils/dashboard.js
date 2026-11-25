import { istDayKeys } from './istDates.js'

// Turns "one row per day" (what MongoDB groups for us) into the numbers the dashboard shows.
// rows: [{ _id: '2026-11-21', orders, revenue, pieces }] for the last 60 days (days with no orders are simply missing).
// Money is paise throughout. Each window comes with the window just before it (same length) so the screen can say "up / down".
const ZERO = { orders: 0, revenue: 0, pieces: 0 }
const add = (a, d) => ({ orders: a.orders + d.orders, revenue: a.revenue + d.revenue, pieces: a.pieces + d.pieces })

export function summarise(rows, now = new Date()) {
  const byDay = new Map(rows.map((r) => [r._id, r]))
  const days = istDayKeys(60, now).map((date) => {
    const r = byDay.get(date)
    return { date, orders: r?.orders ?? 0, revenue: r?.revenue ?? 0, pieces: r?.pieces ?? 0 }
  })
  const total = (from, to) => days.slice(from, to).reduce(add, ZERO)
  const windowOf = (n) => {
    const cur = total(days.length - n)
    return { ...cur, avgOrder: cur.orders ? Math.round(cur.revenue / cur.orders) : 0, prev: total(days.length - 2 * n, days.length - n) }
  }
  return {
    today: windowOf(1), // prev = yesterday
    week: windowOf(7), // today and the 6 days before it; prev = the 7 days before that
    month: windowOf(30),
    series: days.slice(-30),
  }
}
