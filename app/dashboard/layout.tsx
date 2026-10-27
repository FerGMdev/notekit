import { ReactNode } from "react";
import DashboardNav from "@/app/components/DashboardNav";
import { redirect } from "next/navigation";
import { getAppUser } from "@/app/lib/session";
import { isDevAuth } from "@/app/lib/env";

/* Everything under /dashboard is per-user, so it must never be prerendered. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAppUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex flex-col space-y-6 mt-10 justify-center items-center">
      {isDevAuth && (
        <div className="container rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          <strong>Demo mode.</strong> You are signed in as{" "}
          <strong>{user.name}</strong>; notes are stored in your local database.
        </div>
      )}

      <div className="container grid gap-12 md:grid-cols-[200px_1fr]">
        <aside className="hidden w-[200px] flex-col md:flex">
          <DashboardNav />
        </aside>
        <main className="min-w-0 grid gap-6">
          <div className="md:hidden">
            <DashboardNav variant="horizontal" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
