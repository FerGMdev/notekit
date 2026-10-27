import { NoteForm } from "@/app/components/NoteForm";
import { requireUser } from "@/app/lib/auth";
import {
  getNote,
  updateNote,
  NoteNotFoundError,
  noteInputSchema,
} from "@/app/lib/notes";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditNotePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  /* The query filters by userId: another account's note is simply not found. */
  const note = await getNote(user.id, id);

  if (!note) {
    notFound();
  }

  const { error } = await searchParams;

  async function updateNoteAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const { id: noteId } = await params;

    const parsed = noteInputSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
    });

    if (!parsed.success) {
      redirect(`/dashboard/notes/${noteId}?error=invalid`);
    }

    try {
      await updateNote(currentUser.id, noteId, parsed.data);
    } catch (updateError) {
      if (updateError instanceof NoteNotFoundError) {
        notFound();
      }

      throw updateError;
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/notes/${noteId}`);
    redirect("/dashboard");
  }

  return (
    <div className="grid gap-4">
      {error === "invalid" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          Title and content are required (title up to 120 characters).
        </div>
      )}

      <NoteForm
        action={updateNoteAction}
        heading="Edit note"
        description="Changes are saved when you press Save."
        submitLabel="Save changes"
        defaultValues={{
          title: note.title,
          description: note.description,
        }}
      />
    </div>
  );
}
