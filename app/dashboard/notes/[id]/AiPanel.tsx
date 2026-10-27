"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { suggestTagsAction, summarizeNoteAction } from "./actions";

/**
 * AI assist panel. It never edits the note on its own: summaries are shown and
 * persisted, tags are only applied when the user clicks them.
 */
export function AiPanel({
  noteId,
  initialSummary,
  initialSummaryAt,
  lastSavedAt,
  tags,
  isExternal,
  onApplyTags,
}: {
  noteId: string;
  initialSummary: string | null;
  initialSummaryAt: number | null;
  lastSavedAt: number;
  tags: string[];
  isExternal: boolean;
  onApplyTags: (tags: string[]) => void;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [summaryAt, setSummaryAt] = useState(initialSummaryAt);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [tagging, setTagging] = useState(false);

  const summaryIsStale =
    summary !== null && summaryAt !== null && summaryAt < lastSavedAt;

  const available = suggestions.filter((tag) => !tags.includes(tag));

  async function handleSummarize() {
    setSummarizing(true);
    setError(null);

    try {
      const result = await summarizeNoteAction(noteId);

      if (result.ok) {
        setSummary(result.summary);
        setSummaryAt(Date.now());
        setProvider(result.provider);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleSuggestTags() {
    setTagging(true);
    setError(null);

    try {
      const result = await suggestTagsAction(noteId);

      if (result.ok) {
        setSuggestions(result.tags);
        setProvider(result.provider);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setTagging(false);
    }
  }

  function applyTag(tag: string) {
    onApplyTags([...tags, tag]);
    setSuggestions((current) => current.filter((item) => item !== tag));
  }

  function applyAll() {
    onApplyTags([...tags, ...available]);
    setSuggestions([]);
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            AI assist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isExternal
              ? "Summaries and tags use the configured AI model."
              : "Runs on the built-in provider — no API key, no network, no cost."}
          </p>
        </div>

        {provider && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {provider}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSummarize}
          disabled={summarizing || tagging}
        >
          {summarizing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          {summary ? "Regenerate summary" : "Summarise"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSuggestTags}
          disabled={summarizing || tagging}
        >
          {tagging ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Tags className="mr-2 h-4 w-4" />
          )}
          Suggest tags
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {summary && (
        <div className="rounded-md bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Summary
            </span>
            {summaryIsStale && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                May not include your latest edits
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6">{summary}</p>
        </div>
      )}

      {available.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Suggested tags
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={applyAll}
            >
              Add all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => applyTag(tag)}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-accent"
              >
                <Plus className="h-3 w-3" />#{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {!summary && !error && available.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Generate a summary you can share, or get tag ideas from what you
          wrote.
        </p>
      )}
    </Card>
  );
}
