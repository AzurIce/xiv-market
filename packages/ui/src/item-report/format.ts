export function formatGil(v: number): string {
  return v.toLocaleString('zh-CN')
}

export function formatAxisGil(v: number): string {
  if (v >= 1000000) return `${Number((v / 1000000).toPrecision(3))}M`
  if (v >= 1000) return `${Number((v / 1000).toPrecision(3))}K`
  return formatGil(Math.round(v))
}

export function formatDailySales(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '-'
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toLocaleString('zh-CN', { maximumFractionDigits: digits })}/天`
}

export function formatTime(ts: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} 天前`
  return d.toLocaleDateString('zh-CN')
}
