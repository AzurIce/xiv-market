import type { ComponentProps, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"
import { Root as SeparatorPrimitive } from "@kobalte/core/separator"

import { cx } from "@xiv-market/shared"

export type SeparatorProps<T extends ValidComponent = "hr"> = ComponentProps<
  typeof SeparatorPrimitive<T>
> & {
  orientation?: "horizontal" | "vertical"
}

export const Separator = <T extends ValidComponent = "hr">(
  props: SeparatorProps<T>,
) => {
  const [, rest] = splitProps(props as SeparatorProps, ["class", "orientation"])

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={props.orientation}
      class={cx(
        "bg-border shrink-0 border-none",
        "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        props.class,
      )}
      {...rest}
    />
  )
}
