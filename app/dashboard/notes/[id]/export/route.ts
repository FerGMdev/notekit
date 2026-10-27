import { requireUser } from "@/app/lib/auth";
import { exportFilename, noteToMarkdown } from "@/app/lib/export";
import { getNote } from "@/app/lib/notes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const note = await getNote(user.id, id);

  if (!note) {
    return new Response("Note not found", { status: 404 });
  }

  return new Response(noteToMarkdown(note), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(
        note.title
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
