/* eslint-disable @typescript-eslint/no-explicit-any */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.

import { Trash2 } from "lucide-react";
import { useState, useContext, useEffect } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
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

const Notelist = () => {
  const { notes, selectNote, deleteNote } = useContext(NotesContext);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeNoteId, setActiveNoteId] = useState<any | null>(null);

  useEffect(() => {
    if (notes.length > 0) {
      // Set the first note as active
      const firstNoteId = notes[0].id;
      setActiveNoteId(firstNoteId);
    }
  }, [notes]);

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
  const handleNoteClick = (noteId: number) => {
    setActiveNoteId(noteId);
    selectNote(noteId);
  };

  type NoteColor =
    | "primary"
    | "destructive"
    | "chart-3"
    | "chart-4"
    | "chart-2"
    | "secondary";



  const colorClasses: Record<NoteColor, string> = {
    primary: "bg-cem-amber/5  text-cem-amber border border-cem-amber/20",
    destructive: "bg-destructive/5  text-cem-amber border border-destructive/20",
    "chart-3": "bg-chart-3/5  text-cem-amber  border border-chart-3/20",
    "chart-4": "bg-chart-4/5 text-cem-amber border border-chart-4/20",
    "chart-2": "bg-chart-2/5 text-cem-amber  border border-chart-2/20",
    secondary: "bg-cem-elevated/5 text-cem-amber  border border-cem-elevated/20",
  };

  return (
    <>
      <div className="overflow-hidden">
        <div className="relative w-full">

          <SearchIcon size={16} className="absolute left-2 top-1/2 -translate-y-1/2  text-cem-secondary-elevated" />

          <PlaceholdersInput
            value={searchTerm}
            className="pl-9!"
            onChange={setSearchTerm}
            placeholders={[
              "Search Notes...",
              "Find Your Notes...",
              "Look up Notes...",
            ]}
          />
        </div>
        <h6 className="text-base mt-6">All Notes</h6>
        <div className="flex flex-col gap-3 mt-4">
          {filteredNotes && filteredNotes.length ? (
            filteredNotes.map((note, index) => (
              <div key={note.id}>
                <AnimatedItem index={index}>
                  <div
                    className={`cursor-pointer relative p-4 rounded-xl   ${colorClasses[note.color as NoteColor] ||
                      "bg-chart-5/5"
                      } 
                  ${activeNoteId === note.id ? "scale-100" : "scale-95"
                      } transition-transform duration-200`}
                    onClick={() => handleNoteClick(note.id)}
                  >
                    <h6 className={`text-base truncate text-cem-amber`}>
                      {note.title}
                    </h6>
                    <div className="flex items-center justify-between">
                      <p className="text-xs">
                        {new Date(note.datef ?? "").toLocaleDateString()}
                      </p>
                      <div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button
                                variant={"ghost"}
                                className={
                                  "hover:text-destructive hover:bg-destructive/12 text-cem-text dark:hover:text-destructive dark:hover:bg-destructive/12"
                                }
                                size="icon"
                                onClick={() => deleteNote(note.id)}
                                aria-label="Delete note"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </AnimatedItem>
              </div>
            ))
          ) : (
            <Alert variant="destructive">
              <AlertTitle>No Notes Found!</AlertTitle>
            </Alert>
          )}
        </div>
      </div>
    </>
  );
};
export default Notelist;
