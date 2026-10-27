"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setNoteCollectionAction } from "./actions";

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";

/** Moving an item between collections is its own mutation, so it cannot be
 * lost or repeated by the body autosave. */
export function CollectionPicker({
  noteId,
  collections,
  value,
}: {
  noteId: string;
  collections: { id: string; name: string }[];
  value: string | null;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);

    startTransition(async () => {
      const result = await setNoteCollectionAction(noteId, next || null);

      if (!result.ok) {
        setCurrent(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label
        htmlFor="collection"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        Collection
      </label>
      <div className="flex items-center gap-2">
        <select
          id="collection"
          value={current}
          onChange={(event) => handleChange(event.target.value)}
          disabled={pending}
          className={selectClassName}
        >
          <option value="">No collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        {pending && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/collections" className="underline">
            Create a collection
          </Link>{" "}
          to group items.
        </p>
      ) : null}
    </div>
  );
}
