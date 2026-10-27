import { Card } from "@/components/ui/card";

/** Streamed while the dashboard queries the database. */
export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between px-2">
        <div className="grid gap-3">
          <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </div>

      {[0, 1, 2].map((index) => (
        <Card key={index} className="p-4">
          <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded-md bg-muted" />
        </Card>
      ))}
    </div>
  );
}
