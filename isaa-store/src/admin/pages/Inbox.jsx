import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCheck, ChevronDown, Download, Inbox as InboxIcon, LoaderCircle, Mail, MessageSquare, Phone, RefreshCw, Reply, Trash2, Users } from 'lucide-react'
import { deleteMessage, downloadSubscribersCsv, listMessages, listSubscribers, setMessageStatus } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import { announceInboxChange } from '../useInboxUnread'
import { ago, fullDateTime, whatsappLink } from '../orders/format'
import ConfirmDialog from '../orders/ConfirmDialog'
import { useToast } from '../products/useToast'
import { ErrorBanner, PageTitle, btnGhost, btnSolid } from '../products/ui'
import { Empty, ListSkeleton, Pager, SearchBox } from '../inbox/parts'

const STATUS_TABS = [
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'replied', label: 'Replied' },
  { id: 'all', label: 'All' },
]
const STATUS_IDS = STATUS_TABS.map((t) => t.id)

const TOPIC = {
  order: { label: 'Order', tone: 'bg-amber-100 text-amber-900' },
  sizing: { label: 'Sizing', tone: 'bg-sky-100 text-sky-900' },
  returns: { label: 'Returns', tone: 'bg-red-100 text-red-800' },
  collab: { label: 'Collab', tone: 'bg-olive/15 text-olive' },
  other: { label: 'General', tone: 'bg-sand text-ink' },
}
const SOURCE = { footer: 'Website footer' }

const Chip = ({ className = '', children }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}>{children}</span>

