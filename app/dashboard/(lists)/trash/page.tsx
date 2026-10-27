import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import {
  deleteNotePermanently,
  listNotes,
  NoteNotFoundError,
  restoreNote,
} from "@/app/lib/notes";
import { DeleteNoteButton } from "@/app/components/SubmitButtons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, Trash2 } from "lucide-react";
import { revalidatePath } from "next/cache";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TrashPage() {
  const user = await requireAppUser();
  const notes = await listNotes(user.id, { trashed: true, sort: "updated" });

  async function restore(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const noteId = String(formData.get("noteId") ?? "");

    if (!noteId) return;

    try {
      await restoreNote(currentUser.id, noteId);
    } catch (error) {
      if (!(error instanceof NoteNotFoundError)) throw error;
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/trash");
  }

  async function destroy(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const noteId = String(formData.get("noteId") ?? "");

    if (!noteId) return;

    try {
      await deleteNotePermanently(currentUser.id, noteId);
    } catch (error) {
      if (!(error instanceof NoteNotFoundError)) throw error;
    }

    revalidatePath("/dashboard/trash");
  }

  return (
    <div className="grid items-start gap-y-6">
      <div className="grid gap-2 px-2">
        <h1 className="text-3xl md:text-4xl">Trash</h1>
        <p className="text-muted-foreground">
          Trashed notes are hidden from search and do not count towards your
          plan. Restore them, or delete them forever.
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="mx-2 flex min-h-[40vh] flex-col items-center justify-center rounded-md border p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <Trash2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">Trash is empty</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Notes you move to trash will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-2">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{note.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Deleted{" "}
                  {note.deletedAt ? dateFormatter.format(note.deletedAt) : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <form action={restore}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                </form>

                <form action={destroy}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <DeleteNoteButton />
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
