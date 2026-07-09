import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ documentId?: string }>;
};

export default async function ReferentielBoRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.documentId
    ? `?tab=referentiels&documentId=${encodeURIComponent(params.documentId)}`
    : "?tab=referentiels";
  redirect(`/bibliotheque${query}`);
}
