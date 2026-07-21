/**
 * Tests unitaires — orchestrateur IA Flora
 */
import assert from "node:assert/strict";

process.env.FLORA_AI_QUEUE_MAX_WAIT_MS = "500";
process.env.FLORA_AI_QUEUE_POLL_MS = "30";
process.env.FLORA_GEMINI_RETRY_ATTEMPTS = "1";
process.env.FLORA_AI_FALLBACK_RETRY_ATTEMPTS = "1";

async function main() {
  const { AiExhaustedError, classifyAiError } = await import("./errors");
  const { AiOrchestrator } = await import("./orchestrator");
  const { registerAiProvider, resetAiProviderRegistry, resolveProviderChain } = await import(
    "./providers/registry"
  );
  const { resetAiQueueForTests } = await import("./queue");
  type AiProvider = import("./types").AiProvider;

  function mockProvider(input: {
    id: AiProvider["id"];
    model?: string;
    responses?: Array<string | Error>;
    alwaysThrow?: boolean;
  }): AiProvider {
    let callIndex = 0;

    return {
      id: input.id,
      model: input.model ?? `${input.id}-test`,
      isConfigured: () => true,
      async complete() {
        if (input.alwaysThrow) {
          throw new Error("429 RESOURCE_EXHAUSTED quota exceeded");
        }
        const next = input.responses?.[callIndex++];
        if (next instanceof Error) throw next;
        if (typeof next === "string") return next;
        return '{"ok":true}';
      },
    };
  }

  assert.equal(classifyAiError(new Error("429 RESOURCE_EXHAUSTED")).reason, "quota_exceeded");
  assert.equal(
    classifyAiError(Object.assign(new Error("timeout"), { name: "AbortError" })).reason,
    "timeout",
  );
  assert.equal(classifyAiError(new Error("invalid json schema")).transient, false);

  resetAiProviderRegistry();
  process.env.FLORA_AI_FALLBACK = "openai";
  registerAiProvider(mockProvider({ id: "gemini", responses: ['{"ok":1}'] }));
  registerAiProvider(mockProvider({ id: "openai", responses: ['{"ok":2}'] }));
  assert.equal(resolveProviderChain()[0]?.id, "gemini");

  resetAiProviderRegistry();
  resetAiQueueForTests();

  registerAiProvider(mockProvider({ id: "gemini", alwaysThrow: true }));
  registerAiProvider(mockProvider({ id: "openai", responses: ['{"source":"openai"}'] }));

  const orchestrator = new AiOrchestrator();
  const fallbackResult = await orchestrator.completeWithMeta({
    prompt: "test prompt",
    label: "test-fallback",
  });

  assert.equal(fallbackResult.text, '{"source":"openai"}');
  assert.equal(fallbackResult.meta.providerId, "openai");
  assert.equal(fallbackResult.meta.fallbackFrom, "gemini");

  resetAiProviderRegistry();
  resetAiQueueForTests();
  process.env.FLORA_AI_FALLBACK = "none";

  let geminiCalls = 0;
  registerAiProvider({
    id: "gemini",
    model: "gemini-test",
    isConfigured: () => true,
    async complete() {
      geminiCalls += 1;
      if (geminiCalls === 1) {
        throw new Error("503 UNAVAILABLE");
      }
      return '{"source":"queue-retry"}';
    },
  });

  const queueResult = await orchestrator.completeWithMeta({
    prompt: "queued",
    label: "test-queue",
  });

  assert.equal(queueResult.text, '{"source":"queue-retry"}');
  assert.equal(queueResult.meta.queued, true);

  resetAiProviderRegistry();
  resetAiQueueForTests();

  registerAiProvider(mockProvider({ id: "gemini", alwaysThrow: true }));

  await assert.rejects(
    () => orchestrator.completeWithMeta({ prompt: "fail", label: "test-exhausted" }),
    (error: unknown) => error instanceof AiExhaustedError,
  );

  console.log("AI orchestrator tests: OK");
}

main().catch((error) => {
  console.error("AI orchestrator tests: FAIL", error);
  process.exit(1);
});
