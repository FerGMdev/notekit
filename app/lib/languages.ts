/**
 * The languages a snippet can be written in.
 *
 * The ids double as highlight.js language names, so the same value drives the
 * filter, the badge and the syntax highlighter. Keeping the list curated is a
 * feature: a free-text language field becomes a dropdown of 20 lies ("js",
 * "JavaScript", "javascript "), and filtering stops working.
 */
export const LANGUAGE_IDS = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "php",
  "csharp",
  "cpp",
  "c",
  "sql",
  "bash",
  "json",
  "yaml",
  "xml",
  "css",
  "scss",
  "markdown",
  "graphql",
  "diff",
  "plaintext",
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const LANGUAGE_LABELS: Record<LanguageId, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  php: "PHP",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  sql: "SQL",
  bash: "Shell / Bash",
  json: "JSON",
  yaml: "YAML",
  xml: "HTML / XML",
  css: "CSS",
  scss: "SCSS",
  markdown: "Markdown",
  graphql: "GraphQL",
  diff: "Diff",
  plaintext: "Plain text",
};

const ALIASES: Record<string, LanguageId> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  golang: "go",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  html: "xml",
  md: "markdown",
  text: "plaintext",
  txt: "plaintext",
};

/**
 * Maps user input ("TS", "shell", "html") to a stored id. Unknown values return
 * `null` rather than guessing: a snippet with no language is honest, a snippet
 * labelled "javscript" is a bug.
 */
export function normalizeLanguage(value: unknown): LanguageId | null {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim().toLowerCase();

  if (!candidate) {
    return null;
  }

  if ((LANGUAGE_IDS as readonly string[]).includes(candidate)) {
    return candidate as LanguageId;
  }

  return ALIASES[candidate] ?? null;
}

export function languageLabel(value: string | null | undefined): string {
  const id = normalizeLanguage(value);
  return id ? LANGUAGE_LABELS[id] : "Snippet";
}

/** The first fenced code block in a Markdown body, if there is one. */
export function extractCodeBlock(
  markdown: string
): { language: string | null; code: string } | null {
  const match = markdown.match(/```([^\n`]*)\r?\n([\s\S]*?)```/);

  if (!match) {
    return null;
  }

  return {
    language: normalizeLanguage(match[1]),
    code: match[2].replace(/\s+$/, ""),
  };
}

/** Builds the canonical description for a snippet created from the form. */
export function buildSnippetMarkdown({
  code,
  language,
  notes,
}: {
  code: string;
  language: LanguageId;
  notes?: string;
}): string {
  const body = `\`\`\`${language}\n${code.replace(/\s+$/, "")}\n\`\`\``;
  const trimmedNotes = notes?.trim();

  return trimmedNotes ? `${body}\n\n${trimmedNotes}` : body;
}
