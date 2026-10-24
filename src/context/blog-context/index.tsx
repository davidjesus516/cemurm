// Demo blog store.
//
// The template's original context fetched /api/data/blog/BlogPosts from an
// MSW worker that is never started, so the blog always rendered empty. The
// demo keeps fixed content in React state instead: no network calls, no
// Supabase writes, and every change is lost on reload. The blog screens show
// a demo notice that says exactly that.
import { createContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { BlogPostType, BlogType } from 'src/types/apps/blog';
import React from 'react';
import { demoBlogPosts } from '@/demo/content';

// Define BlogContextProps interface
export interface BlogContextProps {
  posts: BlogPostType[];
  sortBy: string;
  selectedPost: BlogPostType | null;
  isLoading: boolean;
  setPosts: Dispatch<SetStateAction<BlogPostType[]>>;
  setSortBy: Dispatch<SetStateAction<string>>;
  setSelectedPost: Dispatch<SetStateAction<BlogPostType | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  addComment: (postId: number, newComment: BlogType) => void;

  error: null;
}

// Create context with default values
export const BlogContext = createContext<BlogContextProps>({
  posts: demoBlogPosts,
  sortBy: 'newest',
  selectedPost: null,
  isLoading: false,
  setPosts: () => { },
  setSortBy: () => { },
  setSelectedPost: () => { },
  setLoading: () => { },
  addComment: () => { },
  error: null,
});

// BlogProvider component
export const BlogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<BlogPostType[]>(demoBlogPosts);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedPost, setSelectedPost] = useState<BlogPostType | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);

  // Adds a new comment to a specific post by updating the state.
  const addComment = (postId: number, newComment: BlogType) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, comments: [newComment, ...(post.comments || [])] } : post,
      ),
    );
  };

  const value: BlogContextProps = {
    posts,
    sortBy,
    selectedPost,
    isLoading,
    setPosts,
    setSortBy,
    setSelectedPost,
    setLoading,
    addComment,
    error: null,
  };

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
};
