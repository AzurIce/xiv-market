/** Gil prices use whole units; keep the source precision for calculations. */
export function formatGil(value: number): string {
  return Math.round(value).toLocaleString('zh-CN')
}
