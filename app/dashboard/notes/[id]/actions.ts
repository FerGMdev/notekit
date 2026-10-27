"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth";
import {
  AiQuotaError,
  summarizeNote,
  suggestNoteTags,
} from "@/app/lib/ai";
import {
  getNote,
  NoteNotFoundError,
  noteInputSchema,
  setNoteSummary,
  updateNote,
} from "@/app/lib/notes";
import { createShareLink, revokeShareLink } from "@/app/lib/sharing";

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

export type SummaryResult =
  | { ok: true; summary: string; provider: string }
  | { ok: false; error: string };

export async function summarizeNoteAction(
  noteId: string
): Promise<SummaryResult> {
  const user = await requireUser();
  const note = await getNote(user.id, noteId);

  if (!note) {
    return { ok: false, error: "This note no longer exists." };
  }

  try {
    const result = await summarizeNote(user.id, note);
    const summary = result.value.trim();

    if (!summary) {
      return { ok: false, error: "The provider returned an empty summary." };
    }

    await setNoteSummary(user.id, noteId, summary);

    return { ok: true, summary, provider: result.provider };
  } catch (error) {
    if (error instanceof AiQuotaError) {
      return { ok: false, error: error.message };
    }

    console.error("[ai] summarize failed", error);
    return { ok: false, error: "Could not generate a summary right now." };
  }
}

export type SuggestTagsResult =
  | { ok: true; tags: string[]; provider: string }
  | { ok: false; error: string };

export async function suggestTagsAction(
  noteId: string
): Promise<SuggestTagsResult> {
  const user = await requireUser();
  const note = await getNote(user.id, noteId);

  if (!note) {
    return { ok: false, error: "This note no longer exists." };
  }

  try {
    const result = await suggestNoteTags(user.id, note);
    const tags = result.value;

    if (tags.length === 0) {
      return {
        ok: false,
        error: "No new tags suggested — this note already covers its topics.",
      };
    }

    return { ok: true, tags, provider: result.provider };
  } catch (error) {
    if (error instanceof AiQuotaError) {
      return { ok: false, error: error.message };
    }

    console.error("[ai] tag suggestion failed", error);
    return { ok: false, error: "Could not suggest tags right now." };
  }
}

export type ShareResult =
  | { ok: true; shareId: string }
  | { ok: false; error: string };

export async function createShareAction(noteId: string): Promise<ShareResult> {
  const user = await requireUser();

  try {
    const shareId = await createShareLink(user.id, noteId);
    revalidatePath(`/dashboard/notes/${noteId}`);

    return { ok: true, shareId };
  } catch (error) {
    if (error instanceof NoteNotFoundError) {
      return { ok: false, error: "This note no longer exists." };
    }

    throw error;
  }
}

export async function revokeShareAction(noteId: string): Promise<ShareResult> {
  const user = await requireUser();

  try {
    await revokeShareLink(user.id, noteId);
    revalidatePath(`/dashboard/notes/${noteId}`);

    return { ok: true, shareId: "" };
  } catch (error) {
    if (error instanceof NoteNotFoundError) {
      return { ok: false, error: "This note no longer exists." };
    }

    throw error;
  }
}
