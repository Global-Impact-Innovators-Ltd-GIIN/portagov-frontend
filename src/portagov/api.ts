// The PortaGov action client, now running in the browser.
//
// In the artifact this was a typed RPC client to the server actions.
// Here the same actions run locally against the browser store (see
// db.ts and actions.ts), so every call in App.tsx works unchanged.

import { Actions } from "./actions";
import { bindQueryClient as bind } from "./sdk";
import type { QueryClient } from "@tanstack/react-query";

export const api = Actions;

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
