import NotesApp from "src/components/apps/notes";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Notes" },
];

const Notes = () => {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbComp title="Notes" items={BCrumb} />
      <DemoNotice>
        Demo content — these rehearsal notes are illustrative. Changes live in
        memory only and are lost on reload; nothing is saved to CEMURM.
      </DemoNotice>
      <NotesApp />
    </div>
  );
};

export default Notes;
