export function serializeError(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
  cause?: ReturnType<typeof serializeError>;
} {
  if (error instanceof Error) {
    const serialized: {
      message: string;
      name?: string;
      stack?: string;
      cause?: ReturnType<typeof serializeError>;
    } = {
      message: error.message,
      name: error.name,
    };

    if (error.stack) {
      serialized.stack = error.stack;
    }

    if (error.cause !== undefined) {
      serialized.cause = serializeError(error.cause);
    }

    return serialized;
  }

  return { message: String(error) };
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export function resolveRequestUrl(route: string): string {
  if (typeof window !== "undefined") {
    try {
      return new URL(route, window.location.origin).href;
    } catch {
      return route;
    }
  }

  return route;
}

export function describeRequestPayload(body: BodyInit | null | undefined): unknown {
  if (!body) return null;

  if (body instanceof FormData) {
    const entries: Record<string, unknown> = {};
    body.forEach((value, key) => {
      if (value instanceof File) {
        entries[key] = {
          type: "File",
          name: value.name,
          size: value.size,
          mimeType: value.type,
        };
      } else {
        entries[key] = value;
      }
    });
    return entries;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body.length > 500 ? `${body.slice(0, 500)}…` : body;
    }
  }

  return `[${Object.prototype.toString.call(body)}]`;
}

export function logStructuredError(
  label: string,
  event: string,
  details: Record<string, unknown>,
  error?: unknown,
) {
  const payload = {
    ...details,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };

  console.error(`[${label}] ${event}`, payload);
}
