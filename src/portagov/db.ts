// Browser-local stand-in for the drizzle-orm / SQLite layer the PortaGov
// actions were written against.
//
// The artifact ran its data in a server SQLite database. On Vercel's free
// tier there is no persistent server database, so tables live in this
// browser's localStorage instead (key portagov-db-v1), with an in-memory
// copy when storage is unavailable. Every citizen's data stays on their
// own device, which matches how the preview behaved: sign up, apply,
// pay, track, release and staff work all run against this store.
//
// Only the small part of the drizzle API the actions use is implemented:
// select / insert / update / delete, where(eq(...)), orderBy(asc/desc),
// limit, returning, and the column builders (integer, text, sqliteTable)
// with their chained .notNull() / .default() / .primaryKey() /
// .references() / .$defaultFn() calls. Handlers in actions.ts are
// otherwise copied verbatim, so behaviour stays the same.

export interface ColumnDef {
  tableName: string;
  key: string;
  sqlName: string;
  kind: "integer" | "text";
  mode?: "boolean" | "timestamp_ms";
  notNull?: boolean;
  hasDefault?: boolean;
  defaultValue?: unknown;
  defaultFn?: () => unknown;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
}

export interface TableDef {
  __tableName: string;
  __columns: Record<string, ColumnDef>;
  $inferSelect: Record<string, any>;
  $inferInsert: Record<string, any>;
}

class ColBuilder {
  readonly def: ColumnDef;
  constructor(
    tableName: string,
    key: string,
    sqlName: string,
    kind: "integer" | "text",
    mode?: "boolean" | "timestamp_ms",
  ) {
    this.def = { tableName, key, sqlName, kind, mode };
  }
  primaryKey(opts?: { autoIncrement?: boolean }): this {
    this.def.primaryKey = true;
    this.def.autoIncrement = Boolean(opts?.autoIncrement);
    return this;
  }
  notNull(): this {
    this.def.notNull = true;
    return this;
  }
  default(value: unknown): this {
    this.def.hasDefault = true;
    this.def.defaultValue = value;
    return this;
  }
  unique(): this {
    this.def.unique = true;
    return this;
  }
  references(_fn: () => unknown): this {
    return this;
  }
  $defaultFn(fn: () => unknown): this {
    this.def.defaultFn = fn;
    return this;
  }
}

export function integer(
  sqlName: string,
  opts?: { mode?: "boolean" | "timestamp_ms" },
): ColBuilder {
  return new ColBuilder("", "", sqlName, "integer", opts?.mode);
}

export function text(
  sqlName: string,
  _opts?: { enum?: string[] },
): ColBuilder {
  return new ColBuilder("", "", sqlName, "text");
}

export function sqliteTable<T extends Record<string, ColBuilder>>(
  name: string,
  columns: T,
): TableDef & { [K in keyof T]: ColumnDef } {
  const defs: Record<string, ColumnDef> = {};
  const table: Record<string, unknown> = {
    __tableName: name,
    __columns: defs,
  };
  for (const [key, builder] of Object.entries(columns)) {
    const def: ColumnDef = { ...builder.def, tableName: name, key };
    defs[key] = def;
    table[key] = def;
  }
  return table as unknown as TableDef & { [K in keyof T]: ColumnDef };
}

export interface Predicate {
  kind: "eq";
  col: ColumnDef;
  value: unknown;
}

export function eq(col: ColumnDef, value: unknown): Predicate {
  return { kind: "eq", col, value };
}

export interface SortSpec {
  kind: "asc" | "desc";
  col: ColumnDef;
}

export function asc(col: ColumnDef): SortSpec {
  return { kind: "asc", col };
}

export function desc(col: ColumnDef): SortSpec {
  return { kind: "desc", col };
}

type Row = Record<string, any>;

function toComparable(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  return v;
}

function matches(pred: Predicate | undefined, row: Row): boolean {
  if (!pred) return true;
  const actual = toComparable(row[pred.col.key]);
  const expected = toComparable(pred.value);
  return actual === expected;
}

