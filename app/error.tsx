"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Swap for a real logger (Sentry, Axiom…) when deploying.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        The page could not be loaded. Your notes are safe — try again.
      </p>
      {error.digest && (
        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {error.digest}
        </code>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
