import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface DemoNoticeProps {
  children: ReactNode
  className?: string
}

/**
 * Marks a template view that has no CEMURM domain yet.
 *
 * The imported template shipped fake content and, in some screens, forms that
 * looked like they persisted data. Every demo surface renders this notice so
 * the state is explicit: the view is visual only and nothing is saved.
 */
export default function DemoNotice({ children, className = '' }: DemoNoticeProps) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border border-cem-hover bg-cem-base px-4 py-3 text-sm text-cem-secondary ${className}`}
    >
      <Info
        size={18}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-cem-amber"
      />
      <p>{children}</p>
    </div>
  )
}
