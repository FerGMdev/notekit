import Stripe from "stripe";
import { env } from "@/app/lib/env";

/**
 * Stripe is instantiated lazily: `new Stripe(undefined)` throws at import time,
 * which used to make the whole app crash when billing was not configured.
 */

export const isStripeConfigured = Boolean(env.STRIPE_SECRET_KEY);

export const stripe = isStripeConfigured
  ? new Stripe(env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2024-09-30.acacia",
      typescript: true,
    })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY or use BILLING_PROVIDER=mock."
    );
  }

  return stripe;
}
