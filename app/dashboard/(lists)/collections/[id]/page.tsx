import { NoteCard } from "@/app/components/NoteCard";
import { Button } from "@/components/ui/button";
import { DeleteCollectionButton } from "@/app/components/SubmitButtons";
import { getCollection, listNotes } from "@/app/lib/notes";
import { requireAppUser } from "@/app/lib/session";
import { ArrowLeft, FolderOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCollectionAction } from "../../../collections-actions";
import {
  moveToTrashAction,
  toggleFavoriteAction,
} from "../../../list-actions";

export const metadata = {
  title: "Collection",
};

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAppUser();

  /* Both queries filter by userId: a collection id from another account is
     simply not found. */
  const collection = await getCollection(user.id, id);

  if (!collection) {
    notFound();
  }

  const items = await listNotes(user.id, {
    collectionId: collection.id,
    sort: "updated",
  });

  return (
    <div className="grid items-start gap-y-6">
      <div className="grid gap-3 px-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/dashboard/collections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All collections
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="flex items-center gap-2 text-3xl md:text-4xl">
              <FolderOpen className="h-7 w-7 shrink-0 text-primary" />
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-muted-foreground">{collection.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {collection.noteCount}{" "}
              {collection.noteCount === 1 ? "item" : "items"}
            </p>
          </div>

          <form action={deleteCollectionAction} className="shrink-0">
            <input
              type="hidden"
              name="collectionId"
              value={collection.id}
            />
            <DeleteCollectionButton />
          </form>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mx-2 flex min-h-[35vh] flex-col items-center justify-center rounded-md border p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">
            This collection is empty
          </h3>
          <p className="mb-6 mt-2 max-w-sm text-muted-foreground">
            Open a note or snippet and choose this collection from its header.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Browse notes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/snippets">Browse snippets</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-2">
          {items.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggleFavorite={toggleFavoriteAction}
              onTrash={moveToTrashAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
