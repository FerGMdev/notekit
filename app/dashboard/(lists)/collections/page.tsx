import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeleteCollectionButton } from "@/app/components/SubmitButtons";
import { listCollections } from "@/app/lib/notes";
import { requireAppUser } from "@/app/lib/session";
import { AlertCircle, FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import {
  createCollectionAction,
  deleteCollectionAction,
} from "../../collections-actions";

export const metadata = {
  title: "Collections",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await requireAppUser();
  const collections = await listCollections(user.id);
  const { error } = await searchParams;

  return (
    <div className="grid items-start gap-y-6">
      <div className="grid gap-2 px-2">
        <h1 className="flex items-center gap-2 text-3xl md:text-4xl">
          <FolderOpen className="h-7 w-7 text-primary" />
          Collections
        </h1>
        <p className="text-muted-foreground">
          Group notes and snippets into a handbook, an onboarding guide or a
          project space. Collections organise; they never change who can read an
          item.
        </p>
      </div>

      {first(error) === "name" && (
        <p className="mx-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          You already have a collection with that name.
        </p>
      )}

      {first(error) === "invalid" && (
        <p className="mx-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          A collection needs a name of 60 characters or fewer.
        </p>
      )}

      <Card className="mx-2 p-4">
        <form
          action={createCollectionAction}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
        >
          <Input
            name="name"
            required
            maxLength={60}
            placeholder="Engineering handbook"
            aria-label="Collection name"
          />
          <Input
            name="description"
            maxLength={300}
            placeholder="What belongs here? (optional)"
            aria-label="Collection description"
          />
          <Button type="submit">
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </form>
      </Card>

      {collections.length === 0 ? (
        <div className="mx-2 flex min-h-[35vh] flex-col items-center justify-center rounded-md border p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">No collections yet</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Create one above, then pick it from the header of any note or snippet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 px-2 sm:grid-cols-2">
          {collections.map((collection) => (
            <Card
              key={collection.id}
              className="flex flex-col justify-between gap-4 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/dashboard/collections/${collection.id}`}
                    className="text-lg font-semibold text-primary hover:underline"
                  >
                    {collection.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {collection.description ?? "No description yet."}
                  </p>
                </div>

                <form action={deleteCollectionAction}>
                  <input
                    type="hidden"
                    name="collectionId"
                    value={collection.id}
                  />
                  <DeleteCollectionButton />
                </form>
              </div>

              <p className="text-xs text-muted-foreground">
                {collection.noteCount}{" "}
                {collection.noteCount === 1 ? "item" : "items"} · updated{" "}
                {dateFormatter.format(collection.updatedAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
