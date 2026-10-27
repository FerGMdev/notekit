import { Markdown } from "@/app/components/Markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { aiIsExternal, AiQuotaError, askNotes } from "@/app/lib/ai";
import { countNotes, listNotes } from "@/app/lib/notes";
import { requireAppUser } from "@/app/lib/session";
import { AlertCircle, FileText, Search, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Ask your library — Notekit",
};

const EXAMPLES = [
  "What does my deploy runbook say?",
  "How do we review code?",
  "What am I reading next?",
];

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await requireAppUser();
  const { q } = await searchParams;
  const question = (Array.isArray(q) ? q[0] : q ?? "").trim().slice(0, 300);

  /* Only load note bodies when there is a question to answer. */
  const notes = question ? await listNotes(user.id, { sort: "updated" }) : [];
  const noteCount = question ? notes.length : await countNotes(user.id);

  let answer: string | null = null;
  let provider: string | null = null;
  let citations: { id: string; title: string }[] = [];
  let error: string | null = null;

  if (question) {
    try {
      const result = await askNotes(user.id, question, notes);
      answer = result.answer;
      provider = result.provider;
      citations = result.citations;
    } catch (caught) {
      if (caught instanceof AiQuotaError) {
        error = caught.message;
      } else {
        throw caught;
      }
    }
  }

  return (
    <div className="grid items-start gap-6">
      <div className="grid gap-2">
        <h1 className="flex items-center gap-2 text-3xl md:text-4xl">
          <Sparkles className="h-7 w-7 text-primary" />
          Ask your library
        </h1>
        <p className="text-muted-foreground">
          Answers come from your own notes and snippets, with citations — not
          from the open internet.
        </p>
      </div>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={question}
            maxLength={300}
            placeholder="Ask something your notes might answer…"
            className="pl-9"
            aria-label="Question"
          />
        </div>
        <Button type="submit">Ask</Button>
      </form>

      <p className="text-xs text-muted-foreground">
        {noteCount} {noteCount === 1 ? "item" : "items"} searched ·{" "}
        {aiIsExternal
          ? "model-powered answers"
          : "built-in provider, no API key required"}
      </p>

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {question && !error && answer && (
        <Card className="grid gap-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Answer</h2>
            {provider && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {provider}
              </span>
            )}
          </div>

          <Markdown className="prose-note text-sm leading-6">{answer}</Markdown>

          {citations.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Sources
              </p>
              <ul className="mt-2 grid gap-1">
                {citations.map((citation) => (
                  <li key={citation.id}>
                    <Link
                      href={`/dashboard/notes/${citation.id}`}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {citation.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {!question && (
        <Card className="grid gap-3 p-4 sm:p-6">
          <p className="text-sm font-medium">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example} variant="outline" size="sm" asChild>
                <Link href={`/dashboard/ask?q=${encodeURIComponent(example)}`}>
                  {example}
                </Link>
              </Button>
            ))}
          </div>
          {noteCount === 0 && (
            <p className="text-sm text-muted-foreground">
              You need at least one note or snippet before there is anything to
              ask about.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
