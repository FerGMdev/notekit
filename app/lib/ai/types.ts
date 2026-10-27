/**
 * The AI seam.
 *
 * Every feature (summary, tags, ask-your-notes) is written against this
 * interface. The app ships with a deterministic, offline heuristic provider so
 * the features work with no key, no account and no network; an OpenAI-compatible
 * provider can be swapped in by setting `AI_API_KEY`.
 */

export type AiNote = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

export type AiProviderKind = "heuristic" | "external";

export type AskAnswer = {
  answer: string;
  citedIds: string[];
};

export interface AiProvider {
  readonly name: string;
  readonly kind: AiProviderKind;
  summarize(note: AiNote): Promise<string>;
  suggestTags(note: AiNote): Promise<string[]>;
  answer(question: string, notes: AiNote[]): Promise<AskAnswer>;
}

/** Drop Markdown syntax so summaries and keywords read like prose. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(/\s+/).filter(Boolean).length >= 3);
}

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9áéíóúüñ][a-z0-9áéíóúüñ+#._-]*/g) ?? [])
    .map((word) => word.replace(/[._-]+$/g, ""))
    .filter(Boolean);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1).trimEnd()}…`;
}
