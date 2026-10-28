import React, { useContext, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { NotesContext } from "@/context/notes-context/index";

const NoteContent = () => {
  const { notes, updateNote, selectedNoteId } = useContext(NotesContext);
  const noteDetails = notes.find((note) => note.id === selectedNoteId);

  const [initialTitle, setInitialTitle] = useState("");
  const [updatedTitle, setUpdatedTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (noteDetails) {
      setInitialTitle(noteDetails.title ?? "");
      setUpdatedTitle(noteDetails.title ?? "");
    }
  }, [noteDetails]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUpdatedTitle(e.target.value);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    updateNote(selectedNoteId, updatedTitle);
  };

  return (
    <div className="p-6">
      {noteDetails ? (
        <div className="w-full">
          <Textarea
            id="note-title"
            aria-label="Note"
            placeholder="Write the note here..."
            rows={6}
            value={isEditing ? updatedTitle : initialTitle}
            onChange={handleTitleChange}
            className="w-full min-h-[180px]"
            onBlur={handleBlur}
          />
        </div>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-base font-medium text-cem-text">No note selected</p>
          <p className="text-sm text-cem-secondary-elevated">
            Add a note or pick one from the list.
          </p>
        </div>
      )}
    </div>
  );
};

export default NoteContent;
