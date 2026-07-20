import { NextResponse } from "next/server";
import { buildDocumentChain, buildDocumentChainByCompetence } from "@/lib/pedagogical/intelligence/document-chain";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get("module") as
      | "programmation"
      | "progression"
      | "sequence"
      | "seance"
      | null;
    const entityId = searchParams.get("entityId");
    const competence = searchParams.get("competence");

    if (competence) {
      const chain = await buildDocumentChainByCompetence(competence);
      return NextResponse.json(chain);
    }

    if (!moduleName || !entityId) {
      return NextResponse.json({ error: "Paramètres module/entityId ou competence requis." }, { status: 400 });
    }

    const chain = await buildDocumentChain({ module: moduleName, entityId });
    return NextResponse.json(chain);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chaîne documentaire indisponible." },
      { status: 500 },
    );
  }
}
