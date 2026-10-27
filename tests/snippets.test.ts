import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/app/lib/db";
import {
  CollectionNameTakenError,
  CollectionNotFoundError,
  NoteLimitError,
  NoteNotFoundError,
  countNotes,
  createCollection,
  createNote,
  deleteCollection,
  getCollection,
  getNote,
  listCollections,
  listLanguages,
  listNotes,
  listTags,
  setNoteCollection,
} from "@/app/lib/notes";
import {
  buildSnippetMarkdown,
  extractCodeBlock,
  normalizeLanguage,
} from "@/app/lib/languages";
import { FREE_NOTE_LIMIT } from "@/app/lib/billing";

/**
 * Snippets reuse the note pipeline, so the risky parts are the joins: a snippet
 * must never appear in the notes list, and a collection id from another account
 * must never be attachable to your item.
 */

const suffix = randomUUID();
const ownerId = `test-snippets-${suffix}`;
const strangerId = `test-snippets-stranger-${suffix}`;
const freeUserId = `test-snippets-free-${suffix}`;

const debounceCode = `export function debounce(fn: () => void, wait = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, wait);
  };
}`;

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@example.test`, name: "Owner" },
      { id: strangerId, email: `${strangerId}@example.test`, name: "Stranger" },
      { id: freeUserId, email: `${freeUserId}@example.test`, name: "Free" },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, strangerId, freeUserId] } },
  });
  await prisma.$disconnect();
});

describe("language helpers", () => {
  it("normalises aliases to the stored ids", () => {
    expect(normalizeLanguage("TS")).toBe("typescript");
    expect(normalizeLanguage(" shell ")).toBe("bash");
    expect(normalizeLanguage("html")).toBe("xml");
    expect(normalizeLanguage("javscript")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
  });

  it("builds and parses the canonical snippet body", () => {
    const markdown = buildSnippetMarkdown({
      code: debounceCode,
      language: "typescript",
      notes: "Use it on search inputs.",
    });

    expect(markdown.startsWith("```typescript\n")).toBe(true);
    expect(markdown).toContain("Use it on search inputs.");

    const block = extractCodeBlock(markdown);
    expect(block?.language).toBe("typescript");
    expect(block?.code).toBe(debounceCode);
  });
});

describe("snippets", () => {
  it("stores kind and language, and never leaks into the notes list", async () => {
    const note = await createNote(ownerId, {
      title: "Prose only",
      description: "A normal note.",
      tags: ["prose"],
    });

    const snippet = await createNote(ownerId, {
      title: "Debounce",
      description: buildSnippetMarkdown({
        code: debounceCode,
        language: "typescript",
      }),
      tags: ["code"],
      kind: "SNIPPET",
      language: "ts",
    });

    expect(snippet.kind).toBe("SNIPPET");
    expect(snippet.language).toBe("typescript");

    const notes = await listNotes(ownerId, { kind: "NOTE" });
    const snippets = await listNotes(ownerId, { kind: "SNIPPET" });

    expect(notes.map((item) => item.id)).toContain(note.id);
    expect(notes.map((item) => item.id)).not.toContain(snippet.id);
    expect(snippets.map((item) => item.id)).toEqual([snippet.id]);

    const bySearch = await listNotes(ownerId, {
      kind: "SNIPPET",
      query: "clearTimeout",
    });
    expect(bySearch.map((item) => item.id)).toEqual([snippet.id]);
  });

  it("filters by language and counts languages", async () => {
    await createNote(ownerId, {
      title: "Read a file",
      description: buildSnippetMarkdown({
        code: "fs.readFileSync('notes.md', 'utf8')",
        language: "javascript",
      }),
      kind: "SNIPPET",
      language: "javascript",
    });

    const typescript = await listNotes(ownerId, {
      kind: "SNIPPET",
      language: "typescript",
    });

    expect(typescript.map((item) => item.title)).toEqual(["Debounce"]);

    const languages = await listLanguages(ownerId);
    expect(languages.find((item) => item.id === "typescript")?.count).toBe(1);
    expect(languages.find((item) => item.id === "javascript")?.count).toBe(1);
  });

  it("keeps tag counts separated by kind", async () => {
    const noteTags = await listTags(ownerId, { kind: "NOTE" });
    const snippetTags = await listTags(ownerId, { kind: "SNIPPET" });

    expect(noteTags.map((tag) => tag.name)).toContain("prose");
    expect(noteTags.map((tag) => tag.name)).not.toContain("code");
    expect(snippetTags.map((tag) => tag.name)).toContain("code");
  });
});

