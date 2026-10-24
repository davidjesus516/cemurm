import { Card } from "@/components/ui/card";


import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import SocialButtons from "../../authforms/social-buttons";

const BoxedRegister = () => {
  return (
    <>
      <div className="relative overflow-hidden h-screen bg-cem-hover">
        <div className="flex h-full justify-center items-center px-4">
          <Card className="md:w-112.5 w-full border-none shadow-lg p-6">
            <div className="mx-auto  w-fit">
              <FullLogo />
            </div>

            <SocialButtons />

            <form className="space-y-6 w-full">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="name"
                    className="text-sm font-normal text-cem-secondary-elevated"
                  >
                    Name*
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"

                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-sm font-normal text-cem-secondary-elevated"
                  >
                    Email*
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter Your Email"

                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-sm font-normal text-cem-secondary-elevated"
                  >
                    Password*
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"

                    required
                  />
                </div>
              </div>
              <Button
                size="lg"
                className="w-full rounded-lg"
              >
                Sign in
              </Button>
            </form>
            <div className="flex gap-2 text-base text-cem-secondary-elevated font-medium mt-4 items-center justify-center">
              <p>Already have an Account?</p>
              <Link
                to={"/auth/auth2/login"}
                className="text-cem-amber/80 text-base hover:text-cem-amber font-medium"
              >
                Sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default BoxedRegister;