// Search typed into the box reaches the URL after a short pause, so a refresh or a shared link keeps it.
function useSearchUrl(initial, update) {
  const [text, setText] = useState(initial)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => update({ q: text.trim(), page: '' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return [text, setText]
}

// Loads a list now, and again whenever `deps` change, the tab regains focus, or reload() is called.
function useList(fetcher, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const ac = new AbortController()
    fetcher(ac.signal).then(
      (d) => { setData(d); setError(''); setLoading(false) },
      (err) => { if (err.name === 'AbortError') return; setError(err.message); setLoading(false) },
    )
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const reload = () => { setLoading(true); setTick((n) => n + 1) }
  return { data, setData, error, loading, setLoading, reload }
}

// ------------------------------------------------------------------------------------------------ messages

function Message({ m, open, onToggle, onStatus, onDelete, canDelete, adminName }) {
  const unread = m.status === 'new'
  const topic = TOPIC[m.topic] ?? TOPIC.other
  const first = m.name.trim().split(/\s+/)[0]
  const mailto = `mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Isaa')}&body=${encodeURIComponent(`Hi ${first},\n\n\n\nThanks,\n${adminName}\nIsaa`)}`

  return (
    <li className={`overflow-hidden rounded-[22px] border transition-colors ${open ? 'border-ink/40 bg-white' : unread ? 'border-amber-500/40 bg-amber-50/70 hover:border-amber-600/60' : 'border-sand bg-white/70 hover:border-ink/30'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`msg-${m.id}`} className="flex w-full items-start gap-3.5 p-4 text-left sm:p-5">
        <span aria-hidden className={`mt-2 size-2.5 shrink-0 rounded-full ${unread ? 'bg-amber-500' : 'bg-transparent'}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <b className={`max-w-full truncate text-[15.5px] ${unread ? 'font-black' : 'font-bold'}`}>{m.name}{unread && <span className="sr-only"> (unread)</span>}</b>
            <Chip className={topic.tone}>{topic.label}</Chip>
            {m.status === 'replied' && <Chip className="bg-olive text-white"><CheckCheck size={12} aria-hidden className="mr-1" />Replied</Chip>}
          </span>
          {!open && <span className={`mt-1 line-clamp-2 break-words text-[14px] ${unread ? 'text-ink/75' : 'text-ink/55'}`}>{m.message}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <time dateTime={m.createdAt} title={fullDateTime(m.createdAt)} className="whitespace-nowrap text-[12.5px] text-ink/50">{ago(m.createdAt)}</time>
          <ChevronDown size={18} aria-hidden className={`text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div id={`msg-${m.id}`} className="border-t border-sand px-4 pb-5 pt-4 sm:pl-[3.1rem] sm:pr-5">
          <p className="whitespace-pre-wrap break-words text-[15.5px] leading-relaxed">{m.message}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px]">
            <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline"><Mail size={14} aria-hidden />{m.email}</a>
            {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline"><Phone size={14} aria-hidden />{m.phone}</a>}
            <span className="text-ink/50">{fullDateTime(m.createdAt)}</span>
          </div>
          {m.status !== 'new' && m.handledBy && <p className="mt-2 text-[12.5px] text-ink/50">Marked {m.status} by {m.handledBy}{m.handledAt ? ` · ${ago(m.handledAt)}` : ''}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a href={mailto} className={btnSolid}><Reply size={15} aria-hidden />Reply by email</a>
            {m.phone && <a href={whatsappLink(m.phone)} target="_blank" rel="noopener noreferrer" className={btnGhost}>WhatsApp</a>}
            <Link to={`/admin/orders?status=all&q=${encodeURIComponent(m.email)}`} className={btnGhost}>Their orders</Link>
            {m.status !== 'replied' && <button type="button" onClick={() => onStatus('replied')} className={btnGhost}><CheckCheck size={15} aria-hidden />Mark replied</button>}
            {m.status !== 'new' && <button type="button" onClick={() => onStatus('new')} className={btnGhost}>Mark unread</button>}
            {canDelete && <button type="button" onClick={onDelete} aria-label="Delete this message" className="ml-auto grid size-10 place-items-center rounded-full border border-transparent text-ink/45 transition-colors hover:border-red-700/30 hover:bg-red-50 hover:text-red-700"><Trash2 size={17} aria-hidden /></button>}
          </div>
        </div>
      )}
    </li>
  )
}

function MessagesTab({ isOwner, adminName, say, onNewCount }) {
  const [params, setParams] = useSearchParams()
  const status = STATUS_IDS.includes(params.get('status')) ? params.get('status') : 'new'
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const update = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    return next
  }, { replace: true })

  const [search, setSearch] = useSearchUrl(q, update)
  const { data, setData, error, loading, setLoading, reload } = useList((signal) => listMessages({ status, q, page }, signal), [status, q, page])
  const [openId, setOpenId] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const counts = data?.counts
  const items = data?.items ?? []
  useEffect(() => { if (counts) onNewCount(counts.new) }, [counts, onNewCount])

  // Change one message on screen (and move the tab counts with it) without reloading the list, so a message you just opened doesn't vanish from "New".
  const patch = (id, changes) => setData((d) => {
    const old = d?.items.find((x) => x.id === id)
    if (!old) return d
    const next = { ...old, ...changes }
    const moved = old.status !== next.status
    return { ...d, items: d.items.map((x) => (x.id === id ? next : x)), counts: moved ? { ...d.counts, [old.status]: d.counts[old.status] - 1, [next.status]: d.counts[next.status] + 1 } : d.counts }
  })

  const change = async (m, to, { quiet = false } = {}) => {
    const before = { status: m.status, handledBy: m.handledBy, handledAt: m.handledAt }
    patch(m.id, { status: to, handledBy: to === 'new' ? '' : adminName, handledAt: to === 'new' ? null : new Date().toISOString() })
    try {
      patch(m.id, await setMessageStatus(m.id, to))
      announceInboxChange()
      if (!quiet) say(to === 'replied' ? 'Marked as replied.' : to === 'new' ? 'Moved back to New.' : 'Marked as read.')
    } catch (err) {
      patch(m.id, before)
      say(err.message, 'error')
    }
  }

  const toggle = (m) => {
    const opening = openId !== m.id
    setOpenId(opening ? m.id : null)
    if (opening && m.status === 'new') change(m, 'read', { quiet: true }) // opening a message is reading it
  }

  const remove = async (m) => {
    await deleteMessage(m.id)
    setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== m.id), counts: { ...d.counts, [m.status]: d.counts[m.status] - 1, all: d.counts.all - 1 }, meta: { ...d.meta, total: d.meta.total - 1 } })
    setToDelete(null)
    setOpenId(null)
    announceInboxChange()
    say('Message deleted.')
  }

  const setTab = (id) => { setLoading(true); setOpenId(null); update({ status: id === 'new' ? '' : id, page: '' }) }
  const goPage = (n) => { setLoading(true); setOpenId(null); update({ page: n > 1 ? String(n) : '' }) }

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Message status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((t) => {
            const on = t.id === status
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={on}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-sand bg-white/60 text-ink/70 hover:border-ink/40 hover:text-ink'}`}>
                {t.label}
                {counts && <span className={`grid min-w-6 place-items-center rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${on ? 'bg-white/20' : t.id === 'new' && counts.new > 0 ? 'bg-amber-200 text-amber-950' : 'bg-sand/80'}`}>{counts[t.id]}</span>}
              </button>
            )
          })}
        </nav>
        <SearchBox value={search} onChange={setSearch} placeholder="Name, email or words in the message" label="Search messages" />
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
        {!data && !error && <ListSkeleton />}

        {data && items.length === 0 && !error && (
          q ? (
            <Empty icon={MessageSquare} title="No messages match that search" action={<button type="button" onClick={() => { setSearch(''); setLoading(true); update({ q: '', status: 'all', page: '' }) }} className="mt-5 rounded-full border border-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide hover:bg-ink hover:text-white">Show all messages</button>}>
              Check the spelling, or try just part of the name or email.
            </Empty>
          ) : status === 'new' ? (
            <Empty icon={CheckCheck} title="Inbox zero">Every message has been read. New ones from the Contact page show up here.</Empty>
          ) : (
            <Empty icon={InboxIcon} title={status === 'all' ? 'No messages yet' : `No ${status} messages`}>Messages sent from the Contact page land here.</Empty>
          )
        )}

        {items.length > 0 && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <ul className="space-y-3">
              {items.map((m) => (
                <Message key={m.id} m={m} open={openId === m.id} adminName={adminName} canDelete={isOwner}
                  onToggle={() => toggle(m)} onStatus={(to) => change(m, to)} onDelete={() => setToDelete(m)} />
              ))}
            </ul>
            <Pager meta={data.meta} loading={loading} noun="messages" onPage={goPage} />
          </div>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog open danger onClose={() => setToDelete(null)} title="Delete this message?" confirmLabel="Delete for good" busyLabel="Deleting…" onConfirm={() => remove(toDelete)}>
          <p>The message from <b>{toDelete.name}</b> will be removed for good. This is meant for spam: to keep a record, leave it and mark it replied instead.</p>
        </ConfirmDialog>
      )}
    </>
  )
}

