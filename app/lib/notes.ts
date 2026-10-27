import { z } from "zod";
import { Prisma, type NoteKind } from "@prisma/client";
import prisma from "./db";
import {
  FREE_NOTE_LIMIT,
  hasActiveSubscription,
  isFreePlanLimitReached,
} from "./billing";
import {
  LANGUAGE_IDS,
  LANGUAGE_LABELS,
  normalizeLanguage,
  type LanguageId,
} from "./languages";

/**
 * Notes and snippets domain layer.
 *
 * Every read and write takes a `userId` and filters by it in the query itself,
 * so "user B can touch user A's note" is impossible by construction rather
 * than by remembering to check it in each page. Server actions become thin
 * wrappers around these functions.
 */

export const MAX_TAGS_PER_NOTE = 8;
export const MAX_TAG_LENGTH = 24;

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TAG_LENGTH, `Tags must be ${MAX_TAG_LENGTH} characters or fewer`);

/* Accept "ts" or "Shell" from a form, store one canonical id. */
const languageSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? normalizeLanguage(value) ?? value : value,
  z.enum(LANGUAGE_IDS).nullable().optional()
);

/* Empty selects submit "" and mean "no collection". */
const collectionIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid("Invalid collection").nullable().optional()
);

export const noteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(50_000, "Content must be 50,000 characters or fewer"),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_NOTE, `A note can have at most ${MAX_TAGS_PER_NOTE} tags`)
    .optional(),
  kind: z.enum(["NOTE", "SNIPPET"]).optional(),
  language: languageSchema,
  collectionId: collectionIdSchema,
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export const collectionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Collection name cannot be empty")
    .max(60, "Collection names must be 60 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(300, "Descriptions must be 300 characters or fewer")
    .optional(),
});

export type NoteSummary = {
  id: string;
  title: string;
  description: string;
  kind: NoteKind;
  language: string | null;
  tags: string[];
  isFavorite: boolean;
  deletedAt: Date | null;
  summary: string | null;
  summaryUpdatedAt: Date | null;
  shareId: string | null;
  sharedAt: Date | null;
  collectionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SortOption = "updated" | "created" | "title";

export type ListNotesOptions = {
  query?: string;
  tag?: string;
  favoritesOnly?: boolean;
  trashed?: boolean;
  sort?: SortOption;
  kind?: NoteKind;
  language?: string;
  collectionId?: string;
};

export class NoteLimitError extends Error {
  readonly limit = FREE_NOTE_LIMIT;

  constructor() {
    super(
      `You reached the free plan limit of ${FREE_NOTE_LIMIT} items. Upgrade to Pro to keep writing.`
    );
    this.name = "NoteLimitError";
  }
}

export class NoteNotFoundError extends Error {
  constructor() {
    super("Note not found");
    this.name = "NoteNotFoundError";
  }
}

export class CollectionNotFoundError extends Error {
  constructor() {
    super("Collection not found");
    this.name = "CollectionNotFoundError";
  }
}

export class CollectionNameTakenError extends Error {
  constructor() {
    super("You already have a collection with that name.");
    this.name = "CollectionNameTakenError";
  }
}

export const noteSummarySelect = {
  id: true,
  title: true,
  description: true,
  kind: true,
  language: true,
  tags: true,
  isFavorite: true,
  deletedAt: true,
  summary: true,
  summaryUpdatedAt: true,
  shareId: true,
  sharedAt: true,
  collectionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Tags are lowercase and unique so `#Work` and `#work` are the same tag. */
export function normalizeTags(tags: string[] | undefined | null): string[] {
  if (!tags?.length) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  ).slice(0, MAX_TAGS_PER_NOTE);
}

const orderBy = {
  updated: { updatedAt: "desc" },
  created: { createdAt: "desc" },
  title: { title: "asc" },
} satisfies Record<SortOption, Prisma.NoteOrderByWithRelationInput>;

export async function listNotes(
  userId: string,
  options: ListNotesOptions = {}
): Promise<NoteSummary[]> {
  const where: Prisma.NoteWhereInput = {
    userId,
    deletedAt: options.trashed ? { not: null } : null,
  };

  if (options.favoritesOnly) {
    where.isFavorite = true;
  }

  if (options.kind) {
    where.kind = options.kind;
  }

  if (options.language) {
    where.language = normalizeLanguage(options.language) ?? options.language;
  }

  if (options.collectionId) {
    where.collectionId = options.collectionId;
  }

  if (options.tag) {
    where.tags = { has: options.tag };
  }

  const query = options.query?.trim().slice(0, 100);

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  return prisma.note.findMany({
    where,
    orderBy: orderBy[options.sort ?? "updated"],
    select: noteSummarySelect,
  });
}

export async function getNote(
  userId: string,
  noteId: string,
  options: { includeTrashed?: boolean } = {}
): Promise<NoteSummary | null> {
  return prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
      ...(options.includeTrashed ? {} : { deletedAt: null }),
    },
    select: noteSummarySelect,
  });
}

/** Active items only: trash must not keep a free account at the limit. */
export async function countNotes(
  userId: string,
  options: { kind?: NoteKind } = {}
) {
  return prisma.note.count({
    where: {
      userId,
      deletedAt: null,
      ...(options.kind ? { kind: options.kind } : {}),
    },
  });
}

/** Whether the account may create one more note. Used to render the UI. */
export async function canCreateNote(userId: string) {
  const [noteCount, isPro] = await Promise.all([
    countNotes(userId),
    hasActiveSubscription(userId),
  ]);

  return !isFreePlanLimitReached(noteCount, isPro);
}

