import { z } from "zod";

/**
 * Environment access goes through this module so a misconfiguration fails
 * once, loudly, instead of surfacing as a confusing runtime error deep in a
 * request (for example `new Stripe(undefined)` at import time).
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (Postgres connection string)"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  /* "dev" signs every request in as a local demo user so the product can be
     explored without an identity provider. Rejected in production below. */
  AUTH_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["kinde", "dev"]).optional()
  ),
  KINDE_CLIENT_ID: optionalString,
  KINDE_CLIENT_SECRET: optionalString,
  KINDE_ISSUER_URL: optionalString,

  /* "stripe" charges real subscriptions; "mock" keeps the product usable in
     development without Stripe keys. When unset, infer from the secret key. */
  BILLING_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["stripe", "mock"]).optional()
  ),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_ID: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

/* --- Auth ---------------------------------------------------------------- */

const kindeConfigured = Boolean(
  env.KINDE_CLIENT_ID && env.KINDE_CLIENT_SECRET && env.KINDE_ISSUER_URL
);

export const authProvider: "kinde" | "dev" =
  env.AUTH_PROVIDER ?? (kindeConfigured ? "kinde" : "dev");

export const isDevAuth = authProvider === "dev";

/* `next build` runs with NODE_ENV=production, so the guard must not fire while
   a developer builds locally. It does fire on any real request (see auth.ts). */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (isDevAuth && env.NODE_ENV === "production" && !isBuildPhase) {
  throw new Error(
    "AUTH_PROVIDER=dev is a local demo mode and cannot run in production. " +
      "Configure Kinde and set AUTH_PROVIDER=kinde."
  );
}

/* --- Billing ------------------------------------------------------------- */

export const billingProvider: "stripe" | "mock" =
  env.BILLING_PROVIDER ?? (env.STRIPE_SECRET_KEY ? "stripe" : "mock");

export const isMockBilling = billingProvider === "mock";

if (isMockBilling && env.NODE_ENV === "production") {
  console.warn(
    "[billing] BILLING_PROVIDER=mock in production: subscriptions will not be charged."
  );
}
