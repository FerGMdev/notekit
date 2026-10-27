import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-muted-foreground">
        The note may have been deleted, or it belongs to another account.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to your notes</Link>
      </Button>
    </div>
  );
}
