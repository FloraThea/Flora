import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { adjustmentEngine } from "@/lib/journal/AdjustmentEngine";
import { journalGenerator } from "@/lib/journal/JournalGenerator";
import { resolveJournalTimetable } from "@/lib/journal/JournalTimetableResolver";
import {
  loadJournalPayload,
  saveAdjustments,
  updateAdjustmentStatus,
} from "@/lib/journal/journal-service";
import { reportEngine } from "@/lib/journal/ReportEngine";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { supabase } from "@/lib/supabase";

const ROUTE_PATH = "/api/cahier-journal/adjustments";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "propose" | "respond";
      journalId?: string;
      adjustmentId?: string;
      status?: "accepted" | "rejected";
    };

    if (body.action === "respond") {
      if (!body.adjustmentId || !body.status) {
        return jsonRouteError(ROUTE_PATH, 400, "adjustmentId et status requis.");
      }

      const { data: adjustmentRow } = await supabase
        .from("journal_adjustments")
        .select("*")
        .eq("id", body.adjustmentId)
        .maybeSingle();

      await updateAdjustmentStatus(body.adjustmentId, body.status);

      if (body.status === "accepted" && adjustmentRow) {
        const payload = await loadJournalPayload(String(adjustmentRow.journal_id));
        const profileBundle = await loadTeacherProfileBundle();

        if (payload && profileBundle) {
          const calendar = schoolWeeksCalculator.calculate(
            profileBundle.profile.schoolYear,
            profileBundle.profile.zoneScolaire,
            { includeBridgeDays: true },
          );
          const timetable = await resolveJournalTimetable(profileBundle);

          const reportResult = await reportEngine.applyReportAdjustment({
            adjustment: {
              id: String(adjustmentRow.id),
              journalId: String(adjustmentRow.journal_id),
              proposedBy: String(adjustmentRow.proposed_by ?? "thea"),
              adjustmentType: String(adjustmentRow.adjustment_type ?? ""),
              title: String(adjustmentRow.title ?? ""),
              description: String(adjustmentRow.description ?? ""),
              payload: (adjustmentRow.payload as Record<string, unknown>) ?? {},
              status: "accepted",
            },
            entries: payload.entries,
            journalDate: payload.journal.journalDate,
            calendar,
            timetable,
          });

          if (reportResult.applied && reportResult.newSessionDate) {
            await journalGenerator.generateForDate({
              date: reportResult.newSessionDate,
              regenerate: true,
            });
          }
        }
      }

      return NextResponse.json({ route: ROUTE_PATH, success: true });
    }

    if (!body.journalId) {
      return jsonRouteError(ROUTE_PATH, 400, "journalId requis.");
    }

    const payload = await loadJournalPayload(body.journalId);
    if (!payload) {
      return jsonRouteError(ROUTE_PATH, 404, "Journal introuvable.");
    }

    const proposals = await adjustmentEngine.proposeAdjustments({
      journal: payload.journal,
      entries: payload.entries,
    });
    await saveAdjustments(body.journalId, proposals);

    return NextResponse.json({ route: ROUTE_PATH, adjustments: proposals });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de traiter les ajustements.",
      toErrorMessage(error),
    );
  }
}
