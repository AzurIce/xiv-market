import { createEffect, createMemo, createSignal, onCleanup, For, Show } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import {
  fetchAggregatedData,
  createQueryResource,
  matchedData,
  getAllItems,
  itemsStatus,
  loadItems,
  selectedRegion,
  type AggregatedItemData,
} from '@xiv-market/shared'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { ItemIcon } from '../item-icon'
import { PageHeader } from '../page-header'
import { RefreshButton } from '../refresh-button'
import { Select, SelectContent, SelectItem, SelectPortal, SelectTrigger, SelectValue } from '../select'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table'
import { useErrorToast } from '../use-error-toast'
import { WorldBadge } from '../world-badge'

type MateriaGrade = 'all' | '拾贰' | '拾壹' | '拾' | '玖' | '捌' | '柒' | '陆' | '伍' | '肆' | '叁' | '贰' | '壹'
type MateriaKind = 'all' | 'battle' | 'crafter' | 'gatherer' | 'elemental' | 'retired'
type MateriaColor = 'all' | 'red' | 'purple' | 'yellow' | 'green' | 'blue' | 'gray'
type SortKey = 'grade' | 'minPrice' | 'averagePrice' | 'velocity' | 'name'

type MateriaItem = {
  id: number
  name: string
  icon: number
  grade: Exclude<MateriaGrade, 'all'>
  gradeRank: number
  kind: Exclude<MateriaKind, 'all'>
  kindLabel: string
  color: Exclude<MateriaColor, 'all'>
  statLabel: string
  statPrefix?: string
}

type MateriaRow = MateriaItem & {
  agg?: AggregatedItemData
}

const BATCH_SIZE = 50
const MATERIA_GRADES: MateriaGrade[] = ['all', '拾贰', '拾壹', '拾', '玖', '捌', '柒', '陆', '伍', '肆', '叁', '贰', '壹']
const MATERIA_KINDS: MateriaKind[] = ['all', 'battle', 'crafter', 'gatherer']
const MATERIA_COLORS: MateriaColor[] = ['all', 'red', 'purple', 'yellow', 'green', 'blue']
const SORT_KEYS: SortKey[] = ['grade', 'minPrice', 'averagePrice', 'velocity', 'name']
const COLOR_ORDER: Record<Exclude<MateriaColor, 'all'>, number> = {
  red: 1,
  purple: 2,
  yellow: 3,
  green: 4,
  blue: 5,
  gray: 99,
}

const GRADE_RANK: Record<Exclude<MateriaGrade, 'all'>, number> = {
  '壹': 1,
  '贰': 2,
  '叁': 3,
  '肆': 4,
  '伍': 5,
  '陆': 6,
  '柒': 7,
  '捌': 8,
  '玖': 9,
  '拾': 10,
  '拾壹': 11,
  '拾贰': 12,
}

const BATTLE_PREFIXES = ['刚力', '耐力', '巧力', '智力', '意力', '信力', '神眼', '武略', '雄略', '刚柔', '战技', '咏唱']
const CRAFTER_PREFIXES = ['名匠', '魔匠', '巨匠']
const GATHERER_PREFIXES = ['达识', '博识', '器识']
const ELEMENTAL_PREFIXES = ['创火', '创冰', '创风', '创土', '创雷', '创水']

// Extracted from ffxiv-datamining-cn Materia.csv joined with BaseParam.csv.
const COMBAT_MATERIA_VALUES: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 16,
  7: 8,
  8: 24,
  9: 12,
  10: 36,
  11: 18,
  12: 54,
}

const GATHERER_MAIN_MATERIA_VALUES: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 10,
  6: 15,
  7: 12,
  8: 20,
  9: 14,
  10: 25,
  11: 20,
  12: 36,
}

const CP_GP_MATERIA_VALUES: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 8,
  7: 7,
  8: 9,
  9: 8,
  10: 10,
  11: 9,
  12: 11,
}

const CRAFTSMANSHIP_MATERIA_VALUES: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 11,
  6: 16,
  7: 14,
  8: 21,
  9: 18,
  10: 27,
  11: 22,
  12: 33,
}

