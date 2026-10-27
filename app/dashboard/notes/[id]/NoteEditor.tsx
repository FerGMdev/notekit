"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NoteSummary } from "@/app/lib/notes";
import { ArrowLeft, Check, Download, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { autosaveNote } from "./actions";
import { AiPanel } from "./AiPanel";
import { ShareBox } from "./ShareBox";

type EditorState = {
  title: string;
  description: string;
  tagsText: string;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 900;

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeStyle: "short",
});

export function NoteEditor({
  note,
  baseUrl,
  isExternalAi,
}: {
  note: NoteSummary;
  baseUrl: string;
  isExternalAi: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [tagsText, setTagsText] = useState(note.tags.join(", "));
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date>(note.updatedAt);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<EditorState>({ title, description, tagsText });

  const flush = useCallback(
    async (values: EditorState) => {
      if (!values.title.trim() || !values.description.trim()) {
        setStatus("error");
        setErrorMessage("A note needs a title and some content to save.");
        return;
      }

      setStatus("saving");
      setErrorMessage(null);

      try {
        const result = await autosaveNote(note.id, {
          title: values.title,
          description: values.description,
          tags: values.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        });

        if (result.ok) {
          setStatus("saved");
          setSavedAt(new Date(result.savedAt));
        } else {
          setStatus("error");
          setErrorMessage(result.error);
        }
      } catch {
        setStatus("error");
        setErrorMessage("Could not reach the server. Your changes are still here.");
      }
    },
    [note.id]
  );

  const queueSave = useCallback(
    (next: EditorState) => {
      latest.current = next;
      setStatus("dirty");
      setErrorMessage(null);

      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => {
        void flush(next);
      }, AUTOSAVE_DELAY_MS);
    },
    [flush]
  );

  const applySuggestedTags = useCallback(
    (next: string[]) => {
      const merged = Array.from(
        new Set(next.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
      ).slice(0, 8);
      const nextTagsText = merged.join(", ");

      setTagsText(nextTagsText);
      queueSave({ title, description, tagsText: nextTagsText });
    },
    [description, queueSave, title]
  );

  /* Don't lose a pending edit when the tab closes. */
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All notes
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {status === "saving" && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </span>
            )}
            {status === "saved" && (
              <span className="inline-flex items-center gap-1">
                <Check className="h-4 w-4 text-green-500" /> Saved at{" "}
                {timeFormatter.format(savedAt)}
              </span>
            )}
            {status === "dirty" && "Unsaved changes"}
            {status === "idle" &&
              `Last edited ${timeFormatter.format(savedAt)}`}
          </span>

          <Button type="button" size="sm" variant="outline" asChild>
            <a href={`/dashboard/notes/${note.id}/export`} download>
              <Download className="mr-2 h-4 w-4" />
              Export
            </a>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => void flush(latest.current)}
            disabled={status === "saving"}
          >
            <Save className="mr-2 h-4 w-4" />
            Save now
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:p-6">
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            queueSave({
              title: event.target.value,
              description,
              tagsText,
            });
          }}
          maxLength={120}
          placeholder="Note title"
          aria-label="Note title"
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />

        <div className="grid gap-2">
          <Label htmlFor="tags" className="text-xs uppercase tracking-wide text-muted-foreground">
            Tags
          </Label>
          <Input
            id="tags"
            value={tagsText}
            onChange={(event) => {
              setTagsText(event.target.value);
              queueSave({
                title,
                description,
                tagsText: event.target.value,
              });
            }}
            placeholder="product, ideas, reading"
            aria-describedby="tags-help"
          />
          <p id="tags-help" className="text-xs text-muted-foreground">
            Comma separated. Up to 8 tags.
          </p>
        </div>

        <div className="flex items-center gap-1 border-b pb-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "write" ? "secondary" : "ghost"}
            onClick={() => setMode("write")}
          >
            Write
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "preview" ? "secondary" : "ghost"}
            onClick={() => setMode("preview")}
          >
            Preview
          </Button>
        </div>

        {mode === "write" ? (
          <Textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              queueSave({
                title,
                description: event.target.value,
                tagsText,
              });
            }}
            placeholder="Start writing… Markdown is supported."
            aria-label="Note content"
            className="min-h-[55vh] resize-y border-none px-0 font-mono text-sm shadow-none focus-visible:ring-0"
          />
        ) : (
          <div className="prose-note min-h-[55vh]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {description}
            </ReactMarkdown>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"} ·{" "}
            {description.length} characters
          </span>
          <span>Markdown</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AiPanel
          noteId={note.id}
          initialSummary={note.summary}
          initialSummaryAt={note.summaryUpdatedAt?.getTime() ?? null}
          lastSavedAt={savedAt.getTime()}
          tags={tagsText
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)}
          isExternal={isExternalAi}
          onApplyTags={applySuggestedTags}
        />

        <ShareBox
          noteId={note.id}
          initialShareId={note.shareId}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}
