import type { AiProvider, AskAnswer } from "./types";
import { heuristicTags, heuristicSummary } from "./heuristic";
import { truncate } from "./types";

/**
 * Any OpenAI-compatible chat endpoint: OpenAI, Groq, OpenRouter, Together,
 * a local Ollama server or Neon's AI gateway. Only the base URL and model
 * change between them.
 */

export type OpenAiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const TIMEOUT_MS = 25_000;

type ChatMessage = { role: "system" | "user"; content: string };

function extractJson<T>(text: string, open: "[" | "{"): T | null {
  const close = open === "[" ? "]" : "}";
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);

  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function cleanTag(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const tag = raw
    .replace(/^#+/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 24);

  return tag.length > 0 ? tag : null;
}

export function createOpenAiProvider(config: OpenAiConfig): AiProvider {
  async function chat(messages: ChatMessage[], maxTokens: number) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `AI request failed (${response.status}): ${truncate(detail, 200)}`
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("AI response was empty");
    }

    return content;
  }

  return {
    name: `openai:${config.model}`,
    kind: "external",

    async summarize(note) {
      const content = await chat(
        [
          {
            role: "system",
            content:
              "You summarise personal notes. Reply with two plain sentences of prose. No preamble, no headings, no bullet points.",
          },
          {
            role: "user",
            content: `Title: ${note.title}\nTags: ${
              note.tags.join(", ") || "none"
            }\n\n${truncate(note.content, 6000)}`,
          },
        ],
        220
      );

      return truncate(content.replace(/\s+/g, " ").trim(), 400);
    },

    async suggestTags(note) {
      const content = await chat(
        [
          {
            role: "system",
            content:
              "You label personal notes. Reply with a JSON array of 3 to 5 lowercase tags and nothing else. Each tag is one word (hyphenated if needed), at most 24 characters, without '#'.",
          },
          {
            role: "user",
            content: `Title: ${note.title}\nExisting tags: ${
              note.tags.join(", ") || "none"
            }\n\n${truncate(note.content, 4000)}`,
          },
        ],
        120
      );

      const parsed = extractJson<unknown[]>(content, "[");

      if (!Array.isArray(parsed)) {
        return heuristicTags(note);
      }

      const existing = new Set(note.tags);
      const tags = Array.from(
        new Set(
          parsed
            .map(cleanTag)
            .filter(
              (tag): tag is string =>
                typeof tag === "string" && !existing.has(tag)
            )
        )
      ).slice(0, 8);

      return tags.length > 0 ? tags : heuristicTags(note);
    },

    async answer(question, notes): Promise<AskAnswer> {
      if (notes.length === 0) {
        return {
          answer: "You do not have any notes to search yet.",
          citedIds: [],
        };
      }

      const context = notes
        .map(
          (note) =>
            `id: ${note.id}\ntitle: ${note.title}\n${truncate(
              note.content,
              1800
            )}`
        )
        .join("\n\n---\n\n");

      const content = await chat(
        [
          {
            role: "system",
            content:
              "Answer the question using only the notes provided. If they do not contain the answer, say so. Reply with JSON only: {\"answer\": string, \"citedIds\": string[]}. 'answer' may use Markdown. 'citedIds' must be ids from the notes you actually used.",
          },
          {
            role: "user",
            content: `Question: ${question}\n\nNotes:\n\n${context}`,
          },
        ],
        500
      );

      const allowed = new Set(notes.map((note) => note.id));
      const parsed = extractJson<{ answer?: unknown; citedIds?: unknown }>(
        content,
        "{"
      );

      if (!parsed || typeof parsed.answer !== "string") {
        return {
          answer: content,
          citedIds: notes.slice(0, 2).map((note) => note.id),
        };
      }

      const citedIds = Array.isArray(parsed.citedIds)
        ? parsed.citedIds.filter(
            (id): id is string => typeof id === "string" && allowed.has(id)
          )
        : [];

      return {
        answer: parsed.answer,
        citedIds: Array.from(new Set(citedIds)),
      };
    },
  };
}

/** Re-exported so the service can fall back without importing two modules. */
export { heuristicSummary };
