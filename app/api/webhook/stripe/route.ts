import prisma from "@/app/lib/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
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
      session.subscription as string
    );

    const customerId = String(session.customer);

    const user = await prisma.user.findUnique({
      where: {
        stripeCustomerId: customerId,
      },
    });

    if (!user) {
      return new Response("User not found...", { status: 404 });
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

    await prisma.subscription.update({
      where: {
        stripeSubscriptionId: subscription.id,
      },
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
