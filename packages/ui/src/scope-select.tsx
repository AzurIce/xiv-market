import { createMemo } from "solid-js"
import { dataCenters, getWorldName } from "@xiv-market/shared"
import { Select, SelectValue, SelectTrigger, SelectPortal, SelectContent, SelectItem } from "./select"
import { DcBadge } from "./world-badge"

type ScopeOptionItem = {
  type: "region" | "dc" | "world"
  value: string
  label: string
  dcName?: string
}

function ScopeOptionContent(props: { option: ScopeOptionItem }) {
  if (props.option.type === "region") {
    return <span>{props.option.label}</span>
  }
  if (props.option.type === "dc") {
    return (
      <span class="inline-flex items-center gap-1.5">
        <DcBadge dcName={props.option.dcName!} />
        <span>{props.option.value}</span>
        <span class="text-muted-foreground">（大区全部）</span>
      </span>
    )
  }
  return <span>{props.option.value}</span>
}

// world 选项的缩进竖线画在整个选项全高上（before 伪元素），
// 相邻 world 选项的线首尾相接形成一条贯通线，仅在大区边界处断开
const worldItemClass =
  "relative pl-8 before:absolute before:left-[1.125rem] before:inset-y-0 before:border-l before:border-border before:content-['']"

export function ScopeSelect(props: {
  value: string
  onChange: (value: string) => void
  region: string
  class?: string
}) {
  const regionDataCenters = createMemo(() => dataCenters.filter((dc) => dc.region === props.region))

  const options = createMemo<ScopeOptionItem[]>(() => {
    const opts: ScopeOptionItem[] = [
      { type: "region", value: props.region, label: `${props.region}（全部）` },
    ]
    for (const dc of regionDataCenters()) {
      opts.push({ type: "dc", value: dc.name, label: `${dc.name}（大区全部）`, dcName: dc.name })
      for (const worldId of dc.worlds) {
        const worldName = getWorldName(worldId)
        if (worldName) opts.push({ type: "world", value: worldName, label: worldName, dcName: dc.name })
      }
    }
    return opts
  })

  const getLabel = (value: string) =>
    options().find((o) => o.value === value)?.label ?? value

  return (
    <Select<ScopeOptionItem>
      options={options()}
      optionValue="value"
      optionTextValue="label"
      value={options().find((o) => o.value === props.value)}
      onChange={(option) => props.onChange(option?.value ?? props.region)}
      itemComponent={(itemProps) => (
        <SelectItem
          item={itemProps.item}
          class={itemProps.item.rawValue.type === "world" ? worldItemClass : undefined}
        >
          <ScopeOptionContent option={itemProps.item.rawValue} />
        </SelectItem>
      )}
    >
      <SelectTrigger size="sm" class={props.class}>
        <SelectValue<ScopeOptionItem>>
          {(state) => state.selectedOption()?.label ?? getLabel(props.value)}
        </SelectValue>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent />
      </SelectPortal>
    </Select>
  )
}
