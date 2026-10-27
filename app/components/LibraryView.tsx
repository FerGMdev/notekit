import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteCard } from "@/app/components/NoteCard";
import { FREE_NOTE_LIMIT, hasActiveSubscription } from "@/app/lib/billing";
import {
  countNotes,
  listLanguages,
  listNotes,
  listTags,
  type SortOption,
} from "@/app/lib/notes";
import { LANGUAGE_LABELS, normalizeLanguage } from "@/app/lib/languages";
import { requireAppUser } from "@/app/lib/session";
import { cn } from "@/lib/utils";
import { Code2, Download, File, Plus, Search, Star } from "lucide-react";
import Link from "next/link";
import { moveToTrashAction, toggleFavoriteAction } from "@/app/dashboard/list-actions";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title" },
];

/**
 * One browser for two kinds of content. Notes and snippets share search, tags,
 * favourites, sorting, plan usage and cards; only the language filter and a
 * handful of labels differ, so a second near-identical page would be a bug
 * waiting to be fixed twice.
 */
export async function LibraryView({
  kind,
  basePath,
  searchParams,
}: {
  kind: "NOTE" | "SNIPPET";
  basePath: "/dashboard" | "/dashboard/snippets";
  searchParams: SearchParams;
}) {
  const user = await requireAppUser();
  const snippet = kind === "SNIPPET";

  const query = (first(searchParams.q) ?? "").trim().slice(0, 120);
  const tag = (first(searchParams.tag) ?? "").trim().slice(0, 24);
  const favoritesOnly = first(searchParams.fav) === "1";
  const language = snippet
    ? normalizeLanguage(first(searchParams.language)) ?? ""
    : "";
  const sortParam = first(searchParams.sort);
  const sort: SortOption =
    sortParam === "created" || sortParam === "title" ? sortParam : "updated";

  const [notes, isPro, tags, total, totalItems, languages] = await Promise.all([
    listNotes(user.id, {
      query,
      tag,
      favoritesOnly,
      sort,
      kind,
      language: language || undefined,
    }),
    hasActiveSubscription(user.id),
    listTags(user.id, { kind }),
    countNotes(user.id, { kind }),
    countNotes(user.id),
    snippet ? listLanguages(user.id) : Promise.resolve([]),
  ]);

  const remaining = Math.max(0, FREE_NOTE_LIMIT - totalItems);
  const canCreate = isPro || remaining > 0;
  const hasFilters = Boolean(query || tag || favoritesOnly || language);

  const hrefWith = (overrides: {
    q?: string;
    tag?: string;
    sort?: SortOption;
    fav?: boolean;
    language?: string;
  }) => {
    const search = new URLSearchParams();
    const next = {
      q: overrides.q ?? query,
      tag: overrides.tag ?? tag,
      sort: overrides.sort ?? sort,
      fav: overrides.fav ?? favoritesOnly,
      language: overrides.language ?? language,
    };

    if (next.q) search.set("q", next.q);
    if (next.tag) search.set("tag", next.tag);
    if (next.sort !== "updated") search.set("sort", next.sort);
    if (next.fav) search.set("fav", "1");
    if (next.language) search.set("language", next.language);

    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="grid items-start gap-y-6">
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <h1 className="flex items-center gap-2 text-3xl md:text-4xl">
            {snippet && <Code2 className="h-7 w-7 text-primary" />}
            {snippet ? "Snippets" : "Your notes"}
          </h1>
          <p className="text-muted-foreground">
            {total === 0
              ? snippet
                ? "Reusable code you can find again."
                : "Nothing here yet."
              : snippet
                ? `${total} ${total === 1 ? "snippet" : "snippets"} · ${
                    languages.length
                  } ${languages.length === 1 ? "language" : "languages"}`
                : `${total} ${total === 1 ? "note" : "notes"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/dashboard/export" download>
              <Download className="mr-2 h-4 w-4" />
              Export all
            </a>
          </Button>

          {canCreate ? (
            <Button asChild>
              <Link href={snippet ? "/dashboard/snippets/new" : "/dashboard/new"}>
                <Plus className="mr-2 h-4 w-4" />
                {snippet ? "New snippet" : "New note"}
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/billing">Upgrade to Pro</Link>
            </Button>
          )}
        </div>
      </div>

      {!isPro && (
        <div className="mx-2 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Free plan</span>
            <span className="text-muted-foreground">
              {totalItems} / {FREE_NOTE_LIMIT} items
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (totalItems / FREE_NOTE_LIMIT) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Notes and snippets share the same limit.
          </p>
        </div>
      )}

      {/* Search + filters */}
      <div className="mx-2 grid gap-3">
        <form method="get" action={basePath} className="flex gap-2">
          {tag && <input type="hidden" name="tag" value={tag} />}
          {favoritesOnly && <input type="hidden" name="fav" value="1" />}
          {language && (
            <input type="hidden" name="language" value={language} />
          )}
          {sort !== "updated" && (
            <input type="hidden" name="sort" value={sort} />
          )}

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder={
                snippet ? "Search title, code or notes…" : "Search title or content…"
              }
              className="pl-9"
              aria-label={snippet ? "Search snippets" : "Search notes"}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" asChild>
              <Link href={basePath}>Clear</Link>
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
            {snippet ? "All snippets" : "All notes"}
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

        {snippet && languages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Languages
            </span>
            {language && (
              <Link
                href={hrefWith({ language: "" })}
                className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
              >
                {LANGUAGE_LABELS[language]} ×
              </Link>
            )}
            {languages
              .filter((item) => item.id !== language)
              .map((item) => (
                <Link
                  key={item.id}
                  href={hrefWith({ language: item.id })}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium hover:bg-accent"
                >
                  {item.label}
                  <span className="ml-1 text-muted-foreground">{item.count}</span>
                </Link>
              ))}
          </div>
        )}

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
            ) : snippet ? (
              <Code2 className="h-8 w-8 text-primary" />
            ) : (
              <File className="h-8 w-8 text-primary" />
            )}
          </div>
          <h3 className="mt-6 text-xl font-semibold">
            {hasFilters
              ? `No matching ${snippet ? "snippets" : "notes"}`
              : snippet
                ? "No snippets yet"
                : "No notes yet"}
          </h3>
          <p className="mb-6 mt-2 max-w-sm text-muted-foreground">
            {hasFilters
              ? "Try a different search, tag, language or sort order."
              : snippet
                ? "Save a function, a query or a config you keep looking up."
                : "Write your first note and it will show up here."}
          </p>

          {hasFilters ? (
            <Button variant="outline" asChild>
              <Link href={basePath}>Clear filters</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link
                href={snippet ? "/dashboard/snippets/new" : "/dashboard/new"}
              >
                {snippet ? "Create your first snippet" : "Create your first note"}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggleFavorite={toggleFavoriteAction}
              onTrash={moveToTrashAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
