import "server-only";

import { askAi } from "@/lib/thea/orchestrator";

export async function askThea(prompt: string): Promise<string> {
  return askAi(prompt, "thea");
}
