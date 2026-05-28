import { For, Show, createMemo } from "solid-js"
import { cn } from "@xiv-market/shared"
import { Button } from "./button"

export function Pagination(props: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  class?: string
}) {
  const canPrev = () => props.page > 1
  const canNext = () => props.page < props.totalPages

  const pages = createMemo(() => {
    const total = props.totalPages
    const current = props.page
    const delta = 2
    const range: (number | "ellipsis")[] = []
    const left = Math.max(2, current - delta)
    const right = Math.min(total - 1, current + delta)

    range.push(1)
    if (left > 2) range.push("ellipsis" as const)
    for (let i = left; i <= right; i++) range.push(i)
    if (right < total - 1) range.push("ellipsis" as const)
    if (total > 1) range.push(total)

    return range
  })

  return (
    <nav class={cn("flex items-center justify-center gap-1 overflow-x-auto max-w-full py-1", props.class)} aria-label="分页">
      <Button
        variant="outline"
        size="sm"
        class="h-9 w-9 p-0 shrink-0"
        disabled={!canPrev()}
        onClick={() => props.onChange(props.page - 1)}
        aria-label="上一页"
      >
        <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </Button>
      <For each={pages()}>
        {(p) => (
          <Show
            when={p !== "ellipsis"}
            fallback={
              <span class="flex size-9 items-center justify-center text-muted-foreground shrink-0" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                  </g>
                </svg>
              </span>
            }
          >
            <Button
              variant={p === props.page ? "default" : "outline"}
              size="sm"
              class="min-w-[2.25rem] h-9 px-3 shrink-0"
              onClick={() => props.onChange(p as number)}
              aria-current={p === props.page ? "page" : undefined}
            >
              {p}
            </Button>
          </Show>
        )}
      </For>
      <Button
        variant="outline"
        size="sm"
        class="h-9 w-9 p-0 shrink-0"
        disabled={!canNext()}
        onClick={() => props.onChange(props.page + 1)}
        aria-label="下一页"
      >
        <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </Button>
    </nav>
  )
}
