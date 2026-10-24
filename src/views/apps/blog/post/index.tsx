import BlogPost from "src/components/apps/blog/blog-post";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Blog app" },
];

const Blog = () => {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbComp title="Blog app" items={BCrumb} />
      <DemoNotice>
        Demo content — CEMURM editorial examples. This view is not connected to
        CEMURM data and nothing you change here is saved.
      </DemoNotice>
      <BlogPost />
    </div>
  );
};
export default Blog;
