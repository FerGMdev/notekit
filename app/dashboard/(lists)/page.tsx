import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import { File, Plus, Search, Star } from "lucide-react";
import { revalidatePath } from "next/cache";
import { NoteCard } from "@/app/components/NoteCard";
import {
  countNotes,
  listNotes,
  listTags,
  NoteNotFoundError,
  setFavorite,
  trashNote,
  type SortOption,
} from "@/app/lib/notes";
import { FREE_NOTE_LIMIT, hasActiveSubscription } from "@/app/lib/billing";
import { cn } from "@/lib/utils";

type SearchParams = {
  q?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
  fav?: string | string[];
};

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title" },
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAppUser();
  const params = await searchParams;

  const query = (first(params.q) ?? "").trim();
  const tag = (first(params.tag) ?? "").trim();
  const favoritesOnly = first(params.fav) === "1";
  const sortParam = first(params.sort);
  const sort: SortOption =
    sortParam === "created" || sortParam === "title" ? sortParam : "updated";

  const [notes, isPro, tags, totalNotes] = await Promise.all([
    listNotes(user.id, { query, tag, favoritesOnly, sort }),
    hasActiveSubscription(user.id),
    listTags(user.id),
    countNotes(user.id),
  ]);

  const remaining = Math.max(0, FREE_NOTE_LIMIT - totalNotes);
  const canCreate = isPro || remaining > 0;
  const hasFilters = Boolean(query || tag || favoritesOnly);

  const hrefWith = (overrides: {
    q?: string;
    tag?: string;
    sort?: SortOption;
    fav?: boolean;
  }) => {
    const search = new URLSearchParams();
    const next = {
      q: overrides.q ?? query,
      tag: overrides.tag ?? tag,
      sort: overrides.sort ?? sort,
      fav: overrides.fav ?? favoritesOnly,
    };

    if (next.q) search.set("q", next.q);
    if (next.tag) search.set("tag", next.tag);
    if (next.sort !== "updated") search.set("sort", next.sort);
    if (next.fav) search.set("fav", "1");

    const qs = search.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  async function toggleFavorite(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const noteId = String(formData.get("noteId") ?? "");
    const value = formData.get("value") === "1";

    if (!noteId) return;

    try {
      await setFavorite(currentUser.id, noteId, value);
    } catch (error) {
      if (!(error instanceof NoteNotFoundError)) throw error;
    }

    revalidatePath("/dashboard");
  }

  async function moveToTrash(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    const noteId = String(formData.get("noteId") ?? "");

    if (!noteId) return;

    try {
      await trashNote(currentUser.id, noteId);
    } catch (error) {
      if (!(error instanceof NoteNotFoundError)) throw error;
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/trash");
  }

  return (
    <div className="grid items-start gap-y-6">
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <h1 className="text-3xl md:text-4xl">Your notes</h1>
          <p className="text-muted-foreground">
            {totalNotes === 0
              ? "Nothing here yet."
              : `${totalNotes} ${totalNotes === 1 ? "note" : "notes"} · ${
                  isPro ? "Pro plan" : `${remaining} left on the free plan`
                }`}
          </p>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="mr-2 h-4 w-4" />
              New note
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/billing">Upgrade to Pro</Link>
          </Button>
        )}
      </div>

      {!isPro && (
        <div className="mx-2 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Free plan</span>
            <span className="text-muted-foreground">
              {Math.min(totalNotes, FREE_NOTE_LIMIT)} / {FREE_NOTE_LIMIT} notes
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (totalNotes / FREE_NOTE_LIMIT) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="mx-2 grid gap-3">
        <form method="get" className="flex gap-2">
          {tag && <input type="hidden" name="tag" value={tag} />}
          {favoritesOnly && <input type="hidden" name="fav" value="1" />}
          {sort !== "updated" && (
            <input type="hidden" name="sort" value={sort} />
          )}

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search title or content…"
              className="pl-9"
              aria-label="Search notes"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" asChild>
              <Link href="/dashboard">Clear</Link>
            </Button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={hrefWith({ fav: false })}
            className={cn(
              "rounded-full border px-3 py-1",
              !favoritesOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            All notes
          </Link>
          <Link
            href={hrefWith({ fav: true })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1",
              favoritesOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Star className="h-3.5 w-3.5" />
            Favourites
          </Link>

          <span className="mx-1 h-4 w-px bg-border" aria-hidden />

          {sortOptions.map((option) => (
            <Link
              key={option.value}
              href={hrefWith({ sort: option.value })}
              className={cn(
                "rounded-full px-2 py-1",
                sort === option.value
                  ? "font-semibold text-foreground underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Tags
            </span>
            {tag && (
              <Link
                href={hrefWith({ tag: "" })}
                className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
              >
                #{tag} ×
              </Link>
            )}
            {tags
              .filter((item) => item.name !== tag)
              .map((item) => (
                <Link
                  key={item.name}
                  href={hrefWith({ tag: item.name })}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  #{item.name}
                  <span className="ml-1 text-muted-foreground">
                    {item.count}
                  </span>
                </Link>
              ))}
          </div>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="mx-2 flex min-h-[40vh] flex-col items-center justify-center rounded-md border p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            {hasFilters ? (
              <Search className="h-8 w-8 text-primary" />
            ) : (
              <File className="h-8 w-8 text-primary" />
            )}
          </div>
          <h3 className="mt-6 text-xl font-semibold">
            {hasFilters ? "No matching notes" : "No notes yet"}
          </h3>
          <p className="mb-6 mt-2 max-w-sm text-muted-foreground">
            {hasFilters
              ? "Try a different search, tag or sort order."
              : "Write your first note and it will show up here."}
          </p>

          {hasFilters ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard">Clear filters</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/new">Create your first note</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggleFavorite={toggleFavorite}
              onTrash={moveToTrash}
            />
          ))}
        </div>
      )}
    </div>
  );
}
