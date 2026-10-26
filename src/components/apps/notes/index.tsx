/* eslint-disable @typescript-eslint/no-explicit-any */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import NotesSidebar from "@/components/apps/notes/notes-sidebar";
import NoteContent from "@/components/apps/notes/note-content";
import AddNotes from "@/components/apps/notes/add-notes";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotesProvider } from "@/context/notes-context/index";
import { useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { mutate } from "swr";

interface colorsType {
  lineColor: string;
  disp: string | any;
  id: number;
}

const NotesApp = () => {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);

  

  const location = useLocation();
  const pathname = location.pathname;

  // Reset Notes on browser refresh
  const handleResetTickets = async () => {
    await mutate("/api/notes");
  };

  useEffect(() => {
    const isPageRefreshed = sessionStorage.getItem("isPageRefreshed");
    if (isPageRefreshed === "true") {
      console.log("page refreshed");
      sessionStorage.removeItem("isPageRefreshed");
      handleResetTickets();
    }
  }, [pathname]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("isPageRefreshed", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const colorvariation: colorsType[] = [
    {
      id: 1,
      lineColor: "chart-4",
      disp: "chart-4",
    },
    {
      id: 2,
      lineColor: "primary",
      disp: "primary",
    },
    {
      id: 3,
      lineColor: "destructive",
      disp: "destructive",
    },
    {
      id: 4,
      lineColor: "chart-2",
      disp: "chart-2",
    },
    {
      id: 5,
      lineColor: "chart-3",
      disp: "chart-3",
    },
  ];

  return (
    <>
      <NotesProvider>
        <Card className="py-0! overflow-hidden">
          <div className="flex min-h-[600px] h-[calc(100vh-300px)]">
            {/* NOTES SIDEBAR */}
            <div>
              <Sheet open={isOpen} onOpenChange={handleClose}>
                <SheetContent
                                   side="left"

                  showCloseButton={false}
                  className="!max-w-[320px] !sm:max-w-[320px] w-full h-full lg:z-0 lg:hidden block"
                >
                  <NotesSidebar />
                </SheetContent>
              </Sheet>
              <div className="w-full h-full lg:block hidden">
                <NotesSidebar />
              </div>
            </div>

            {/* NOTES CONTENT */}
            <div className="w-full">
              <div className="flex justify-between items-center border-b border-cem-hover py-4 px-6">
                <div className="flex gap-3 items-center">
                  <Button
                    variant="ghost"
                    onClick={() => setIsOpen(true)}
                    className="!h-8 !w-8 !rounded-md  justify-center items-center  p-0 lg:!hidden flex  border border-cem-hover"
                  >
                    <Menu size={18} />
                  </Button>
                  <h6 className="text-base"> Edit Note</h6>
                </div>
                <AddNotes colors={colorvariation} />
              </div>
              <NoteContent />
            </div>
          </div>
        </Card>
      </NotesProvider>
    </>
  );
};

export default NotesApp;
