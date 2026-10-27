import { Button } from "@/components/ui/button";
import { SnippetForm } from "@/app/components/SnippetForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import { FREE_NOTE_LIMIT, hasActiveSubscription } from "@/app/lib/billing";
import {
  canCreateNote,
  countNotes,
  createNote,
  NoteLimitError,
} from "@/app/lib/notes";
import {
  buildSnippetMarkdown,
  normalizeLanguage,
} from "@/app/lib/languages";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const metadata = {
  title: "New snippet",
};

export default async function NewSnippetPage() {
  const user = await requireAppUser();
  const allowed = await canCreateNote(user.id);

  if (!allowed) {
    const [itemCount, isPro] = await Promise.all([
      countNotes(user.id),
      hasActiveSubscription(user.id),
    ]);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Free plan limit reached</CardTitle>
          <CardDescription>
            You have {itemCount} of {FREE_NOTE_LIMIT} items
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

  async function createSnippetAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const language = normalizeLanguage(formData.get("language")) ?? "plaintext";

    let noteId: string;

    try {
      const note = await createNote(currentUser.id, {
        title: formData.get("title"),
        description: buildSnippetMarkdown({
          code: String(formData.get("code") ?? ""),
          language,
          notes: String(formData.get("notes") ?? ""),
        }),
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        kind: "SNIPPET",
        language,
      });

      noteId = note.id;
    } catch (error) {
      if (error instanceof NoteLimitError) {
        redirect("/dashboard/billing?reason=limit");
      }

      throw error;
    }

    revalidatePath("/dashboard", "layout");
    redirect(`/dashboard/notes/${noteId}`);
  }

  return (
    <SnippetForm
      action={createSnippetAction}
      heading="Create a new snippet"
      description="Keep the code, the language and the context together."
      submitLabel="Create snippet"
    />
  );
}
