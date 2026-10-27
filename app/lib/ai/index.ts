import { aiConfig, aiProviderName } from "../env";
import type { NoteSummary } from "../notes";
import { normalizeTags } from "../notes";
import { AiQuotaError } from "./errors";
import {
  heuristicAnswer,
  heuristicProvider,
  heuristicSummary,
  heuristicTags,
  queryTerms,
  scoreNote,
} from "./heuristic";
import { createOpenAiProvider } from "./openai";
import { consumeAiQuota } from "./quota";
import type { AiNote, AiProvider } from "./types";

/**
 * The AI service: provider selection, cost control and graceful degradation.
 *
 * If the external provider fails for any reason (network, quota, bad JSON), the
 * request still returns a useful heuristic answer and the UI says which provider
 * answered. AI should never be a hard dependency of writing a note.
 */

export const aiProvider: AiProvider =
  aiProviderName === "openai" && aiConfig.apiKey
    ? createOpenAiProvider({
        apiKey: aiConfig.apiKey,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
      })
    : heuristicProvider;

export const aiIsExternal = aiProvider.kind === "external";

export { AiQuotaError };

export type AiResult<T> = {
  value: T;
  provider: string;
  usedFallback: boolean;
};

function toAiNote(note: NoteSummary): AiNote {
  return {
    id: note.id,
    title: note.title,
    content: note.description,
    tags: note.tags,
  };
}

async function run<T>(
  userId: string,
  call: (provider: AiProvider) => Promise<T>,
  fallback: () => T
): Promise<AiResult<T>> {
  if (aiProvider.kind === "external") {
    /* Throws AiQuotaError, which callers surface as a normal message. */
    await consumeAiQuota(userId);
  }

  try {
    return {
      value: await call(aiProvider),
      provider: aiProvider.name,
      usedFallback: false,
    };
  } catch (error) {
    console.warn(
      "[ai] provider failed, using the built-in heuristic:",
      error instanceof Error ? error.message : error
    );

    return {
      value: fallback(),
      provider: heuristicProvider.name,
      usedFallback: true,
    };
  }
}

export async function summarizeNote(
  userId: string,
  note: NoteSummary
): Promise<AiResult<string>> {
  const aiNote = toAiNote(note);

  return run(
    userId,
    (provider) => provider.summarize(aiNote),
    () => heuristicSummary(aiNote)
  );
}

export async function suggestNoteTags(
  userId: string,
  note: NoteSummary
): Promise<AiResult<string[]>> {
  const aiNote = toAiNote(note);

  const result = await run(
    userId,
    (provider) => provider.suggestTags(aiNote),
    () => heuristicTags(aiNote)
  );

  return {
    ...result,
    value: normalizeTags(result.value).filter(
      (tag) => !note.tags.includes(tag)
    ),
  };
}

function rankForQuestion(question: string, notes: NoteSummary[]) {
  const terms = queryTerms(question);

  if (terms.length === 0) {
    return notes.slice(0, 6);
  }

  return notes
    .map((note) => ({ note, score: scoreNote(terms, toAiNote(note)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.note);
}

export type AskResult = {
  answer: string;
  provider: string;
  usedFallback: boolean;
  citations: { id: string; title: string }[];
};

export async function askNotes(
  userId: string,
  question: string,
  notes: NoteSummary[]
): Promise<AskResult> {
  const candidates = rankForQuestion(question, notes);
  const aiNotes = candidates.map(toAiNote);

  const result = await run(
    userId,
    (provider) => provider.answer(question, aiNotes),
    () => heuristicAnswer(question, aiNotes)
  );

  const byId = new Map(candidates.map((note) => [note.id, note]));

  const citations = result.value.citedIds
    .map((id) => byId.get(id))
    .filter((note): note is NoteSummary => Boolean(note))
    .map((note) => ({ id: note.id, title: note.title }));

  return {
    answer: result.value.answer,
    provider: result.provider,
    usedFallback: result.usedFallback,
    citations,
  };
}
