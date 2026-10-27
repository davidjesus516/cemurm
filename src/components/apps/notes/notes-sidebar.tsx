import Notelist from "./notes-list";

interface NotesSidebarProps {
  onNoteSelect?: () => void;
}

const NotesSidebar = ({ onNoteSelect }: NotesSidebarProps) => {
  return (
    <div className="flex h-full w-full flex-col border-e border-cem-hover p-6">
      <Notelist onNoteSelect={onNoteSelect} />
    </div>
  );
};

export default NotesSidebar;
