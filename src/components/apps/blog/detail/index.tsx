/* eslint-disable react-hooks/exhaustive-deps */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.

import React, { useEffect, useContext } from "react";

import { Circle, Eye, MessageSquare, Quote } from "lucide-react";
import { format } from "date-fns";
let demoIdCounter = 0;
const uniqueId = (prefix = "") => `${prefix}${++demoIdCounter}`;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "react-router-dom";
import {
  BlogContext,
  BlogContextProps,
} from "../../../../context/blog-context/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import BlogComment from "./blog-commnets";
import { BlogType } from "src/types/apps/blog";
import { blogReadTime } from "../read-time";

const BlogDetailData = () => {
  const { posts, setLoading, addComment }: BlogContextProps =
    useContext(BlogContext);
  const location = useLocation();
  const pathName = location.pathname;

  const getTitle = pathName.split("/").pop();
  const post = posts.find(
    (p) =>
      (p.title || "")
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "") === getTitle
  );
  const [replyTxt, setReplyTxt] = React.useState("");

  const onSubmit = () => {
    if (!post || !post.id) return;
    const newComment = {
      id: uniqueId("#comm_"),
      profile: {
        id: uniqueId("#USER_"),
        avatar: post.author?.avatar || "",
        name: post.author?.name || "",
        time: "Now",
      },
      comment: replyTxt,
      replies: [],
    };
    addComment(Number(post.id), newComment);
    setReplyTxt("");
  };

  // skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {post ? (
        <>
          <Card className="py-0! overflow-hidden gap-0!">
            <div className="relative">
              <div className="overflow-hidden h-[450px]">
                <img
                  src={post?.coverImg || ""}
                  alt=""
                  className="w-full h-full object-cover object-center"
                />
              </div>

              <Badge

                className="absolute bottom-8 end-6 bg-cem-hover text-cem-secondary-elevated"
              >
                {blogReadTime(post)}
              </Badge>
            </div>
            <div className="flex justify-between items-center -mt-7 px-6">
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar className="cursor-pointer h-10 w-10">
                        <AvatarImage
                          src={post?.author?.avatar}
                          alt={post?.author?.name}
                        />
                        <AvatarFallback>
                          {post?.author?.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{post?.author?.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Badge className="mt-3 " variant={"secondary"}>
                {post?.category}
              </Badge>
              <h2 className="md:text-4xl text-2xl my-6">{post?.title}</h2>
              <div>
                <div className="flex gap-3">
                  <div className="flex gap-2 items-center text-sm ">
                    <Eye size={18} />
                    {post?.view}
                  </div>
                  <div className="flex gap-2 items-center  text-sm">
                    <MessageSquare size={18} />{" "}
                    {post?.comments?.length || 0}
                  </div>
                  <div className="ms-auto flex gap-2 items-center   text-sm">
                    <Circle size={7} />
                    <small>
                      {post && post.createdAt
                        ? format(new Date(post.createdAt), "E, MMM d")
                        : ""}
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <Separator className="my-8" />
            <div className="px-6 pb-6">
              <p className="text-lg text-cem-secondary-elevated">{post?.content}</p>
              {post?.body?.map((paragraph) => (
                <p key={paragraph} className="mt-4">
                  {paragraph}
                </p>
              ))}
              {post?.quote ? (
                <div className="mt-6 pt-5 pb-4 px-4 rounded-md border-s-2 border-cem-amber flex gap-1 items-start bg-cem-amber/5">
                  <Quote size={20} className="-mt-1" />
                  <p className="text-base font-bold">{post.quote}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h5 className="text-xl mb-2">Post Comments</h5>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={replyTxt}
                onChange={(e) => setReplyTxt(e.target.value)}
              ></Textarea>
              <Button
                variant={"default"}
                className="w-fit mt-3 rounded-md "
                onClick={onSubmit}
              >
                Post Comment
              </Button>
              <div className="mt-6">
                <div className="flex gap-3 items-center">
                  <h5 className="text-xl ">Comments</h5>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-cem-amber bg-cem-amber/5 font-bold">
                    {post?.comments?.length || 0}
                  </div>
                </div>
                <div>
                  {post?.comments?.map((comment: BlogType) => {
                    return <BlogComment key={comment.id} comment={comment} />;
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-xl text-center py-6 font-bold">No Post Found</p>
      )}
    </>
  );
};
export default BlogDetailData;
