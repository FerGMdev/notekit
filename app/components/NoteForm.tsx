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
import Link from "next/link";
import { SaveNoteButton } from "./SubmitButtons";

type NoteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  heading: string;
  description: string;
  submitLabel: string;
  defaultValues?: {
    title: string;
    description: string;
  };
};

/** Shared shell so create and edit stay identical in behaviour and layout. */
export function NoteForm({
  action,
  heading,
  description,
  submitLabel,
  defaultValues,
}: NoteFormProps) {
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
              placeholder="Title for your note"
              defaultValue={defaultValues?.title}
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="description">Content</Label>
            <Textarea
              required
              id="description"
              name="description"
              className="min-h-[320px]"
              placeholder="Write your note here..."
              defaultValue={defaultValues?.description}
            />
            <p className="text-xs text-muted-foreground">
              Markdown is supported.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard">Cancel</Link>
          </Button>
          <SaveNoteButton label={submitLabel} />
        </CardFooter>
      </form>
    </Card>
  );
}
