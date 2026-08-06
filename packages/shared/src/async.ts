import { createResource, createSignal, onCleanup } from 'solid-js'

const REQUEST_TIMEOUT_MS = 20_000

function abortWithReason(controller: AbortController, reason: unknown) {
  if (reason === undefined) controller.abort()
  else controller.abort(reason)
}

/**
 * 带完整请求周期超时的 JSON 请求：定时器直到 response body 解析完成后才清除。
 * 外部 signal 用于查询切换/刷新时主动取消，超时则以 TimeoutError 区分。
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  errorMessage: string,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  const abortFromSignal = () => abortWithReason(controller, signal?.reason)

  if (signal?.aborted) abortFromSignal()
  else signal?.addEventListener('abort', abortFromSignal, { once: true })

  let timedOut = false
  const timer = setTimeout(
    () => {
      timedOut = true
      controller.abort(new DOMException('请求超时', 'TimeoutError'))
    },
    REQUEST_TIMEOUT_MS,
  )

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`${errorMessage}（HTTP ${res.status}）`)
    return await res.json() as T
  } catch (e) {
    // 部分浏览器在 body 读取阶段被 abort 时只抛 AbortError，不保留 signal.reason。
    // 以本地标记恢复 TimeoutError，避免 createQueryResource 将真实超时当成主动取消静默掉。
    if (timedOut) throw new DOMException('请求超时', 'TimeoutError')
    throw e
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromSignal)
  }
}

/**
 * 查询配对的数据资源：两态正交模型的基建。
 *
 * 每个异步数据面只有三个正交维度：
 * - 请求状态 loading/ready：由 resource 原生提供
 * - 数据状态 无/有：value 永远等于"最新可用数据"——失败时 fetcher 返回上次值，
 *   数据不被清空；"有数据"以与当前查询参数匹配为准（见 matchedData）
 * - 错误层：失败信息写入伴生 error signal，不改变数据，由 UI 决定落点
 *   （有内容 → toast；无内容 → 错误屏）
 *
 * fetcher 永不 throw，因此 Solid 1.9 的 resource() 在 errored 时 throw 的行为
 * 不会触发，页面错误 UI 不依赖 ErrorBoundary 即可达。
 */
export type QueryResult<Q, T> = { query: Q; data: T }

export function createQueryResource<Q, T>(
  query: () => Q | null | false | undefined,
  fn: (q: Q, signal: AbortSignal) => Promise<T>,
) {
  const [error, setError] = createSignal<string | null>(null)
  let activeController: AbortController | null = null
  // 请求序号守卫是取消之外的第二层保护：即使底层任务不响应 AbortSignal，
  // 它晚到失败时也不允许写 error，避免旧查询污染当前查询的错误状态。
  let requestSeq = 0
  onCleanup(() => activeController?.abort())
  const [res, { refetch }] = createResource<QueryResult<Q, T> | undefined, Q>(
    // query() 返回 null/false 时 Solid 跳过 fetch（前置依赖未就绪）；
    // 类型上收敛为 Q 让 fetcher 书写更直接，运行时行为不变
    query as () => Q,
    async (q, info) => {
      const seq = ++requestSeq
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller
      // 新请求开始即清除旧错误：错误屏切换回骨架；toast 在 error 置位时已弹出，不受影响
      setError(null)
      try {
        const data = await fn(q, controller.signal)
        return { query: q, data }
      } catch (e) {
        // 查询切换、刷新或组件卸载导致的主动取消：静默并保留最新可用值
        if (e instanceof DOMException && e.name === 'AbortError') return info.value
        if (seq === requestSeq) setError(errMessage(e))
        return info.value
      }
    },
  )
  return {
    res,
    error,
    loading: () => res.loading,
    refetch,
  }
}

/**
 * 只接受与当前查询参数匹配的数据；不匹配（旧查询的残留）视为无数据。
 */
export function matchedData<Q, T>(
  v: QueryResult<Q, T> | undefined,
  match: (q: Q) => boolean,
): T | undefined {
  return v && match(v.query) ? v.data : undefined
}

export function errMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'TimeoutError') return '请求超时，请检查网络后重试'
  if (e instanceof Error && e.message) return e.message
  return '网络请求失败，请稍后重试'
}
