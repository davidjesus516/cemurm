import { useState } from "react";
import { Card } from "@/components/ui/card";
import NotesSidebar from "@/components/apps/notes/notes-sidebar";
import NoteContent from "@/components/apps/notes/note-content";
import AddNotes from "@/components/apps/notes/add-notes";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotesProvider } from "@/context/notes-context/index";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const NotesApp = () => {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);

  return (
    <NotesProvider>
      <Card className="py-0! overflow-hidden">
        <div className="flex min-h-[600px] h-[calc(100vh-300px)]">
          <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="!max-w-[320px] !sm:max-w-[320px] w-full h-full p-0! lg:hidden"
            >
              <NotesSidebar onNoteSelect={handleClose} />
            </SheetContent>
          </Sheet>

          <div className="hidden h-full w-80 shrink-0 lg:block">
            <NotesSidebar />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between border-b border-cem-hover px-6 py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(true)}
                  className="border border-cem-hover lg:hidden"
                  aria-label="Open notes list"
                >
                  <Menu size={18} />
                </Button>
                <h2 className="text-base font-medium text-cem-text">Notes</h2>
              </div>
              <AddNotes />
            </div>
            <NoteContent />
          </div>
        </div>
      </Card>
    </NotesProvider>
  );
};

export default NotesApp;
