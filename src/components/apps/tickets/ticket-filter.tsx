import { useContext } from "react";
import { TicketContext } from "@/context/ticket-context/index";
import type { TicketFilterType } from "@/types/apps/ticket";

const TicketFilter = () => {
  const { tickets, filter, setFilter } = useContext(TicketContext);

  const pendingC = tickets.filter((t) => t.Status === "Pending").length;
  const openC = tickets.filter((t) => t.Status === "Open").length;
  const closeC = tickets.filter((t) => t.Status === "Closed").length;

  const cards: { key: TicketFilterType; label: string; count: number }[] = [
    { key: "total_tickets", label: "Total Tickets", count: tickets.length },
    { key: "Pending", label: "Pending Tickets", count: pendingC },
    { key: "Open", label: "Open Tickets", count: openC },
    { key: "Closed", label: "Closed Tickets", count: closeC },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const active = filter === card.key;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={active}
            onClick={() => setFilter(card.key)}
            className={`rounded-xl border p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cem-amber/40 ${
              active
                ? "border-cem-amber/40 bg-cem-amber/5"
                : "border-cem-hover bg-cem-surface hover:border-cem-amber/30 hover:bg-cem-hover/40"
            }`}
          >
            <span
              className={`block text-2xl font-semibold tabular-nums ${
                active ? "text-cem-amber" : "text-cem-text"
              }`}
            >
              {card.count}
            </span>
            <span
              className={`mt-1 block text-sm ${
                active ? "text-cem-text" : "text-cem-secondary-elevated"
              }`}
            >
              {card.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default TicketFilter;
