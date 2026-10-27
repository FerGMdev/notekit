import { LoginLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/app/lib/auth";
import { FREE_NOTE_LIMIT } from "@/app/lib/billing";
import { isDevAuth } from "@/app/lib/env";
import { Lock, PenLine, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const highlights = [
  {
    icon: PenLine,
    title: "Write without friction",
    body: "A distraction-free editor that saves as you type. Markdown keeps your notes portable forever.",
  },
  {
    icon: Search,
    title: "Find anything",
    body: "Search across titles and content, filter by tag, and keep what matters one click away in favourites.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "Every note belongs to exactly one account, enforced in the database query — not hidden behind a button.",
  },
];

export default async function Home() {
  const user = await getSessionUser();
  const isDemo = isDevAuth;

  if (user && !isDemo) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-[90vh] w-full max-w-6xl flex-col justify-center px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center rounded-full border bg-secondary px-4 py-1.5 text-sm font-medium text-muted-foreground">
          {isDemo ? "Demo mode — no sign-up required" : "Now in beta — free to use"}
        </span>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
          Notes that stay{" "}
          <span className="text-primary">out of your way</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
          A fast, private place to write. Markdown, tags and search that work,
          with a free plan that is actually usable.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isDemo ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Open the demo</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <LoginLink>Start writing for free</LoginLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <LoginLink>Sign in</LoginLink>
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {isDemo
            ? "You are signed in as a local demo user."
            : `No credit card. ${FREE_NOTE_LIMIT} notes on the free plan.`}
        </p>
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {highlights.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
