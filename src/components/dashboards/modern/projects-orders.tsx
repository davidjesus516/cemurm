import { CalendarDays, Ellipsis, MapPin } from "lucide-react";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "../../shared/dashboard-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { AdminEvent } from "@/hooks/shared/useAdminOverview";

// cem tokens keep the template's status chips honest: orange -> chart-5,
// red -> destructive tint with neutral text, green -> success, teal -> chart-2.
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: "bg-chart-5/10", text: "text-chart-5", label: "Planned" },
  confirmed: { bg: "bg-success/10", text: "text-success", label: "Confirmed" },
  completed: { bg: "bg-chart-2/10", text: "text-chart-2", label: "Completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-cem-text", label: "Cancelled" },
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectsOrders({ events }: { events: AdminEvent[] }) {
  return (
    <DashboardCard className="flex flex-col gap-0!">
      {/* Header */}
      <CardHeader className="border-b border-cem-hover">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays size={16} className="text-cem-text" />
          <span>
            Events
          </span>
        </CardTitle>
      </CardHeader>

      {/* Table */}
      <CardContent className="px-0!">
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-cem-hover">
                  <TableHead className="pl-4! px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated whitespace-nowrap w-[200px]">
                    Event
                  </TableHead>
                  <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                    Venue
                  </TableHead>
                  <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated whitespace-nowrap w-[130px]">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated whitespace-nowrap w-[160px]">
                    Setlist
                  </TableHead>
                  <TableHead className="px-4 py-3 h-auto text-sm font-normal text-cem-secondary-elevated whitespace-nowrap w-[140px]">
                    Date
                  </TableHead>
                  <TableHead className="pr-4! px-2 py-3 h-auto w-[48px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {events.length === 0 && (
                  <TableRow className="border-cem-hover">
                    <TableCell
                      colSpan={6}
                      className="px-6 py-8 text-sm font-normal text-cem-secondary-elevated"
                    >
                      No events yet. Create a gig to see it here.
                    </TableCell>
                  </TableRow>
                )}
                {events.map((event) => {
                  const status = statusConfig[event.status] ?? statusConfig.planned;
                  return (
                    <TableRow
                      key={event.id}
                      className="border-cem-hover hover:bg-cem-hover/30"
                    >
                      {/* Event */}
                      <TableCell className="pl-4! px-4 py-3 w-[200px]">
                        <div className="flex flex-col leading-5">
                          <span className="text-sm font-medium text-cem-text whitespace-nowrap">
                            {event.name}
                          </span>
                          <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                            #{event.id.slice(-6)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Venue */}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-cem-hover shrink-0">
                            <MapPin size={14} />
                          </span>
                          <span className="text-sm font-normal text-cem-text whitespace-nowrap">
                            {event.venue}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-4 py-3 w-[130px]">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-normal whitespace-nowrap ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                      </TableCell>

                      {/* Setlist */}
                      <TableCell className="px-4 py-3 w-[160px]">
                        <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                          {event.setlist}
                        </span>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="px-4 py-3 w-[140px]">
                        <span className="text-sm font-normal text-cem-secondary-elevated whitespace-nowrap">
                          {formatDate(event.scheduledAt)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-4! px-2 py-3 w-[48px]">
                        <Link
                          to={`/gigs/${event.id}`}
                          aria-label={`Open ${event.name}`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                            className: "rounded-lg hover:bg-cem-hover/50 transition-colors",
                          })}
                        >
                          <Ellipsis size={16} className="text-cem-text" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </DashboardCard>
  );
}
