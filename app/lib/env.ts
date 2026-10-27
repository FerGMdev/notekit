import { z } from "zod";

/**
 * Environment access goes through this module so a misconfiguration fails
 * once, loudly, instead of surfacing as a confusing runtime error deep in a
 * request (for example `new Stripe(undefined)` at import time).
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (Postgres connection string)"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  /* "stripe" charges real subscriptions; "mock" keeps the product usable in
     development without Stripe keys. When unset, infer from the secret key. */
  BILLING_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["stripe", "mock"]).optional()
  ),

  STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_PRICE_ID: z.preprocess(emptyToUndefined, z.string().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

export const billingProvider: "stripe" | "mock" =
  env.BILLING_PROVIDER ?? (env.STRIPE_SECRET_KEY ? "stripe" : "mock");

export const isMockBilling = billingProvider === "mock";

if (isMockBilling && env.NODE_ENV === "production") {
  console.warn(
    "[billing] BILLING_PROVIDER=mock in production: subscriptions will not be charged."
  );
}
