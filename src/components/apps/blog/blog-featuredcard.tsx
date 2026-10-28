/* eslint-disable react-hooks/exhaustive-deps */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.


import { Circle, Eye, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useContext } from "react";

import { Link } from "react-router-dom";
import { BlogContext, BlogContextProps } from "src/context/blog-context";
import { BlogPostType } from "src/types/apps/blog";

interface Btype {
  post: BlogPostType;
  index: number;
}
const BlogFeaturedCard = ({ post, index }: Btype) => {
  const { coverImg, title, view, comments, category, author, createdAt } = post;
  const linkTo = title
    ? title
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "")
    : "";
  const mainPost = index === 0;
  const { setLoading }: BlogContextProps = useContext(BlogContext);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {post ? (
        <div
          className={
            mainPost
              ? "lg:col-span-8 md:col-span-12 col-span-12"
              : "lg:col-span-4 md:col-span-12 col-span-12"
          }
        >
          <div className="relative h-[400px] w-full overflow-hidden rounded-xl ring-1 ring-cem-hover group">
            {/* Background Image */}

            <div className="absolute inset-0">
              <img
                src={coverImg || ""}
                alt={title || "blog image"}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.09]"
                width={786}
                height={400}
              />
              <div className="absolute inset-0 bg-cem-base/70"></div>
            </div>

            <div>
              <div className="absolute w-full h-full left-0 p-6">
                <div className="flex flex-col h-full justify-between ">
                  <div className="flex justify-between items-center">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={author?.avatar} alt={author?.name} />
                      <AvatarFallback>
                        {author?.name ? author.name[0] : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <Badge  >{category}</Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl text-cem-text my-6">
                      <Link to={`/dashboard/apps/blog/detail/${linkTo}`}> {title}</Link>
                    </h2>
                    <div className="flex  gap-3">
                      <div className="flex gap-2 items-center text-cem-secondary-elevated text-sm">
                        <Eye size={18} /> {view}
                      </div>
                      <div className="flex gap-2 items-center text-cem-secondary-elevated text-sm">
                        <MessageSquare size={18} />{" "}
                        {comments?.length}
                      </div>
                      <div className="ms-auto flex gap-2 items-center text-cem-secondary-elevated text-sm">
                        <Circle size={7} />
                        <small>
                          {createdAt
                            ? format(new Date(createdAt), "E, MMM d")
                            : ""}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
export default BlogFeaturedCard;
