import prisma from "@/app/lib/db";
import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getStripeSession, stripe } from "@/lib/stripe";
import {
  StripeSubscriptionCreationButton,
  StripeSubscriptionEditButton,
} from "@/app/components/SubmitButtons";

const features = [
  { name: "Unlimited Notes" },
  { name: "Unlimited Collections" },
  { name: "Unlimited Words" },
  { name: "Unlimited Characters" },
  { name: "Unlimited Tokens" },
];

/* Resolve the public base URL so Stripe redirects work in every environment. */
async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}

async function getData(userId: string) {
  const data = await prisma.subscription.findUnique({
    where: {
      userId: userId,
    },
    select: {
      status: true,
      user: {
        select: {
          stripeCustomerId: true,
        },
      },
    },
  });

  return data;
}
export default async function BillingPage() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  const userId = user?.id as string;
  const data = await getData(userId);

  async function createSubscription() {
    "use server";

    const dbUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!dbUser?.stripeCustomerId) {
      throw new Error("Unable to get stripe customer id");
    }

    const subscriptionUrl = await getStripeSession({
      customerId: dbUser.stripeCustomerId,
      domainUrl: await getBaseUrl(),
      priceId: process.env.STRIPE_PRICE_ID as string,
    });

    return redirect(subscriptionUrl);
  }

  async function createCustomerPortal() {
    "use server";

    const session = await stripe.billingPortal.sessions.create({
      customer: data?.user.stripeCustomerId as string,
      return_url: `${await getBaseUrl()}/dashboard/billing`,
    });

    return redirect(session.url);
  }

  if (data?.status === "active") {
    return (
      <div className="grid items-start gap-8">
        <div className="flex items-center justify-between px-2">
          <div className="grid gap-1">
            <h3 className="text-3xl font-medium">Subscription</h3>
            <p className="text-lg text-muted-foreground">
              Settings related to your subscription.
            </p>
          </div>
        </div>

        <Card className=" w-full lg:w-2/3">
          <CardHeader>
            <CardTitle>Edit Subscription</CardTitle>
            <CardDescription>
              Click on the button below to edit your subscription. This will
              give you the ability to change your plan or cancel your
              subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCustomerPortal}>
              <StripeSubscriptionEditButton />
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card className="flex flex-col gap-4">
        <CardContent className="py-8">
          <div>
            <h3 className="inline-flex px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wide uppercase">
              Monthly Billing
            </h3>
          </div>

          <div className="mt-4 flex items-baseline text-6xl font-extrabold">
            $30
            <span className="text-lg font-medium text-muted-foreground">
              /month
            </span>
          </div>
          <p className="text-lg mt-5 text-muted-foreground">
            Write as many notes as you want for $30 a Month.
          </p>
        </CardContent>
        <div className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8 bg-secondary rounded-lg m-1 space-y-6 sm:p-10 sm:pt-6">
          <ul className="space-y-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="ml-3 text-base font-medium leading-none">
                  {feature.name}
                </p>
              </li>
            ))}
          </ul>

          <form action={createSubscription}>
            <StripeSubscriptionCreationButton />
          </form>
        </div>
      </Card>
    </div>
  );
}
