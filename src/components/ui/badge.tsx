import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "cn-badge group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-cem-secondary focus-visible:ring-[3px] focus-visible:ring-cem-secondary/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "cn-badge-variant-default bg-cem-amber text-cem-base [a]:hover:bg-cem-amber/80",
        secondary:
          "cn-badge-variant-secondary bg-cem-elevated text-cem-text [a]:hover:bg-cem-elevated/80",
        destructive:
          "cn-badge-variant-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "cn-badge-variant-outline border-cem-hover text-cem-text [a]:hover:bg-cem-hover [a]:hover:text-cem-secondary-elevated",
        ghost:
          "cn-badge-variant-ghost hover:bg-cem-hover hover:text-cem-secondary-elevated dark:hover:bg-cem-hover/50",
        link: "cn-badge-variant-link text-cem-amber underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
