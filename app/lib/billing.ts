import prisma from "./db";
import { env, isMockBilling } from "./env";
import { requireStripe } from "@/lib/stripe";

/** Items a free account can create before upgrading (notes + snippets). */
export const FREE_NOTE_LIMIT = 10;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const MOCK_INTERVAL_SECONDS = 30 * 24 * 60 * 60;

export function isFreePlanLimitReached(noteCount: number, hasSubscription: boolean) {
  return !hasSubscription && noteCount >= FREE_NOTE_LIMIT;
}

export async function getSubscriptionStatus(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });

  return subscription?.status ?? null;
}

export async function hasActiveSubscription(userId: string) {
  const status = await getSubscriptionStatus(userId);
  return status !== null && ACTIVE_STATUSES.has(status);
}

/**
 * Development only: the "mock" billing provider activates a local
 * subscription so the product can be explored without Stripe keys.
 */
export async function activateMockSubscription(userId: string) {
  if (!isMockBilling) {
    throw new Error("activateMockSubscription is only available in mock mode");
  }

  const now = Math.floor(Date.now() / 1000);

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + MOCK_INTERVAL_SECONDS,
    },
    create: {
      userId,
      stripeSubscriptionId: `mock_${userId}`,
      status: "active",
      planId: "price_mock_monthly",
      interval: "month",
      currentPeriodStart: now,
      currentPeriodEnd: now + MOCK_INTERVAL_SECONDS,
    },
  });
}

export async function cancelMockSubscription(userId: string) {
  if (!isMockBilling) {
    throw new Error("cancelMockSubscription is only available in mock mode");
  }

  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: "canceled" },
  });
}

export async function ensureStripeCustomer({
  userId,
  email,
}: {
  userId: string;
  email: string;
}): Promise<string | null> {
  if (isMockBilling) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await requireStripe().customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/** Returns a Stripe Checkout URL, or activates the mock plan in dev. */
export async function createCheckoutUrl({
  userId,
  email,
  origin,
}: {
  userId: string;
  email: string;
  origin: string;
}): Promise<string> {
  if (isMockBilling) {
    await activateMockSubscription(userId);
    return `${origin}/payment/success`;
  }

  if (!env.STRIPE_PRICE_ID) {
    throw new Error("STRIPE_PRICE_ID is not configured");
  }

  const customerId = await ensureStripeCustomer({ userId, email });

  if (!customerId) {
    throw new Error("Could not resolve the Stripe customer");
  }

  const session = await requireStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    payment_method_types: ["card"],
    customer_update: { address: "auto", name: "auto" },
    success_url: `${origin}/payment/success`,
    cancel_url: `${origin}/payment/cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

/** Returns a Stripe Billing Portal URL so users can manage their own plan. */
export async function createPortalUrl({
  userId,
  origin,
}: {
  userId: string;
  origin: string;
}): Promise<string> {
  if (isMockBilling) {
    throw new Error("The billing portal is not available in mock mode");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error("This account has no billing customer yet");
  }

  const session = await requireStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return session.url;
}
