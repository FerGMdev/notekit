import Link from "next/link";
import { ThemeToggle } from "@/app/components/Themetoggle";
import { Button } from "@/components/ui/button";
import {
  RegisterLink,
  LoginLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import UserNav from "@/app/components/UserNav";
import { getSessionUser } from "@/app/lib/auth";
import { isDevAuth } from "@/app/lib/env";

export async function Navbar() {
  const user = await getSessionUser();

  return (
    <nav className="border-b bg-background h-[10vh] flex items-center justify-center">
      <div className="container flex items-center justify-between">
        <Link href="/" aria-label="Notekit home">
          <h1 className="text-3xl font-bold">
            Note<span className="text-primary">kit</span>
          </h1>
        </Link>
        <div className="flex items-center gap-x-4">
          <ThemeToggle />

          {user ? (
            <UserNav
              user={user.name}
              email={user.email}
              imageUrl={user.picture ?? ""}
              isDemo={isDevAuth}
            />
          ) : (
            <div className="flex items-center gap-x-5">
              <LoginLink>
                <Button>Sign In</Button>
              </LoginLink>
              <RegisterLink>
                <Button variant="secondary">Sign Up</Button>
              </RegisterLink>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
