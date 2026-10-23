import { createEffect, createMemo, on, onCleanup } from 'solid-js'
import { A, useParams, useSearchParams } from '@solidjs/router'
import {
  fetchMarketData, fetchHistoryData, createQueryResource, matchedData,
  selectedRegion, worldsReady, worldsLoadFailed, worldDirectory, getItemInfo, getItemName,
  parseMarketQuality,
} from '@xiv-market/shared'
import { ItemReportView } from '../item-report/view'
import { ScopeSelect } from '../scope-select'
import { RefreshButton } from '../refresh-button'
import { useErrorToast } from '../use-error-toast'

/** Web controller: routing, acquisition and refresh policy stay outside the view. */
export default function ItemDetail() {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const itemId = () => params.id ?? ''
  const queryScope = () => typeof searchParams.scope === 'string' ? searchParams.scope.trim() : ''
  const scope = () => queryScope() || selectedRegion()
  createEffect(on(selectedRegion, () => setSearchParams({ scope: undefined }), { defer: true }))
  const changeScope = (value: string) => setSearchParams({ scope: value })
  createEffect(() => { document.title = `XIV Market - ${getItemName(Number(itemId()))}` })
  onCleanup(() => { document.title = 'XIV Market' })

  const market = createQueryResource(
    () => itemId() ? { scope: scope(), id: itemId() } : null,
    ({ scope, id }, signal) => fetchMarketData(scope, id, signal),
  )
  const history = createQueryResource(
    () => itemId() ? { scope: scope(), id: itemId() } : null,
    ({ scope, id }, signal) => fetchHistoryData(scope, id, signal),
  )
  // Metadata loads in parallel in Navbar; preserve its failure fallback.
  const resolved = () => worldsReady() || worldsLoadFailed()
  const marketMatched = () => resolved()
    ? matchedData(market.res(), q => q.scope === scope() && q.id === itemId()) : undefined
  const historyMatched = () => resolved()
    ? matchedData(history.res(), q => q.scope === scope() && q.id === itemId()) : undefined
  useErrorToast(market.error, () => marketMatched() !== undefined, market.refetch)
  useErrorToast(history.error, () => historyMatched() !== undefined, history.refetch)
  const item = createMemo(() => getItemInfo(Number(itemId())) ?? {
    name: getItemName(Number(itemId())), icon: 0, canBeHq: true,
  })
  const backHref = () => {
    const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : ''
    return q ? `/?q=${encodeURIComponent(q)}` : '/'
  }

  return (
    <ItemReportView
      itemId={Number(itemId())}
      item={item()}
      scope={scope()}
      directory={worldDirectory()}
      quality={parseMarketQuality(searchParams.quality)}
      onQualityChange={quality => setSearchParams({ quality })}
      market={{
        data: marketMatched() === undefined ? undefined : marketMatched()![Number(itemId())] ?? null,
        loading: market.loading(), error: market.error(), retry: market.refetch,
      }}
      history={{ data: historyMatched(), loading: history.loading(), error: history.error(), retry: history.refetch }}
      sticky
      backLink={
        <A href={backHref()}
          class="flex-shrink-0 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-300 h-8 w-8"
          title="返回市场">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </A>
      }
      actions={compact => <>
        <ScopeSelect value={scope()} onChange={changeScope} region={selectedRegion()} />
        <RefreshButton loading={market.loading() || history.loading()}
          onClick={() => { market.refetch(); history.refetch() }}
          class={compact ? 'size-6' : 'size-7'} />
      </>}
    />
  )
}
