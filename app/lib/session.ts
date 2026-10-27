import { cache } from "react";
import { getSessionUser, UnauthorizedError } from "./auth";
import { ensureUser } from "./users";

/**
 * Request-scoped "the signed-in user, mirrored into our database".
 *
 * Dashboard layout and page render concurrently, so if the layout is the only
 * one that runs `ensureUser`, the page can query before the first-run notes
 * exist. Wrapping it in React's `cache` makes both call sites share a single
 * promise per request: the page always awaits the user row (and its welcome
 * notes) before it lists anything.
 */
export const getAppUser = cache(async () => {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  await ensureUser(user);

  return user;
});

export async function requireAppUser() {
  const user = await getAppUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}
