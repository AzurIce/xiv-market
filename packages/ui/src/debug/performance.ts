export function resourceDetails(entry: PerformanceResourceTiming) {
  const available = entry.requestStart > 0 && entry.responseStart > 0
  return {
    name: entry.name,
    start: entry.startTime,
    duration: entry.duration,
    available,
    dns: available ? Math.max(0, entry.domainLookupEnd - entry.domainLookupStart) : null,
    connect: available ? Math.max(0, entry.connectEnd - entry.connectStart) : null,
    tls: available ? entry.secureConnectionStart > 0 ? Math.max(0, entry.connectEnd - entry.secureConnectionStart) : 0 : null,
    ttfb: available ? Math.max(0, entry.responseStart - entry.requestStart) : null,
    transfer: available ? entry.transferSize : null,
    cached: available ? entry.transferSize === 0 && entry.decodedBodySize > 0 : null,
  }
}

export function browserProfile() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return {
    domReady: nav && nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd - nav.startTime : null,
    load: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : null,
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    resources: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).slice(-100).map(resourceDetails),
  }
}
