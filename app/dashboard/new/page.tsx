import { NoteForm } from "@/app/components/NoteForm";
import { requireUser } from "@/app/lib/auth";
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
  const user = await requireUser();
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
            You have {noteCount} of {FREE_NOTE_LIMIT} notes
            {isPro ? "" : " on the free plan"}. Upgrade to Pro for unlimited
            notes.
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
      description="Capture an idea, a meeting or a snippet."
      submitLabel="Create note"
    />
  );
}
