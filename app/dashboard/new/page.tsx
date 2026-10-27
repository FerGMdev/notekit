import { NoteForm } from "@/app/components/NoteForm";
import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import { FREE_NOTE_LIMIT, hasActiveSubscription } from "@/app/lib/billing";
import {
  canCreateNote,
  countNotes,
  createNote,
  NoteLimitError,
} from "@/app/lib/notes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export default async function NewNotePage() {
  const user = await requireAppUser();
  const allowed = await canCreateNote(user.id);

  if (!allowed) {
    const [noteCount, isPro] = await Promise.all([
      countNotes(user.id),
      hasActiveSubscription(user.id),
    ]);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Free plan limit reached</CardTitle>
          <CardDescription>
            You have {noteCount} of {FREE_NOTE_LIMIT} items
            {isPro ? "" : " on the free plan"}. Notes and snippets share the
            limit; upgrade to Pro for unlimited items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/billing">See plans</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  async function createNoteAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();

    try {
      await createNote(currentUser.id, {
        title: formData.get("title"),
        description: formData.get("description"),
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
    } catch (error) {
      if (error instanceof NoteLimitError) {
        redirect("/dashboard/billing?reason=limit");
      }

      throw error;
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  return (
    <NoteForm
      action={createNoteAction}
      heading="Create a new note"
      description="Capture an idea, a meeting or a reference. Code belongs in a snippet."
      submitLabel="Create note"
    />
  );
}
