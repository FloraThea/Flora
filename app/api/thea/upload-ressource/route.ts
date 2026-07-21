import { NextResponse } from "next/server";
import {
  extractJsonObject,
  jsonRouteError,
  logRouteInfo,
  toErrorMessage,
} from "@/lib/api/route-diagnostics";
import { DocumentExtractionError, extractTextFromFile } from "@/lib/documents/extract-text";
import { floraDb } from "@/lib/supabase/get-db";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { askThea } from "@/lib/thea/services/gemini";
import { isAnyAiProviderConfigured } from "@/lib/thea/orchestrator";

const ROUTE_PATH = "/api/thea/upload-ressource";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.", "Le champ `file` est requis.");
    }

    logRouteInfo(ROUTE_PATH, "Fichier reçu", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const filePath = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await (await floraDb()).storage
      .from(getStorageBucketName())
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    let text = "";
    try {
      const extraction = await extractTextFromFile(file);
      text = extraction.text;
      logRouteInfo(ROUTE_PATH, "Texte extrait", {
        fileName: file.name,
        extractionMethod: extraction.extractionMethod,
        textLength: text.length,
      });
    } catch (error) {
      if (error instanceof DocumentExtractionError) {
        return jsonRouteError(ROUTE_PATH, 400, error.message, "Extraction texte impossible.");
      }
      throw error;
    }

    if (!isAnyAiProviderConfigured()) {
      return jsonRouteError(
        ROUTE_PATH,
        500,
        "Configuration serveur invalide.",
        "Aucun fournisseur IA configuré (GEMINI_API_KEY, OPENROUTER_API_KEY…).",
      );
    }

    const prompt = `
Tu es Théa, l'assistante pédagogique de Flora.

Analyse cette ressource pédagogique.

Réponds uniquement en JSON valide :

{
  "nom": "",
  "type": "",
  "matiere": "",
  "sous_matiere": "",
  "niveau": "",
  "methode": "",
  "auteur": "",
  "editeur": "",
  "resume": "",
  "mots_cles": [],
  "competences": []
}

Document :
${text.slice(0, 12000)}
`;

    const rawText = (await askThea(prompt)).trim();
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

    const analyse = JSON.parse(safeJson) as Record<string, unknown>;

    const { data, error: insertError } = await (await floraDb())
      .from("resources")
      .insert({
        nom: String(analyse.nom || file.name),
        type: String(analyse.type || "Ressource pédagogique"),
        matiere: String(analyse.matiere || ""),
        sous_matiere: String(analyse.sous_matiere || ""),
        niveau: String(analyse.niveau || ""),
        methode: String(analyse.methode || ""),
        auteur: String(analyse.auteur || ""),
        editeur: String(analyse.editeur || ""),
        resume: String(analyse.resume || ""),
        mots_cles: JSON.stringify(analyse.mots_cles ?? []),
        competences: analyse.competences ?? [],
        fichier_url: filePath,
        taille: file.size,
        extension,
        statut: "analysed",
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(getSupabaseErrorMessage(insertError, "Insertion Supabase échouée."));
    }

    logRouteInfo(ROUTE_PATH, "Ressource importée", {
      fileName: file.name,
      resourceId: data?.id,
      matiere: analyse.matiere,
      competencesCount: Array.isArray(analyse.competences) ? analyse.competences.length : 0,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      resource: data,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'importer la ressource.",
      toErrorMessage(error),
    );
  }
}
