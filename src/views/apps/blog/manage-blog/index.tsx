import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import { BlogProvider } from "src/context/blog-context";
import ManageBlogTable from "@/components/apps/blog/blogtable/manage-blogtable";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Manage Blog" },
];

const MangeBlog = () => {
  return (
    <BlogProvider>
      <div className="flex flex-col gap-4">
        <BreadcrumbComp title="Manage Blog" items={BCrumb} />
        <DemoNotice>
          Demo content — the blog table uses CEMURM editorial examples. Nothing
          here is connected to CEMURM data and no change is saved.
        </DemoNotice>
        <ManageBlogTable />
      </div>
    </BlogProvider>
  );
};

export default MangeBlog;
