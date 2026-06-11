import { selectedRegion, setSelectedRegion, availableRegions } from '@xiv-market/shared'
import { Select, SelectValue, SelectTrigger, SelectPortal, SelectContent, SelectItem } from '../select'

export default function RegionSelect() {
  const regions = () => {
    const available = availableRegions()
    if (available.length > 0) return available
    return ['中国', '日本', '北美', '欧洲', '大洋洲']
  }

  return (
    <Select<string>
      options={regions()}
      value={selectedRegion()}
      onChange={(val) => setSelectedRegion(val ?? '中国')}
      itemComponent={(props) => (
        <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
      )}
    >
      <SelectTrigger size="sm">
        <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent />
      </SelectPortal>
    </Select>
  )
}
