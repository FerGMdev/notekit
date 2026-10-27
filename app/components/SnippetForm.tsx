import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_IDS, LANGUAGE_LABELS } from "@/app/lib/languages";
import Link from "next/link";
import { SaveNoteButton } from "./SubmitButtons";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Snippets are created through a dedicated form because code wants a different
 * shape than prose: a language first, no Markdown fences to type by hand, and a
 * separate field for the explanation.
 */
export function SnippetForm({
  action,
  heading,
  description,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  heading: string;
  description: string;
  submitLabel: string;
}) {
  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              required
              id="title"
              type="text"
              name="title"
              maxLength={120}
              placeholder="Retry an async call with backoff"
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              name="language"
              defaultValue="typescript"
              className={selectClassName}
            >
              {LANGUAGE_IDS.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_LABELS[language]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Used for the badge, the language filter and syntax highlighting.
            </p>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="code">Code</Label>
            <Textarea
              required
              id="code"
              name="code"
              spellCheck={false}
              autoComplete="off"
              className="min-h-[280px] font-mono text-sm"
              placeholder={"export async function retry<T>(fn: () => Promise<T>) {\n  // ...\n}"}
            />
            <p className="text-xs text-muted-foreground">
              Paste the code as-is. Notekit wraps it in a fenced block for you.
            </p>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              className="min-h-[120px] text-sm"
              placeholder="When to use it, gotchas, a link to the docs…"
            />
            <p className="text-xs text-muted-foreground">Markdown is supported.</p>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              type="text"
              name="tags"
              placeholder="backend, reliability, typescript"
            />
            <p className="text-xs text-muted-foreground">
              Comma separated. Up to 8 tags.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/snippets">Cancel</Link>
          </Button>
          <SaveNoteButton label={submitLabel} />
        </CardFooter>
      </form>
    </Card>
  );
}
