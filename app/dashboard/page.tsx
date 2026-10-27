import { Button } from "@/components/ui/button";
import Link from "next/link";
import { requireUser } from "@/app/lib/auth";
import { Edit, File, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revalidatePath } from "next/cache";
import { DeleteNoteButton } from "@/app/components/SubmitButtons";
import {
  deleteNote,
  listNotes,
  NoteNotFoundError,
} from "@/app/lib/notes";
import { FREE_NOTE_LIMIT, hasActiveSubscription } from "@/app/lib/billing";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function Dashboard() {
  const user = await requireUser();

  const [notes, isPro] = await Promise.all([
    listNotes(user.id),
    hasActiveSubscription(user.id),
  ]);

  const remaining = Math.max(0, FREE_NOTE_LIMIT - notes.length);
  const canCreate = isPro || remaining > 0;

  async function removeNote(formData: FormData) {
    "use server";

    /* Inside a server action the session must be re-read: the action is its
       own request and cannot rely on the page's render. */
    const currentUser = await requireUser();
    const noteId = String(formData.get("noteId") ?? "");

    if (!noteId) {
      return;
    }

    try {
      /* Ownership is enforced inside the query (id + userId). */
      await deleteNote(currentUser.id, noteId);
    } catch (error) {
      /* Someone else's note is indistinguishable from a missing one. */
      if (!(error instanceof NoteNotFoundError)) {
        throw error;
      }
    }

    revalidatePath("/dashboard");
  }

  return (
    <div className="grid items-start gap-y-8">
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <h1 className="text-3xl md:text-4xl">Your Notes</h1>
          <p className="text-muted-foreground text-lg">
            {notes.length === 0
              ? "Nothing here yet."
              : `${notes.length} ${notes.length === 1 ? "note" : "notes"}${
                  isPro ? "" : ` · ${remaining} left on the free plan`
                }`}
          </p>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="mr-2 h-4 w-4" />
              New note
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/billing">Upgrade to Pro</Link>
          </Button>
        )}
      </div>

      {!isPro && (
        <div className="mx-2 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Free plan</span>
            <span className="text-muted-foreground">
              {Math.min(notes.length, FREE_NOTE_LIMIT)} / {FREE_NOTE_LIMIT} notes
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (notes.length / FREE_NOTE_LIMIT) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col min-h-[50vh] items-center justify-center rounded-md border p-8 text-center animate-in fade-in-50">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-primary/20">
            <File className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">No notes yet</h3>
          <p className="mb-8 mt-2 text-lg text-muted-foreground max-w-sm mx-auto">
            Write your first note and it will show up here.
          </p>

          <Button asChild>
            <Link href="/dashboard/new">Create your first note</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold text-primary">
                  {note.title}
                </h2>
                <p className="text-muted-foreground">
                  Updated {dateFormatter.format(note.updatedAt)}
                </p>
              </div>

              <div className="flex shrink-0 gap-x-4">
                <Link
                  href={`/dashboard/notes/${note.id}`}
                  aria-label={`Edit ${note.title}`}
                >
                  <Button variant="outline" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <form action={removeNote}>
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
