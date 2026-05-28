import { cn } from '@xiv-market/shared'

export function Input(props: {
  class?: string
  type?: string
  placeholder?: string
  value?: string
  onInput?: (e: InputEvent & { currentTarget: HTMLInputElement }) => void
  onChange?: (e: Event & { currentTarget: HTMLInputElement }) => void
}) {
  return (
    <input
      type={props.type ?? 'text'}
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )}
      placeholder={props.placeholder}
      value={props.value}
      onInput={props.onInput}
      onChange={props.onChange}
    />
  )
}
