"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth";
import { NoteNotFoundError, setFavorite, trashNote } from "@/app/lib/notes";

/**
 * List-level mutations shared by notes, snippets, collections and trash views.
 * Each action re-reads the session instead of trusting a client id, then
 * revalidates the whole dashboard so every list/count is consistent.
 */

export async function toggleFavoriteAction(formData: FormData) {
  const user = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const value = formData.get("value") === "1";

  if (!noteId) return;

  try {
    await setFavorite(user.id, noteId, value);
  } catch (error) {
    if (!(error instanceof NoteNotFoundError)) throw error;
  }

  revalidatePath("/dashboard", "layout");
}

export async function moveToTrashAction(formData: FormData) {
  const user = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");

  if (!noteId) return;

  try {
    await trashNote(user.id, noteId);
  } catch (error) {
    if (!(error instanceof NoteNotFoundError)) throw error;
  }

  revalidatePath("/dashboard", "layout");
}
