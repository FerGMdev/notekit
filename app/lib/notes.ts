import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "./db";
import {
  FREE_NOTE_LIMIT,
  hasActiveSubscription,
  isFreePlanLimitReached,
} from "./billing";

/**
 * Note domain layer.
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
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export type NoteSummary = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  deletedAt: Date | null;
  summary: string | null;
  summaryUpdatedAt: Date | null;
  shareId: string | null;
  sharedAt: Date | null;
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
};

export class NoteLimitError extends Error {
  readonly limit = FREE_NOTE_LIMIT;

  constructor() {
    super(
      `You reached the free plan limit of ${FREE_NOTE_LIMIT} notes. Upgrade to Pro to keep writing.`
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

export const noteSummarySelect = {
  id: true,
  title: true,
  description: true,
  tags: true,
  isFavorite: true,
  deletedAt: true,
  summary: true,
  summaryUpdatedAt: true,
  shareId: true,
  sharedAt: true,
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

/** Active notes only: trash must not keep a free account at the limit. */
export async function countNotes(userId: string) {
  return prisma.note.count({ where: { userId, deletedAt: null } });
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

  return prisma.note.create({
    data: {
      title: data.title,
      description: data.description,
      tags: normalizeTags(data.tags),
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
  userId: string
): Promise<{ name: string; count: number }[]> {
  const rows = await prisma.note.findMany({
    where: { userId, deletedAt: null },
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
