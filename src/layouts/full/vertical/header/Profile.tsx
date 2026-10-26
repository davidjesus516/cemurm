

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetFooter,
  SheetClose,
} from "src/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "src/components/ui/avatar";
import { Button } from "src/components/ui/button";
import { Icon } from "@iconify/react";

import { cn } from "src/lib/utils";
import { Mailbox } from 'lucide-react';

import { profileDD } from "./data";
import { Link } from "react-router-dom";
import avatar from '@/assets/images/profile/avtar.webp';
import Buynow from '@/assets/images/backgrounds/sidebarbuynow.svg';
export default function ProfileSheet() {


  return (
    <Sheet>
      {/* Trigger Button */}
      <SheetTrigger className="cursor-pointer hover:bg-cem-amber/5 flex items-center justify-center rounded-full h-10 w-10">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt="profile" />
          <AvatarFallback>CM</AvatarFallback>
        </Avatar>
      </SheetTrigger>

      {/* Drawer Panel */}
      <SheetContent
        showCloseButton={false}
        side="right"
        className="border-s-0 w-full sm:max-w-80 max-w-60"
      >
        <SheetClose className="absolute top-5 end-5 p-2 hover:bg-cem-amber/5 hover:text-cem-amber rounded-full">
          <Icon icon="tabler:x" width={20} height={20} />
        </SheetClose>
        {/* Top Profile Section */}
        <div className="p-6 py-6">
          <div className="flex flex-col gap-4 justify-center items-center pt-10">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={avatar}
                alt="Profile"
                width={30}
                height={30}
              />
              <AvatarFallback>CM</AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h6 className="text-lg font-semibold">Cameron</h6>
              <div className="flex items-center gap-2 justify-center">
                <Mailbox
                  size={18} className="text-cem-secondary-elevated"
                />
                <span className="text-sm font-normal text-cem-secondary-elevated">
                  info@shadcndashboard.com
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="border-t  border-cem-hover">
          <ul className="flex flex-col gap-2 p-6">
            {profileDD.map((item) => (
              <li key={item.title} className="group">
                <Link
                  to={item.href}
                  className={cn(
                    "flex gap-3 py-2 px-3 rounded-md group-hover:bg-cem-amber/5 text-cem-secondary-elevated"
                  )}
                >
                  <item.avatar
                    width={20}
                    height={20}
                    className="group-hover:text-cem-amber"
                  />

                  <div className="flex gap-3 items-center">
                    <h6 className="text-sm group-hover:text-cem-amber">
                      {item.title}
                    </h6>

                    {item.badge && (
                      <span className="h-5 w-6 text-sm flex justify-center items-center text-cem-amber rounded-sm bg-cem-amber/5">
                        4
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <SheetFooter className="px-0 pb-6">
          <div className="border-t border-cem-hover w-full">
            <div className="rounded-sm pt-6 flex flex-col justify-center items-center gap-3">
              <div>
                <img
                  src={Buynow}
                  alt="login-bg"
                />
              </div>

              <div className="text-center">
                <h5 className="text-xl font-semibold">
                  Grab ShadcnDashboard Admin
                </h5>
                <p className="text-sm text-cem-secondary-elevated">
                  Customize your dashboard
                </p>
              </div>

              <Button
                variant="secondary"
                render={<Link to="/auth/auth2/login" />}
                className="text-cem-amber"
              >
                Log Out
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