const CONTROL_MATERIA_VALUES: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 7,
  6: 10,
  7: 9,
  8: 13,
  9: 12,
  10: 18,
  11: 15,
  12: 23,
}

const MATERIA_STATS: Record<string, { stat: string; color: Exclude<MateriaColor, 'all'>; values?: Record<number, number> }> = {
  '神眼': { stat: '直击', color: 'red', values: COMBAT_MATERIA_VALUES },
  '武略': { stat: '暴击', color: 'red', values: COMBAT_MATERIA_VALUES },
  '雄略': { stat: '信念', color: 'red', values: COMBAT_MATERIA_VALUES },
  '信力': { stat: '信仰', color: 'yellow', values: COMBAT_MATERIA_VALUES },
  '刚柔': { stat: '坚韧', color: 'yellow', values: COMBAT_MATERIA_VALUES },
  '战技': { stat: '技能速度', color: 'purple', values: COMBAT_MATERIA_VALUES },
  '咏唱': { stat: '咏唱速度', color: 'purple', values: COMBAT_MATERIA_VALUES },
  '达识': { stat: '获得力', color: 'green', values: GATHERER_MAIN_MATERIA_VALUES },
  '博识': { stat: '鉴别力', color: 'green', values: GATHERER_MAIN_MATERIA_VALUES },
  '器识': { stat: '采集力', color: 'green', values: CP_GP_MATERIA_VALUES },
  '名匠': { stat: '作业精度', color: 'blue', values: CRAFTSMANSHIP_MATERIA_VALUES },
  '魔匠': { stat: '制作力', color: 'blue', values: CP_GP_MATERIA_VALUES },
  '巨匠': { stat: '加工精度', color: 'blue', values: CONTROL_MATERIA_VALUES },
  '刚力': { stat: '力量', color: 'gray' },
  '耐力': { stat: '耐力', color: 'gray' },
  '巧力': { stat: '灵巧', color: 'gray' },
  '智力': { stat: '智力', color: 'gray' },
  '意力': { stat: '精神', color: 'gray' },
  '创火': { stat: '火属性耐性', color: 'gray' },
  '创冰': { stat: '冰属性耐性', color: 'gray' },
  '创风': { stat: '风属性耐性', color: 'gray' },
  '创土': { stat: '土属性耐性', color: 'gray' },
  '创雷': { stat: '雷属性耐性', color: 'gray' },
  '创水': { stat: '水属性耐性', color: 'gray' },
}

