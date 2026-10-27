import BreadcrumbComp from "src/layouts/full/shared/breadcrumb/BreadcrumbComp";
import { BlogProvider } from "src/context/blog-context";
import CategoryTags from "@/components/apps/blog/blogedit/category-tags";
import GeneralDetail from "@/components/apps/blog/blogedit/general-detail";
import { Button } from "@/components/ui/button";
import PostDate from "@/components/apps/blog/blogedit/post-date";
import Media from "@/components/apps/blog/blogedit/medias";
import Status from "@/components/apps/blog/blogedit/blog-status";
import DemoNotice from "src/components/shared/DemoNotice";

const BCrumb = [
  { to: "/dashboard", title: "Home" },
  { title: "Blog Edit" },
];

const BlogEdit = () => {
  return (
    <BlogProvider>
      <div className="flex flex-col gap-4">
        <BreadcrumbComp title="Blog Edit" items={BCrumb} />
        <DemoNotice>
          Demo content — this form does not save changes. The editor is a visual
          reference for a future CEMURM blog.
        </DemoNotice>
        <div className="grid grid-cols-12 gap-6">
          <div className="lg:col-span-8 col-span-12">
            <div className="flex flex-col gap-6">
              <GeneralDetail />
              <Media />
            </div>
          </div>
          <div className="lg:col-span-4 col-span-12 self-stretch">
            <div className="flex h-full flex-col gap-6">
              <Status />
              <CategoryTags />
              <div className="flex flex-1 flex-col">
                <PostDate />
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 col-span-12">
            <div className="flex gap-3">
              <Button className="sm:mb-0 mb-3 w-fit">Save changes</Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </BlogProvider>
  );
};

export default BlogEdit;
