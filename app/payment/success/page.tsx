import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SuccessRoute() {
  return (
    <div className="w-full min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">You&apos;re on Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your plan is active. Unlimited notes are now available.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link href="/dashboard">Back to your notes</Link>
        </Button>
      </Card>
    </div>
  );
}
