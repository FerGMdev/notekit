import { requireAppUser } from "@/app/lib/session";
import { getNote, listCollections } from "@/app/lib/notes";
import { aiIsExternal } from "@/app/lib/ai";
import { getBaseUrl } from "@/app/lib/url";
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

  const baseUrl = await getBaseUrl();
  const collections = await listCollections(user.id);

  return (
    <NoteEditor
      note={note}
      collections={collections.map(({ id, name }) => ({ id, name }))}
      baseUrl={baseUrl}
      isExternalAi={aiIsExternal}
    />
  );
}
