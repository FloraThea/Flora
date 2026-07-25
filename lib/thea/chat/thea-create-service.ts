import "server-only";

import { createIndependentSequenceFromDraft } from "@/lib/sequences/sequence-service";
import type { SequencePayload } from "@/lib/sequences/types";
import { createIndependentSeanceFromDraft } from "@/lib/seances/seance-service";
import type { SeancePayload } from "@/lib/seances/types";
import type { TeacherProfileBundle } from "@/lib/profile/types";
import {
  buildSeanceDraftFromTheaStructured,
  buildSequenceDraftFromTheaStructured,
} from "./parse-create-response";
import type { TheaChatMode, TheaCreateDraftInput, TheaSeanceStructured, TheaSequenceStructured } from "./types";

export async function saveTheaCreateProposal(input: {
  mode: TheaChatMode;
  structured: TheaSeanceStructured | TheaSequenceStructured;
  createContext: TheaCreateDraftInput;
  bundle: TeacherProfileBundle | null;
}): Promise<
  | { type: "seance"; payload: SeancePayload }
  | { type: "sequence"; payload: SequencePayload }
> {
  if (input.mode === "create_seance") {
    const draft = buildSeanceDraftFromTheaStructured(
      input.structured as TheaSeanceStructured,
      input.createContext,
      input.bundle,
    );

    const payload = await createIndependentSeanceFromDraft(draft, {
      source_type: "thea_chat",
      theaStructured: input.structured,
      createContext: input.createContext,
    });

    return { type: "seance", payload };
  }

  const draft = buildSequenceDraftFromTheaStructured(
    input.structured as TheaSequenceStructured,
    input.createContext,
    input.bundle,
  );

  const payload = await createIndependentSequenceFromDraft(draft, {
    source_type: "thea_chat",
    theaStructured: input.structured,
    createContext: input.createContext,
  });

  return { type: "sequence", payload };
}
