import { describe, expect, it } from "vitest";
import {
  exportFilename,
  notesToMarkdownBundle,
  noteToMarkdown,
  slugify,
} from "@/app/lib/export";

/**
 * Export is a promise about portability: whatever we write must be valid
 * Markdown with parseable YAML frontmatter, including titles that contain
 * quotes, colons or accents.
 */

const base = {
  title: "Deploy runbook",
  description: "# Deploy\n\nRun the migration first.",
  tags: ["ops", "engineering"],
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  updatedAt: new Date("2026-02-03T04:05:06.000Z"),
};

describe("noteToMarkdown", () => {
  it("writes frontmatter, metadata and the body", () => {
    const markdown = noteToMarkdown(base);

    expect(markdown.startsWith("---\n")).toBe(true);
    expect(markdown).toContain('title: "Deploy runbook"');
    expect(markdown).toContain("kind: note");
    expect(markdown).toContain('tags: ["ops", "engineering"]');
    expect(markdown).toContain("created: 2026-01-02T03:04:05.000Z");
    expect(markdown).toContain("updated: 2026-02-03T04:05:06.000Z");
    expect(markdown).toContain("Run the migration first.");
  });

  it("marks snippets with their language", () => {
    const markdown = noteToMarkdown({
      ...base,
      title: "Debounce",
      kind: "SNIPPET",
      language: "typescript",
    });

    expect(markdown).toContain("kind: snippet");
    expect(markdown).toContain("language: typescript");
  });

  it("escapes quotes so the frontmatter stays valid", () => {
    const markdown = noteToMarkdown({
      ...base,
      title: 'A "quoted" title: with a colon',
    });

    expect(markdown).toContain('title: "A \\"quoted\\" title: with a colon"');

    const frontmatter = markdown.split("\n---\n")[0];
    expect(frontmatter.split("\n").length).toBeGreaterThan(4);
  });

  it("keeps an empty tag list explicit", () => {
    expect(noteToMarkdown({ ...base, tags: [] })).toContain("tags: []");
  });
});

describe("filenames", () => {
  it("slugifies accents and punctuation", () => {
    expect(slugify("Diseño de APIs: guía rápida")).toBe(
      "diseno-de-apis-guia-rapida"
    );
  });

  it("never returns an empty name", () => {
    expect(slugify("***")).toBe("note");
    expect(exportFilename("***")).toBe("note.md");
  });

  it("produces a .md file name", () => {
    expect(exportFilename("Deploy runbook")).toBe("deploy-runbook.md");
  });
});

describe("bundle", () => {
  it("summarises the export and includes every item", () => {
    const bundle = notesToMarkdownBundle(
      [base, { ...base, title: "Second note" }],
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(bundle).toContain("# Notekit export");
    expect(bundle).toContain("2 items");
    expect(bundle).toContain('title: "Deploy runbook"');
    expect(bundle).toContain('title: "Second note"');
    expect(bundle.match(/^---$/gm)?.length).toBe(4);
  });

  it("says one item when there is one item", () => {
    expect(notesToMarkdownBundle([base])).toContain("1 item");
  });
});
