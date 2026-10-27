"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/app/lib/auth";
import {
  CollectionNameTakenError,
  CollectionNotFoundError,
  createCollection,
  deleteCollection,
} from "@/app/lib/notes";

const COLLECTIONS_PATH = "/dashboard/collections";

export async function createCollectionAction(formData: FormData) {
  const user = await requireUser();

  try {
    await createCollection(user.id, {
      name: formData.get("name"),
      description: formData.get("description"),
    });
  } catch (error) {
    if (error instanceof CollectionNameTakenError) {
      redirect(`${COLLECTIONS_PATH}?error=name`);
    }

    if (error instanceof ZodError) {
      redirect(`${COLLECTIONS_PATH}?error=invalid`);
    }

    throw error;
  }

  revalidatePath("/dashboard", "layout");
  redirect(COLLECTIONS_PATH);
}

export async function deleteCollectionAction(formData: FormData) {
  const user = await requireUser();
  const collectionId = String(formData.get("collectionId") ?? "");

  if (!collectionId) return;

  try {
    await deleteCollection(user.id, collectionId);
  } catch (error) {
    if (!(error instanceof CollectionNotFoundError)) throw error;
  }

  revalidatePath("/dashboard", "layout");
  redirect(COLLECTIONS_PATH);
}
