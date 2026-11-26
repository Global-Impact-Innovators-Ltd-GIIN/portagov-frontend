// Local stand-in for the @hatch/space-sdk server side the PortaGov
// actions were written against.
//
// defineAction keeps the same shape (request / response zod schemas and
// a handler receiving a context), so actions.ts is copied almost
// verbatim. The context gives handlers:
//   ctx.db()        the browser-local database (see db.ts)
//   ctx.blobs       document files, kept as data URLs on this device
//   ctx.inference   the PortaGov assistant and Liberian English
//                   rewriting, answered locally from the real service
//                   catalogue (see assistant.ts) instead of a server
//                   model, so nothing is ever invented
//   ctx.invalidateQueries()  refreshes the app's data views

import { z } from "zod";
import * as schema from "./schema";
import { LocalDb, type TableDef } from "./db";
import { localComplete } from "./assistant";

export { z };

export type ActionsModule = Record<
  string,
  (args: any) => Promise<unknown>
>;

export interface BlobStore {
  put(key: string, bytes: Uint8Array, opts: { contentType: string }): Promise<void>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface Inference {
  complete(prompt: string, opts: { schema: z.ZodTypeAny }): Promise<any>;
}

export interface Ctx {
  db: <T = unknown>() => LocalDb;
  blobs: BlobStore;
  inference: Inference;
  invalidateQueries: () => void;
}

let dbInstance: LocalDb | null = null;

export function getDb(): LocalDb {
  if (!dbInstance) {
    const defs = Object.values(schema).filter(
      (v: unknown): v is TableDef =>
        typeof v === "object" && v !== null && "__tableName" in v,
    );
    dbInstance = new LocalDb(defs);
  }
  return dbInstance;
}

const BLOB_KEY = "portagov-blobs-v1";
const memoryBlobs = new Map<string, string>();

function readBlobStore(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(BLOB_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeBlobStore(store: Record<string, string>): void {
  try {
    window.localStorage.setItem(BLOB_KEY, JSON.stringify(store));
  } catch {
    // Storage full: the in-memory copy keeps the file for this session.
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

const blobs: BlobStore = {
  async put(key, bytes, opts) {
    const dataUrl = `data:${opts.contentType};base64,${bytesToBase64(bytes)}`;
    memoryBlobs.set(key, dataUrl);
    const store = readBlobStore();
    store[key] = dataUrl;
    writeBlobStore(store);
  },
  async getUrl(key) {
    return memoryBlobs.get(key) ?? readBlobStore()[key] ?? "";
  },
  async delete(key) {
    memoryBlobs.delete(key);
    const store = readBlobStore();
    delete store[key];
    writeBlobStore(store);
  },
};

const inference: Inference = {
  async complete(prompt, opts) {
    const result = localComplete(prompt);
    const checked = opts.schema.safeParse(result);
    return checked.success ? checked.data : result;
  },
};

let boundInvalidate: (() => void) | null = null;

/** Called once by the app shell with the react-query client, so action
    handlers can refresh the views the way ctx.invalidateQueries() did
    on the server. */
export function bindQueryClient(invalidate: () => void): void {
  boundInvalidate = invalidate;
}

export function createCtx(): Ctx {
  return {
    db: () => getDb(),
    blobs,
    inference,
    invalidateQueries: () => {
      boundInvalidate?.();
    },
  };
}

export interface ActionDef<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
> {
  description?: string;
  request: I;
  response: O;
  handler: (ctx: Ctx, args: z.infer<I>) => Promise<z.infer<O>>;
}

export function defineAction<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
>(def: ActionDef<I, O>): (args: z.input<I>) => Promise<z.infer<O>> {
  const fn = async (rawArgs: unknown): Promise<z.infer<O>> => {
    const parsed = def.request.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new Error(
        first?.message ?? "Check the information and try again.",
      );
    }
    const result = await def.handler(createCtx(), parsed.data);
    const checked = def.response.safeParse(result);
    return (checked.success ? checked.data : result) as z.infer<O>;
  };
  (fn as unknown as Record<string, unknown>).request = def.request;
  (fn as unknown as Record<string, unknown>).response = def.response;
  (fn as unknown as Record<string, unknown>).description =
    def.description ?? "";
  return fn;
}