function compareValues(a: unknown, b: unknown): number {
  const av = toComparable(a);
  const bv = toComparable(b);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

const STORE_KEY = "portagov-db-v1";

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable: the in-memory copy keeps working
    // for this session.
  }
}

export class LocalDb {
  private tables = new Map<string, Row[]>();
  private nextId = new Map<string, number>();
  private loaded = false;
  private defsByName = new Map<string, TableDef>();

  constructor(tableDefs: TableDef[]) {
    for (const t of tableDefs) this.defsByName.set(t.__tableName, t);
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    const raw = storageGet(STORE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        tables?: Record<string, Row[]>;
      };
      for (const [name, rows] of Object.entries(parsed.tables ?? {})) {
        const def = this.defsByName.get(name);
        if (!def || !Array.isArray(rows)) continue;
        const revived = rows.map((row) => this.reviveRow(def, row));
        this.tables.set(name, revived);
        let max = 0;
        for (const row of revived) {
          if (typeof row.id === "number" && row.id > max) max = row.id;
        }
        this.nextId.set(name, max + 1);
      }
    } catch {
      // A corrupt local copy must never stop the app opening.
      this.tables.clear();
      this.nextId.clear();
    }
  }

  private reviveRow(def: TableDef, row: Row): Row {
    const out: Row = { ...row };
    for (const col of Object.values(def.__columns)) {
      const v = out[col.key];
      if (col.mode === "timestamp_ms" && typeof v === "number") {
        out[col.key] = new Date(v);
      }
    }
    return out;
  }

  persist(): void {
    const tables: Record<string, Row[]> = {};
    for (const [name, rows] of this.tables) {
      const def = this.defsByName.get(name);
      tables[name] = rows.map((row) => {
        const out: Row = { ...row };
        if (def) {
          for (const col of Object.values(def.__columns)) {
            const v = out[col.key];
            if (col.mode === "timestamp_ms" && v instanceof Date) {
              out[col.key] = v.getTime();
            }
          }
        }
        return out;
      });
    }
    storageSet(STORE_KEY, JSON.stringify({ version: 1, tables }));
  }

  rowsFor(table: TableDef): Row[] {
    this.ensureLoaded();
    let rows = this.tables.get(table.__tableName);
    if (!rows) {
      rows = [];
      this.tables.set(table.__tableName, rows);
    }
    return rows;
  }

  normalizeValue(col: ColumnDef, value: unknown): unknown {
    if (value == null) return value;
    if (col.mode === "boolean") return Boolean(value);
    if (col.mode === "timestamp_ms") {
      if (value instanceof Date) return value;
      return new Date(value as string | number);
    }
    return value;
  }

  applyDefaults(table: TableDef, item: Row): Row {
    const row: Row = {};
    for (const col of Object.values(table.__columns)) {
      let value = item[col.key];
      if (value === undefined) {
        if (col.defaultFn) value = col.defaultFn();
        else if (col.hasDefault) value = col.defaultValue;
        else if (col.autoIncrement) {
          const next = this.nextId.get(table.__tableName) ?? 1;
          this.nextId.set(table.__tableName, next + 1);
          value = next;
        }
      }
      row[col.key] = this.normalizeValue(col, value);
    }
    // Keep any extra keys the caller set that are not columns.
    for (const [k, v] of Object.entries(item)) {
      if (!(k in row)) row[k] = v;
    }
    return row;
  }

  select(): SelectBuilder {
    return new SelectBuilder(this);
  }

  insert(table: TableDef): InsertBuilder {
    return new InsertBuilder(this, table);
  }

  update(table: TableDef): UpdateBuilder {
    return new UpdateBuilder(this, table);
  }

  delete(table: TableDef): DeleteBuilder {
    return new DeleteBuilder(this, table);
  }
}

