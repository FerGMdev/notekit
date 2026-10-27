import { LibraryView } from "@/app/components/LibraryView";

export const metadata = {
  title: "Snippets",
};

export default async function SnippetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <LibraryView
      kind="SNIPPET"
      basePath="/dashboard/snippets"
      searchParams={await searchParams}
    />
  );
}
