/* eslint-disable @typescript-eslint/no-explicit-any, no-extra-boolean-cast, react-hooks/exhaustive-deps */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.


import { useState, useMemo } from "react";
import { Component, Search as SearchIcon } from 'lucide-react';

import SimpleBar from "simplebar-react";
import SidebarContent from "../../vertical/sidebar/sidebaritems";


import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

function Search() {
  const [query, setQuery] = useState("");

  // 🔍 Recursive search through menu
  const searchItems = (items: any[], q: string, parentPath = "") => {
    let results: any[] = [];

    items.forEach((item) => {
      const currentPath = parentPath
        ? `${parentPath} → ${item.name}`
        : item.name;

      // If match found
      if (
        item.name &&
        item.url &&
        item.name.toLowerCase().includes(q.toLowerCase())
      ) {
        results.push({
          name: item.name,
          url: item.url,
          path: currentPath,
          icon: item.icon,
        });
      }

      // Search deeper children
      if (item.items) {
        results = [...results, ...searchItems(item.items, q, currentPath)];
      }
    });

    return results;
  };

  // Memoize filtered results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchItems(SidebarContent, query);
  }, [query]);

  return (
    <div className="relative w-full">
      <div className="flex items-center relative w-xs mx-auto ">
        <SearchIcon size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cem-secondary-elevated"
        />
        <Input
          placeholder="Search...."
          className="rounded-lg pl-10!"
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div
        className={`absolute w-full bg-cem-surface rounded-md top-11 z-10 start-0 shadow-md border border-cem-hover ${Boolean(query) ? "block" : "hidden"
          }`}
      >
        <SimpleBar className="h-72 p-4 custom-scroll">
          {Boolean(results.length) ? (
            results.map((item, i) => (
              <Link
                key={i}
                to={item.url}
                onClick={() => setQuery("")}
                className="  p-2 mb-1.5 last:mb-0 flex items-center bg-cem-hover/30 gap-2 text-sm font-medium rounded-md hover:bg-cem-amber/5 hover:text-cem-amber w-full overflow-hidden"
              >
                <div className="flex items-center">
                  <Component width={18} height={18} />
                  <div className="ps-3">
                    <h5 className="mb-1 text-sm group-hover/link:text-cem-amber">
                      {item.name}
                    </h5>
                    <span className="text-xs block  truncate max-w-60">
                      {item.url}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <h1 className="text-medium font-medium ">
                No Components Found!
              </h1>
            </div>
          )}
        </SimpleBar>
      </div>
    </div>
  );
}

export default Search;