// ------------------------------------------------------------------------------------------------ subscribers

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-sand bg-white/70 p-4 sm:p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-olive/12 text-olive"><Icon size={20} aria-hidden /></span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">{label}</p>
        <p className="text-[28px] font-black leading-none tabular-nums">{value}{hint && <span className="ml-2 text-[13px] font-normal text-ink/50">{hint}</span>}</p>
      </div>
    </div>
  )
}

function SubscribersTab({ isOwner, say }) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const update = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    return next
  }, { replace: true })
  const [search, setSearch] = useSearchUrl(q, update)
  const { data, error, loading, setLoading, reload } = useList((signal) => listSubscribers({ q, page }, signal), [q, page])
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    try { await downloadSubscribersCsv(); say('Download started.') } catch (err) { say(err.message, 'error') } finally { setExporting(false) }
  }
  const items = data?.items ?? []
  const counts = data?.counts

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Users} label="Subscribers" value={counts ? counts.total.toLocaleString('en-IN') : '–'} />
        <Stat icon={Mail} label="Joined this week" value={counts ? `+${counts.last7Days}` : '–'} hint="last 7 days" />
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-sand bg-white/70 p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
          {isOwner ? (
            <>
              <p className="text-[13.5px] leading-snug text-ink/60">Download everyone as a spreadsheet file (CSV).</p>
              <button type="button" onClick={exportCsv} disabled={exporting || !counts?.total} className={`${btnSolid} shrink-0`}>
                {exporting ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Download size={15} aria-hidden />}Export CSV
              </button>
            </>
          ) : (
            <p className="text-[13.5px] leading-snug text-ink/60">Only the owner can download the list.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by email" label="Search subscribers" />
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
        {!data && !error && <ListSkeleton height="h-[60px]" />}
        {data && items.length === 0 && !error && (
          <Empty icon={Mail} title={q ? 'No subscribers match that search' : 'No subscribers yet'}>
            {q ? 'Try part of the email address.' : 'People who sign up in the website footer show up here.'}
          </Empty>
        )}
        {items.length > 0 && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="overflow-hidden rounded-[24px] border border-sand bg-white/70">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-sand bg-cream/70 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">
                  <tr><th scope="col" className="px-5 py-3.5">Email</th><th scope="col" className="hidden px-3 py-3.5 sm:table-cell">Source</th><th scope="col" className="px-5 py-3.5 text-right">Joined</th></tr>
                </thead>
                <tbody className="divide-y divide-sand/70">
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className="max-w-0 px-5 py-3.5"><a href={`mailto:${s.email}`} className="block truncate font-bold underline-offset-4 hover:underline">{s.email}</a></td>
                      <td className="hidden px-3 py-3.5 text-ink/60 sm:table-cell">{SOURCE[s.source] ?? s.source}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-ink/60" title={fullDateTime(s.createdAt)}>{ago(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={data.meta} loading={loading} noun="subscribers" onPage={(n) => { setLoading(true); update({ page: n > 1 ? String(n) : '' }) }} />
          </div>
        )}
      </div>
    </>
  )
}

