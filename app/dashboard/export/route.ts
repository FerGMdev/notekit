import { requireUser } from "@/app/lib/auth";
import { notesToMarkdownBundle } from "@/app/lib/export";
import { listNotes } from "@/app/lib/notes";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  const notes = await listNotes(user.id, { sort: "updated" });

  const body = notesToMarkdownBundle(notes);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="notekit-export-${date}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