class SelectBuilder {
  private table?: TableDef;
  private pred?: Predicate;
  private sort?: SortSpec;
  private limitN?: number;
  constructor(private db: LocalDb) {}
  from(table: TableDef): this {
    this.table = table;
    return this;
  }
  where(pred: Predicate): this {
    this.pred = pred;
    return this;
  }
  orderBy(sort: SortSpec): this {
    this.sort = sort;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  private exec(): Row[] {
    if (!this.table) throw new Error("Select needs a table.");
    let rows = this.db.rowsFor(this.table).filter((r) => matches(this.pred, r));
    if (this.sort) {
      const { col, kind } = this.sort;
      const dir = kind === "asc" ? 1 : -1;
      rows = [...rows].sort(
        (a, b) => dir * compareValues(a[col.key], b[col.key]),
      );
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows.map((r) => ({ ...r }));
  }
  then<TResult1 = Row[], TResult2 = never>(
    onFulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}

class InsertBuilder {
  private items: Row[] = [];
  private proj?: Record<string, ColumnDef>;
  constructor(
    private db: LocalDb,
    private table: TableDef,
  ) {}
  values(v: Row | Row[]): this {
    this.items = Array.isArray(v) ? v : [v];
    return this;
  }
  returning(proj?: Record<string, ColumnDef>): this {
    this.proj = proj;
    return this;
  }
  private conflict?: { target: ColumnDef; set: Row };
  /** Upsert: when a row already has the target column's value, update
      it with `set` instead of adding a second row. Used for the single
      release-mode setting row. */
  onConflictDoUpdate(spec: { target: ColumnDef; set: Row }): this {
    this.conflict = spec;
    return this;
  }
  private project(row: Row): Row {
    if (!this.proj) return { ...row };
    const out: Row = {};
    for (const [alias, col] of Object.entries(this.proj)) {
      out[alias] = row[col.key];
    }
    return out;
  }
  private exec(): Row[] {
    const rows = this.db.rowsFor(this.table);
    const out: Row[] = [];
    for (const item of this.items) {
      if (this.conflict) {
        const key = this.conflict.target.key;
        const existing = rows.find(
          (r) => toComparable(r[key]) === toComparable(item[key]),
        );
        if (existing) {
          for (const [k, v] of Object.entries(this.conflict.set)) {
            const col = (
              this.table.__columns as Record<string, ColumnDef>
            )[k];
            existing[k] = col ? this.db.normalizeValue(col, v) : v;
          }
          out.push(this.project(existing));
          continue;
        }
      }
      const row = this.db.applyDefaults(this.table, item);
      rows.push(row);
      out.push(this.project(row));
    }
    this.db.persist();
    return out;
  }
  then<TResult1 = Row[], TResult2 = never>(
    onFulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}

class UpdateBuilder {
  private patch: Row = {};
  private pred?: Predicate;
  constructor(
    private db: LocalDb,
    private table: TableDef,
  ) {}
  set(patch: Row): this {
    this.patch = patch;
    return this;
  }
  where(pred: Predicate): this {
    this.pred = pred;
    return this;
  }
  returning(proj?: Record<string, ColumnDef>): this {
    void proj;
    return this;
  }
  private exec(): Row[] {
    const rows = this.db.rowsFor(this.table);
    const updated: Row[] = [];
    for (const row of rows) {
      if (!matches(this.pred, row)) continue;
      for (const [k, v] of Object.entries(this.patch)) {
        const col = (this.table.__columns as Record<string, ColumnDef>)[k];
        row[k] = col ? this.db.normalizeValue(col, v) : v;
      }
      updated.push({ ...row });
    }
    if (updated.length > 0) this.db.persist();
    return updated;
  }
  then<TResult1 = Row[], TResult2 = never>(
    onFulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}

class DeleteBuilder {
  private pred?: Predicate;
  constructor(
    private db: LocalDb,
    private table: TableDef,
  ) {}
  where(pred: Predicate): this {
    this.pred = pred;
    return this;
  }
  private exec(): Row[] {
    const rows = this.db.rowsFor(this.table);
    const kept: Row[] = [];
    const removed: Row[] = [];
    for (const row of rows) {
      if (matches(this.pred, row)) removed.push({ ...row });
      else kept.push(row);
    }
    this.db.rowsFor(this.table).length = 0;
    this.db.rowsFor(this.table).push(...kept);
    if (removed.length > 0) this.db.persist();
    return removed;
  }
  then<TResult1 = Row[], TResult2 = never>(
    onFulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}
