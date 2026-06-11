import { createMemo } from "solid-js"
import { dataCenters, getWorldName } from "@xiv-market/shared"
import { Select, SelectValue, SelectTrigger, SelectPortal, SelectContent, SelectItem } from "./select"

export function ScopeSelect(props: {
  value: string
  onChange: (value: string) => void
  region: string
  class?: string
}) {
  const regionDataCenters = createMemo(() => dataCenters.filter((dc) => dc.region === props.region))

  const options = createMemo(() => {
    const opts = [props.region]
    for (const dc of regionDataCenters()) {
      opts.push(dc.name)
      for (const worldId of dc.worlds) {
        const worldName = getWorldName(worldId)
        if (worldName) opts.push(worldName)
      }
    }
    return opts
  })

  const getLabel = (value: string) => {
    if (value === props.region) return `${value}（全部）`
    const dc = regionDataCenters().find((d) => d.name === value)
    if (dc) return `${value}（大区全部）`
    return value
  }

  return (
    <Select<string>
      options={options()}
      value={props.value}
      onChange={(val) => props.onChange(val ?? props.region)}
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>{getLabel(itemProps.item.rawValue)}</SelectItem>
      )}
    >
      <SelectTrigger size="sm" class={props.class}>
        <SelectValue<string>>{(state) => getLabel(state.selectedOption() ?? props.region)}</SelectValue>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent />
      </SelectPortal>
    </Select>
  )
}
