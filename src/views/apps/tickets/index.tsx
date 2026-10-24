import TicketsApp from "src/components/apps/tickets";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Tickets" },
];

const Tickets = () => {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbComp title="Tickets" items={BCrumb} />
      <DemoNotice>
        Demo content — these maintenance tickets illustrate the screen. Changes
        live in memory only and are lost on reload; nothing is saved to CEMURM.
      </DemoNotice>
      <TicketsApp />
    </div>
  );
};

export default Tickets;
