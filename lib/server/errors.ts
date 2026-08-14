export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function apiError(error: unknown, correlationId: string) {
  if (error instanceof HttpError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          fields: error.fields,
        },
      },
      { status: error.status },
    );
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "api.unhandled_error",
      correlationId,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );

  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "Something went sideways. Nothing was saved—please try again.",
        correlationId,
      },
    },
    { status: 500 },
  );
}

export async function withApi(
  request: Request,
  handler: (correlationId: string) => Promise<Response>,
) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  try {
    const response = await handler(correlationId);
    response.headers.set("x-correlation-id", correlationId);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return apiError(error, correlationId);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  const maxBytes = 256 * 1024;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "json_required", "Send this as JSON.");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "request_too_large", "That update is too large.");
  }
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
      throw new HttpError(
        413,
        "request_too_large",
        "That update is too large.",
      );
    }
    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "invalid_json",
      "That request was not valid JSON.",
    );
  }
}
