import { Link, useLocation } from "react-router-dom";
import NavItem from "../nav-items/index";
import { cn } from "@/lib/utils";
import { toAdminPath } from "@/lib/admin-path";
import { useSidebar } from "@/components/ui/sidebar";
import { MenuItem, ChildItem } from "../sidebaritems";

interface NavCollapseProps {
  menu: MenuItem[];
  className?: string;
}

export default function NavCollapse({ menu, className }: NavCollapseProps) {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const isCollapse = state === "collapsed";

  const isActiveRoute = (item: ChildItem): boolean => {
    if (item.url && pathname === toAdminPath(item.url)) return true;
    if (item.items) return item.items.some(isActiveRoute);
    return false;
  };

  return (
    <>

      {menu.map((section, index) => (
        <div key={index}>
          {/* Heading */}


          <span className={cn(
            "text-xs uppercase block font-semibold text-cem-secondary-elevated mb-2 transition-all duration-200",
            isCollapse ? "text-center group-hover:text-start group-data-[state=expanded]:text-start" : ""
          )}>
            {isCollapse ? (
              <>
                <span className="group-hover:hidden group-data-[state=expanded]:hidden">...</span>
                <span className="hidden group-hover:inline group-data-[state=expanded]:inline">{section.heading ?? ""}</span>
              </>
            ) : (
              section.heading ?? ""
            )}
          </span>

          {section.items?.map((item: ChildItem, index) => {
            const hasChildren =
              Array.isArray(item.items) && item.items.length > 0;
            const active = isActiveRoute(item);

            // 👉 No children → direct link
            if (!hasChildren)
              return (
                <Link
                  key={index}
                  to={toAdminPath(item.url)}
                  target={item.external ? "_blank" : undefined}
                  className={cn(
                    "flex items-center gap-3  rounded-md transition-all duration-200 ease-in-out ",

                    className,
                  )}

                >

                  <NavItem item={item} hasChildren={false} isActive={active} />
                </Link>




              );

            // 👉 With children → collapsible
            return (
              <details
                key={index}
                className="group/nav"
                open={active || item.isActive}
              >
                <summary
                  className={cn(
                    "cursor-pointer rounded-md flex items-center transition-all duration-200 ease-in-out",

                  )}
                >
                  <NavItem
                    item={item}
                    hasChildren={true}
                    className={className}
                    isActive={active}
                  />
                </summary>

                <div className="pl-3  ml-5  border-l border-cem-hover">
                  {item.items?.map((sub: ChildItem, index) =>
                    sub.items ? (
                      <NavCollapse
                        key={index}
                        menu={[{ items: [sub] }]}
                        className={className}
                      />
                    ) : (
                      <Link
                        key={index}
                        to={toAdminPath(sub.url)}
                        target={sub.external ? "_blank" : undefined}
                        className={cn(
                          "block rounded-md transition-all duration-200 ease-in-out",

                          className,
                        )}
                      >
                        <NavItem item={sub} hasChildren={false} className={cn("px-2! py-1! my-1!", pathname === toAdminPath(sub.url) && "bg-cem-amber/5 text-cem-amber")} isActive={pathname === toAdminPath(sub.url)} />
                      </Link>
                    )
                  )}
                </div>
              </details>
            );
          })}
        </div >
      ))
      }
    </>
  );
}