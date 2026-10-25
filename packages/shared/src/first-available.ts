export interface DataSource {
  id: string
  label: string
  url: string
}

/** Prefer the first source; hedge slow requests and cancel every losing request. */
export function firstAvailable<T>(
  sources: readonly DataSource[],
  load: (source: DataSource, signal: AbortSignal) => Promise<T>,
  options: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<{ data: T; source: DataSource }> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = []
    const errors: unknown[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    let next = 0, failed = 0, settled = false
    const cleanup = () => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      controllers.forEach(controller => controller.abort())
    }
    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(options.signal?.reason ?? new DOMException('请求已取消', 'AbortError'))
    }
    const startNext = () => {
      if (settled || next >= sources.length) return
      clearTimeout(timer)
      const index = next++
      const source = sources[index]
      const controller = new AbortController()
      controllers.push(controller)
      if (next < sources.length) timer = setTimeout(startNext, options.delayMs ?? 2_000)
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted()
        return load(source, controller.signal)
      }).then(data => {
        if (settled) return
        settled = true
        cleanup()
        resolve({ data, source })
      }).catch(error => {
        if (settled) return
        errors[index] = error
        failed++
        if (next < sources.length) startNext()
        else if (failed === sources.length) {
          settled = true
          cleanup()
          reject(new Error(sources.map((item, i) => `${item.label}：${errors[i] instanceof Error ? errors[i].message : '请求失败'}`).join('；')))
        }
      })
    }
    if (!sources.length) return reject(new Error('没有可用的数据源'))
    if (options.signal?.aborted) return abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    startNext()
  })
}
