/* eslint-disable @typescript-eslint/no-explicit-any */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.
import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import { BlogPostType, BlogType } from 'src/types/apps/blog';
import React from 'react';
import useSWR from 'swr';
import { getFetcher } from 'src/api/global-fetcher';

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
  posts: [],
  sortBy: 'newest',
  selectedPost: null,
  isLoading: true,
  setPosts: () => { },
  setSortBy: () => { },
  setSelectedPost: () => { },
  setLoading: () => { },
  addComment: () => { },
  error: null,
});

// BlogProvider component
export const BlogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedPost, setSelectedPost] = useState<BlogPostType | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  // Fetch Post data from the API
  const {
    data: postsData,
    isLoading: isPostsLoading,
    error: postsError,
  } = useSWR('/api/data/blog/BlogPosts', getFetcher);

  useEffect(() => {
    if (postsData) {
      setPosts(postsData.data);
      setLoading(isPostsLoading);
    } else if (postsError) {
      setError(postsError);
      setLoading(isPostsLoading);
    } else {
      setLoading(isPostsLoading);
    }
  }, [postsData, postsError, isPostsLoading]);

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
    error,
  };

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
};
