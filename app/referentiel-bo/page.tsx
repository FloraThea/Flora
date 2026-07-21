import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ documentId?: string; q?: string }>;
};

export default async function ReferentielBoRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.documentId) search.set("documentId", params.documentId);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  redirect(`/bibliotheque${query ? `?${query}` : ""}`);
}
