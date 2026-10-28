import CreateTicketForm from "src/components/apps/tickets/create-ticketform";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { to: "/dashboard/apps/tickets", title: "Tickets" },
  { title: "Create Ticket" },
];

const CreateTickets = () => {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbComp title="Create Ticket" items={BCrumb} />
      <DemoNotice>
        Demo content — creating a ticket adds it to the in-memory demo list.
        Nothing is saved to CEMURM and the list resets on reload.
      </DemoNotice>
      <CreateTicketForm />
    </div>
  );
};

export default CreateTickets;
