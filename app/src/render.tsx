import { render } from 'solid-js/web'
import { ItemReportSnapshot } from '@xiv-market/ui/item-report/snapshot'
import { ErrorBoundary } from '@xiv-market/ui/error-boundary'
import { parseMarketQuality } from '@xiv-market/shared'
import './index.css'

declare global {
  interface Window { __XIV_MARKET_REPORT__?: unknown }
}

const quality = parseMarketQuality(new URLSearchParams(window.location.search).get('quality')) ?? 'hq'

render(() => (
  <ErrorBoundary><ItemReportSnapshot report={window.__XIV_MARKET_REPORT__} quality={quality} /></ErrorBoundary>
), document.getElementById('root')!)
