import { useEffect, useState } from 'react'
import { getInboxUnread } from '../lib/adminApi'

// The number on the Inbox tab. It refreshes every minute while the tab is visible, when you come back to the tab,
// and straight away when the Inbox page changes a message (it calls announceInboxChange()).
const INBOX_CHANGED = 'isaa:inbox-changed'
export const announceInboxChange = () => window.dispatchEvent(new Event(INBOX_CHANGED))

export function useInboxUnread() {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let ac = new AbortController()
    const load = () => {
      ac.abort()
      ac = new AbortController()
      getInboxUnread(ac.signal).then(setUnread, () => { /* a badge isn't worth an error message */ })
    }
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    load()
    const timer = setInterval(onVisible, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(INBOX_CHANGED, load)
    return () => {
      ac.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(INBOX_CHANGED, load)
    }
  }, [])
  return unread
}
