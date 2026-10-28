// Demo notes store.
//
// The notes screen has no CEMURM domain yet, so the demo keeps its content in
// React state: no network calls, no Supabase writes, and every change is lost on
// reload. The notes screen renders a demo notice that says exactly that.
import { createContext, useState } from 'react';
import React from 'react';
import { demoNotes } from '@/demo/content';
import { notesType } from 'src/types/apps/notes';

interface NotesContextType {
  notes: notesType[];
  selectedNoteId: number;
  selectNote: (id: number) => void;
  addNote: (newNote: notesType) => void;
  updateNote: (id: number, title: string) => void;
  deleteNote: (id: number) => void;
}

const initialContext: NotesContextType = {
  notes: demoNotes,
  selectedNoteId: demoNotes[0]?.id ?? 1,
  selectNote: () => {},
  addNote: () => {},
  updateNote: () => {},
  deleteNote: () => {},
};

export const NotesContext = createContext<NotesContextType>(initialContext);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<notesType[]>(demoNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<number>(
    demoNotes[0]?.id ?? 1,
  );

  const selectNote = (id: number) => {
    setSelectedNoteId(id);
  };

  const addNote = (newNote: notesType) => {
    const nextId = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
    const created: notesType = {
      ...newNote,
      id: nextId,
      datef: new Date().toISOString(),
      deleted: false,
    };
    setNotes((current) => [created, ...current]);
    setSelectedNoteId(nextId);
  };

  const updateNote = (id: number, title: string) => {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, title } : note)),
    );
  };

  const deleteNote = (id: number) => {
    const remaining = notes.filter((note) => note.id !== id);
    setNotes(remaining);
    if (selectedNoteId === id) {
      setSelectedNoteId(remaining[0]?.id ?? 0);
    }
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        selectedNoteId,
        selectNote,
        addNote,
        updateNote,
        deleteNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};
