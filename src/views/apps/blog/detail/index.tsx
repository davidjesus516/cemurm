import BlogDetailData from "@/components/apps/blog/detail";
import { BlogProvider } from "src/context/blog-context";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Blog Detail" },
];

const BlogDetail = () => {
  return (
    <BlogProvider>
      <div className="flex flex-col gap-4">
        <BreadcrumbComp title="Blog Detail" items={BCrumb} />
        <DemoNotice>
          Demo content — CEMURM editorial examples. This view is not connected to
          CEMURM data and nothing you change here is saved.
        </DemoNotice>
        <BlogDetailData />
      </div>
    </BlogProvider>
  );
};

export default BlogDetail;
