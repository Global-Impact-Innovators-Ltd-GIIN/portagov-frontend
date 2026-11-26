// The PortaGov action client, now running in the browser.
//
// Most actions still run locally against the browser store (see db.ts
// and actions.ts). The core citizen flow, sign-up / sign-in, profile,
// applications, documents, payments, appointments, tracking, certificates
// and public stats, now talks to the live PortaGov backend on Render
// through remote.ts. Everything else (staff / institution / platform
// desks, family, business, help desk, assistant) still uses the local
// actions until it is wired too. See remote.ts for the full list.

import { Actions } from "./actions";
import { remote } from "./remote";
import { bindQueryClient as bind } from "./sdk";
import type { QueryClient } from "@tanstack/react-query";

export const api = { ...Actions, ...remote } as typeof Actions;

export type ApiResponse<T, K extends keyof T> =
  T[K] extends (...args: any[]) => infer R ? Awaited<R> : never;

export type ApiRequest<T, K extends keyof T> =
  T[K] extends (args: infer A) => any ? A : never;

/** Wire the app's react-query client in, so action handlers can
    refresh views the way ctx.invalidateQueries() did on the server. */
export function bindQueryClient(qc: QueryClient): void {
  bind(() => {
    void qc.invalidateQueries();
  });
}