// ------------------------------------------------------------------------------------------------ page

export default function Inbox() {
  useAdminPage('Inbox')
  const { admin } = useAdminAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'subscribers' ? 'subscribers' : 'messages'
  const [toast, say] = useToast()
  const [newCount, setNewCount] = useState(null)
  const [nonce, setNonce] = useState(0) // bump to start both tabs over (Refresh)
  const isOwner = admin.role === 'owner'

  // switching tab starts that tab clean: its search and page don't leak into the other
  const goTab = (id) => setParams(id === 'messages' ? {} : { tab: id }, { replace: true })
  const TABS = [{ id: 'messages', label: 'Messages', icon: MessageSquare }, { id: 'subscribers', label: 'Subscribers', icon: Users }]

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle>Inbox</PageTitle>
        <button type="button" onClick={() => setNonce((n) => n + 1)} className={btnGhost}><RefreshCw size={15} aria-hidden />Refresh</button>
      </div>

      <div role="tablist" aria-label="Inbox sections" className="mt-6 inline-flex rounded-full border border-sand bg-white/60 p-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = id === tab
          return (
            <button key={id} type="button" role="tab" aria-selected={on} onClick={() => goTab(id)}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-bold uppercase tracking-wide transition-colors ${on ? 'bg-ink text-white' : 'text-ink/65 hover:text-ink'}`}>
              <Icon size={15} aria-hidden />{label}
              {id === 'messages' && newCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black leading-5 tabular-nums text-ink">{newCount}</span>}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === 'messages'
          ? <MessagesTab key={nonce} isOwner={isOwner} adminName={admin.name} say={say} onNewCount={setNewCount} />
          : <SubscribersTab key={nonce} isOwner={isOwner} say={say} />}
      </div>
      {toast}
    </div>
  )
}
