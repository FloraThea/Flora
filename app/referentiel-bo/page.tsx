import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ documentId?: string }>;
};

export default async function ReferentielBoRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.documentId
    ? `?documentId=${encodeURIComponent(params.documentId)}`
    : "";
  redirect(`/bibliotheque${query}`);
}
