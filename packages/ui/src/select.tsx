import type { ComponentProps, ValidComponent, VoidProps } from "solid-js"
import { mergeProps, splitProps } from "solid-js"
import { Select as SelectPrimitive } from "@kobalte/core/select"

import { cx } from "@xiv-market/shared"

export const SelectPortal = SelectPrimitive.Portal

export type SelectProps<
  Option,
  OptGroup = never,
  T extends ValidComponent = "div",
> = ComponentProps<typeof SelectPrimitive<Option, OptGroup, T>>

export const Select = <
  Option,
  OptGroup = never,
  T extends ValidComponent = "div",
>(
  props: SelectProps<Option, OptGroup, T>,
) => {
  const [, rest] = splitProps(props as SelectProps<Option, OptGroup>, ["class"])

  return (
    <SelectPrimitive
      data-slot="select"
      class={cx("space-y-2", props.class)}
      {...rest}
    />
  )
}

export type SelectValueProps<Options, T extends ValidComponent = "span"> =
  ComponentProps<typeof SelectPrimitive.Value<Options, T>>

export const SelectValue = <Options, T extends ValidComponent = "span">(
  props: SelectValueProps<Options, T>,
) => {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

export type SelectTriggerProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof SelectPrimitive.Trigger<T>> & {
    size?: "sm" | "default"
  }

export const SelectTrigger = <T extends ValidComponent = "button">(
  props: SelectTriggerProps<T>,
) => {
  const merge = mergeProps({ size: "default" } as SelectTriggerProps, props)
  const [, rest] = splitProps(merge, ["class", "size", "children"])

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={props.size}
      class={cx(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex w-fit items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-9 data-[size=sm]:h-8",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      {...rest}
    >
      {props.children}
      <SelectPrimitive.Icon
        as={() => (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="size-4 opacity-50"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="m6 9l6 6l6-6"
            />
          </svg>
        )}
      />
    </SelectPrimitive.Trigger>
  )
}

export type SelectContentProps<T extends ValidComponent = "div"> = VoidProps<
  ComponentProps<typeof SelectPrimitive.Content<T>>
>

export const SelectContent = <T extends ValidComponent = "div">(
  props: SelectContentProps<T>,
) => {
  const [, rest] = splitProps(props as SelectContentProps, ["class"])

  return (
    <SelectPrimitive.Content
      data-slot="select-content"
      class={cx(
        "bg-popover text-popover-foreground overscroll-contain relative z-50 min-w-[8rem] max-h-[min(24rem,calc(100vh-6rem))] overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
        props.class,
      )}
      {...rest}
    >
      <SelectPrimitive.Listbox class="p-1 outline-none" />
    </SelectPrimitive.Content>
  )
}

export type SelectItemProps<T extends ValidComponent = "li"> = ComponentProps<
  typeof SelectPrimitive.Item<T>
>

export const SelectItem = <T extends ValidComponent = "li">(
  props: SelectItemProps<T>,
) => {
  const [, rest] = splitProps(props as SelectItemProps, ["class", "children"])

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      class={cx(
        "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        props.class,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemLabel>
        {(props as SelectItemProps).children}
      </SelectPrimitive.ItemLabel>
      <SelectPrimitive.ItemIndicator
        as={() => (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="size-3.5"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 6L9 17l-5-5"
            />
          </svg>
        )}
      />
    </SelectPrimitive.Item>
  )
}
