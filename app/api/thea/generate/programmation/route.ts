import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  extractJsonObject,
  jsonRouteError,
  logRouteInfo,
  toErrorMessage,
} from "@/lib/api/route-diagnostics";

const ROUTE_PATH = "/api/thea/generate/programmation";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    logRouteInfo(ROUTE_PATH, "Génération demandée", {
      keys: Object.keys(body ?? {}),
    });

    if (!process.env.GEMINI_API_KEY) {
      return jsonRouteError(
        ROUTE_PATH,
        500,
        "Configuration serveur invalide.",
        "La variable d'environnement GEMINI_API_KEY est absente.",
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
Tu es Théa, l'assistante pédagogique de Flora.
Génère une programmation annuelle à partir des données fournies.
Réponds uniquement en JSON valide.

Données :
${JSON.stringify(body, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const rawText = (response.text ?? "").trim();
    const safeJson =
      extractJsonObject(rawText.replace(/```json/g, "").replace(/```/g, "").trim()) ??
      extractJsonObject(rawText);

    if (!safeJson) {
      return jsonRouteError(
        ROUTE_PATH,
        502,
        "Théa a répondu dans un format non JSON.",
        "Aucun objet JSON valide détecté.",
        { modelResponse: rawText },
      );
    }

    const parsed = JSON.parse(safeJson);

    logRouteInfo(ROUTE_PATH, "Génération terminée", {
      title: (parsed as { titre?: string; title?: string }).titre ??
        (parsed as { title?: string }).title ??
        null,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      ...parsed,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de générer la programmation.",
      toErrorMessage(error),
    );
  }
}
