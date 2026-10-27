import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/app/lib/db";
import {
  countNotes,
  createNote,
  getNote,
  listNotes,
  listTags,
  normalizeTags,
  restoreNote,
  setFavorite,
  trashNote,
} from "@/app/lib/notes";

/**
 * Organisation rules: search, tags, favourites, trash and restore.
 * These run against the same Postgres database as the app.
 */

const suffix = randomUUID();
const userId = `test-org-${suffix}`;

async function seedNote(title: string, description: string, tags: string[] = []) {
  return createNote(userId, { title, description, tags });
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: userId, email: `${userId}@example.test`, name: "Org" },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("tags", () => {
  it("normalises to lowercase, trims and deduplicates", () => {
    expect(normalizeTags(["  Work ", "work", "", "IDEA"])).toEqual([
      "work",
      "idea",
    ]);
  });

  it("filters notes by tag", async () => {
    await seedNote("Tagged note", "content", ["work"]);
    await seedNote("Other note", "content", ["personal"]);

    const work = await listNotes(userId, { tag: "work" });
    const personal = await listNotes(userId, { tag: "personal" });

    expect(work.map((note) => note.title)).toEqual(["Tagged note"]);
    expect(personal.map((note) => note.title)).toEqual(["Other note"]);
  });

  it("counts tags across active notes", async () => {
    const tags = await listTags(userId);
    const work = tags.find((tag) => tag.name === "work");

    expect(work?.count).toBeGreaterThanOrEqual(1);
  });
});

describe("search", () => {
  it("matches title and content, case-insensitively", async () => {
    await seedNote("Postgres notes", "Indexes and migrations");

    const byTitle = await listNotes(userId, { query: "postgres" });
    const byContent = await listNotes(userId, { query: "MIGRATIONS" });

    expect(byTitle.some((note) => note.title === "Postgres notes")).toBe(true);
    expect(byContent.some((note) => note.title === "Postgres notes")).toBe(
      true
    );
  });
});

describe("favourites", () => {
  it("toggles a favourite and filters by it", async () => {
    const note = await seedNote("Favourite me", "content");

    await setFavorite(userId, note.id, true);

    const favourites = await listNotes(userId, { favoritesOnly: true });
    expect(favourites.map((item) => item.id)).toContain(note.id);

    await setFavorite(userId, note.id, false);

    const afterToggle = await listNotes(userId, { favoritesOnly: true });
    expect(afterToggle.map((item) => item.id)).not.toContain(note.id);
  });
});

describe("trash", () => {
  it("hides a note from lists, search and the plan count until restored", async () => {
    const before = await countNotes(userId);
    const note = await seedNote("Disposable", "findable content", ["temp"]);

    expect(await countNotes(userId)).toBe(before + 1);

    await trashNote(userId, note.id);

    expect(await getNote(userId, note.id)).toBeNull();
    expect((await listNotes(userId)).map((item) => item.id)).not.toContain(
      note.id
    );
    expect(
      (await listNotes(userId, { query: "findable" })).map((item) => item.id)
    ).not.toContain(note.id);

    const trashed = await listNotes(userId, { trashed: true });
    expect(trashed.map((item) => item.id)).toContain(note.id);

    await restoreNote(userId, note.id);

    expect(await getNote(userId, note.id)).not.toBeNull();
    expect((await listNotes(userId)).map((item) => item.id)).toContain(
      note.id
    );
  });

  it("does not count trashed notes towards the plan limit", async () => {
    const note = await seedNote("Trashed slot", "content");
    const withNote = await countNotes(userId);

    await trashNote(userId, note.id);

    expect(await countNotes(userId)).toBe(withNote - 1);
  });
});
