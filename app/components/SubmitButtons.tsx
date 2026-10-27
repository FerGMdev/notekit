"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Trash } from "lucide-react";
import { useFormStatus } from "react-dom";

export default function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? (
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Please wait...
        </Button>
      ) : (
        <Button className="text-white" type="submit">
          Save Now
        </Button>
      )}
    </>
  );
}

export function SaveNoteButton({ label = "Save note" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function StripeSubscriptionCreationButton() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? (
        <Button disabled className="w-full">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </Button>
      ) : (
        <Button className="w-full" type="submit">
          Create Subscription
        </Button>
      )}
    </>
  );
}

export function StripeSubscriptionEditButton() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? (
        <Button disabled className="w-fit">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </Button>
      ) : (
        <Button className="w-fit" type="submit">
          View payment details
        </Button>
      )}
    </>
  );
}

export function TrashNoteButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      variant="outline"
      size="icon"
      type="submit"
      disabled={pending}
      title="Move to trash"
      aria-label="Move to trash"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash className="h-4 w-4" />
      )}
    </Button>
  );
}

export function DeleteNoteButton() {
  const { pending } = useFormStatus();

  return (
    <>
      {pending ? (
        <Button variant="destructive" disabled size="icon">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      ) : (
        <Button variant="destructive" size="icon" type="submit">
          <Trash className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
