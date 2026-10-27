"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { createShareAction, revokeShareAction } from "./actions";

export function ShareBox({
  noteId,
  initialShareId,
  baseUrl,
}: {
  noteId: string;
  initialShareId: string | null;
  baseUrl: string;
}) {
  const [shareId, setShareId] = useState(initialShareId);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<"create" | "revoke" | null>(null);

  const url = shareId ? `${baseUrl}/share/${shareId}` : null;

  async function create() {
    setPending("create");
    setError(null);

    try {
      const result = await createShareAction(noteId);

      if (result.ok) {
        setShareId(result.shareId);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not create the link. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function revoke() {
    if (
      !window.confirm(
        "Revoke this public link? Anyone who has it will lose access."
      )
    ) {
      return;
    }

    setPending("revoke");
    setError(null);

    try {
      const result = await revokeShareAction(noteId);

      if (result.ok) {
        setShareId(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not revoke the link. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function copy() {
    if (!url) return;

    setCopying(true);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select the link and copy it manually.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {shareId ? (
            <Globe className="h-5 w-5 text-primary" />
          ) : (
            <Lock className="h-5 w-5 text-primary" />
          )}
          Sharing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {shareId
            ? "Anyone with the link can read this note. Editing stays private."
            : "This note is private. Create a read-only link to share it."}
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {url ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input value={url} readOnly aria-label="Public link" />
            <Button
              type="button"
              variant="secondary"
              onClick={copy}
              disabled={copying}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline underline-offset-2"
            >
              Open the public page
            </a>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={revoke}
              disabled={pending !== null}
              className="text-destructive hover:text-destructive"
            >
              {pending === "revoke" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Revoke link
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={create}
          disabled={pending !== null}
          className="w-fit"
        >
          {pending === "create" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Globe className="mr-2 h-4 w-4" />
          )}
          Create public link
        </Button>
      )}
    </Card>
  );
}
