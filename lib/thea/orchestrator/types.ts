export type AiProviderId = "gemini" | "openrouter" | "openai" | "anthropic";

export type AiFallbackReason =
  | "quota_exceeded"
  | "api_error"
  | "timeout"
  | "unavailable"
  | "provider_exhausted";

export type AiCompletionRequest = {
  prompt: string;
  label?: string;
};

export type AiCompletionMeta = {
  providerId: AiProviderId;
  model: string;
  durationMs: number;
  fallbackFrom?: AiProviderId;
  fallbackReason?: AiFallbackReason;
  attempt: number;
  queued?: boolean;
};

export type AiCompletionResult = {
  text: string;
  meta: AiCompletionMeta;
};

export interface AiProvider {
  readonly id: AiProviderId;
  readonly model: string;
  isConfigured(): boolean;
  complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string>;
}

export type AiTransientErrorInfo = {
  transient: boolean;
  reason?: AiFallbackReason;
};
