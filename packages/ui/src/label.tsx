import type { ComponentProps } from "solid-js"
import { splitProps } from "solid-js"

import { cx } from "@xiv-market/shared"

export type LabelProps = ComponentProps<"label">

export const Label = (props: LabelProps) => {
  const [, rest] = splitProps(props, ["class"])

  return (
    <label
      data-slot="label"
      class={cx(
        "text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        props.class,
      )}
      {...rest}
    />
  )
}
