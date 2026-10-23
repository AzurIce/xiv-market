export interface ReportRenderState { ready: boolean; error: string }

/** Observe actual render work. No timers, network-idle heuristic, or module globals. */
export function observeReportReadiness(root: HTMLElement, update: (state: ReportRenderState) => void): () => void {
  let frame = 0
  let stopped = false
  let previousGeometry = ''
  const decoded = new WeakMap<HTMLImageElement, { source: string; state: 'pending' | 'ready' | 'error' }>()
  const visible = (element: Element) => element.getClientRects().length > 0

  function invalidate() {
    if (stopped) return
    previousGeometry = ''
    update({ ready: false, error: '' })
    if (!frame) frame = requestAnimationFrame(check)
  }

  function check() {
    frame = 0
    if (stopped) return
    if (root.querySelector('[data-chart-state="error"]')) {
      update({ ready: false, error: '图表绘制失败，请重试' })
      return
    }
    // These operations wake the observer themselves when their work finishes.
    if (document.fonts.status !== 'loaded') return
    const canvases = [...root.querySelectorAll('canvas')].filter(visible)
    if (canvases.some(canvas => canvas.dataset.chartState !== 'ready')) return
    if ([...root.querySelectorAll('[data-layout-ready="false"]')].some(visible)) return
    const images = [...root.querySelectorAll('img')].filter(visible)
    let pendingImage = false
    for (const image of images) {
      if (!image.complete) { pendingImage = true; continue }
      const source = image.currentSrc || image.src
      const entry = decoded.get(image)
      if (entry?.source === source) {
        if (entry.state === 'error') {
          update({ ready: false, error: '图片解码失败，请重试' })
          return
        }
        if (entry.state === 'pending') pendingImage = true
        continue
      }
      const value = { source, state: 'pending' as 'pending' | 'ready' | 'error' }
      decoded.set(image, value)
      pendingImage = true
      void image.decode().then(() => { value.state = 'ready' }, () => { value.state = 'error' }).finally(invalidate)
    }
    if (pendingImage) return
    // Two consecutive animation frames with identical measured geometry also
    // allow ResizeObserver callbacks and Solid effects to reach their final layout.
    const box = root.getBoundingClientRect()
    const geometry = [box.width, box.height, ...canvases.flatMap(canvas => [canvas.width, canvas.height])].join(',')
    if (geometry === previousGeometry) {
      update({ ready: true, error: '' })
      return
    }
    previousGeometry = geometry
    frame = requestAnimationFrame(check)
  }

  const mutations = new MutationObserver(invalidate)
  mutations.observe(root, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['src', 'width', 'height', 'style', 'class', 'data-chart-state', 'data-layout-ready'] })
  const resize = new ResizeObserver(invalidate)
  resize.observe(root)
  root.addEventListener('load', invalidate, true)
  root.addEventListener('error', invalidate, true)
  document.fonts.addEventListener('loadingdone', invalidate)
  void document.fonts.ready.then(invalidate)
  invalidate()
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    mutations.disconnect()
    resize.disconnect()
    root.removeEventListener('load', invalidate, true)
    root.removeEventListener('error', invalidate, true)
    document.fonts.removeEventListener('loadingdone', invalidate)
  }
}
