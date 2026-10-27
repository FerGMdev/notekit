import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import Link from "next/link";

export default function CancelledRoute() {
  return (
    <div className="w-full min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You were not charged. You can upgrade whenever you are ready.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link href="/dashboard/billing">Back to plans</Link>
        </Button>
      </Card>
    </div>
  );
}