const COLOR_META: Record<MateriaColor, { label: string; class: string; dot: string }> = {
  all: {
    label: '全部颜色',
    class: 'border-border bg-background text-foreground',
    dot: 'bg-foreground',
  },
  red: {
    label: '红色',
    class: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  purple: {
    label: '紫色',
    class: 'border-violet-200 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
  },
  yellow: {
    label: '黄色',
    class: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  green: {
    label: '绿色',
    class: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  blue: {
    label: '蓝色',
    class: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
  },
  gray: {
    label: '旧版',
    class: 'border-slate-200 bg-slate-50 text-slate-700',
    dot: 'bg-slate-400',
  },
}

function getMateriaGrade(name: string): Exclude<MateriaGrade, 'all'> | null {
  const match = name.match(/魔晶石(拾贰|拾壹|拾|玖|捌|柒|陆|伍|肆|叁|贰|壹)型$/)
  return (match?.[1] as Exclude<MateriaGrade, 'all'> | undefined) ?? null
}

function getMateriaKind(name: string): { kind: Exclude<MateriaKind, 'all'>; label: string } {
  if (BATTLE_PREFIXES.some((prefix) => name.startsWith(prefix))) return { kind: 'battle', label: '战斗' }
  if (CRAFTER_PREFIXES.some((prefix) => name.startsWith(prefix))) return { kind: 'crafter', label: '生产' }
  if (GATHERER_PREFIXES.some((prefix) => name.startsWith(prefix))) return { kind: 'gatherer', label: '采集' }
  if (ELEMENTAL_PREFIXES.some((prefix) => name.startsWith(prefix))) return { kind: 'elemental', label: '属性' }
  return { kind: 'retired', label: '旧版' }
}

function getMateriaMeta(name: string) {
  const prefix = Object.keys(MATERIA_STATS).find((key) => name.startsWith(key))
  const stat = prefix ? MATERIA_STATS[prefix] : undefined
  const color = stat?.color ?? 'gray'
  return {
    color,
    statLabel: stat?.stat ?? '旧版属性',
    statPrefix: prefix,
  }
}

function isMateriaItem(name: string): boolean {
  return Boolean(getMateriaGrade(name)) && !name.includes('半魔晶石') && !name.includes('契约')
}

function formatGil(value: number | undefined): string {
  if (!value || value <= 0) return '-'
  return Math.round(value).toLocaleString('zh-CN')
}

function formatVelocity(value: number | undefined): string {
  if (!value || value <= 0) return '-'
  return value < 0.01 ? '<0.01/天' : `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}/天`
}

function formatTime(ts: number | undefined): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} 天前`
  return d.toLocaleDateString('zh-CN')
}

function getListingWorldId(agg: AggregatedItemData | undefined): number | undefined {
  return agg?.nq.minListingWorldId
}

function gradeLabel(value: MateriaGrade) {
  return value === 'all' ? '全部品级' : `${value}型`
}

function kindLabel(value: MateriaKind) {
  const labels: Record<MateriaKind, string> = {
    all: '全部类型',
    battle: '战斗',
    crafter: '生产',
    gatherer: '采集',
    elemental: '属性',
    retired: '旧版',
  }
  return labels[value]
}

function colorLabel(value: MateriaColor) {
  return COLOR_META[value].label
}

function sortLabel(value: SortKey) {
  const labels: Record<SortKey, string> = {
    grade: '品级优先',
    minPrice: '本页最低价',
    averagePrice: '本页均价',
    velocity: '本页销量',
    name: '名称',
  }
  return labels[value]
}

function ListingPrice(props: { price?: number; worldId?: number }) {
  return (
    <div class="flex flex-col leading-tight">
      <Show
        when={props.price && props.price > 0}
        fallback={<span class="text-muted-foreground">-</span>}
      >
        <span class="font-medium tabular-nums">{formatGil(props.price)}</span>
        <WorldBadge worldId={props.worldId} class="mt-0.5 text-xs text-muted-foreground" />
      </Show>
    </div>
  )
}

function PriceValue(props: { value?: number }) {
  return (
    <Show
      when={props.value && props.value > 0}
      fallback={<span class="text-muted-foreground">-</span>}
    >
      <span class="tabular-nums">{formatGil(props.value)}</span>
    </Show>
  )
}

function StatValue(props: { row: MateriaRow }) {
  const bonus = createMemo(() => getMateriaBonus(props.row))

  return (
    <div class="flex flex-col leading-tight">
      <span class="font-medium">{props.row.statLabel}</span>
      <Show
        when={bonus()}
        fallback={<span class="text-xs text-muted-foreground">数值未收录</span>}
      >
        {(value) => <span class="text-xs text-muted-foreground">+{value()}</span>}
      </Show>
    </div>
  )
}

function getMateriaBonus(row: MateriaRow): number | null {
  if (!row.statPrefix) return null
  return MATERIA_STATS[row.statPrefix]?.values?.[row.gradeRank] ?? null
}

function ColorTabs(props: {
  value: MateriaColor
  counts: Record<MateriaColor, number>
  onChange: (value: MateriaColor) => void
}) {
  return (
    <div class="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="魔晶石颜色分类">
      <For each={MATERIA_COLORS}>
        {(color) => (
          <Button
            type="button"
            variant={props.value === color ? 'default' : 'outline'}
            size="sm"
            class="shrink-0"
            onClick={() => props.onChange(color)}
          >
            <span class={`size-2 rounded-full ${COLOR_META[color].dot}`} />
            <span>{colorLabel(color)}</span>
            <span class={props.value === color ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
              {props.counts[color]}
            </span>
          </Button>
        )}
      </For>
    </div>
  )
}

function SectionHeaderRow(props: { color: Exclude<MateriaColor, 'all'>; count: number }) {
  return (
    <TableRow class="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={6} class="py-2">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span class={`size-2.5 rounded-full ${COLOR_META[props.color].dot}`} />
          <span>{COLOR_META[props.color].label}</span>
          <span>{props.count} 个</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ListingVelocity(props: { value?: number }) {
  return (
    <Show
      when={props.value && props.value > 0}
      fallback={
        <span class="text-muted-foreground">-</span>
      }
    >
      <span class="tabular-nums">{formatVelocity(props.value)}</span>
    </Show>
  )
}

// 骨架行数跟随当前筛选行数：切换筛选导致的重新加载不产生高度跳动
function TableSkeleton(props: { rows: number }) {
  return (
    <div class="space-y-2" role="status">
      <span class="sr-only">加载中</span>
      <For each={Array.from({ length: props.rows })}>
        {() => <Skeleton class="h-12 w-full" />}
      </For>
    </div>
  )
}

function MateriaMobileCard(props: { row: MateriaRow; onOpen: (e?: MouseEvent) => void }) {
  const agg = () => props.row.agg

  return (
    <Card
      class="cursor-pointer py-3 transition-shadow hover:shadow-md"
      role="button"
      tabindex="0"
      onClick={props.onOpen}
      onAuxClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          props.onOpen(e as unknown as MouseEvent)
        }
      }}
    >
      <CardContent class="space-y-3">
        <div class="flex items-center gap-3">
          <ItemIcon itemId={props.row.id} class="h-8 w-8 shrink-0 rounded" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{props.row.name}</div>
            <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>#{props.row.id}</span>
              <span>{props.row.kindLabel}</span>
              <span>{props.row.grade}型</span>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div class="mb-1 text-muted-foreground">属性</div>
            <div class="font-medium">{props.row.statLabel} <Show when={getMateriaBonus(props.row)}>+{getMateriaBonus(props.row)}</Show></div>
          </div>
          <div>
            <div class="mb-1 text-muted-foreground">最低挂单</div>
            <ListingPrice price={agg()?.nq.minListingPrice} worldId={getListingWorldId(agg())} />
          </div>
        </div>
        <div class="flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
          <span>均价 {formatGil(agg()?.nq.averageSalePrice)}</span>
          <span>销量 {formatVelocity(agg()?.nq.dailySaleVelocity)}</span>
          <span>{formatTime(agg()?.lastUploadTime)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MateriaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = createSignal(typeof searchParams.q === 'string' ? searchParams.q : '')
  const [debouncedQuery, setDebouncedQuery] = createSignal(query())
  const [grade, setGrade] = createSignal<MateriaGrade>(
    MATERIA_GRADES.includes(searchParams.grade as MateriaGrade) ? searchParams.grade as MateriaGrade : 'all'
  )
  const [kind, setKind] = createSignal<MateriaKind>(
    MATERIA_KINDS.includes(searchParams.kind as MateriaKind) ? searchParams.kind as MateriaKind : 'all'
  )
  const [color, setColor] = createSignal<MateriaColor>(
    MATERIA_COLORS.includes(searchParams.color as MateriaColor) ? searchParams.color as MateriaColor : 'all'
  )
  const [sortKey, setSortKey] = createSignal<SortKey>(
    SORT_KEYS.includes(searchParams.sort as SortKey) ? searchParams.sort as SortKey : 'grade'
  )

  const materiaItems = createMemo<MateriaItem[]>(() => {
    return getAllItems()
      .filter((item) => isMateriaItem(item.name))
      .map((item) => {
        const itemGrade = getMateriaGrade(item.name)!
        const itemKind = getMateriaKind(item.name)
        const itemMeta = getMateriaMeta(item.name)
        return {
          ...item,
          grade: itemGrade,
          gradeRank: GRADE_RANK[itemGrade],
          kind: itemKind.kind,
          kindLabel: itemKind.label,
          ...itemMeta,
        }
      })
      .filter((item) => item.color !== 'gray')
  })

  // 基础排序固定为颜色→品级→类型→名称；显示排序在 currentRows 本地做（不发请求）
  const filteredItems = createMemo<MateriaItem[]>(() => {
    const search = debouncedQuery().trim().toLowerCase()
    return materiaItems()
      .filter((item) => {
        if (grade() !== 'all' && item.grade !== grade()) return false
        if (kind() !== 'all' && item.kind !== kind()) return false
        if (color() !== 'all' && item.color !== color()) return false
        if (!search) return true
        return item.name.toLowerCase().includes(search) || item.id.toString().includes(search)
      })
      .sort((a, b) => {
        const colorOrder = COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
        if (colorOrder !== 0) return colorOrder
        return b.gradeRank - a.gradeRank || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'zh-CN')
      })
  })

  const colorCounts = createMemo(() => {
    const counts = Object.fromEntries(MATERIA_COLORS.map((item) => [item, 0])) as Record<MateriaColor, number>
    for (const item of materiaItems()) {
      if (grade() !== 'all' && item.grade !== grade()) continue
      if (kind() !== 'all' && item.kind !== kind()) continue
      const search = debouncedQuery().trim().toLowerCase()
      if (search && !item.name.toLowerCase().includes(search) && !item.id.toString().includes(search)) continue
      counts.all += 1
      counts[item.color] += 1
    }
    return counts
  })

  const currentItems = createMemo(() => {
    return filteredItems()
  })

  // 魔晶石全集固定且量小（~150 个），聚合数据按 region 一次拉全（分批并发），
  // 筛选/搜索/排序全部本地完成——不发请求、不闪骨架；只有切区和点刷新才重新请求。
  // 前置：items.json 未就绪时不发起请求（加载中 → 骨架；失败 → 错误屏重试）
  const agg = createQueryResource(
    () => (itemsStatus() === 'ready' ? { region: selectedRegion() } : null),
    async ({ region }, signal) => {
      const ids = materiaItems().map((item) => item.id)
      const map = new Map<number, AggregatedItemData>()
      if (!ids.length) return map

      const batches: number[][] = []
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        batches.push(ids.slice(i, i + BATCH_SIZE))
      }

      const results = await Promise.all(
        batches.map((batch) => fetchAggregatedData(region, batch.join(','), 'region', signal))
      )
      for (const batch of results) {
        for (const item of batch) {
          map.set(item.itemId, item)
        }
      }
      return map
    }
  )
  const aggMap = () =>
    matchedData(agg.res(), (q) => q.region === selectedRegion())

  // 错误落点：无数据 → 下方错误屏；有数据（点刷新失败）→ toast
  useErrorToast(agg.error, () => aggMap() !== undefined, agg.refetch)

  const currentRows = createMemo<MateriaRow[]>(() => {
    const map = aggMap()
    const rows = currentItems().map((item) => ({ ...item, agg: map?.get(item.id) }))
    if (sortKey() === 'name') {
      return rows.sort((a, b) => {
        const colorOrder = COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
        if (colorOrder !== 0) return colorOrder
        return a.name.localeCompare(b.name, 'zh-CN') || a.id - b.id
      })
    }
    if (sortKey() === 'minPrice') {
      return rows.sort((a, b) => {
        const aValue = a.agg?.nq.minListingPrice ?? Number.MAX_SAFE_INTEGER
        const bValue = b.agg?.nq.minListingPrice ?? Number.MAX_SAFE_INTEGER
        return aValue - bValue || b.gradeRank - a.gradeRank || a.name.localeCompare(b.name, 'zh-CN')
      })
    }
    if (sortKey() === 'averagePrice') {
      return rows.sort((a, b) => {
        const aValue = a.agg?.nq.averageSalePrice ?? Number.MAX_SAFE_INTEGER
        const bValue = b.agg?.nq.averageSalePrice ?? Number.MAX_SAFE_INTEGER
        return aValue - bValue || b.gradeRank - a.gradeRank || a.name.localeCompare(b.name, 'zh-CN')
      })
    }
    if (sortKey() === 'velocity') {
      return rows.sort((a, b) => {
        const aValue = a.agg?.nq.dailySaleVelocity ?? 0
        const bValue = b.agg?.nq.dailySaleVelocity ?? 0
        return bValue - aValue || b.gradeRank - a.gradeRank || a.name.localeCompare(b.name, 'zh-CN')
      })
    }
    return rows
  })
  const currentRowsWithSections = createMemo(() => {
    const result: ({ type: 'section'; color: Exclude<MateriaColor, 'all'>; count: number } | { type: 'row'; row: MateriaRow })[] = []
    const pageRows = currentRows()
    let lastColor: Exclude<MateriaColor, 'all'> | null = null

    for (const row of pageRows) {
      if (row.color !== lastColor) {
        result.push({
          type: 'section',
          color: row.color,
          count: filteredItems().filter((item) => item.color === row.color).length,
        })
        lastColor = row.color
      }
      result.push({ type: 'row', row })
    }

    return result
  })

  const updateParams = (next?: { q?: string; grade?: MateriaGrade; kind?: MateriaKind; color?: MateriaColor; sort?: SortKey }) => {
    const q = next?.q ?? query()
    const g = next?.grade ?? grade()
    const k = next?.kind ?? kind()
    const c = next?.color ?? color()
    const s = next?.sort ?? sortKey()
    setSearchParams({
      q: q ? q : undefined,
      grade: g === 'all' ? undefined : g,
      kind: k === 'all' ? undefined : k,
      color: c === 'all' ? undefined : c,
      sort: s === 'grade' ? undefined : s,
    }, { replace: true })
  }

  createEffect(() => {
    if (!MATERIA_COLORS.includes(color())) {
      setColor('all')
      updateParams({ color: 'all' })
    }
    if (!MATERIA_KINDS.includes(kind())) {
      setKind('all')
      updateParams({ kind: 'all' })
    }
  })

  let searchTimer: number | undefined
  onCleanup(() => window.clearTimeout(searchTimer))

  const setQueryAndParams = (value: string) => {
    setQuery(value)
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      setDebouncedQuery(value)
      updateParams({ q: value })
    }, 300)
  }

  const handleRefresh = () => {
    // 前置（物品基础数据）失败时重试前置；否则只刷新聚合数据（参数不变，内容保留）
    if (itemsStatus() === 'error') void loadItems()
    else agg.refetch()
  }

  const itemPath = (itemId: number) => `/item/${itemId}`

  const itemUrl = (itemId: number) => {
    const url = new URL(window.location.href)
    url.hash = itemPath(itemId)
    return url.toString()
  }

  const openItem = (itemId: number, e?: MouseEvent) => {
    if (e?.button === 1 || e?.ctrlKey || e?.metaKey) {
      e.preventDefault()
      window.open(itemUrl(itemId), '_blank', 'noopener')
      return
    }
    navigate(itemPath(itemId))
  }

  return (
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="魔晶石行情"
        description="集中查看全部常规魔晶石的最低挂单、成交均价和日销量"
        actions={<RefreshButton loading={agg.loading()} onClick={handleRefresh} />}
      />

      <div class="mb-6 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <div class="relative min-w-0">
          <svg class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            value={query()}
            onInput={(e) => setQueryAndParams(e.currentTarget.value)}
            class="pl-10 pr-16"
            placeholder="搜索魔晶石名称或 ID..."
          />
          <Show when={query()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => setQueryAndParams('')}
              aria-label="清除搜索"
              title="清除搜索"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </Button>
          </Show>
        </div>

        <Select<MateriaGrade>
          options={MATERIA_GRADES}
          value={grade()}
          onChange={(value) => {
            const next = value ?? 'all'
            setGrade(next)
            updateParams({ grade: next })
          }}
          itemComponent={(props) => <SelectItem item={props.item}>{gradeLabel(props.item.rawValue)}</SelectItem>}
        >
          <SelectTrigger class="w-full justify-between lg:w-32">
            <SelectValue<MateriaGrade>>{(state) => gradeLabel(state.selectedOption() ?? 'all')}</SelectValue>
          </SelectTrigger>
          <SelectPortal><SelectContent /></SelectPortal>
        </Select>

        <Select<MateriaKind>
          options={MATERIA_KINDS}
          value={kind()}
          onChange={(value) => {
            const next = value ?? 'all'
            setKind(next)
            updateParams({ kind: next })
          }}
          itemComponent={(props) => <SelectItem item={props.item}>{kindLabel(props.item.rawValue)}</SelectItem>}
        >
          <SelectTrigger class="w-full justify-between lg:w-32">
            <SelectValue<MateriaKind>>{(state) => kindLabel(state.selectedOption() ?? 'all')}</SelectValue>
          </SelectTrigger>
          <SelectPortal><SelectContent /></SelectPortal>
        </Select>

        <Select<SortKey>
          options={SORT_KEYS}
          value={sortKey()}
          onChange={(value) => {
            const next = value ?? 'grade'
            setSortKey(next)
            updateParams({ sort: next })
          }}
          itemComponent={(props) => <SelectItem item={props.item}>{sortLabel(props.item.rawValue)}</SelectItem>}
        >
          <SelectTrigger class="w-full justify-between lg:w-36">
            <SelectValue<SortKey>>{(state) => sortLabel(state.selectedOption() ?? 'grade')}</SelectValue>
          </SelectTrigger>
          <SelectPortal><SelectContent /></SelectPortal>
        </Select>
      </div>

      <ColorTabs
        value={color()}
        counts={colorCounts()}
        onChange={(next) => {
          setColor(next)
          updateParams({ color: next })
        }}
      />

      <Show
        when={itemsStatus() !== 'error'}
        fallback={
          <EmptyState
            variant="error"
            title="物品数据加载失败"
            description="物品基础数据（名称、图标）暂时无法获取，请稍后再试"
            action={<Button variant="outline" size="sm" onClick={() => void loadItems()}>重试</Button>}
          />
        }
      >
        <Show
          when={aggMap() !== undefined}
          fallback={
            <Show
              when={!agg.error()}
              fallback={
                <EmptyState
                  variant="error"
                  title="魔晶石行情加载失败"
                  description={agg.error() ?? undefined}
                  action={<RefreshButton loading={agg.loading()} onClick={handleRefresh} />}
                />
              }
            >
              <TableSkeleton rows={currentRows().length || 8} />
            </Show>
          }
        >
          <Show
            when={currentRows().length > 0}
            fallback={
              <EmptyState
                title="未找到魔晶石"
                description="当前筛选条件下没有匹配的魔晶石"
              />
            }
          >
            <div class="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>魔晶石</TableHead>
                    <TableHead>属性</TableHead>
                    <TableHead>最低挂单</TableHead>
                    <TableHead>成交均价</TableHead>
                    <TableHead>日销量</TableHead>
                    <TableHead class="hidden lg:table-cell">更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={currentRowsWithSections()}>
                    {(entry) => {
                      if (entry.type === 'section') {
                        return <SectionHeaderRow color={entry.color} count={entry.count} />
                      }
                      const row = entry.row
                      return (
                        <TableRow class="cursor-pointer" onClick={(e) => openItem(row.id, e)} onAuxClick={(e) => openItem(row.id, e)}>
                          <TableCell>
                            <div class="flex items-center gap-2">
                              <ItemIcon itemId={row.id} class="size-7 shrink-0 rounded" />
                              <div class="min-w-0">
                                <div class="max-w-xs truncate font-medium">{row.name}</div>
                                <div class="text-xs text-muted-foreground">#{row.id}</div>
                              </div>
                            </div>
                        </TableCell>
                        <TableCell>
                          <StatValue row={row} />
                        </TableCell>
                        <TableCell>
                          <ListingPrice price={row.agg?.nq.minListingPrice} worldId={getListingWorldId(row.agg)} />
                        </TableCell>
                        <TableCell>
                          <PriceValue value={row.agg?.nq.averageSalePrice} />
                        </TableCell>
                        <TableCell>
                          <ListingVelocity value={row.agg?.nq.dailySaleVelocity} />
                        </TableCell>
                        <TableCell class="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatTime(row.agg?.lastUploadTime)}
                        </TableCell>
                        </TableRow>
                      )
                    }}
                  </For>
                </TableBody>
              </Table>
            </div>

            <div class="space-y-2 sm:hidden">
              <For each={currentRows()}>
                {(row) => <MateriaMobileCard row={row} onOpen={(e) => openItem(row.id, e)} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
