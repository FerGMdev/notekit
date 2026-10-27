import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NoteSummary } from "@/app/lib/notes";
import { extractCodeBlock, languageLabel } from "@/app/lib/languages";
import { Code2, Edit, Globe, Star } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { TrashNoteButton } from "./SubmitButtons";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Plain-text preview: strips the most common Markdown noise. */
function excerpt(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function NoteCard({
  note,
  onToggleFavorite,
  onTrash,
}: {
  note: NoteSummary;
  onToggleFavorite: (formData: FormData) => void | Promise<void>;
  onTrash: (formData: FormData) => void | Promise<void>;
}) {
  const snippet = note.kind === "SNIPPET";
  const codeBlock = snippet ? extractCodeBlock(note.description) : null;
  const preview = codeBlock
    ? codeBlock.code.replace(/\s+/g, " ").trim().slice(0, 160)
    : excerpt(note.description);
  const tagHref = snippet ? "/dashboard/snippets" : "/dashboard";

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          {snippet && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Code2 className="h-3 w-3" />
              {languageLabel(note.language)}
            </span>
          )}
          <Link href={`/dashboard/notes/${note.id}`} className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-primary hover:underline">
              {note.title}
            </h2>
          </Link>
          {note.isFavorite && (
            <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
          )}
          {note.shareId && (
            <Globe
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-label="Public link active"
            />
          )}
        </div>

        <p
          className={
            snippet
              ? "line-clamp-2 font-mono text-xs text-muted-foreground"
              : "line-clamp-2 text-sm text-muted-foreground"
          }
        >
          {preview}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {dateFormatter.format(note.updatedAt)}
          </span>
          {note.tags.map((tag) => (
            <Link
              key={tag}
              href={`${tagHref}?tag=${encodeURIComponent(tag)}`}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {codeBlock && <CopyButton value={codeBlock.code} />}

        <form action={onToggleFavorite}>
          <input type="hidden" name="noteId" value={note.id} />
          <input
            type="hidden"
            name="value"
            value={note.isFavorite ? "0" : "1"}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            title={
              note.isFavorite ? "Remove from favourites" : "Add to favourites"
            }
            aria-label={
              note.isFavorite ? "Remove from favourites" : "Add to favourites"
            }
          >
            <Star
              className={
                note.isFavorite
                  ? "h-4 w-4 fill-yellow-400 text-yellow-400"
                  : "h-4 w-4"
              }
            />
          </Button>
        </form>

        <Button variant="outline" size="icon" asChild>
          <Link
            href={`/dashboard/notes/${note.id}`}
            aria-label={`Edit ${note.title}`}
          >
            <Edit className="h-4 w-4" />
          </Link>
        </Button>

        <form action={onTrash}>
          <input type="hidden" name="noteId" value={note.id} />
          <TrashNoteButton />
        </form>
      </div>
    </Card>
  );
}
