import { useSidebar } from "src/components/ui/sidebar";
import { Button } from "src/components/ui/button";
import { PanelLeft } from "lucide-react";
import { Separator } from "src/components/ui/separator";

import FullLogo from "../../shared/logo/FullLogo";
import Search from "./Search";

import Profile from "./Profile";
import LightDark from "./Light-Dark";

const Header = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="cem-material sticky top-0 z-2 bg-cem-base/90 backdrop-blur-md">
      <nav>
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-2 lg:px-4">
          <div className="flex gap-2 items-center">
            <div className="block lg:hidden">
              <FullLogo />
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle sidebar"
              className="p-2 hover:bg-cem-amber/5 rounded-full transition cursor-pointer"
              onClick={toggleSidebar}
            >
              <PanelLeft size={21} />
            </Button>

            <Separator
              orientation="vertical"
              className="h-4 mx-2 w-px bg-cem-hover self-center max-lg:hidden"
            />

            <div className="sm:block hidden">
              <Search />
            </div>
          </div>

          <div className="flex sm:gap-1 gap-0 items-center">
            {/* Theme Toggle */}
            <LightDark />

            {/* Profile Dropdown */}
            <Profile />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
