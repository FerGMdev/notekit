import {
  type AiNote,
  type AiProvider,
  type AskAnswer,
  splitSentences,
  stripMarkdown,
  truncate,
  words,
} from "./types";

/**
 * The no-key provider.
 *
 * This is not a stub: it is a small, deterministic extractive summariser and
 * keyword retriever. It gives every environment real behaviour (and honest
 * limits), keeps AI features testable, and means the product is never broken
 * because a vendor is down or a key is missing.
 */

const STOPWORDS = new Set(
  `
  a an and are as at be been being but by can could did do does doing for from
  had has have having he her here hers him his how i if in into is it its just
  like me more most my no not now of off on once only or other our out over own
  same she should so some such than that the their them then there these they
  this those through to too under until up very was we were what when where
  which while who whom why will with would you your
  al algo algunos ante antes aquel aquella aquellas aquellos aqui asi aun cada
  como con contra cual cuando de del desde donde dos el ella ellas ellos en
  entre era eran es esa esas ese eso esos esta estaba estado estan estar estas
  este esto estos fue fueron ha hacen hacer hacia han hasta hay la las le les lo
  los mas me mi mis mucho muy nada ni no nos nosotros o os otra otras otro otros
  para pero poco por porque que se sea segun ser si sin sobre sola solo son su
  sus tambien tan tanto te tiene tienen todo todos tu tus un una unas uno unos
  vosotros y ya yo
  `
    .split(/\s+/)
    .filter(Boolean)
);

/** Extra filler that is useless as a tag even though it is a real word. */
const TAG_STOPWORDS = new Set([
  ...STOPWORDS,
  "note",
  "notes",
  "using",
  "used",
  "use",
  "get",
  "got",
  "make",
  "made",
  "thing",
  "things",
  "want",
  "need",
  "also",
  "into",
  "about",
  "with",
  "from",
  "will",
]);

function isHeadingLike(sentence: string) {
  return sentence.length <= 40 && !/[.!?]$/.test(sentence);
}

function pickSentences(sentences: string[], maxCharacters: number) {
  const picked: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    if (picked.length >= 2) {
      break;
    }

    if (picked.length > 0 && length + sentence.length > maxCharacters) {
      break;
    }

    picked.push(sentence);
    length += sentence.length + 1;
  }

  return picked;
}

export function heuristicSummary(note: AiNote): string {
  const body = stripMarkdown(note.content);

  if (body.length < 24) {
    const tags = note.tags.length
      ? ` tagged ${note.tags.map((tag) => `#${tag}`).join(", ")}`
      : "";

    return `“${note.title}” is a short note${tags}.`;
  }

  const sentences = splitSentences(body).filter(
    (sentence) => sentence.toLowerCase() !== note.title.toLowerCase()
  );

  /* Prefer prose over headings: "Deploy runbook Getting started …" reads badly. */
  const prose = sentences.filter((sentence) => !isHeadingLike(sentence));
  const source = prose.length > 0 ? prose : sentences;

  const picked = pickSentences(source, 280);
  const text = truncate(picked.join(" ") || body, 300);

  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

export function heuristicTags(note: AiNote, limit = 4): string[] {
  const text = `${note.title} ${note.title} ${stripMarkdown(note.content)}`;
  const counts = new Map<string, number>();

  for (const word of words(text)) {
    if (word.length < 4 || word.length > 24) continue;
    if (/^\d+$/.test(word)) continue;
    if (TAG_STOPWORDS.has(word)) continue;

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const existing = new Set(note.tags);
  const hasCode = note.content.includes("```") && !existing.has("code");

  /* Reserve a slot: a note full of code has a tag keywords cannot express. */
  const ranked = Array.from(counts.entries())
    .filter(([word]) => !existing.has(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, hasCode ? Math.max(0, limit - 1) : limit)
    .map(([word]) => word);

  if (hasCode) {
    ranked.push("code");
  }

  return ranked;
}

export function queryTerms(question: string): string[] {
  return Array.from(
    new Set(
      words(question).filter(
        (word) => word.length >= 3 && !STOPWORDS.has(word)
      )
    )
  );
}

export function scoreNote(terms: string[], note: AiNote): number {
  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += 4;
    }

    /* Substring matching is deliberate: "deploy" should find "deployment". */
    score += content.split(term).length - 1;
  }

  return score;
}

export function bestSentence(terms: string[], note: AiNote, max = 240): string {
  const sentences = splitSentences(stripMarkdown(note.content));
  let best = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const score = terms.reduce(
      (total, term) => total + (lower.includes(term) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }

  return truncate(
    best || sentences[0] || stripMarkdown(note.content),
    max
  );
}

export function heuristicAnswer(question: string, notes: AiNote[]): AskAnswer {
  const terms = queryTerms(question);

  if (terms.length === 0) {
    return {
      answer:
        "Ask a more specific question — for example, “what does my deploy runbook say?”.",
      citedIds: [],
    };
  }

  const matches = notes
    .map((note) => ({ note, score: scoreNote(terms, note) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (matches.length === 0) {
    return {
      answer: `I could not find anything in your notes about “${truncate(
        question,
        80
      )}”. Try different words, or search the whole library.`,
      citedIds: [],
    };
  }

  const lines = matches.map(
    ({ note }) => `- **${note.title}** — ${bestSentence(terms, note)}`
  );

  return {
    answer: `From your notes:\n\n${lines.join("\n")}`,
    citedIds: matches.map((match) => match.note.id),
  };
}

export const heuristicProvider: AiProvider = {
  name: "heuristic",
  kind: "heuristic",
  async summarize(note) {
    return heuristicSummary(note);
  },
  async suggestTags(note) {
    return heuristicTags(note);
  },
  async answer(question, notes) {
    return heuristicAnswer(question, notes);
  },
};
