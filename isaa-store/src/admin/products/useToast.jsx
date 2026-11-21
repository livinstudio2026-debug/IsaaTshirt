import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert } from 'lucide-react'

// A small confirmation at the bottom of the screen. `const [toast, say] = useToast()`; render {toast} once; say('Saved') or say('Oops', 'error').
export function useToast() {
  const [t, setT] = useState(null)
  const timer = useRef(null)
  const say = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current)
    setT({ message, tone, id: Date.now() })
    timer.current = setTimeout(() => setT(null), tone === 'error' ? 7000 : 3200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const toast = (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      {t && (
        <p key={t.id} className={`pointer-events-auto flex max-w-md animate-[rise_.3s_ease-out_both] items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium shadow-[0_18px_40px_-16px_rgba(0,0,0,.5)] motion-reduce:animate-none ${t.tone === 'error' ? 'bg-red-800 text-white' : 'bg-ink text-white'}`}>
          {t.tone === 'error' ? <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden /> : <Check size={17} strokeWidth={3} className="mt-0.5 shrink-0 text-lime-300" aria-hidden />}
          {t.message}
        </p>
      )}
    </div>
  )
  return [toast, say]
}
