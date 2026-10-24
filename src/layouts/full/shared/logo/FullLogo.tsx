import { Link } from "react-router-dom";

/**
 * The CEMURM mark, extracted from public/cemurm-wordmark.svg. It is inline so
 * the amber square and the note take their colours from the cem tokens: the
 * same component is legible on the dark and light admin shells. The note uses
 * `text-cem-base` on purpose; that swap gives dark ink on light amber in dark
 * mode and light ink on dark amber in light mode.
 */
export function CemurmMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-cem-sm bg-cem-amber text-cem-base ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="currentColor"
        aria-hidden="true"
      >
        <ellipse cx="8" cy="19.4" rx="4" ry="3" transform="rotate(-18 8 19.4)" />
        <rect x="11.2" y="7" width="1.8" height="12.4" />
        <path d="M13 7c3.4 1.3 4.9 3.6 4.2 6.6-.2.9-1 1.4-1.8 1.1-.7-.2-1-.9-.8-1.6.5-1.7.1-3-1.6-3.8V7z" />
      </svg>
    </span>
  );
}

const FullLogo = () => {
  return (
    <Link
      to="/dashboard"
      aria-label="CEMURM admin"
      className="flex min-w-0 items-center gap-2"
    >
      <CemurmMark />
      <span className="truncate text-[17px] font-bold tracking-[0.5px] text-cem-text group-data-[state=collapsed]:hidden">
        CEMURM
      </span>
    </Link>
  );
};

export default FullLogo;
