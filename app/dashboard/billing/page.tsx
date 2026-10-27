import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import {
  cancelMockSubscription,
  createCheckoutUrl,
  createPortalUrl,
  FREE_NOTE_LIMIT,
  getSubscriptionStatus,
} from "@/app/lib/billing";
import { isMockBilling } from "@/app/lib/env";
import { getBaseUrl } from "@/app/lib/url";
import {
  StripeSubscriptionCreationButton,
  StripeSubscriptionEditButton,
} from "@/app/components/SubmitButtons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const proFeatures = [
  "Unlimited notes and snippets",
  "Language-aware snippet search",
  "Collections for handbooks",
  "AI summaries and auto-tagging",
  "Public sharing links",
  "Markdown export",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await requireAppUser();
  const [status, { reason }] = await Promise.all([
    getSubscriptionStatus(user.id),
    searchParams,
  ]);

  const isActive = status === "active" || status === "trialing";

  async function subscribe() {
    "use server";

    const currentUser = await requireUser();
    const origin = await getBaseUrl();

    const url = await createCheckoutUrl({
      userId: currentUser.id,
      email: currentUser.email,
      origin,
    });

    redirect(url);
  }

  async function openPortal() {
    "use server";

    const currentUser = await requireUser();
    const origin = await getBaseUrl();

    const url = await createPortalUrl({ userId: currentUser.id, origin });

    redirect(url);
  }

  async function cancelMock() {
    "use server";

    const currentUser = await requireUser();
    await cancelMockSubscription(currentUser.id);
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard");
  }

  return (
    <div className="grid items-start gap-8">
      <div className="flex flex-col gap-2 px-2">
        <h1 className="text-3xl font-medium">Plan &amp; billing</h1>
        <p className="text-lg text-muted-foreground">
          {isActive
            ? "You are on the Pro plan."
            : `You are on the free plan (${FREE_NOTE_LIMIT} items).`}
        </p>
      </div>

      {reason === "limit" && (
        <div className="mx-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          You reached the free plan limit. Upgrade to keep writing.
        </div>
      )}

      {isMockBilling && (
        <div className="mx-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Demo billing.</strong> No card is
          charged: upgrading or cancelling only changes your plan locally.
        </div>
      )}

      {isActive ? (
        <Card className="w-full lg:w-2/3">
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              {isMockBilling
                ? "Cancel to go back to the free plan."
                : "Change your plan or cancel from the Stripe billing portal."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMockBilling ? (
              <form action={cancelMock}>
                <Button type="submit" variant="outline">
                  Cancel Pro plan
                </Button>
              </form>
            ) : (
              <form action={openPortal}>
                <StripeSubscriptionEditButton />
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>For trying the product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-4xl font-extrabold">
                $0
                <span className="text-base font-medium text-muted-foreground">
                  /month
                </span>
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Up to {FREE_NOTE_LIMIT} items
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Markdown editor
                </li>
              </ul>
              <Button disabled variant="outline" className="w-full">
                Your current plan
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>For people who live in their notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-4xl font-extrabold">
                $8
                <span className="text-base font-medium text-muted-foreground">
                  /month
                </span>
              </p>
              <ul className="space-y-2 text-sm">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <form action={subscribe}>
                <StripeSubscriptionCreationButton />
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
