import { Markdown } from "@/app/components/Markdown";
import { Button } from "@/components/ui/button";
import { getSharedNote } from "@/app/lib/sharing";
import { stripMarkdown } from "@/app/lib/ai/types";
import { ArrowRight, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* Share links can be revoked at any moment: never cache the page. */
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const note = await getSharedNote(shareId);

  if (!note) {
    return {
      title: "Note not found",
      robots: { index: false, follow: false },
    };
  }

  const description = (
    note.summary ?? stripMarkdown(note.description)
  ).slice(0, 160);

  return {
    title: note.title,
    description,
    /* A shared note is readable by link, not browsable in search results. */
    robots: { index: false, follow: false },
    openGraph: {
      type: "article",
      title: note.title,
      description,
    },
  };
}

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const note = await getSharedNote(shareId);

  if (!note) {
    notFound();
  }

  return (
    <main className="container max-w-3xl py-10">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        Shared note · read-only
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {note.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Updated {dateFormatter.format(note.updatedAt)}</span>
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            #{tag}
          </span>
        ))}
      </div>

      {note.summary && (
        <div className="mt-6 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="mt-2 text-sm leading-6">{note.summary}</p>
        </div>
      )}

      <article className="mt-8 border-t pt-8">
        <Markdown>{note.description}</Markdown>
      </article>

      <footer className="mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Shared with Notekit — private by default, shared on purpose.
        </p>
        <Button asChild size="sm">
          <Link href="/">
            Try Notekit
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </footer>
    </main>
  );
}
