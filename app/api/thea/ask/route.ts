import { NextResponse } from "next/server";
import {
  jsonRouteError,
  logRouteInfo,
  toErrorMessage,
} from "@/lib/api/route-diagnostics";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { buildTheaChatPrompt } from "@/lib/thea/chat/build-prompt";
import {
  formatSeancePreview,
  formatSequencePreview,
  parseTheaSeanceStructured,
  parseTheaSequenceStructured,
} from "@/lib/thea/chat/parse-create-response";
import type { TheaAskRequest, TheaAskResponse } from "@/lib/thea/chat/types";
import { AiExhaustedError, isAnyAiProviderConfigured } from "@/lib/thea/orchestrator";
import { AI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";
import { askThea } from "@/lib/thea/services/gemini";

const ROUTE_PATH = "/api/thea/ask";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TheaAskRequest;

    if (!body.message?.trim()) {
      return jsonRouteError(ROUTE_PATH, 400, "Message requis.");
    }

    const mode = body.mode ?? "chat";

    logRouteInfo(ROUTE_PATH, "Question Théa", {
      mode,
      messageLength: body.message.length,
    });

    if (!isAnyAiProviderConfigured()) {
      return jsonRouteError(
        ROUTE_PATH,
        500,
        "Aucun fournisseur IA configuré.",
        "Configurez GEMINI_API_KEY ou OPENROUTER_API_KEY.",
      );
    }

    const bundle = await loadTeacherProfileBundle();
    const prompt = buildTheaChatPrompt(body, bundle);
    const raw = (await askThea(prompt)).trim();

    if (mode === "create_seance" && body.createContext) {
      try {
        const structured = parseTheaSeanceStructured(raw);
        const payload: TheaAskResponse = {
          reply: formatSeancePreview(structured),
          mode,
          structured,
          canSave: true,
        };
        return NextResponse.json({ route: ROUTE_PATH, ...payload });
      } catch (parseError) {
        return NextResponse.json({
          route: ROUTE_PATH,
          reply: raw,
          mode,
          structured: null,
          canSave: false,
          parseWarning:
            parseError instanceof Error
              ? parseError.message
              : "Réponse non structurée — enregistrement indisponible.",
        });
      }
    }

    if (mode === "create_sequence" && body.createContext) {
      try {
        const structured = parseTheaSequenceStructured(raw);
        const payload: TheaAskResponse = {
          reply: formatSequencePreview(structured),
          mode,
          structured,
          canSave: true,
        };
        return NextResponse.json({ route: ROUTE_PATH, ...payload });
      } catch (parseError) {
        return NextResponse.json({
          route: ROUTE_PATH,
          reply: raw,
          mode,
          structured: null,
          canSave: false,
          parseWarning:
            parseError instanceof Error
              ? parseError.message
              : "Réponse non structurée — enregistrement indisponible.",
        });
      }
    }

    const payload: TheaAskResponse = { reply: raw, mode };
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    if (error instanceof AiExhaustedError) {
      return jsonRouteError(ROUTE_PATH, 503, AI_QUEUE_USER_MESSAGE, toErrorMessage(error));
    }

    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de contacter Théa.",
      toErrorMessage(error),
    );
  }
}
