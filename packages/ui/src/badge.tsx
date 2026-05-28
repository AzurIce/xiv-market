import type { ComponentProps } from "solid-js"
import { splitProps } from "solid-js"
import { Badge as BadgePrimitive } from "@kobalte/core/badge"

import { cva, type VariantProps } from "@xiv-market/shared"

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-normal w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type BadgeProps = ComponentProps<
  typeof BadgePrimitive
> & {
  variant?: VariantProps<typeof badgeVariants>["variant"]
  class?: string
}

export const Badge = (props: BadgeProps) => {
  const [local, rest] = splitProps(props as BadgeProps, ["class", "variant"])

  return (
    <BadgePrimitive
      data-slot="badge"
      class={badgeVariants({
        variant: local.variant,
        class: local.class,
      })}
      {...rest}
    />
  )
}
