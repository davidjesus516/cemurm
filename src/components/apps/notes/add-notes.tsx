import { useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NotesContext } from "@/context/notes-context/index";

const AddNotes = () => {
  const { addNote } = useContext(NotesContext);

  const [openNoteModal, setOpenNoteModal] = useState(false);
  const [title, setTitle] = useState("");
  const trimmedTitle = title.trim();

  const handleOpenChange = (next: boolean) => {
    setOpenNoteModal(next);
    if (!next) setTitle("");
  };

  const handleSave = () => {
    if (!trimmedTitle) return;
    addNote({
      title: trimmedTitle,
      id: 0,
      deleted: false,
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={openNoteModal} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>Add Note</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            rows={5}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-h-[120px]"
            placeholder="Write the note here..."
            aria-label="Note"
          />
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!trimmedTitle} onClick={handleSave}>
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddNotes;
