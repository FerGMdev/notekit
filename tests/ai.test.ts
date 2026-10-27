import { afterEach, describe, expect, it, vi } from "vitest";
import {
  heuristicAnswer,
  heuristicSummary,
  heuristicTags,
  queryTerms,
  scoreNote,
} from "@/app/lib/ai/heuristic";
import { createOpenAiProvider } from "@/app/lib/ai/openai";
import type { AiNote } from "@/app/lib/ai/types";

/**
 * The heuristic provider is the default in every environment without an API
 * key, so it is not a fallback to be embarrassed about: it is tested like a
 * feature. The external adapter is tested with a stubbed fetch so the suite
 * never depends on a network or a vendor account.
 */

const runbook: AiNote = {
  id: "note-runbook",
  title: "Deploy runbook",
  content: `# Deploy runbook

Merge to \`main\` and wait for CI. Then run the migration before deploying.

\`\`\`bash
npm run db:deploy
\`\`\`

The API runs behind a health check. Roll back by redeploying the previous build.`,
  tags: ["ops"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("heuristic summary", () => {
  it("strips Markdown and returns prose", () => {
    const summary = heuristicSummary(runbook);

    expect(summary).not.toContain("#");
    expect(summary).not.toContain("```");
    expect(summary.length).toBeLessThan(400);
    expect(summary).toMatch(/[.!?…]$/);
  });

  it("is deterministic", () => {
    expect(heuristicSummary(runbook)).toBe(heuristicSummary(runbook));
  });

  it("describes a note that is too short to summarise", () => {
    const summary = heuristicSummary({
      id: "short",
      title: "Scratch",
      content: "todo",
      tags: ["inbox"],
    });

    expect(summary).toContain("Scratch");
    expect(summary).toContain("#inbox");
  });
});

describe("heuristic tags", () => {
  it("extracts keywords, lowercases them and skips stopwords", () => {
    const tags = heuristicTags({
      id: "pg",
      title: "Postgres notes",
      content:
        "Postgres migrations are additive. Postgres indexes need a GIN index for search. The migration is safe to rerun.",
      tags: [],
    });

    expect(tags).toContain("postgres");
    expect(tags).not.toContain("the");
    expect(tags).not.toContain("are");
    expect(tags.length).toBeLessThanOrEqual(4);
    expect(tags[0]).toBe("postgres");
  });

  it("does not suggest tags the note already has", () => {
    const tags = heuristicTags({ ...runbook, tags: ["deploy", "runbook"] });

    expect(tags).not.toContain("deploy");
    expect(tags).not.toContain("runbook");
  });

  it("adds a code tag when the note contains fenced code", () => {
    expect(heuristicTags(runbook)).toContain("code");
  });
});

describe("retrieval", () => {
  const notes: AiNote[] = [
    runbook,
    {
      id: "note-review",
      title: "How we review code",
      content:
        "Keep diffs small. Every bug fix gets a test that fails before the fix.",
      tags: ["process"],
    },
    {
      id: "note-reading",
      title: "Reading list",
      content: "A Philosophy of Software Design. Designing Data-Intensive Applications.",
      tags: ["reading"],
    },
  ];

  it("drops stopwords from a natural-language question", () => {
    const terms = queryTerms("What does the deploy runbook say?");

    expect(terms).toContain("deploy");
    expect(terms).toContain("runbook");
    expect(terms).not.toContain("what");
    expect(terms).not.toContain("the");
  });

  it("weights a title match above a body match", () => {
    const terms = ["deploy"];

    expect(scoreNote(terms, runbook)).toBeGreaterThan(
      scoreNote(terms, notes[1])
    );
  });

  it("answers with the matching note as a citation", () => {
    const answer = heuristicAnswer("how do I deploy", notes);

    expect(answer.citedIds).toEqual(["note-runbook"]);
    expect(answer.answer).toContain("Deploy runbook");
    expect(answer.answer).toMatch(/health check|migration|redeploy/);
  });

  it("admits when nothing matches", () => {
    const answer = heuristicAnswer("invoices and taxes", notes);

    expect(answer.citedIds).toEqual([]);
    expect(answer.answer).toContain("could not find");
  });

  it("asks for a more specific question instead of guessing", () => {
    expect(heuristicAnswer("what about it", notes).citedIds).toEqual([]);
  });
});

describe("OpenAI-compatible adapter", () => {
  const provider = createOpenAiProvider({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    model: "test-model",
  });

  it("parses a JSON tag array and removes duplicates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '["Postgres","#Migrations","postgres","ops"]',
                  },
                },
              ],
            }),
            { status: 200 }
          )
      )
    );

    const tags = await provider.suggestTags({ ...runbook, tags: ["ops"] });

    expect(tags).toEqual(["postgres", "migrations"]);
  });

  it("falls back to heuristic tags when the model returns nonsense", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "I cannot help with that." } }],
            }),
            { status: 200 }
          )
      )
    );

    const tags = await provider.suggestTags(runbook);

    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain("code");
  });

  it("throws on an HTTP error so the service can degrade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 }))
    );

    await expect(provider.summarize(runbook)).rejects.toThrow(/429/);
  });
});
