import { useState, useMemo } from "react";
import { Component, Search as SearchIcon, type LucideIcon } from "lucide-react";

import SimpleBar from "simplebar-react";
import SidebarContent, {
  type ChildItem,
  type MenuItem,
} from "../../vertical/sidebar/sidebaritems";

import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toAdminPath } from "src/lib/admin-path";

type SearchNode = MenuItem | ChildItem;

type SearchResult = {
  name: string;
  url: string;
  path: string;
  icon?: LucideIcon;
  external?: boolean;
};

// Recursive search through the same local menu the sidebar renders. Matching
// against the accumulated path lets a parent label such as "Blogs" find its
// children even when the child name ("All posts") does not contain it.
function searchItems(
  items: SearchNode[],
  query: string,
  parentPath = ""
): SearchResult[] {
  const needle = query.toLowerCase();
  let results: SearchResult[] = [];

  items.forEach((item) => {
    const label =
      item.name ?? ("heading" in item ? item.heading : undefined) ?? "";
    const currentPath = parentPath ? `${parentPath} → ${label}` : label;

    if (
      item.name &&
      item.url &&
      (item.name.toLowerCase().includes(needle) ||
        currentPath.toLowerCase().includes(needle))
    ) {
      results.push({
        name: item.name,
        url: item.url,
        path: currentPath,
        icon: item.icon,
        external: "external" in item ? item.external : undefined,
      });
    }

    if (item.items) {
      results = [...results, ...searchItems(item.items, query, currentPath)];
    }
  });

  return results;
}

function Search() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  const results = useMemo(
    () => (trimmedQuery ? searchItems(SidebarContent, trimmedQuery) : []),
    [trimmedQuery]
  );

  return (
    <div className="relative">
      <div className="relative w-[320px]">
        <SearchIcon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cem-secondary-elevated"
        />
        <Input
          placeholder="Search admin..."
          aria-label="Search admin"
          className="rounded-lg pl-10!"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div
        className={`absolute w-full bg-cem-surface rounded-md top-11 z-10 start-0 shadow-md border border-cem-hover ${
          trimmedQuery ? "block" : "hidden"
        }`}
      >
        <SimpleBar className="h-72 p-4 custom-scroll">
          {results.length ? (
            results.map((item, i) => {
              const ResultIcon = item.icon ?? Component;

              return (
                <Link
                  key={i}
                  to={toAdminPath(item.url)}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  onClick={() => setQuery("")}
                  className="p-2 mb-1.5 last:mb-0 flex items-center bg-cem-hover/30 gap-2 text-sm font-medium rounded-md hover:bg-cem-amber/5 hover:text-cem-amber w-full overflow-hidden"
                >
                  <div className="flex items-center">
                    <ResultIcon width={18} height={18} />
                    <div className="ps-3">
                      <h5 className="mb-1 text-sm">{item.name}</h5>
                      <span className="text-xs block truncate max-w-60">
                        {item.path}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full">
              <h1 className="text-medium font-medium">
                No results for &ldquo;{trimmedQuery}&rdquo;.
              </h1>
            </div>
          )}
        </SimpleBar>
      </div>
    </div>
  );
}

export default Search;
