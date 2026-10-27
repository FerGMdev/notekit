import prisma from "@/app/lib/db";
import { env } from "@/app/lib/env";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";

/**
 * Stripe webhook. Signature verification is mandatory: without it anyone could
 * POST a fake "subscription active" event and get Pro for free.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured) {
    return new Response("Stripe is not configured", { status: 503 });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response("STRIPE_WEBHOOK_SECRET is not configured", {
      status: 503,
    });
  }

  const stripe = requireStripe();
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return new Response("Webhook Error", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!session.subscription) {
      return new Response("Missing subscription", { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(
      String(session.subscription)
    );

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: String(session.customer) },
    });

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const subscriptionData = {
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      status: subscription.status,
      interval: subscription.items.data[0].price.recurring?.interval ?? "",
      stripeSubscriptionId: subscription.id,
      planId: subscription.items.data[0].price.id,
    };

    /* Upsert so retried or out-of-order events don't fail on the unique userId. */
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...subscriptionData },
      update: subscriptionData,
    });
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;

    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subscriptionId) {
      return new Response(null, { status: 200 });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        planId: subscription.items.data[0].price.id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        status: subscription.status,
      },
    });
  }

  return new Response(null, { status: 200 });
}
