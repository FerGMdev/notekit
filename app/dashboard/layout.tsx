import { ReactNode } from "react";
import DashboardNav from "@/app/components/DashboardNav";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/app/lib/auth";
import { ensureUser } from "@/app/lib/users";

/* Everything under /dashboard is per-user, so it must never be prerendered. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  /* Mirror the identity provider user and make sure billing is set up. */
  await ensureUser(user);

  return (
    <div className="flex flex-col space-y-6 mt-10 justify-center items-center">
      <div className="container grid gap-12 md:grid-cols-[200px_1fr]">
        <aside className="hidden w-[200px] flex-col md:flex">
          <DashboardNav />
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
