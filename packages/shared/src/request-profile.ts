import { createSignal } from 'solid-js'

export interface RequestTrace {
  id: number
  url: string
  label: string
  purpose: 'app' | 'probe'
  cache: RequestCache
  start: number
  end?: number
  status: 'pending' | 'success' | 'error' | 'aborted'
  httpStatus?: number
  waitMs?: number
  readMs?: number
  parseMs?: number
  verifyMs?: number
  bytes?: number
  error?: string
}

let nextId = 0
const [requestTraces, setRequestTraces] = createSignal<readonly RequestTrace[]>([])
export { requestTraces }

export function beginRequest(input: Pick<RequestTrace, 'url' | 'label' | 'purpose' | 'cache'>) {
  const trace: RequestTrace = { ...input, id: ++nextId, start: performance.now(), status: 'pending' }
  setRequestTraces(records => [...records.slice(-199), trace])
  return trace
}

export function finishRequest(trace: RequestTrace) {
  setRequestTraces(records => records.map(record => record.id === trace.id ? { ...trace } : record))
}

export function clearRequestTraces() {
  setRequestTraces([])
}
