import GeneralDetail from "@/components/apps/blog/blogadd/general-detail";
import CategoryTags from "@/components/apps/blog/blogadd/category-tags";
import PostDate from "@/components/apps/blog/blogadd/post-date";
import { Button } from "@/components/ui/button";
import Media from "@/components/apps/blog/blogadd/medias";
import Status from "@/components/apps/blog/blogadd/blog-status";
import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Blog Create" },
];

const BlogCreate = () => {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbComp title="Blog Create" items={BCrumb} />
      <DemoNotice>
        Demo content — this form does not save a post. The editor is a visual
        reference for a future CEMURM blog.
      </DemoNotice>
      <div className="grid grid-cols-12 gap-6">
        <div className="lg:col-span-8 col-span-12">
          <div className="flex flex-col gap-6">
            <GeneralDetail />
            <Media />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="flex flex-col gap-6">
            <Status />
            <CategoryTags />
            <PostDate />
          </div>
        </div>
        <div className="lg:col-span-8 col-span-12">
          <div className="flex gap-3">
            <Button className="sm:mb-0 mb-3 w-fit">Add Blog</Button>
            <Button variant="outline">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogCreate;
