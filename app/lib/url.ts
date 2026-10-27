import { headers } from "next/headers";
import { env } from "./env";

/**
 * Absolute base URL for redirects (Stripe) and for links we hand to the user.
 * Prefers the incoming request so preview deployments work without extra
 * configuration, and falls back to `NEXT_PUBLIC_APP_URL`.
 */
export async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("host");

  if (host) {
    const forwardedProto = headersList.get("x-forwarded-proto");
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const protocol = forwardedProto ?? (isLocal ? "http" : "https");

    return `${protocol}://${host}`;
  }

  return env.NEXT_PUBLIC_APP_URL;
}
