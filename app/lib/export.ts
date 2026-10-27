import type { NoteSummary } from "./notes";

/**
 * Markdown export: the promise of "portable forever" has to be real, so the
 * export is plain text with YAML frontmatter — readable in Obsidian, Notion,
 * VS Code or a static site generator, with no vendor format involved.
 */

type ExportableNote = Pick<
  NoteSummary,
  "title" | "description" | "tags" | "createdAt" | "updatedAt"
> &
  Partial<Pick<NoteSummary, "kind" | "language">>;

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "note";
}

export function exportFilename(title: string): string {
  return `${slugify(title)}.md`;
}

/**
 * `JSON.stringify` produces a valid YAML double-quoted scalar, which keeps
 * titles containing quotes, colons or backslashes from corrupting the
 * frontmatter.
 */
export function noteToMarkdown(note: ExportableNote): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(note.title)}`,
    `kind: ${note.kind === "SNIPPET" ? "snippet" : "note"}`,
    ...(note.kind === "SNIPPET" && note.language
      ? [`language: ${note.language}`]
      : []),
    `tags: [${note.tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    `created: ${note.createdAt.toISOString()}`,
    `updated: ${note.updatedAt.toISOString()}`,
    "---",
  ].join("\n");

  return `${frontmatter}\n\n${note.description.trim()}\n`;
}

export function notesToMarkdownBundle(
  notes: ExportableNote[],
  exportedAt = new Date()
): string {
  const header = [
    "# Notekit export",
    "",
    `Exported ${exportedAt.toISOString()} · ${notes.length} ${
      notes.length === 1 ? "item" : "items"
    }`,
    "",
    "Each item starts with YAML frontmatter, so the file can be imported into any Markdown tool.",
    "",
  ].join("\n");

  return [header, ...notes.map(noteToMarkdown)].join("\n");
}
