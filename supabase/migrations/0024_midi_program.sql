-- CEMURM 0024 — MIDI program change mapping guard (Hito 5 #56).
--
-- The column already exists in the base contract: 0001 setlist_items.midi_program
-- ("per-song program change (NULL ⇒ send nothing)"), documented verbatim in
-- docs/database-schema-v2.md. This migration adds the range guard the contract
-- left open — a Program Change value is 0-127 by the MIDI 1.0 spec, so any
-- other value is a client bug we fail fast on. NULL stays the "no patch"
-- sentinel (songs without a mapping send nothing).
--
-- The mapping travels with the setlist: setlist_items rows are copied by
-- duplicateSetlist, so a duplicated setlist inherits the same program per
-- song. RLS/grants of setlist_items already cover the column — the table-level
-- grants from 0002 apply automatically, and the update policy (owner or
-- can_edit collaborator) governs writes. No new policy needed.

alter table public.setlist_items
  add constraint setlist_items_midi_program_check
  check (midi_program is null or (midi_program >= 0 and midi_program <= 127));

comment on column public.setlist_items.midi_program is
  'Optional MIDI Program Change (0-127) sent when the song becomes current in Stage Mode; NULL = no patch.';