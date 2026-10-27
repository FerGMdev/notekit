import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

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

/** Single read of the provider session, so swapping providers is localised. */
export const getSessionUser = async (): Promise<SessionUser | null> => {
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
