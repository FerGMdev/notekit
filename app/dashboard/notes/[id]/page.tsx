import { requireAppUser } from "@/app/lib/session";
import { getNote } from "@/app/lib/notes";
import { notFound } from "next/navigation";
import { NoteEditor } from "./NoteEditor";

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAppUser();

  /* The query filters by userId: another account's note is simply not found. */
  const note = await getNote(user.id, id);

  if (!note) {
    notFound();
  }

  return <NoteEditor note={note} />;
}
