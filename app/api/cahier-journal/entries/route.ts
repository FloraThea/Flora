import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  completeJournalEntry,
  generateJournalEntry,
  type CompleteJournalEntryInput,
  type GenerateJournalEntryInput,
} from "@/lib/journal/journal-entry-service";

const ROUTE_PATH = "/api/cahier-journal/entries";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "complete" | "generate";
      date?: string;
      entryRef?: CompleteJournalEntryInput["entryRef"];
      startTime?: string;
      endTime?: string;
      matiere?: string;
      subSubject?: string;
      competence?: string;
      objectif?: string;
      organisation?: string;
      materielItems?: string[];
      resourceItems?: string[];
      observations?: string;
      theme?: string;
      objectifSouhaite?: string;
    };

    if (!body.date || !body.entryRef) {
      return jsonRouteError(ROUTE_PATH, 400, "date et entryRef requis.");
    }

    if (body.action === "generate") {
      logRouteInfo(ROUTE_PATH, "Génération Théa créneau", { date: body.date });
      const payload = await generateJournalEntry({
        date: body.date,
        entryRef: body.entryRef,
        theme: body.theme,
        objectifSouhaite: body.objectifSouhaite,
      } satisfies GenerateJournalEntryInput);
      return NextResponse.json({ route: ROUTE_PATH, ...payload, preview: false });
    }

    logRouteInfo(ROUTE_PATH, "Complétion manuelle créneau", { date: body.date });
    const payload = await completeJournalEntry({
      date: body.date,
      entryRef: body.entryRef,
      startTime: body.startTime,
      endTime: body.endTime,
      matiere: body.matiere,
      subSubject: body.subSubject,
      competence: body.competence,
      objectif: body.objectif,
      organisation: body.organisation,
      materielItems: body.materielItems,
      resourceItems: body.resourceItems,
      observations: body.observations,
    });

    return NextResponse.json({ route: ROUTE_PATH, ...payload, preview: false });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de mettre à jour le créneau.",
      toErrorMessage(error),
    );
  }
}
