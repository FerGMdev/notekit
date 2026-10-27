import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { isDevAuth } from "./env";

/**
 * The single place the app asks "who is calling?".
 *
 * Everything else depends on this narrow interface, so swapping or adding an
 * identity provider (for example company SSO) means touching this file only.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
};

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const DEV_USER: SessionUser = {
  id: "dev-user",
  email: "demo@notekit.local",
  name: "Demo User",
  picture: null,
};

/** Single read of the provider session, so swapping providers is localised. */
export const getSessionUser = async (): Promise<SessionUser | null> => {
  if (isDevAuth) {
    /* Fail closed: even if a build slipped through, requests never use the
       demo identity in production. */
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedError("Dev auth is disabled in production.");
    }

    return DEV_USER;
  }

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user?.id) {
    return null;
  }

  const name =
    [user.given_name, user.family_name].filter(Boolean).join(" ") ||
    user.email ||
    "Anonymous";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
    picture: user.picture ?? null,
  };
};

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}