/** `input` is `unknown` on purpose: server actions receive untrusted form data. */
export async function createNote(
  userId: string,
  input: unknown
): Promise<NoteSummary> {
  const data = noteInputSchema.parse(input);

  const [noteCount, isPro] = await Promise.all([
    countNotes(userId),
    hasActiveSubscription(userId),
  ]);

  if (isFreePlanLimitReached(noteCount, isPro)) {
    throw new NoteLimitError();
  }

  const kind = data.kind ?? "NOTE";
  const language = kind === "SNIPPET" ? data.language ?? null : null;
  const collectionId = data.collectionId ?? null;

  if (collectionId) {
    await requireCollection(userId, collectionId);
  }

  return prisma.note.create({
    data: {
      title: data.title,
      description: data.description,
      tags: normalizeTags(data.tags),
      kind,
      language,
      collectionId,
      userId,
    },
    select: noteSummarySelect,
  });
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: unknown
): Promise<void> {
  const data = noteInputSchema.parse(input);

  const payload: Prisma.NoteUpdateManyMutationInput = {
    title: data.title,
    description: data.description,
  };

  /* Only touch tags when the caller sent them, so an autosave of the body does
     not wipe the tags. */
  if (data.tags !== undefined) {
    payload.tags = normalizeTags(data.tags);
  }

  // `updateMany` with both id and userId is a single atomic statement: it
  // cannot be tricked into updating a row owned by someone else.
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: payload,
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

export async function setFavorite(
  userId: string,
  noteId: string,
  isFavorite: boolean
): Promise<void> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { isFavorite },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

/** Moves an item into a collection, or out of one when `collectionId` is null. */
export async function setNoteCollection(
  userId: string,
  noteId: string,
  collectionId: string | null
): Promise<void> {
  if (collectionId) {
    await requireCollection(userId, collectionId);
  }

  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { collectionId },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }

  if (collectionId) {
    /* Keep the collection list ordered by meaningful activity, not only creation. */
    await prisma.collection.updateMany({
      where: { id: collectionId, userId },
      data: { updatedAt: new Date() },
    });
  }
}

export async function setNoteSummary(
  userId: string,
  noteId: string,
  summary: string
): Promise<void> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { summary, summaryUpdatedAt: new Date() },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

export async function trashNote(
  userId: string,
  noteId: string
): Promise<void> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { deletedAt: new Date(), isFavorite: false },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

export async function restoreNote(
  userId: string,
  noteId: string
): Promise<void> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

export async function deleteNotePermanently(
  userId: string,
  noteId: string
): Promise<void> {
  const { count } = await prisma.note.deleteMany({
    where: { id: noteId, userId },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

/**
 * Tag cloud for the sidebar. Aggregated in application code: at a few thousand
 * notes this is one cheap query, and it keeps the schema simple. Move to a
 * materialised view if the corpus grows.
 */
export async function listTags(
  userId: string,
  options: { kind?: NoteKind } = {}
): Promise<{ name: string; count: number }[]> {
  const rows = await prisma.note.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(options.kind ? { kind: options.kind } : {}),
    },
    select: { tags: true },
  });

  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const tag of row.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
}

/** Language cloud for the snippets view, derived from what the account owns. */
export async function listLanguages(
  userId: string
): Promise<{ id: LanguageId; label: string; count: number }[]> {
  const rows = await prisma.note.findMany({
    where: { userId, deletedAt: null, kind: "SNIPPET" },
    select: { language: true },
  });

  const counts = new Map<LanguageId, number>();

  for (const row of rows) {
    const language = normalizeLanguage(row.language);

    if (language) {
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([id, count]) => ({
    id,
    label: LANGUAGE_LABELS[id],
    count,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const collectionSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listCollections(
  userId: string
): Promise<CollectionSummary[]> {
  const [rows, counts] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: collectionSelect,
    }),
    prisma.note.groupBy({
      by: ["collectionId"],
      where: { userId, deletedAt: null, collectionId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countsByCollection = new Map(
    counts
      .filter((row) => row.collectionId !== null)
      .map((row) => [row.collectionId as string, row._count._all])
  );

  return rows.map((collection) => ({
    ...collection,
    noteCount: countsByCollection.get(collection.id) ?? 0,
  }));
}

export async function getCollection(
  userId: string,
  collectionId: string
): Promise<CollectionSummary | null> {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: collectionSelect,
  });

  if (!collection) {
    return null;
  }

  const noteCount = await prisma.note.count({
    where: { userId, collectionId, deletedAt: null },
  });

  return { ...collection, noteCount };
}

export async function createCollection(
  userId: string,
  input: unknown
): Promise<CollectionSummary> {
  const data = collectionInputSchema.parse(input);

  /* Case-insensitive check first so "Handbook" and "handbook" collide with a
     useful message; the unique index still guards the race. */
  const existing = await prisma.collection.findFirst({
    where: {
      userId,
      name: { equals: data.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    throw new CollectionNameTakenError();
  }

  try {
    const collection = await prisma.collection.create({
      data: {
        userId,
        name: data.name,
        description: data.description?.trim() || null,
      },
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });

    return { ...collection, noteCount: 0 };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CollectionNameTakenError();
    }

    throw error;
  }
}

export async function deleteCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  const { count } = await prisma.collection.deleteMany({
    where: { id: collectionId, userId },
  });

  if (count === 0) {
    throw new CollectionNotFoundError();
  }
}

/** Used before assigning an item so a valid collection UUID from another
 * account cannot be attached to this user's note. */
async function requireCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });

  if (!collection) {
    throw new CollectionNotFoundError();
  }
}
