import type { ComponentProps, ValidComponent } from "solid-js"
import { mergeProps, splitProps } from "solid-js"
import { Tooltip as TooltipPrimitive } from "@kobalte/core/tooltip"

import { cx } from "@xiv-market/shared"

export type TooltipProps = ComponentProps<typeof TooltipPrimitive>

export const TooltipPortal = TooltipPrimitive.Portal

export const Tooltip = (props: TooltipProps) => {
  const merge = mergeProps<TooltipProps[]>(
    { closeDelay: 0, openDelay: 300, placement: "top" },
    props,
  )

  return <TooltipPrimitive data-slot="tooltip" {...merge} />
}

export type TooltipTriggerProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof TooltipPrimitive.Trigger<T>>

export const TooltipTrigger = <T extends ValidComponent = "button">(
  props: TooltipTriggerProps<T>,
) => {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

export type TooltipContentProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof TooltipPrimitive.Content<T>>

export const TooltipContent = <T extends ValidComponent = "div">(
  props: TooltipContentProps<T>,
) => {
  const [, rest] = splitProps(props as TooltipContentProps, ["class", "children"])

  return (
    <TooltipPrimitive.Content
      data-slot="tooltip-content"
      class={cx(
        "bg-primary text-primary-foreground z-50 w-fit rounded-md px-3 py-1.5 text-xs",
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </TooltipPrimitive.Content>
  )
}
