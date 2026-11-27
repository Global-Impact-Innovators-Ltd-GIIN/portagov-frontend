// GiinAI feedback route: POST forwards a thumbs up or down.
//
// POST body: { session_id, rating, question, answer } where rating is
// 5 for thumbs up and -1 for thumbs down. The app key never leaves
// the server. A 429 or 503 from GiinAI becomes the friendly busy
// message; other GiinAI errors become a generic error with no
// upstream detail.

import {
  giinAiConfigured,
  giinAiErrorResponse,
  giinAiFetch,
  giinAiNotConfiguredResponse,
  invalidBodyResponse,
} from "../giinai";

export async function POST(req: Request): Promise<Response> {
  if (!giinAiConfigured()) return giinAiNotConfiguredResponse();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidBodyResponse();
  }
  const b = body as Record<string, unknown>;
  const sessionId =
    typeof b.session_id === "string" ? b.session_id.trim() : "";
  const rating = b.rating;
  const question =
    typeof b.question === "string" ? b.question.slice(0, 600) : "";
  const answer =
    typeof b.answer === "string" ? b.answer.slice(0, 8000) : "";
  if (!sessionId || (rating !== 5 && rating !== -1) || !question || !answer) {
    return invalidBodyResponse();
  }
  let upstream: Response;
  try {
    upstream = await giinAiFetch("/api/v1/feedback", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, rating, question, answer }),
    });
  } catch {
    return Response.json(
      { error: "GiinAI is busy, try again" },
      { status: 503 },
    );
  }
  if (!upstream.ok) return giinAiErrorResponse(upstream);
  return Response.json({ ok: true });
}
