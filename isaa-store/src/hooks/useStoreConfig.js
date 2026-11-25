import { useEffect, useState } from 'react'
import { fetchStoreConfig } from '../lib/api'
import { FREE_SHIPPING_MIN } from '../lib/format'

// One request per session. `config` is null until it loads (use `fallback` for display-only needs like the bag drawer).
let pending
const load = () => (pending ??= fetchStoreConfig().catch((err) => { pending = undefined; throw err }))

export const fallback = { freeShippingMin: FREE_SHIPPING_MIN, shippingFee: 0, codFee: 0, codFreeMin: 0, maxQty: 10, states: [], payments: { cod: { enabled: true }, online: { enabled: false } } }

export function useStoreConfig() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ attempt: -1, config: null, error: null })
  useEffect(() => {
    let live = true
    load().then((config) => live && setState({ attempt, config, error: null }), (error) => live && setState({ attempt, config: null, error }))
    return () => { live = false }
  }, [attempt])
  const current = state.attempt === attempt
  return {
    config: current ? state.config : null,
    status: !current ? 'loading' : state.error ? 'error' : 'ready',
    retry: () => setAttempt((a) => a + 1),
  }
}
