// Shared GiinAI server helpers for the /api/giinai/* routes.
//
// The GiinAI app key lives only on the server (GIINAI_APP_KEY, no
// NEXT_PUBLIC_ prefix) and is sent as the X-GiinAI-Key header on every
// GiinAI call. It is never sent to the browser. The base URL comes from
// GIINAI_URL so the service can move from the test machine to a cloud
// domain without a code change.

export const GIINAI_TIMEOUT_MS = 900_000;

export const GIINAI_BUSY_MESSAGE = "GiinAI is busy, try again";

const GENERIC_MESSAGE =
  "The assistant could not answer just now. Please try again.";

function giinAiBase(): string {
  return (process.env.GIINAI_URL || "").trim().replace(/\/$/, "");
}

function giinAiKey(): string {
  return (process.env.GIINAI_APP_KEY || "").trim();
}

export function giinAiConfigured(): boolean {
  return giinAiBase().length > 0 && giinAiKey().length > 0;
}

/** Call GiinAI with the app key. Never log the key or return it. */
export async function giinAiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-GiinAI-Key", giinAiKey());
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const signal =
    init.signal ?? AbortSignal.timeout(GIINAI_TIMEOUT_MS);
  return fetch(`${giinAiBase()}${path}`, { ...init, headers, signal });
}

/** Map a GiinAI error status to a safe message for the browser. The
    upstream detail is never forwarded, so no backend detail leaks. */
export function giinAiErrorResponse(res: Response): Response {
  if (res.status === 429 || res.status === 503) {
    return Response.json({ error: GIINAI_BUSY_MESSAGE }, { status: res.status });
  }
  return Response.json({ error: GENERIC_MESSAGE }, { status: 502 });
}

export function giinAiNotConfiguredResponse(): Response {
  return Response.json(
    { error: "The assistant is not set up yet. Please try again later." },
    { status: 503 },
  );
}

export function invalidBodyResponse(): Response {
  return Response.json({ error: GENERIC_MESSAGE }, { status: 422 });
}
