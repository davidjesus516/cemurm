import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "cn-textarea flex field-sizing-content min-h-16 w-full rounded-lg border border-cem-hover bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-cem-secondary-elevated focus-visible:border-cem-secondary focus-visible:ring-3 focus-visible:ring-cem-secondary/50 disabled:cursor-not-allowed disabled:bg-cem-hover/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-cem-hover/30 dark:disabled:bg-cem-hover/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
