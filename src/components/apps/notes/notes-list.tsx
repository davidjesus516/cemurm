import { Trash2 } from "lucide-react";
import { useState, useContext } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { NotesContext } from "@/context/notes-context/index";
import AnimatedItem from "../../animated-components/list-animation";
import PlaceholdersInput from "@/components/animated-components/animatedinput-placeholder";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { notesType } from "src/types/apps/notes";

interface NotelistProps {
  onNoteSelect?: () => void;
}

const formatNoteDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

const Notelist = ({ onNoteSelect }: NotelistProps) => {
  const { notes, selectNote, deleteNote, selectedNoteId } =
    useContext(NotesContext);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filterNotes = (notes: notesType[], nSearch: string) => {
    if (nSearch !== "")
      return notes.filter(
        (t) =>
          !t.deleted &&
          (t.title ?? "")
            .toLocaleLowerCase()
            .concat(" ")
            .includes(nSearch.toLocaleLowerCase())
      );
    return notes.filter((t) => !t.deleted);
  };

  const filteredNotes = filterNotes(notes, searchTerm);
  const totalNotes = notes.filter((note) => !note.deleted).length;

  const handleNoteClick = (noteId: number) => {
    selectNote(noteId);
    onNoteSelect?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative w-full">
        <SearchIcon
          size={16}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-cem-secondary-elevated"
        />

        <PlaceholdersInput
          value={searchTerm}
          className="pl-9!"
          onChange={setSearchTerm}
          placeholders={[
            "Search notes...",
            "Find a rehearsal note...",
            "Look up a note...",
          ]}
        />
      </div>
      <h3 className="mt-6 text-sm font-medium text-cem-secondary-elevated">
        All Notes
      </h3>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {filteredNotes.length ? (
          filteredNotes.map((note, index) => {
            const selected = selectedNoteId === note.id;

            return (
              <div key={note.id}>
                <AnimatedItem index={index}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNoteClick(note.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNoteClick(note.id);
                      }
                    }}
                    aria-current={selected ? "true" : undefined}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      selected
                        ? "border-cem-amber/40 bg-cem-amber/5"
                        : "border-cem-hover bg-cem-surface hover:border-cem-amber/30"
                    }`}
                  >
                    <p
                      className={`truncate text-sm font-medium ${
                        selected ? "text-cem-amber" : "text-cem-text"
                      }`}
                    >
                      {note.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-cem-secondary-elevated">
                        {formatNoteDate(note.datef)}
                      </p>
                      <div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  className="text-cem-secondary-elevated hover:bg-destructive/10 hover:text-destructive"
                                  size="icon"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteNote(note.id);
                                  }}
                                  aria-label="Delete note"
                                />
                              }
                            >
                              <Trash2 size={18} />
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </AnimatedItem>
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-cem-hover p-4 text-sm text-cem-secondary-elevated">
            {totalNotes === 0
              ? "No notes yet. Add one with Add Note."
              : "No notes match your search."}
          </p>
        )}
      </div>
    </div>
  );
};

export default Notelist;
