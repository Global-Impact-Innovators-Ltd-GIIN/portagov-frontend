// GiinAI tasks route: POST forwards a task run.
//
// POST body: { instruction, input, use_knowledge, output_schema? }.
// Kept as its own route because tasks have a different request shape
// and error handling from chat and feedback. The app key never leaves
// the server. A 429 or 503 from GiinAI becomes the friendly busy
// message; other GiinAI errors become a generic error with no
// upstream detail. The upstream JSON result is passed back unchanged.

import {
  giinAiConfigured,
  giinAiErrorResponse,
  giinAiFetch,
  giinAiNotConfiguredResponse,
  invalidBodyResponse,
} from "../../giinai";

export async function POST(req: Request): Promise<Response> {
  if (!giinAiConfigured()) return giinAiNotConfiguredResponse();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidBodyResponse();
  }
  const b = body as Record<string, unknown>;
  const instruction =
    typeof b.instruction === "string" ? b.instruction.trim() : "";
  if (!instruction || instruction.length > 4000) return invalidBodyResponse();
  const input = b.input === undefined ? {} : b.input;
  const useKnowledge = b.use_knowledge !== false;
  const outputSchema =
    b.output_schema !== undefined ? b.output_schema : undefined;

  let upstream: Response;
  try {
    upstream = await giinAiFetch("/api/v1/tasks/run", {
      method: "POST",
      body: JSON.stringify({
        instruction,
        input,
        use_knowledge: useKnowledge,
        ...(outputSchema !== undefined
          ? { output_schema: outputSchema }
          : {}),
      }),
    });
  } catch {
    return Response.json(
      { error: "GiinAI is busy, try again" },
      { status: 503 },
    );
  }
  if (!upstream.ok) return giinAiErrorResponse(upstream);
  const text = await upstream.text();
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
