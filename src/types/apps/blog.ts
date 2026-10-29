/* eslint-disable @typescript-eslint/no-explicit-any */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.



export type Profile = {
  id?: string | number;
  avatar?: string;
  name?: string;
  time?: string;
};

export interface BlogType {
  id?: string;
  profile?: Profile;
  time?: Date;
  comment?: string;
  replies?: BlogType[];
}

export interface BlogPostType {
  id?: number | any;
  title?: string;
  content?: string;
  body?: string[];
  quote?: string;
  coverImg?: string;
  createdAt?: Date;
  view?: number;
  share?: number;
  category?: string;
  featured?: boolean;
  author?: Profile;
  comments?: BlogType[];
  published: boolean;
}
