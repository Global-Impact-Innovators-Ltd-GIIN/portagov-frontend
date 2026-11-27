// GiinAI chat route: POST streams a chat answer, DELETE forgets a
// conversation.
//
// POST body: { message, session_id?, user_ref?, user_context? }.
// The GiinAI answer streams back as server-sent events (start, token,
// tool, sources, done, error) exactly as GiinAI sends them, so the
// browser can show tokens as they arrive. A 429 or 503 from GiinAI
// becomes a friendly busy message; 401, 403 and 422 become a generic
// error with no upstream detail. The app key never leaves the server.
//
// DELETE ?session_id=<id> forgets that conversation on GiinAI and
// clears the stored session on the browser side.
//
// GiinAI answers take 30 seconds to 4 minutes, so the upstream fetch
// allows 600 seconds. Vercel Hobby caps a function at 60 seconds, so
// maxDuration is 60 here; on a longer limit the 600 second upstream
// timeout applies. If the function limit cuts a long answer short,
// the browser falls back to the local assistant instead of losing
// the question.

import {
  GIINAI_TIMEOUT_MS,
  giinAiConfigured,
  giinAiErrorResponse,
  giinAiFetch,
  giinAiNotConfiguredResponse,
  invalidBodyResponse,
} from "../giinai";

export const maxDuration = 60;

const QUESTION_MAX = 600;
const CONTEXT_MAX = 6000;

export async function POST(req: Request): Promise<Response> {
  if (!giinAiConfigured()) return giinAiNotConfiguredResponse();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidBodyResponse();
  }
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message || message.length > QUESTION_MAX) return invalidBodyResponse();
  const sessionId =
    typeof b.session_id === "string" && b.session_id.trim()
      ? b.session_id.trim().slice(0, 200)
      : undefined;
  const userRef =
    typeof b.user_ref === "string" ? b.user_ref.trim().slice(0, 200) : undefined;
  const userContext =
    typeof b.user_context === "string"
      ? b.user_context.slice(0, CONTEXT_MAX)
      : undefined;

  let upstream: Response;
  try {
    upstream = await giinAiFetch("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        session_id: sessionId,
        stream: true,
        user_ref: userRef,
        user_context: userContext,
      }),
      signal: AbortSignal.timeout(GIINAI_TIMEOUT_MS),
    });
  } catch {
    return Response.json(
      { error: "GiinAI is busy, try again" },
      { status: 503 },
    );
  }
  if (!upstream.ok || !upstream.body) {
    return giinAiErrorResponse(upstream);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!giinAiConfigured()) return giinAiNotConfiguredResponse();
  const sessionId = new URL(req.url).searchParams.get("session_id")?.trim();
  if (!sessionId) return invalidBodyResponse();
  let upstream: Response;
  try {
    upstream = await giinAiFetch(
      `/api/v1/chat/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    return Response.json({ ok: true, forgotten: false }, { status: 200 });
  }
  // Already forgotten on GiinAI is still forgotten for the citizen.
  if (upstream.ok || upstream.status === 404) {
    return Response.json({ ok: true, forgotten: true });
  }
  return giinAiErrorResponse(upstream);
}
