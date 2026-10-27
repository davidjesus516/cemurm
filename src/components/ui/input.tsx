import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "cn-input h-8 w-full min-w-0 rounded-lg border border-cem-hover bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-cem-text placeholder:text-cem-secondary-elevated focus-visible:border-cem-secondary focus-visible:ring-3 focus-visible:ring-cem-secondary/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-cem-hover/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-cem-hover/30 dark:disabled:bg-cem-hover/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
