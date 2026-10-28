
import { useContext } from "react";

import { BlogContext } from "../../../context/blog-context";
import BlogFeaturedCard from "./blog-featuredcard";

import BlogCard from "./blog-card";
import { BlogPostType } from "src/types/apps/blog";

const sortByDate = (items: BlogPostType[], direction: "asc" | "desc") => {
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort(
    (a, b) => factor * ((a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)),
  );
};

const sortByViews = (items: BlogPostType[]) =>
  [...items].sort((a, b) => (b.view ?? 0) - (a.view ?? 0));

const BlogListing = () => {
  const { posts, sortBy } = useContext(BlogContext);

  // Function to filter blog posts based on sorting criteria
  const filterBlogs = (posts: BlogPostType[], sortBy: string) => {
    let filteredPosts = [...posts];

    if (sortBy === "newest") {
      filteredPosts = sortByDate(filteredPosts, "desc");
    } else if (sortBy === "oldest") {
      filteredPosts = sortByDate(filteredPosts, "asc");
    } else if (sortBy === "popular") {
      filteredPosts = sortByViews(filteredPosts);
    }

    // Filter out featured posts
    return filteredPosts.filter((post) => !post.featured);
  };

  // Function to filter featured posts
  const filterFeaturedPosts = (posts: BlogPostType[]) => {
    return posts.filter((post) => post.featured);
  };

  const blogPosts = filterBlogs(posts, sortBy);
  const featuredPosts = filterFeaturedPosts(posts);

  return (
    <div className="grid grid-cols-12 gap-6">
      {featuredPosts.map((post, index) => {
        return <BlogFeaturedCard index={index} post={post} key={post.id} />;
      })}
      {blogPosts.map((post) => {
        return <BlogCard post={post} key={post.id} />;
      })}
    </div>
  );
};
export default BlogListing;
