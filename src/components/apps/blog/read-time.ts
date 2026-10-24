import type { BlogPostType } from "src/types/apps/blog";

// Demo read time for the CEMURM editorial samples. The template hardcoded
// "2 min Read" on every card, which stopped matching once each post got its own
// body.
export function blogReadTime(post: BlogPostType) {
  const words = [post.content, ...(post.body ?? [])]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}
