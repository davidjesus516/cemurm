import { useState } from "react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetFooter,
  SheetClose,
} from "src/components/ui/sheet";
import { Avatar, AvatarFallback } from "src/components/ui/avatar";
import { Button } from "src/components/ui/button";
import { Icon } from "@iconify/react";
import { cn } from "src/lib/utils";
import { toAdminPath } from "src/lib/admin-path";
import { House, LogOut, Mailbox, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "src/app/providers/useAuth";

// useAuth is a JS module whose context starts as null, so TypeScript infers
// its return as never. The template only needs the authenticated user shape.
type AdminProfileUser = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

const menuItems = [
  {
    title: "Profile",
    href: toAdminPath("/pages/user-profile"),
    icon: UserRound,
  },
  {
    title: "Member app",
    href: "/",
    icon: House,
  },
];

export default function ProfileSheet() {
  const { user, signOut } = useAuth() as {
    user: AdminProfileUser | null;
    signOut: () => Promise<void>;
  };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const name =
    user?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Manager";
  const email = user?.email || "";
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    name.charAt(0).toUpperCase();

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      setOpen(false);
      navigate("/auth", { replace: true });
    } catch {
      setSignOutError("Could not sign out. Try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open profile menu"
        className="cursor-pointer hover:bg-cem-amber/5 flex items-center justify-center rounded-full h-10 w-10"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-cem-amber text-cem-base text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </SheetTrigger>

      <SheetContent
        showCloseButton={false}
        side="right"
        className="border-s-0 w-full sm:max-w-80 max-w-60"
      >
        <SheetClose className="absolute top-5 end-5 p-2 hover:bg-cem-amber/5 hover:text-cem-amber rounded-full">
          <Icon icon="tabler:x" width={20} height={20} />
        </SheetClose>

        <div className="p-6 py-6">
          <div className="flex flex-col gap-4 justify-center items-center pt-10">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-cem-amber text-cem-base text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h6 className="text-lg font-semibold">{name}</h6>
              {email && (
                <div className="flex items-center gap-2 justify-center">
                  <Mailbox size={18} className="text-cem-secondary-elevated" />
                  <span className="text-sm font-normal text-cem-secondary-elevated truncate max-w-[220px]">
                    {email}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-cem-hover">
          <ul className="flex flex-col gap-2 p-6">
            {menuItems.map((item) => (
              <li key={item.title} className="group">
                <Link
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex gap-3 py-2 px-3 rounded-md group-hover:bg-cem-amber/5 text-cem-secondary-elevated"
                  )}
                >
                  <item.icon
                    width={20}
                    height={20}
                    className="group-hover:text-cem-amber"
                  />

                  <div className="flex gap-3 items-center">
                    <h6 className="text-sm group-hover:text-cem-amber">
                      {item.title}
                    </h6>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <SheetFooter className="px-0 pb-6">
          <div className="border-t border-cem-hover w-full">
            <div className="pt-6 px-6 flex flex-col gap-3">
              <Button
                variant="secondary"
                className="w-full gap-2 text-cem-text"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
              {signOutError && (
                <p className="text-sm text-destructive text-center">
                  {signOutError}
                </p>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
