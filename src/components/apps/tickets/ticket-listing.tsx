import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { SearchIcon, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { TicketContext } from "@/context/ticket-context";
import {
  AnimatedTableWrapper,
  AnimatedTableBody,
  AnimatedTableRow,
} from "@/components/animated-components/animated-table";
import InputPlaceholderAnimate from "@/components/animated-components/animatedinput-placeholder";
import type {
  TicketFilterType,
  TicketStatus,
  TicketType,
} from "src/types/apps/ticket";

const getVisibleTickets = (
  tickets: TicketType[],
  filter: TicketFilterType,
  ticketSearch: string,
) => {
  const term = ticketSearch.trim().toLowerCase();

  return tickets.filter((ticket) => {
    if (ticket.deleted) return false;
    if (filter !== "total_tickets" && ticket.Status !== filter) return false;
    if (!term) return true;

    return (
      ticket.ticketTitle.toLowerCase().includes(term) ||
      ticket.ticketDescription.toLowerCase().includes(term)
    );
  });
};

const ticketBadge = (status: TicketStatus) => {
  switch (status) {
    case "Open":
      return "border-transparent bg-success/12 text-success";
    case "Pending":
      return "border-transparent bg-warning/12 text-warning";
    case "Closed":
    default:
      return "border-cem-hover bg-cem-elevated text-cem-secondary-elevated";
  }
};

const TicketListing = () => {
  const { tickets, deleteTicket, ticketSearch, setTicketSearch, filter } =
    useContext(TicketContext);
  const router = useNavigate();

  const visibleTickets = getVisibleTickets(tickets, filter, ticketSearch);

  return (
    <div className="my-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <Button
          onClick={() => router("/dashboard/apps/tickets/create")}
          className="whitespace-nowrap"
        >
          Create Ticket
        </Button>
        <div className="relative w-full sm:max-w-60">
          <SearchIcon
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cem-secondary-elevated"
          />
          <InputPlaceholderAnimate
            value={ticketSearch}
            onChange={setTicketSearch}
            placeholders={[
              "Search ticket...",
              "Find ticket...",
              "Look up ticket...",
            ]}
            className="pl-9!"
          />
        </div>
      </div>

      {visibleTickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cem-hover px-6 py-10 text-center">
          <p className="text-sm text-cem-secondary-elevated">
            {tickets.length === 0
              ? "No tickets yet. Create the first one."
              : "No tickets match this search or filter."}
          </p>
        </div>
      ) : (
        <AnimatedTableWrapper className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm font-semibold py-3 whitespace-nowrap">
                  Id
                </TableHead>
                <TableHead className="text-sm font-semibold py-3 whitespace-nowrap">
                  Ticket
                </TableHead>
                <TableHead className="text-sm font-semibold py-3 whitespace-nowrap">
                  Assigned To
                </TableHead>
                <TableHead className="text-sm font-semibold py-3 whitespace-nowrap">
                  Status
                </TableHead>
                <TableHead className="text-sm font-semibold py-3 whitespace-nowrap">
                  Date
                </TableHead>
                <TableHead className="text-sm font-semibold py-3 text-end">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <AnimatedTableBody className="divide-y divide-cem-hover">
              {visibleTickets.map((ticket, index) => (
                <AnimatedTableRow key={ticket.Id} index={index}>
                  <TableCell className="whitespace-nowrap">
                    {ticket.Id}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <h6 className="text-base font-medium truncate line-clamp-1">
                      {ticket.ticketTitle}
                    </h6>
                    <p className="text-sm text-cem-secondary-elevated truncate line-clamp-1 text-wrap sm:max-w-56">
                      {ticket.ticketDescription}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={ticket.thumb}
                          alt={ticket.AgentName}
                        />
                        <AvatarFallback>
                          {ticket.AgentName?.charAt(0) || "A"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {ticket.AgentName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge className={ticketBadge(ticket.Status)}>
                      {ticket.Status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-sm text-cem-secondary-elevated">
                      {format(new Date(ticket.Date), "E, MMM d")}
                    </p>
                  </TableCell>
                  <TableCell className="text-end">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTicket(ticket.Id)}
                              aria-label={`Delete ${ticket.ticketTitle}`}
                              className="text-cem-secondary-elevated hover:bg-destructive/10 hover:text-destructive"
                            />
                          }
                        >
                          <Trash size={18} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete ticket</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatedTableBody>
          </Table>
        </AnimatedTableWrapper>
      )}
    </div>
  );
};

export default TicketListing;
