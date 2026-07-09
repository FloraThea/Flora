import { METHODE_OPTIONS } from "@/app/programmation/types";
import type { ValidatedProgrammationSummary } from "@/lib/progression/types";

export type ProgressionFormValues = {
  programmationId: string;
  methode: string;
};

export const initialProgressionFormValues: ProgressionFormValues = {
  programmationId: "",
  methode: "",
};

export { METHODE_OPTIONS };

export type ValidatedProgrammationOption = ValidatedProgrammationSummary;
