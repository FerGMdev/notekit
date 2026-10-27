import { LibraryView } from "@/app/components/LibraryView";

export const metadata = {
  title: "Notes",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <LibraryView
      kind="NOTE"
      basePath="/dashboard"
      searchParams={await searchParams}
    />
  );
}