describe("collections", () => {
  it("creates collections and rejects case-insensitive duplicates", async () => {
    const collection = await createCollection(ownerId, {
      name: "Engineering handbook",
      description: "How we build.",
    });

    expect(collection.noteCount).toBe(0);

    await expect(
      createCollection(ownerId, { name: "engineering HANDBOOK" })
    ).rejects.toBeInstanceOf(CollectionNameTakenError);

    // The unique index is per account, not global.
    const other = await createCollection(strangerId, {
      name: "Engineering handbook",
    });
    expect(other.id).not.toBe(collection.id);
  });

  it("assigns items, filters by collection and detaches on delete", async () => {
    const collection = await listCollections(ownerId).then((items) => items[0]);
    const snippet = await listNotes(ownerId, { kind: "SNIPPET" }).then(
      (items) => items[0]
    );

    await setNoteCollection(ownerId, snippet.id, collection.id);

    const updated = await getCollection(ownerId, collection.id);
    expect(updated?.noteCount).toBe(1);
    expect(
      (await listNotes(ownerId, { collectionId: collection.id })).map(
        (item) => item.id
      )
    ).toEqual([snippet.id]);

    await deleteCollection(ownerId, collection.id);

    expect(await getCollection(ownerId, collection.id)).toBeNull();
    expect((await getNote(ownerId, snippet.id))?.collectionId).toBeNull();
  });

  it("does not let another account read or delete a collection", async () => {
    const strangerCollection = await listCollections(strangerId).then(
      (items) => items[0]
    );

    expect(await getCollection(ownerId, strangerCollection.id)).toBeNull();

    await expect(
      deleteCollection(ownerId, strangerCollection.id)
    ).rejects.toBeInstanceOf(CollectionNotFoundError);
  });

  it("refuses to attach a foreign collection or move a foreign note", async () => {
    const [strangerCollection] = await listCollections(strangerId);
    const ownerSnippet = await listNotes(ownerId, { kind: "SNIPPET" }).then(
      (items) => items[0]
    );

    await expect(
      setNoteCollection(ownerId, ownerSnippet.id, strangerCollection.id)
    ).rejects.toBeInstanceOf(CollectionNotFoundError);

    await expect(
      setNoteCollection(strangerId, ownerSnippet.id, strangerCollection.id)
    ).rejects.toBeInstanceOf(NoteNotFoundError);
  });
});

describe("free plan limit", () => {
  it("counts notes and snippets against the same limit", async () => {
    await prisma.note.createMany({
      data: Array.from({ length: FREE_NOTE_LIMIT - 1 }, (_, index) => ({
        title: `Free item ${index}`,
        description: "content",
        userId: freeUserId,
      })),
    });

    await createNote(freeUserId, {
      title: "One note to fill the plan",
      description: "content",
    });

    expect(await countNotes(freeUserId)).toBe(FREE_NOTE_LIMIT);

    await expect(
      createNote(freeUserId, {
        title: "A snippet beyond the limit",
        description: buildSnippetMarkdown({
          code: "const x = 1;",
          language: "typescript",
        }),
        kind: "SNIPPET",
        language: "typescript",
      })
    ).rejects.toBeInstanceOf(NoteLimitError);
  });
});
