import type { ComponentProps, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"
import { Tabs as TabsPrimitive } from "@kobalte/core/tabs"

import { cx } from "@xiv-market/shared"

export type TabsProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof TabsPrimitive<T>
>

export const Tabs = <T extends ValidComponent = "div">(props: TabsProps<T>) => {
  const [, rest] = splitProps(props as TabsProps, ["class"])

  return (
    <TabsPrimitive
      data-slot="tabs"
      class={cx("flex flex-col gap-2", props.class)}
      {...rest}
    />
  )
}

export type TabsListProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof TabsPrimitive.List<T>
>

export const TabsList = <T extends ValidComponent = "div">(
  props: TabsListProps<T>,
) => {
  const [, rest] = splitProps(props as TabsListProps, ["class"])

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      class={cx(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-1",
        props.class,
      )}
      {...rest}
    />
  )
}

export type TabsTriggerProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof TabsPrimitive.Trigger<T>>

export const TabsTrigger = <T extends ValidComponent = "button">(
  props: TabsTriggerProps<T>,
) => {
  const [, rest] = splitProps(props as TabsTriggerProps, ["class"])

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      class={cx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm",
        props.class,
      )}
      {...rest}
    />
  )
}

export type TabsContentProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof TabsPrimitive.Content<T>
>

export const TabsContent = <T extends ValidComponent = "div">(
  props: TabsContentProps<T>,
) => {
  const [, rest] = splitProps(props as TabsContentProps, ["class"])

  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      class={cx("flex-1 outline-none", props.class)}
      {...rest}
    />
  )
}

export type TabsIndicatorProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof TabsPrimitive.Indicator<T>>

export const TabsIndicator = <T extends ValidComponent = "div">(
  props: TabsIndicatorProps<T>,
) => {
  const [, rest] = splitProps(props as TabsIndicatorProps, ["class"])

  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      class={cx(
        "bg-background absolute rounded-md shadow-sm transition-all",
        props.class,
      )}
      {...rest}
    />
  )
}
