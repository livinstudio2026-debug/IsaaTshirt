import { useEffect } from 'react'

// Back-office pages are private: tell search engines to stay away and label the tab.
export function useAdminPage(title) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · Isaa Back Office`
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { document.title = previous; meta.remove() }
  }, [title])
}
