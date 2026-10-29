export interface ChildItem {
  id?: number | string;
  name: string;
  icon?: LucideIcon;
  items?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
  disabled?: boolean;
  subtitle?: string;
  badge?: boolean;
  badgeType?: string;
  badgeContent?: string;
  isActive?: boolean;
  external?: boolean;
  isPro?: boolean;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: LucideIcon;
  id?: number;
  to?: string;
  item?: MenuItem[];
  items?: ChildItem[];
  url?: string;
  disabled?: boolean;
  subtitle?: string;
  badgeType?: string;
  badge?: boolean;
  badgeContent?: string;
  isActive?: boolean;
  isPro?: boolean;
}

let navIdCounter = 0;
const uniqueId = () => `${++navIdCounter}`;

import {
  BookOpen,
  CircleUserRound,
  Form,
  House,
  Lock,
  LogIn,
  LucideIcon,
  NotebookText,
  ShieldCheck,
  Smile,
  Table2,
  Ticket,
  Unlink,
  UserPlus,
} from "lucide-react";

/**
 * The imported template shipped a marketing sidebar: 98 of its links pointed
 * at shadcndashboard.dev demos and only the local routes under /dashboard were
 * real. This keeps every local screen reachable and removes the external
 * marketing tree, so the shell describes the app that exists instead of the
 * template's catalogue.
 *
 * URLs stay in the template's root-relative form; NavCollapse prefixes them
 * with /dashboard through toAdminPath().
 */
const SidebarContent: MenuItem[] = [
  {
    heading: "Dashboard",
    items: [
      {
        id: uniqueId(),
        name: "Overview",
        icon: House,
        url: "/",
      },
    ],
  },
  {
    heading: "Pages",
    items: [
      {
        id: uniqueId(),
        name: "Tables",
        icon: Table2,
        url: "/pages/tables",
      },
      {
        id: uniqueId(),
        name: "Form",
        icon: Form,
        url: "/pages/form",
      },
      {
        id: uniqueId(),
        name: "Profile",
        icon: CircleUserRound,
        url: "/pages/user-profile",
      },
    ],
  },
  {
    heading: "Apps",
    items: [
      {
        id: uniqueId(),
        name: "Notes",
        icon: NotebookText,
        url: "/apps/notes",
      },
      {
        id: uniqueId(),
        name: "Blogs",
        icon: BookOpen,
        items: [
          {
            id: uniqueId(),
            name: "All posts",
            url: "/apps/blog/post",
          },
          {
            id: uniqueId(),
            name: "Post detail",
            url: "/apps/blog/detail/the-quiet-craft-of-a-setlist",
          },
          {
            id: uniqueId(),
            name: "Edit post",
            url: "/apps/blog/edit",
          },
          {
            id: uniqueId(),
            name: "New post",
            url: "/apps/blog/create",
          },
          {
            id: uniqueId(),
            name: "Manage posts",
            url: "/apps/blog/manage-blog",
          },
        ],
      },
      {
        id: uniqueId(),
        name: "Tickets",
        icon: Ticket,
        url: "/apps/tickets",
      },
    ],
  },
  {
    heading: "Icons",
    items: [
      {
        id: uniqueId(),
        name: "Icon library",
        icon: Smile,
        url: "/icons/iconify",
      },
    ],
  },
  {
    heading: "Auth demos",
    items: [
      {
        id: uniqueId(),
        name: "Error",
        icon: Unlink,
        url: "/auth/404",
      },
      {
        id: uniqueId(),
        name: "Login",
        icon: LogIn,
        items: [
          {
            id: uniqueId(),
            name: "Boxed login",
            url: "/auth/auth2/login",
          },
        ],
      },
      {
        id: uniqueId(),
        name: "Register",
        icon: UserPlus,
        items: [
          {
            id: uniqueId(),
            name: "Boxed register",
            url: "/auth/auth2/register",
          },
        ],
      },
      {
        id: uniqueId(),
        name: "Forgot password",
        icon: Lock,
        items: [
          {
            id: uniqueId(),
            name: "Boxed forgot password",
            url: "/auth/auth2/forgot-password",
          },
        ],
      },
      {
        id: uniqueId(),
        name: "Two steps",
        icon: ShieldCheck,
        items: [
          {
            id: uniqueId(),
            name: "Boxed two steps",
            url: "/auth/auth2/two-steps",
          },
        ],
      },
    ],
  },
];

export default SidebarContent;
