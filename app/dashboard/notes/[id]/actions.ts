"use server";

import { requireUser } from "@/app/lib/auth";
import {
  NoteNotFoundError,
  noteInputSchema,
  updateNote,
} from "@/app/lib/notes";

export type AutosaveResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string };

/**
 * Called by the editor on a debounce. Returns a result instead of throwing so
 * the client can show "Could not save" without unmounting the editor.
 */
export async function autosaveNote(
  noteId: string,
  input: unknown
): Promise<AutosaveResult> {
  const user = await requireUser();

  const parsed = noteInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note",
    };
  }

  try {
    await updateNote(user.id, noteId, parsed.data);
  } catch (error) {
    if (error instanceof NoteNotFoundError) {
      return { ok: false, error: "This note no longer exists." };
    }

    throw error;
  }

  return { ok: true, savedAt: Date.now() };
}
