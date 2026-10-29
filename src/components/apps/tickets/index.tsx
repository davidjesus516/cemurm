
import { Card } from "@/components/ui/card";
import TicketFilter from "@/components/apps/tickets/ticket-filter";
import TicketListing from "@/components/apps/tickets/ticket-listing";

const TicketsApp = () => {
  return (
    <Card className="p-6">
      <TicketFilter />
      <TicketListing />
    </Card>
  );
};

export default TicketsApp;
