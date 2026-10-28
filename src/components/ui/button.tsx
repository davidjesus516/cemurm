import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "cn-button group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-cem-secondary focus-visible:ring-3 focus-visible:ring-cem-secondary/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "cn-button-variant-default bg-cem-amber text-cem-base [a]:hover:bg-cem-amber/80",
        outline:
          "cn-button-variant-outline border-cem-hover! bg-cem-base hover:bg-cem-hover hover:text-cem-text aria-expanded:bg-cem-hover aria-expanded:text-cem-text dark:border-cem-hover! dark:bg-cem-hover/30 dark:hover:bg-cem-hover/50",
        secondary:
          "cn-button-variant-secondary bg-cem-elevated text-cem-text hover:bg-cem-elevated/80 aria-expanded:bg-cem-elevated aria-expanded:text-cem-text",
        ghost:
          "cn-button-variant-ghost hover:bg-cem-hover hover:text-cem-text aria-expanded:bg-cem-hover aria-expanded:text-cem-text dark:hover:bg-cem-hover/50",
        destructive:
          "cn-button-variant-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "cn-button-variant-link text-cem-amber underline-offset-4 hover:underline",
      },
      size: {
        default:
          "cn-button-size-default h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "cn-button-size-xs h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "cn-button-size-sm h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "cn-button-size-lg h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "cn-button-size-icon size-8",
        "icon-xs":
          "cn-button-size-icon-xs size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "cn-button-size-icon-sm size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "cn-button-size-icon-lg size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
