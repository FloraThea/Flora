import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { analyseBoDocumentText } from "@/lib/thea/analyseBoDocument";

const ROUTE_PATH = "/api/thea/analyse-document";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Aucun texte à analyser.",
        "Le champ `text` est requis et doit être une chaîne.",
      );
    }

    logRouteInfo(ROUTE_PATH, "Début analyse Théa", {
      textLength: text.length,
      preview: text.slice(0, 120),
    });

    const analysis = await analyseBoDocumentText(text);

    logRouteInfo(ROUTE_PATH, "Analyse terminée", {
      referencesCount: analysis.references.length,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      references: analysis.references,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Théa n'a pas réussi à analyser le document.",
      toErrorMessage(error),
    );
  }
}
