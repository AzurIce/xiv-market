import { createSignal } from 'solid-js'
import { createWorldDirectory, normalizeItemReport, type MarketQuality } from '@xiv-market/shared'
import { ItemReportView } from './view'

/** Supplied JSON only: no router, data requests, or writes to global stores. */
export function ItemReportSnapshot(props: { report: unknown; quality?: MarketQuality }) {
  const report = normalizeItemReport(props.report)
  const directory = createWorldDirectory(report.dataCenters, report.worlds)
  const [quality, setQuality] = createSignal<MarketQuality>(props.quality ?? 'hq')
  return (
    <div class="min-h-screen bg-background text-foreground">
      <div class="w-[1120px] bg-background" data-render-root="item-report" data-render-ready="true">
        <ItemReportView itemId={report.itemId} item={report.item} scope={report.scope} directory={directory}
          quality={quality()} onQualityChange={setQuality}
          market={{ data: report.market, loading: false, error: null }}
          history={{ data: report.history, loading: false, error: null }}
          showDetails={false} />
      </div>
    </div>
  )
}
