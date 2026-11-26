import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, bindQueryClient, type ApiResponse } from "./api";
import { actionFields } from "./fields";
import { Actions } from "./actions";
import {
COUNTIES,
COUNTRIES,
DIAL_CODES,
DISTRICTS,
EMBASSIES,
EMBASSY_DIRECTORY,
EMBASSY_DELIVERY_FEE_USD,
EMERGENCY_FEE_USD,
FAST_TRACK_FEE_USD,
MINISTRIES,
OFFICES,
SERVICES,
STATUS_STEPS,
TIMEZONES,
TIME_SLOTS,
applicationStatusPlain,
USD_TO_LRD_RATE_LABEL,
communitiesForDistrict,
feeInLrd,
ministryById,
serviceById,
serviceDetails,
servicesForMinistry,
type Service,
SERVICE_CENTRE_HOURS,
} from "./services";
import QRCode from "qrcode";
import { logoMain, logoBadge, logoMark } from "./assets";
import { LIBERIA_FLAG_VIDEO, LIBERIA_FLAG_POSTER, HERO_LOGO_VIDEO, HERO_LOGO_POSTER } from "./heroVideos";
import {
  SafeAreaTopScrim,
  PdfViewer,
  ListenButton,
} from "./components";

const FIELDS = actionFields(Actions);

/* Safe on-device storage. In the phone app this page runs in an opaque
   origin, where reading window.localStorage throws a SecurityError. An
   unguarded read on the opening effect crashed the whole app to a blank
   page there, even though the same code worked in a normal browser tab.
   Every storage access in this file goes through this helper: it uses
   localStorage when the browser allows it, and otherwise keeps values in
   memory for the session, so the app always opens. Do not call
   window.localStorage directly anywhere in this file. */
const memoryStorage = new Map<string, string>();
const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memoryStorage.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Storage unavailable in this shell; the memory copy above keeps
         the value for this session. */
    }
  },
  remove(key: string): void {
    memoryStorage.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* Storage unavailable in this shell. */
    }
  },
  keys(): string[] {
    const found = new Set<string>(memoryStorage.keys());
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) found.add(key);
      }
    } catch {
      /* Storage unavailable in this shell; memory keys only. */
    }
    return [...found];
  },
};

type ProfileT = NonNullable<
  ApiResponse<typeof api, "findProfileByPhone">["profile"]
>;
type ApplicationT =
  ApiResponse<typeof api, "listApplications">["applications"][number];
type DocumentT = ApiResponse<typeof api, "listDocuments">["documents"][number];
type AppointmentT =
  ApiResponse<typeof api, "listAppointments">["appointments"][number];
type PaymentT = ApiResponse<typeof api, "listPayments">["payments"][number];
type MemberT = ApiResponse<typeof api, "listFamily">["members"][number];
type AgentT = ApiResponse<typeof api, "listAgents">["agents"][number];

type Route =
  | { name: "home" }
  | { name: "ministry"; id: string }
  | { name: "service"; id: string }
  | { name: "signin" }
  | { name: "account" }
  | { name: "apply"; serviceId: string }
  | { name: "applications" }
  | { name: "application"; id: number }
  | { name: "wallet" }
  | { name: "appointments" }
  | { name: "payments" }
  | { name: "family" }
  | { name: "track" }
  | { name: "institution" }
  | { name: "reports" }
  | { name: "access" }
  | { name: "how" }
  | { name: "help" }
  | { name: "centre" }
  | { name: "business" }
  | { name: "verify" }
  | { name: "queues" }
  | { name: "privacy" }
  | { name: "certificate"; id: number }
  | { name: "embassies" }
  | { name: "dashboard" }
  | { name: "training" }
  | { name: "near" }
  | { name: "shared"; token: string }
  | { name: "staff" }
  | { name: "status" }
  | { name: "portal"; id: string }
  | { name: "onboarding" };

function parseRoutePath(raw: string): Route {
  const parts = raw.split("/").filter(Boolean);
  const [head, arg] = parts;
  switch (head) {
    case "ministry":
      return { name: "ministry", id: arg ?? "" };
    case "service":
      return { name: "service", id: arg ?? "" };
    case "signin":
      return { name: "signin" };
    case "account":
      return { name: "account" };
    case "apply":
      return { name: "apply", serviceId: arg ?? "" };
    case "applications":
      return { name: "applications" };
    case "application":
      return { name: "application", id: Number(arg ?? 0) };
    case "wallet":
      return { name: "wallet" };
    case "appointments":
      return { name: "appointments" };
    case "payments":
      return { name: "payments" };
    case "family":
      return { name: "family" };
    case "track":
      return { name: "track" };
    case "institution":
      return arg ? { name: "portal", id: arg } : { name: "institution" };
    case "reports":
      return { name: "reports" };
    case "platform":
      return { name: "reports" };
    case "access":
      return { name: "access" };
    case "how":
      return { name: "how" };
    case "help":
      return { name: "help" };
    case "centre":
      return { name: "centre" };
    case "business":
      return { name: "business" };
    case "verify":
      return { name: "verify" };
    case "queues":
      return { name: "queues" };
    case "privacy":
      return { name: "privacy" };
    case "certificate":
      return { name: "certificate", id: Number(arg ?? 0) };
    case "embassies":
      return { name: "embassies" };
    case "dashboard":
      return { name: "dashboard" };
    case "training":
      return { name: "training" };
    case "near":
      return { name: "near" };
    case "shared":
      return { name: "shared", token: arg ?? "" };
    case "staff":
      return { name: "staff" };
    case "status":
      return { name: "status" };
    case "onboarding":
      return { name: "onboarding" };
    default:
      return { name: "home" };
  }
}

function parseHash(): Route {
  try {
    return parseRoutePath(window.location.hash.replace(/^#\/?/, ""));
  } catch {
    return currentRoute ?? { name: "home" };
  }
}

/* In-app navigation. In the phone app this page runs inside a locked-down
   view where touching window.location can throw, the same restriction that
   blocks localStorage there. When that happened, every button and link
   that navigated by setting the hash silently did nothing, so the whole
   site felt dead. nav() therefore routes through app state first: it
   records the route, notifies the mounted App directly, and only then
   tries to update the address hash as a courtesy for real browsers. A
   global click handler in App sends every internal anchor through nav()
   too, so plain links and buttons behave exactly the same. */
let currentRoute: Route | null = null;
const routeListeners = new Set<(route: Route) => void>();

/* The page scrolls inside the shell's root container, not the window, so
   window.scrollTo alone leaves the old scroll position sitting on the new
   page: the reader lands at the footer of the page they just opened.
   Reset every candidate scroller by direct assignment, which is instant
   even where the container animates programmatic scrolls, and repeat the
   reset after the new page renders (see the effect in App). */
function scrollToTop() {
  try {
    window.scrollTo(0, 0);
  } catch {
    /* Scrolling unavailable in this shell. */
  }
  try {
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.querySelector("[data-hatch-space-root]"),
      document.querySelector("[data-generated-space-root]"),
    ];
    for (const el of candidates) {
      if (el) el.scrollTop = 0;
    }
  } catch {
    /* Scrolling unavailable in this shell. */
  }
}

/* The stack of pages the person has opened, in order. Back and the X
   close button walk this stack inside the app instead of relying on
   window.history.back(): in the phone shell a history step can be
   swallowed silently, which left people pressing Back again and again
   and going nowhere. Walking our own stack always moves on the first
   tap, to exactly the page the person came from. */
let pathStack: string[] | null = null;

function hashPath(): string {
  try {
    return window.location.hash || "#/";
  } catch {
    return "#/";
  }
}

function stack(): string[] {
  if (!pathStack) pathStack = [hashPath()];
  return pathStack;
}

function applyPath(path: string) {
  const route = parseRoutePath(path.replace(/^#\/?/, ""));
  currentRoute = route;
  routeListeners.forEach((fn) => fn(route));
  try {
    window.location.hash = path;
  } catch {
    /* Address bar unavailable in this shell; state routing already applied. */
  }
  scrollToTop();
}

function nav(path: string) {
  const s = stack();
  if (s[s.length - 1] !== path) s.push(path);
  applyPath(path);
}

/** Go back to the page the person came from; fall back to Home when this
    page was opened directly. Used by the back arrow on every page. The X
    close button does not use this: it closes the page outright, see
    closePage(). */
function goBack() {
  const s = stack();
  if (s.length > 1) {
    s.pop();
    applyPath(s[s.length - 1] ?? "#/");
    return;
  }
  pathStack = ["#/"];
  applyPath("#/");
}

/** Close the page the person is on and go to the homepage, clearing the
    page stack so the person is out of that page entirely, not one step
    back. Used by the X close button on every page. */
function closePage() {
  pathStack = ["#/"];
  applyPath("#/");
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => currentRoute ?? parseHash());
  useEffect(() => {
    const apply = (r: Route) => {
      currentRoute = r;
      setRoute(r);
      scrollToTop();
    };
    const onChange = () => {
      /* Keep the back stack in step with hash changes that did not come
         from nav() or goBack(), such as a real browser's own back and
         forward buttons: landing on the previous page pops the stack,
         landing anywhere new pushes it. */
      const h = hashPath();
      const s = stack();
      if (s[s.length - 1] !== h) {
        if (s[s.length - 2] === h) s.pop();
        else s.push(h);
      }
      apply(parseHash());
    };
    routeListeners.add(apply);
    window.addEventListener("hashchange", onChange);
    return () => {
      routeListeners.delete(apply);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);
  return route;
}

const PROTECTED: ReadonlySet<Route["name"]> = new Set([
  "account",
  "apply",
  "applications",
  "application",
  "wallet",
  "appointments",
  "payments",
  "family",
  "business",
  "certificate",
]);

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

/** The clock time when a lockout ends, so a locked-out person knows
    exactly when to try again instead of guessing. */
function retryTime(minutesLeft: number): string {
  return new Date(Date.now() + minutesLeft * 60000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Plain-words lockout message, shared by the citizen code step, the
    sign-up code step, and the staff second step. */
function lockMessage(minutesLeft: number): string {
  return `Too many wrong codes. This account is locked for about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}. Try again after ${retryTime(minutesLeft)}.`;
}

/** How long an application has waited since it was submitted, in plain
    words, computed from its real submitted time. */
function waitLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "just arrived";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just arrived";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Real sharpness check for a photo, run in the browser before submit.
    The image is shrunk to a small size and the variance of its Laplacian
    is measured: a sharp photo has strong edges and a high variance, a
    blurry photo has soft edges and a low one. Returns null when the
    check could not run, so no warning is shown on a guess. A low score
    is a warning, never proof on its own, and the person can still
    submit if they choose to. */
function measureSharpness(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = 160;
        const h = Math.max(1, Math.round((img.naturalHeight * w) / img.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx2d.drawImage(img, 0, 0, w, h);
        const data = ctx2d.getImageData(0, 0, w, h).data;
        const grey: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          grey.push(0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0));
        }
        let sum = 0;
        let count = 0;
        for (let y = 1; y < h - 1; y += 1) {
          for (let x = 1; x < w - 1; x += 1) {
            const c = grey[y * w + x] ?? 0;
            const lap =
              (grey[(y - 1) * w + x] ?? 0) +
              (grey[(y + 1) * w + x] ?? 0) +
              (grey[y * w + x - 1] ?? 0) +
              (grey[y * w + x + 1] ?? 0) -
              4 * c;
            sum += lap * lap;
            count += 1;
          }
        }
        URL.revokeObjectURL(url);
        resolve(count > 0 ? sum / count : null);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Real checks on a staged wallet file, run before it is saved. Each
    check uses the file itself: its type, its size, its pixel size, and
    its measured sharpness. Returns one plain warning per problem found,
    or an empty list when nothing is wrong. */
function checkStagedDoc(
  docType: string,
  staged: StagedDoc,
): string[] {
  const warnings: string[] = [];
  const f = staged.file;
  const isImage = f.type.startsWith("image/");
  const isPdf = f.type === "application/pdf";
  if (!isImage && !isPdf) {
    warnings.push(
      `This file is a ${f.type || "unknown type"}, not a photo or a PDF. Check that you picked the right file for ${docType}.`,
    );
  }
  if (docType === "Passport photograph" && isPdf) {
    warnings.push(
      "A passport photograph must be a photo, not a PDF. Replace this file with a photo.",
    );
  }
  if (docType === "Passport photograph" && isImage && f.size < 20 * 1024) {
    warnings.push(
      `This photo is only ${formatFileSize(f.size)}, which is very small for a passport photograph. A small file is often a compressed or low quality copy. Use the original full quality photo.`,
    );
  }
  if (
    docType === "Passport photograph" &&
    staged.dims &&
    (staged.dims.w < 600 || staged.dims.h < 600)
  ) {
    warnings.push(
      `This photo is ${staged.dims.w} by ${staged.dims.h} pixels, smaller than the 600 by 600 pixels a passport photograph needs. Use a sharper, full quality photo, because this is the photo printed in your passport.`,
    );
  }
  if (
    isImage &&
    staged.dims &&
    docType !== "Passport photograph" &&
    (staged.dims.w < 400 || staged.dims.h < 400)
  ) {
    warnings.push(
      `This image is only ${staged.dims.w} by ${staged.dims.h} pixels, which is small and may be hard for an officer to read. Use a clearer copy if you have one.`,
    );
  }
  if (staged.sharpness !== null && staged.sharpness < 15) {
    warnings.push(
      "This photo looks blurry. Take a new one in good light, hold the phone still, and check that the writing or face is sharp before you save it.",
    );
  }
  return warnings;
}

function parseDetails(json: string): { label: string; value: string }[] {
  try {
    const v: unknown = JSON.parse(json);
    if (Array.isArray(v)) {
      return v.filter(
        (x): x is { label: string; value: string } =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as { label?: unknown }).label === "string" &&
          typeof (x as { value?: unknown }).value === "string",
      );
    }
  } catch {
    return [];
  }
  return [];
}

function parseIds(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((x): x is number => typeof x === "number")
      : [];
  } catch {
    return [];
  }
}

/* ---------- wizard date fields ---------- */

/* A date field must hold a real calendar date in YYYY-MM-DD form,
   never typed digits stored as text. A plain text box let a citizen
   type 03141995, which was saved literally as the date of birth and
   only failed later, at payment time, with "Date of birth must be a
   valid date." These helpers are used by every form that renders a
   service date field: the field is a date picker, its value is
   normalised on entry, and Step 3 and submit both refuse a bad date
   with the field's own label, before anything is sent. */
function normalizeDateValue(raw: string): string {
  const v = (raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length === 8) {
    const y1 = digits.slice(0, 4);
    if (y1.startsWith("19") || y1.startsWith("20")) {
      return `${y1}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    const a = Number(digits.slice(0, 2));
    const b = Number(digits.slice(2, 4));
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      return `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
    }
    if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
      return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
  }
  return v;
}

function isRealDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/** Null when the value is a usable date, otherwise a plain message
    naming the field. Past dates only (birth, death, incident,
    marriage) must not be in the future; an expiry date may be past
    when the document is expired, so it is only checked as a date. */
function dateFieldError(
  field: { key: string; label: string; kind?: string },
  raw: string,
): string | null {
  if (field.kind !== "date") return null;
  const v = normalizeDateValue(raw);
  if (!isRealDate(v)) {
    return `${field.label} must be a valid date. Pick it from the calendar, for example 1995-03-14.`;
  }
  if (field.key !== "expiryDate") {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (v > todayIso) {
      return `${field.label} cannot be in the future. Pick the real date.`;
    }
  }
  return null;
}

/* ---------- shared UI ---------- */

function Chip({ children, tone }: { children: ReactNode; tone?: "gold" | "plain" }) {
  return (
    <span
      className={
        tone === "gold"
          ? "inline-block rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--warn)]"
          : "inline-block rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--dim)]"
      }
    >
      {children}
    </span>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-bold text-[var(--text)]">{children}</h2>
      {sub ? <p className="mt-1 text-sm text-[var(--dim)]">{sub}</p> : null}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 whitespace-nowrap rounded-lg bg-[var(--navy)] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      style={{ backgroundColor: "#0a2a5e" }}
    >
      {children}
    </button>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-5 py-2.5 font-bold text-[#0a2a5e] disabled:opacity-50 ${className ?? ""}`}
      style={{ backgroundColor: "#d9a821" }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-[var(--text)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** First letter of the first name, plus the first letter of the last
    name when there is one, for the avatar shown when no photo is saved. */
function profileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return (parts[0]?.[0] ?? "P").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/** Circular citizen avatar: the saved profile photo when there is one,
    otherwise the person's initials on a navy circle. */
function ProfileAvatar({
  profile,
  size = 36,
}: {
  profile: ProfileT;
  size?: number;
}) {
  if (profile.photo) {
    return (
      <img
        src={profile.photo}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: "#0a2a5e",
        fontSize: size * 0.4,
      }}
    >
      {profileInitials(profile.full_name)}
    </span>
  );
}

/** The back arrow at the top left of every opened page: returns the
    person to exactly where they came from. */
function BackArrow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick ?? goBack}
      aria-label="Back to where you came from"
      title="Back"
      className="flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 font-semibold text-[var(--text)] shadow-sm"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-sm">Back</span>
    </button>
  );
}

/** The X close button at the top right of every opened page: closes the
    page outright and goes to the homepage, clearing the page stack. It
    is not a back button: the Back button takes the person to the previous
    page, the X closes where they were. An explicit onClick, when passed,
    is used instead. */
function CloseX({ onClick, label }: { onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick ?? closePage}
      aria-label={label ?? "Close"}
      title={label ?? "Close"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-[var(--text)]">
      {children}
    </label>
  );
}

const inputCls =
  "min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]";

/* Liberian identity document formats, checked the same way on the server.
   National ID: the NIR card carries a 10 digit National Identification
   Number; the card number itself is 2 letters plus 7 digits on the current
   biometric card (LR1234567) and 3 letters plus 7 digits on the older card
   (LIB1234567). Passport: one or two letters followed by 6 to 8 digits, the shapes
   published for Liberian passport numbers (L123456 in the bank identifier
   list, L12345678 and PP1234567 on the current e-passport series). */
export function nationalIdProblem(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!v) return "Type your national ID number, or choose a different way to prove who you are below.";
  if (!/^(\d{10}|[A-Z]{2}\d{7}|[A-Z]{3}\d{7})$/.test(v))
    return "That does not match a Liberian national ID. It is either the 10 digit number on your card, or the card number: 2 letters plus 7 digits, like LR1234567 (older cards: 3 letters plus 7 digits). Check the card and type it again.";
  return null;
}

export function passportNumberProblem(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!v) return "Type your passport number, or choose a different way to prove who you are below.";
  if (!/^[A-Z]{1,2}\d{6,8}$/.test(v))
    return "That does not match a Liberian passport number. It is one or two letters followed by digits, like PP1234567 or L12345678, printed at the top of the passport's photo page. Check it and type it again.";
  return null;
}

/* ---------- phone number with country picker ---------- */

const PHONE_COUNTRIES = COUNTRIES.filter((c) => DIAL_CODES[c]);

/** Compose the one stored form: +code followed by the national digits,
    with any trunk 0 or repeated country code removed. */
function composePhone(country: string, digitsRaw: string): string {
  const code = DIAL_CODES[country] ?? "231";
  let d = digitsRaw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(code) && d.length > code.length + 6) d = d.slice(code.length);
  d = d.replace(/^0+/, "");
  return d ? `+${code}${d}` : "";
}

/** Split a stored phone back into picker country and national digits.
    Numbers without a country code are read as Liberian local numbers. */
function splitPhone(value: string): { country: string; digits: string } {
  const clean = value.replace(/[\s()-]/g, "");
  if (clean.startsWith("+") || clean.startsWith("00")) {
    const intl = clean.replace(/^00/, "").replace(/^\+/, "");
    let bestCountry = "";
    let bestCode = "";
    for (const c of PHONE_COUNTRIES) {
      const code = DIAL_CODES[c] ?? "";
      if (code && intl.startsWith(code) && code.length > bestCode.length) {
        bestCountry = c;
        bestCode = code;
      }
    }
    if (bestCountry)
      return { country: bestCountry, digits: intl.slice(bestCode.length) };
    return { country: "Liberia", digits: intl };
  }
  return { country: "Liberia", digits: clean.replace(/^0+/, "") };
}

function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
  fieldProps,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  fieldProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  const [country, setCountry] = useState(() => splitPhone(value).country);
  const [digits, setDigits] = useState(() => splitPhone(value).digits);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      const s = splitPhone(value);
      setCountry(s.country);
      setDigits(s.digits);
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = (c: string, d: string) => {
    const v = composePhone(c, d);
    lastEmitted.current = v;
    onChange(v);
  };
  const code = DIAL_CODES[country] ?? "231";

  return (
    <div className="flex w-full min-w-0">
      <select
        aria-label="Country dialling code"
        value={country}
        onChange={(e) => {
          setCountry(e.target.value);
          emit(e.target.value, digits);
        }}
        className="w-28 min-w-0 shrink-0 truncate rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-[var(--text)] sm:w-40"
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="flex shrink-0 items-center border-y border-[var(--border)] bg-[var(--surface-alt)] px-2 font-semibold text-[var(--dim)]"
      >
        +{code}
      </span>
      <input
        {...fieldProps}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={digits}
        onChange={(e) => {
          setDigits(e.target.value);
          emit(country, e.target.value);
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-r-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
      />
    </div>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  if (idx < 0) {
    return (
      <div className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
        Current status: {status}. The institution has asked for more
        information. Read their note below and contact the institution desk if
        anything is unclear.
      </div>
    );
  }
  return (
    <ol className="space-y-0">
      {STATUS_STEPS.map((step, i) => (
        <li key={step} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={
                i < idx
                  ? { backgroundColor: "#0a2a5e", color: "#fff" }
                  : i === idx
                    ? { backgroundColor: "#d9a821", color: "#0a2a5e" }
                    : {
                        backgroundColor: "var(--surface-alt)",
                        color: "var(--dim)",
                        border: "1px solid var(--border)",
                      }
              }
            >
              {i < idx ? "✓" : i + 1}
            </span>
            {i < STATUS_STEPS.length - 1 ? (
              <span className="w-px flex-1 bg-[var(--border)]" style={{ minHeight: 14 }} />
            ) : null}
          </div>
          <p
            className={
              i === idx
                ? "pb-3 text-sm font-bold text-[var(--text)]"
                : "pb-3 text-sm text-[var(--dim)]"
            }
          >
            {step}
            {i === idx ? " (current)" : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ApplicationCard({
  app,
  onOpen,
}: {
  app: ApplicationT;
  onOpen: () => void;
}) {
  const plain = applicationStatusPlain(app.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold text-[var(--text)]">
            {app.service_name}
          </p>
          <p className="text-sm text-[var(--dim)]">{app.institution}</p>
        </div>
        <Chip tone="gold">{plain.short}</Chip>
      </div>
      <p className="mt-2 text-sm text-[var(--text)]">
        Status: {app.status}. {plain.meaning}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--dim)]">
        <span>
          Reference <strong className="text-[var(--text)]">{app.reference}</strong>
        </span>
        <span>Submitted {fmtDate(app.created_at)}</span>
        <span>{app.channel}</span>
      </div>
    </button>
  );
}

/* ---------- signed-in home: one home screen per person ----------
   Added for the organised batch. This is the one combined view: the
   next thing to do at the top, computed from real data, then the
   person's applications, appointments and wallet documents in one
   place. It is used on the signed-in home page and in My account, so
   there is one home screen, not two different ones. Expiry reminders
   are included here, so they appear on the home screen as well as in
   the wallet. Data is the person's own browser data until shared
   backend storage lands. */

function daysUntil(dateStr: string): number {
  const t = new Date(`${dateStr}T00:00:00`).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - Date.now()) / 86400000);
}

function SignedInHome({ profile }: { profile: ProfileT }) {
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const appts = useQuery({
    queryKey: ["appointments", profile.id],
    queryFn: () => api.listAppointments({ profileId: profile.id }),
  });
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const applications = apps.data?.applications ?? [];
  const appointments = appts.data?.appointments ?? [];
  const documents = (docs.data?.documents ?? []).filter(
    (d: DocumentT) => d.status !== "Superseded",
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = appointments
    .filter((a: AppointmentT) => a.status === "Booked" && a.date >= todayStr)
    .sort((a: AppointmentT, b: AppointmentT) =>
      `${a.date} ${a.time_slot}`.localeCompare(`${b.date} ${b.time_slot}`),
    );
  const nextAppt = upcoming[0];
  const expiring = documents
    .filter((d: DocumentT) => d.expires_on)
    .map((d: DocumentT) => ({ doc: d, days: daysUntil(d.expires_on) }))
    .sort((a, b) => a.days - b.days);
  const expiredDoc = expiring.find((x) => x.days < 0);
  const soonDoc = expiring.find((x) => x.days >= 0 && x.days <= 30);
  const openApps = applications.filter(
    (a: ApplicationT) => a.status !== "Completed",
  );
  const readyApp = applications.find(
    (a: ApplicationT) => a.status === "Ready for collection",
  );
  const needsInfoApp = applications.find(
    (a: ApplicationT) => a.status === "More information needed",
  );
  const unpaidApp = applications.find(
    (a: ApplicationT) =>
      a.billing_status !== "Paid" && a.total_due > 0 && a.status !== "Completed",
  );

  type NextAction = { title: string; detail: string; href: string; label: string };
  let next: NextAction | null = null;
  if (needsInfoApp) {
    next = {
      title: "One more thing is needed for your application",
      detail: `${needsInfoApp.service_name}, ${needsInfoApp.reference}. ${needsInfoApp.status_note || "Open the application and read the note from PortaGov."}`,
      href: `#/application/${needsInfoApp.id}`,
      label: "Open the application",
    };
  } else if (readyApp) {
    next = {
      title: "Your document is ready to collect",
      detail: `${readyApp.service_name}, ${readyApp.reference}. Bring your pickup code${readyApp.pickup_code ? ` ${readyApp.pickup_code}` : ""} and your ID.`,
      href: `#/application/${readyApp.id}`,
      label: "See pickup details",
    };
  } else if (expiredDoc) {
    next = {
      title: `Your ${expiredDoc.doc.title} has expired`,
      detail: `It expired on ${fmtDate(expiredDoc.doc.expires_on)}. Renew it, then update it in your wallet so no application is refused.`,
      href: "#/wallet",
      label: "Update it in my wallet",
    };
  } else if (unpaidApp) {
    next = {
      title: "A payment is due",
      detail: `${unpaidApp.service_name}, billing number ${unpaidApp.billing_number}. $${unpaidApp.total_due - unpaidApp.amount_paid} is still to pay. PortaGov releases the application only when the billing number is confirmed paid.`,
      href: `#/application/${unpaidApp.id}`,
      label: "Pay with mobile money",
    };
  } else if (nextAppt) {
    const days = daysUntil(nextAppt.date);
    next = {
      title: `Your visit is ${days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`,
      detail: `${nextAppt.kind}, ${fmtDate(nextAppt.date)}, ${nextAppt.time_slot}, at ${nextAppt.office}. Bring your ID${nextAppt.ticket ? ` and ticket ${nextAppt.ticket}` : ""}.`,
      href: "#/appointments",
      label: "See my appointments",
    };
  } else if (soonDoc) {
    next = {
      title: `Your ${soonDoc.doc.title} expires soon`,
      detail: `It expires on ${fmtDate(soonDoc.doc.expires_on)}, in ${soonDoc.days} days. Renew it in good time, then update it in your wallet.`,
      href: "#/wallet",
      label: "Update it in my wallet",
    };
  } else if (openApps.length > 0) {
    const first = openApps[0]!;
    const plain = applicationStatusPlain(first.status);
    next = {
      title: "Follow your application",
      detail: `${first.service_name}, ${first.reference}. Status: ${plain.short}. ${plain.meaning}`,
      href: `#/application/${first.id}`,
      label: "Open the application",
    };
  }

  const loading = apps.isPending || appts.isPending || docs.isPending;
  return (
    <section aria-label="My PortaGov home" className="mx-auto max-w-6xl px-4 pt-6">
      <SectionTitle sub="Your applications, appointments and wallet documents in one place.">
        My PortaGov home
      </SectionTitle>
      {loading ? (
        <p className="text-[var(--dim)]">Loading your home screen...</p>
      ) : (
        <div className="space-y-5">
          {next ? (
            <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#d9a821" }}>
                Next thing to do
              </p>
              <h3 className="mt-1 font-display text-xl font-extrabold">{next.title}</h3>
              <p className="mt-1 text-sm text-white/85">{next.detail}</p>
              <div className="mt-3">
                <GoldButton onClick={() => nav(next.href)}>{next.label}</GoldButton>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">
                Nothing needs you right now
              </h3>
              <p className="mt-1 text-sm text-[var(--dim)]">
                No application is waiting on you, no payment is due, no visit
                is booked, and no document is about to expire. When you start
                a service, your next step will appear here.
              </p>
              <div className="mt-3">
                <PrimaryButton onClick={() => nav("#/")}>Browse services</PrimaryButton>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">My applications</h3>
              {applications.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dim)]">No applications yet.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {applications.slice(0, 3).map((a: ApplicationT) => {
                    const plain = applicationStatusPlain(a.status);
                    return (
                      <li key={a.id}>
                        <a href={`#/application/${a.id}`} className="block">
                          <span className="text-sm font-bold text-[var(--text)]">{a.service_name}</span>
                          <span className="mt-1 block text-sm text-[var(--dim)]">
                            {a.reference} <Chip tone="gold">{plain.short}</Chip>
                          </span>
                          <span className="mt-1 block text-sm text-[var(--dim)]">{plain.meaning}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-sm font-semibold">
                <a href="#/applications" className="underline" style={{ color: "var(--accent)" }}>
                  See all my applications ({applications.length})
                </a>
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">My appointments</h3>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  No visits booked yet. When a service needs you in person, you book the visit from that application.
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {upcoming.slice(0, 2).map((a: AppointmentT) => (
                    <li key={a.id} className="text-sm text-[var(--text)]">
                      <strong>{a.kind}</strong>, {fmtDate(a.date)}, {a.time_slot}
                      <span className="block text-[var(--dim)]">
                        {a.office}
                        {a.application_ref ? `, for ${a.application_ref}` : ""}
                        {a.ticket ? `, ticket ${a.ticket}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm font-semibold">
                <a href="#/appointments" className="underline" style={{ color: "var(--accent)" }}>
                  See all my appointments ({upcoming.length} coming up)
                </a>
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">My wallet documents</h3>
              {documents.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dim)]">No documents saved yet.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {expiring.slice(0, 3).map(({ doc, days }) => (
                    <li key={doc.id} className="text-sm text-[var(--text)]">
                      <strong>{doc.title}</strong> ({doc.doc_type})
                      <span className="block text-[var(--dim)]">
                        Expires {fmtDate(doc.expires_on)}
                        {days < 0
                          ? `, expired ${Math.abs(days)} days ago`
                          : days === 0
                            ? ", expires today"
                            : `, ${days} days left`}
                      </span>
                    </li>
                  ))}
                  {expiring.length === 0 ? (
                    <li className="text-sm text-[var(--dim)]">
                      {documents.length} document{documents.length === 1 ? "" : "s"} saved, none with an expiry date.
                    </li>
                  ) : null}
                </ul>
              )}
              <p className="mt-3 text-sm font-semibold">
                <a href="#/wallet" className="underline" style={{ color: "var(--accent)" }}>
                  Open my document wallet ({documents.length} saved)
                </a>
              </p>
            </div>
          </div>

          <ExpiryReminders profile={profile} />
        </div>
      )}
    </section>
  );
}

/* ---------- home page ---------- */

function HomePage({
  profile,
  goApply,
  lowData,
}: {
  profile: ProfileT | null;
  goApply: (service: Service) => void;
  lowData?: boolean;
}) {
  return (
    <div>
      <EmergencyBanner />
      <FeatureNoteStrip />
      <section
        style={{ backgroundColor: "#0a2a5e" }}
        className="relative overflow-hidden text-white"
      >
        {lowData ? null : (
          <>
            <video
              aria-hidden
              className="hero-bg-video absolute inset-0 h-full w-full object-cover opacity-60"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={LIBERIA_FLAG_POSTER}
            >
              <source src={LIBERIA_FLAG_VIDEO} type="video/mp4" />
            </video>
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(7, 31, 69, 0.92) 0%, rgba(10, 42, 94, 0.73) 55%, rgba(5, 22, 48, 0.58) 100%)",
              }}
            />
          </>
        )}
        <div className="relative mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-start gap-3 px-4 py-10 md:gap-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#d9a821" }}>
              Citizens. Services. Connected.
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">
              Government services, from your home.
            </h1>
            <p className="mt-3 max-w-xl text-base text-white/85">
              Apply from home. Pay with mobile money. Come in only when you
              are told to.
            </p>
            {profile ? (
              <div className="mt-5 flex flex-nowrap gap-2 sm:gap-3">
                <GoldButton onClick={() => nav("#/applications")} className="min-w-0 flex-1 px-3 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base">
                  My applications
                </GoldButton>
                <button
                  type="button"
                  onClick={() => nav("#/account")}
                  className="min-w-0 flex-1 rounded-lg border border-white/50 px-3 py-2 text-sm font-semibold text-white sm:px-5 sm:py-2.5 sm:text-base"
                >
                  Welcome back, {profile.full_name.split(" ")[0]}: my account
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-nowrap gap-2 sm:gap-3">
                <GoldButton onClick={() => nav("#/signin")} className="min-w-0 flex-1 px-3 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base">
                  Sign in or create your account
                </GoldButton>
                <button
                  type="button"
                  onClick={() => nav("#/track")}
                  className="min-w-0 flex-1 rounded-lg border border-white/50 px-3 py-2 text-sm font-semibold text-white sm:px-5 sm:py-2.5 sm:text-base"
                >
                  Track an application
                </button>
              </div>
            )}
          </div>
          {lowData ? null : (
          <div className="w-20 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 md:w-64 md:rounded-2xl md:p-3">
            <img
              src={logoMain}
              alt="PortaGov logo: a white G with a gold gate bar in a navy circle, portagov written underneath"
              className="h-auto w-full"
            />
          </div>
          )}
        </div>
        <div
          style={{ backgroundColor: "#d9a821" }}
          className="relative h-1.5"
        />
      </section>

      {profile ? <SignedInHome profile={profile} /> : null}

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <FinderSection />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <SectionTitle sub="One account for the whole of government. PortaGov receives your application first, checks it, then releases it to the right institution. The institution never sees it before PortaGov releases it.">
          What PortaGov is
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              t: "One account, every institution",
              d: "Your details are collected once and saved in your profile. Every application after that fills itself in, and your documents live in one wallet you reuse.",
            },
            {
              t: "Apply from home, travel once",
              d: "Passports, police clearance, birth certificates, business registration and more. You come in only for biometrics at a booked time, or to collect what is ready.",
            },
            {
              t: "Checked by PortaGov first",
              d: "PortaGov holds and reviews each application before releasing it to the institution, so incomplete applications are caught early and your progress is tracked at every step.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <h3 className="font-display text-lg font-bold text-[var(--text)]">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <SectionTitle sub="Choose a ministry or agency to see the services it renders. Each one has its own page.">
          Ministries and agencies
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MINISTRIES.map((m) => (
            <a
              key={m.id}
              href={`#/ministry/${m.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold leading-snug text-[var(--text)]">
                  {m.name}
                </h3>
                <Chip>{servicesForMinistry(m.id).length} services</Chip>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{m.blurb}</p>
              <p className="mt-3 text-sm font-bold" style={{ color: "var(--accent)" }}>
                View ministry page
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-2">
        <AnnouncementsBoard />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <SectionTitle sub="Every service on PortaGov. Open a service to see what it needs, then sign in to start it.">
          All services
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {SERVICES.map((s) => {
            const m = ministryById(s.ministryId);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a href={`#/service/${s.id}`} className="font-display text-base font-bold text-[var(--text)]">
                    {s.name}
                  </a>
                  <Chip tone="gold">{s.visitType}</Chip>
                </div>
                <p className="mt-1 text-sm text-[var(--dim)]">{s.blurb}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a href={`#/ministry/${m.id}`} className="text-sm font-semibold text-[var(--dim)]">
                    {m.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => goApply(s)}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                    style={{ backgroundColor: "#0a2a5e" }}
                    aria-label={`Start ${s.name}`}
                  >
                    Start this service
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl p-6 text-white" style={{ backgroundColor: "#0a2a5e" }}>
            <h2 className="font-display text-xl font-bold">How it works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/90">
              <li>Create your account once. Your profile is saved.</li>
              <li>Choose a service and apply from home, documents attached from your wallet.</li>
              <li>PortaGov reviews your application, then releases it to the institution.</li>
              <li>The institution confirms receipt and processes it.</li>
              <li>You are told when to come in: biometrics at a booked time, or collection only.</li>
            </ol>
            <button
              type="button"
              onClick={() => nav("#/how")}
              className="mt-4 rounded-lg border border-white/50 px-4 py-2 text-sm font-semibold text-white"
            >
              Read the full guide
            </button>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl font-bold text-[var(--text)]">
              Five ways PortaGov reaches everyone
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--dim)]">
              <li><strong className="text-[var(--text)]">Document wallet:</strong> upload once, reuse everywhere.</li>
              <li><strong className="text-[var(--text)]">Mobile money:</strong> pay with MTN MoMo or Orange Money.</li>
              <li><strong className="text-[var(--text)]">Agent assisted:</strong> a PortaGov agent can apply with you or for you.</li>
              <li><strong className="text-[var(--text)]">Diaspora:</strong> apply from abroad, for yourself or family at home.</li>
              <li><strong className="text-[var(--text)]">Low bandwidth:</strong> light pages that work on basic phones and slow connections.</li>
            </ul>
            <div className="mt-4">
              <GhostButton onClick={() => nav("#/access")}>
                How each way works
              </GhostButton>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-display text-xl font-bold text-[var(--text)]">
            Liberian embassies, for citizens abroad
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--dim)]">
            Living outside Liberia? You can apply from the country you are in
            and collect your document at the Liberian embassy there, or have
            it ready for you in Liberia. The embassy directory lists every
            Liberian embassy with its hours, contacts, and what it can
            collect or deliver for you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => nav("#/embassies")}>
              See the embassy directory
            </PrimaryButton>
            <GhostButton onClick={() => nav("#/access")}>
              Applying from abroad
            </GhostButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- ministry page ---------- */

function MinistryPage({ id }: { id: string }) {
  const m = MINISTRIES.find((x) => x.id === id);
  if (!m) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">Ministry not found</h1>
        <p className="mt-2 text-[var(--dim)]">
          <a href="#/" className="font-semibold underline">Return to the home page</a> and
          choose from the list of ministries and agencies.
        </p>
      </div>
    );
  }
  const services = servicesForMinistry(m.id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm text-[var(--dim)]">
        <a href="#/" className="font-semibold underline">Home</a> / Ministries and agencies
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--text)]">{m.name}</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-[var(--dim)]">{m.about}</p>

      <div className="mt-8">
        <SectionTitle sub="Open a service for its requirements and how the visit works.">
          Services rendered here
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {services.map((s) => (
            <a
              key={s.id}
              href={`#/service/${s.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[var(--text)]">{s.name}</h3>
                <Chip tone="gold">{s.visitType}</Chip>
              </div>
              <p className="mt-1 text-sm text-[var(--dim)]">{s.blurb}</p>
              <p className="mt-3 text-sm font-bold" style={{ color: "var(--accent)" }}>
                View service page
              </p>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <TrustBadge institution={m.name} />
        <AnnouncementsBoard ministry={m.name} />
      </div>

      <div className="mt-10">
        <SectionTitle>Other ministries and agencies</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {MINISTRIES.filter((x) => x.id !== m.id).map((x) => (
            <a
              key={x.id}
              href={`#/ministry/${x.id}`}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
            >
              {x.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- service page ---------- */

function ServicePage({
  id,
  profile,
  goApply,
}: {
  id: string;
  profile: ProfileT | null;
  goApply: (service: Service) => void;
}) {
  const s = serviceById(id);
  if (!s) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">Service not found</h1>
        <p className="mt-2 text-[var(--dim)]">
          <a href="#/" className="font-semibold underline">Return to the home page</a> to
          browse all services.
        </p>
      </div>
    );
  }
  const m = ministryById(s.ministryId);
  const isPassport = s.id.startsWith("passport");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-[var(--dim)]">
        <a href="#/" className="font-semibold underline">Home</a> /{" "}
        <a href={`#/ministry/${m.id}`} className="font-semibold underline">{m.name}</a> /{" "}
        {s.name}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">{s.name}</h1>
        <Chip tone="gold">{s.visitType}</Chip>
        {profile ? <FavouriteStar profile={profile} serviceId={s.id} /> : null}
      </div>
      <p className="mt-1 font-semibold text-[var(--dim)]">{m.name}</p>
      <ServiceClosedBanner serviceId={s.id} />
      <p className="mt-4 leading-relaxed text-[var(--text)]">{s.about}</p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">What you need</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--dim)]">
          {s.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">Your visit</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{s.visitNote}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
          Remember the order of things: you apply to PortaGov first. PortaGov
          reviews your application and only then releases it to {m.name}. The
          institution confirms receipt, and PortaGov keeps you updated at every
          step.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Cost, time, and where you collect
        </h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-bold text-[var(--dim)]">Fee on PortaGov</dt>
            <dd className="font-display text-xl font-extrabold text-[var(--text)]">
              ${serviceDetails(s.id).feeUsd} USD
            </dd>
            <dd className="font-semibold text-[var(--text)]">
              {serviceDetails(s.id).feeUsd === 0
                ? "Free, nothing to pay"
                : `About L$${feeInLrd(serviceDetails(s.id).feeUsd).toLocaleString()} LRD`}
            </dd>
            <p className="text-xs text-[var(--dim)]">
              Rate used: {USD_TO_LRD_RATE_LABEL}. You see both amounts here,
              before you apply, so you know what you will pay.
            </p>
            <FeeExplainer label={s.name} amount={serviceDetails(s.id).feeUsd} />
          </div>
          <div>
            <dt className="font-bold text-[var(--dim)]">How long it takes</dt>
            <dd className="font-semibold text-[var(--text)]">{serviceDetails(s.id).processingTime}</dd>
          </div>
          <div>
            <dt className="font-bold text-[var(--dim)]">Collection point</dt>
            <dd className="font-semibold text-[var(--text)]">{serviceDetails(s.id).collectionPoint}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <RealTiming serviceId={s.id} />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-[var(--text)]">
            What happens next, step by step, and the fee history
          </summary>
          <div className="mt-3 space-y-4">
            <ServiceJourney service={s} />
            <PriceHistory service={s} />
            <CurrencyConverter feeUsd={serviceDetails(s.id).feeUsd} />
          </div>
        </details>
      </div>

      {isPassport ? (
        <div className="mt-4 rounded-xl bg-[var(--gold-soft)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Passport photograph rules
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--text)]">
            <li>One recent colour photograph, taken within the last six months.</li>
            <li>White background, full face looking straight at the camera, no hat or sunglasses.</li>
            <li>Standard passport size, printed and scanned clearly.</li>
            <li>
              Keep the file at full quality. Do not compress it: this photograph
              is the one printed in your passport, so it must stay sharp and clear.
            </li>
            <li>
              PortaGov warns you in your document wallet when a photograph looks
              blurry or low quality, before you submit.
            </li>
          </ul>
          <div className="mt-3">
            <PhotoGuide />
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl p-6 text-white" style={{ backgroundColor: "#0a2a5e" }}>
        {profile ? (
          <>
            <h2 className="font-display text-xl font-bold">
              You are signed in as {profile.full_name}
            </h2>
            <p className="mt-1 text-sm text-white/85">
              Your saved profile will fill in this application. You can change
              any detail before you submit.
            </p>
            <div className="mt-4">
              <GoldButton onClick={() => goApply(s)}>Start this application</GoldButton>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">Sign in to start this service</h2>
            <p className="mt-1 text-sm text-white/85">
              Every PortaGov service starts with sign-in, so your details are
              saved once and reused, and your application is tracked to you.
              New here? Your first sign-in collects your profile once. Not new?
              Your saved profile loads straight away.
            </p>
            <div className="mt-4">
              <GoldButton onClick={() => goApply(s)}>
                Sign in and start {s.name}
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- profile form (first-time setup and editing) ---------- */

interface ProfileDraft {
  firstName: string;
  middleName: string;
  surname: string;
  suffix: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  sex: "Female" | "Male";
  address: string;
  county: string;
  district: string;
  community: string;
  communityOther: string;
  street: string;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  idChoice: "nid" | "passport" | "none";
  passportNumber: string;
  nationalId: string;
  hasNationalId: boolean;
  altIdType: string;
  altIdNumber: string;
  witnessName: string;
  witnessPhone: string;
  country: string;
  timezone: string;
  language: "English" | "Liberian English" | "Simple English";
}

const NAME_SUFFIXES = ["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"];

const SUFFIX_OPTIONS = ["Jr", "Sr", "II", "III", "IV"];

/** Which suffix dropdown choice a stored suffix belongs to. */
function suffixChoiceOf(s: string): string {
  const t = s.trim().replace(/\.$/, "");
  if (!t) return "";
  return SUFFIX_OPTIONS.find((o) => o.toLowerCase() === t.toLowerCase()) ?? "Other";
}

/** Split a stored full name back into the form's name parts. */
function splitFullName(full: string): {
  firstName: string;
  middleName: string;
  surname: string;
  suffix: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  let suffix = "";
  const last = parts[parts.length - 1];
  if (parts.length > 2 && last && NAME_SUFFIXES.includes(last.toLowerCase())) {
    suffix = parts.pop() ?? "";
  }
  const firstName = parts.shift() ?? "";
  const surname = parts.pop() ?? "";
  return { firstName, middleName: parts.join(" "), surname, suffix };
}

/** Join the name parts into the single full name the record stores. */
function composeFullName(d: {
  firstName: string;
  middleName: string;
  surname: string;
  suffix: string;
}): string {
  return [d.firstName, d.middleName, d.surname, d.suffix]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

function draftFromProfile(p: ProfileT): ProfileDraft {
  return {
    ...splitFullName(p.full_name),
    dateOfBirth: p.date_of_birth,
    placeOfBirth: p.place_of_birth,
    nationality: p.nationality,
    sex: p.sex === "Male" ? "Male" : "Female",
    address: p.address,
    county: p.county,
    district: "",
    community: "",
    communityOther: "",
    street: p.address,
    phone: p.phone,
    email: p.email,
    emergencyName: p.emergency_name,
    emergencyPhone: p.emergency_phone,
    idChoice: p.has_national_id
      ? "nid"
      : p.alt_id_type === "Passport"
        ? "passport"
        : "none",
    passportNumber: p.alt_id_type === "Passport" ? p.alt_id_number : "",
    nationalId: p.national_id,
    hasNationalId: p.has_national_id,
    altIdType: p.alt_id_type,
    altIdNumber: p.alt_id_number,
    witnessName: p.witness_name,
    witnessPhone: p.witness_phone,
    country: p.country,
    timezone: p.timezone,
    language:
      p.language === "Liberian English" || p.language === "Simple English"
        ? p.language
        : "English",
  };
}

const emptyDraft: ProfileDraft = {
  firstName: "",
  middleName: "",
  surname: "",
  suffix: "",
  dateOfBirth: "",
  placeOfBirth: "",
  nationality: "Liberia",
  sex: "Female",
  address: "",
  county: "Montserrado",
  district: "",
  community: "",
  communityOther: "",
  street: "",
  phone: "",
  email: "",
  emergencyName: "",
  emergencyPhone: "",
  idChoice: "nid",
  passportNumber: "",
  nationalId: "",
  hasNationalId: true,
  altIdType: "Birth certificate",
  altIdNumber: "",
  witnessName: "",
  witnessPhone: "",
  country: "Liberia",
  timezone: "",
  language: "English",
};

function ProfileForm({
  initial,
  submitLabel,
  onSaved,
  signup,
  officerMode,
  onRegistered,
}: {
  initial?: ProfileT;
  submitLabel: string;
  onSaved: (p: ProfileT) => void;
  signup?: boolean;
  officerMode?: boolean;
  onRegistered?: (info: {
    profileId: number;
    demoCode: string;
    needsEmail: boolean;
  }) => void;
}) {
  const [draft, setDraft] = useState<ProfileDraft>(
    initial ? draftFromProfile(initial) : emptyDraft,
  );
  const [error, setError] = useState("");
  const [abroad, setAbroad] = useState(
    initial ? initial.country !== "Liberia" : false,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [declared, setDeclared] = useState(false);
  const [signature, setSignature] = useState("");
  const set = (patch: Partial<ProfileDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const [suffixChoice, setSuffixChoice] = useState(() =>
    suffixChoiceOf(draft.suffix),
  );
  const [suffixOther, setSuffixOther] = useState(() =>
    suffixChoiceOf(draft.suffix) === "Other" ? draft.suffix : "",
  );
  const effective = () => {
    const communityFinal =
      draft.community === "Another community"
        ? draft.communityOther.trim()
        : draft.community;
    const homeAddress = [
      draft.street.trim(),
      communityFinal,
      draft.district,
      draft.county,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      fullName: composeFullName({
        ...draft,
        suffix: suffixChoice === "Other" ? suffixOther.trim() : suffixChoice,
      }),
      dateOfBirth: draft.dateOfBirth,
      placeOfBirth: draft.placeOfBirth,
      nationality: draft.nationality,
      sex: draft.sex,
      address: abroad ? draft.address : homeAddress || draft.address,
      county: abroad ? draft.country : draft.county,
      phone: draft.phone,
      email: draft.email,
      emergencyName: draft.emergencyName,
      emergencyPhone: draft.emergencyPhone,
      nationalId: draft.idChoice === "nid" ? draft.nationalId : "",
      hasNationalId: draft.idChoice === "nid",
      altIdType:
        draft.idChoice === "passport"
          ? "Passport"
          : draft.idChoice === "none"
            ? draft.altIdType
            : "",
      altIdNumber:
        draft.idChoice === "passport"
          ? draft.passportNumber
          : draft.idChoice === "none"
            ? draft.altIdNumber
            : "",
      witnessName: draft.idChoice === "none" ? draft.witnessName : "",
      witnessPhone: draft.idChoice === "none" ? draft.witnessPhone : "",
      country: abroad ? draft.country : "Liberia",
      timezone: abroad ? draft.timezone : draft.timezone || "Africa/Monrovia",
      language: draft.language,
    };
  };

  const create = useMutation({
    mutationFn: async () =>
      await api.createProfile({
        ...effective(),
        officerVerified: officerMode ?? false,
      }),
    onSuccess: (r) => onSaved(r.profile),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const update = useMutation({
    mutationFn: async () =>
      await api.updateProfile({ ...effective(), id: initial?.id ?? 0 }),
    onSuccess: (r) => onSaved(r.profile),
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save."),
  });
  const register = useMutation({
    mutationFn: async () =>
      await api.registerAccount({ ...effective(), password }),
    onSuccess: (r) =>
      onRegistered?.({
        profileId: r.profile_id,
        demoCode: r.demo_code,
        needsEmail: r.needs_email,
      }),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Sign-up failed. Try again."),
  });
  const busy = create.isPending || update.isPending || register.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!draft.firstName.trim() || !draft.surname.trim() || !draft.phone.trim()) {
      setError("Your first name, surname, and phone number are required.");
      return;
    }
    if (!draft.placeOfBirth) {
      setError("Choose your place of birth: the country you were born in.");
      return;
    }
    if (!draft.nationality) {
      setError("Choose your nationality: the country you are from.");
      return;
    }
    if (abroad && (!draft.country || draft.country === "Liberia")) {
      setError("You live outside Liberia, so choose the country you live in.");
      return;
    }
    if (abroad && !draft.timezone) {
      setError("You live outside Liberia, so choose your timezone.");
      return;
    }
    if (!abroad) {
      if (!draft.district) {
        setError("Choose your district from the list.");
        return;
      }
      if (!draft.community) {
        setError("Choose your community from the list.");
        return;
      }
      if (draft.community === "Another community" && !draft.communityOther.trim()) {
        setError("Type the name of your community.");
        return;
      }
    }
    if (draft.idChoice === "nid") {
      const problem = nationalIdProblem(draft.nationalId);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (draft.idChoice === "passport") {
      const problem = passportNumberProblem(draft.passportNumber);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (signup) {
      if (password.length < 12) {
        setError("Your password must be at least 12 characters long.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Your password needs at least one capital letter.");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Your password needs at least one small letter.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Your password needs at least one number.");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setError("Your password needs at least one symbol, like !, #, or %.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Your two passwords do not match. Type them again.");
        return;
      }
      if (!declared) {
        setError(
          "Review everything you entered, then tick the declaration to confirm it is all true and correct. Your account cannot be created without it.",
        );
        return;
      }
      const signedName = signature.trim().replace(/\s+/g, " ");
      const enteredName = effective().fullName.trim().replace(/\s+/g, " ");
      if (!signedName || signedName !== enteredName) {
        setError(
          `The signature does not match the name above, so your account cannot be created. You signed "${signature.trim()}" but the name you entered is "${effective().fullName}". Type your full name exactly as you entered it, with the same capital letters: first name, middle name, surname, and your suffix if you have one.`,
        );
        return;
      }
      register.mutate();
      return;
    }
    if (initial) update.mutate();
    else create.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="min-w-0 w-full space-y-4">
      <div className="grid min-w-0 gap-4 [>&*]:min-w-0 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="pf-first-name">First name</FieldLabel>
          <input id="pf-first-name" {...FIELDS.createProfile.fullName} className={inputCls} value={draft.firstName}
            onChange={(e) => set({ firstName: e.target.value })} autoComplete="given-name" />
        </div>
        <div>
          <FieldLabel htmlFor="pf-middle-name">Middle name (if you have one)</FieldLabel>
          <input id="pf-middle-name" className={inputCls} value={draft.middleName}
            onChange={(e) => set({ middleName: e.target.value })} autoComplete="additional-name" />
        </div>
        <div>
          <FieldLabel htmlFor="pf-surname">Surname</FieldLabel>
          <input id="pf-surname" className={inputCls} value={draft.surname}
            onChange={(e) => set({ surname: e.target.value })} autoComplete="family-name" />
        </div>
        <div>
          <FieldLabel htmlFor="pf-suffix">Suffix (optional)</FieldLabel>
          <select id="pf-suffix" className={inputCls} value={suffixChoice}
            onChange={(e) => setSuffixChoice(e.target.value)} autoComplete="honorific-suffix">
            <option value="">No suffix</option>
            {SUFFIX_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="Other">Other</option>
          </select>
          {suffixChoice === "Other" ? (
            <div className="mt-2">
              <FieldLabel htmlFor="pf-suffix-other">Type your suffix</FieldLabel>
              <input id="pf-suffix-other" className={inputCls} value={suffixOther}
                onChange={(e) => setSuffixOther(e.target.value)}
                placeholder="Your suffix" />
            </div>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="pf-phone">Phone number</FieldLabel>
          <PhoneInput id="pf-phone" fieldProps={FIELDS.createProfile.phone} value={draft.phone}
            onChange={(v) => set({ phone: v })}
            placeholder="770 000 000" />
          <p className="mt-1 text-xs text-[var(--dim)]">
            Pick your country and the dialling code appears. Then type the
            rest of your number.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="pf-dob">Date of birth</FieldLabel>
          <input id="pf-dob" type="date" className={inputCls} value={draft.dateOfBirth}
            onChange={(e) => set({ dateOfBirth: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="pf-pob">Place of birth</FieldLabel>
          <select id="pf-pob" className={inputCls} value={draft.placeOfBirth}
            onChange={(e) => set({ placeOfBirth: e.target.value })}>
            <option value="">Choose the country you were born in</option>
            {draft.placeOfBirth && !COUNTRIES.includes(draft.placeOfBirth) ? (
              <option value={draft.placeOfBirth}>{draft.placeOfBirth}</option>
            ) : null}
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="pf-nationality">Nationality</FieldLabel>
          <select id="pf-nationality" className={inputCls} value={draft.nationality}
            onChange={(e) => set({ nationality: e.target.value })}>
            <option value="">Choose the country you are from</option>
            {draft.nationality && !COUNTRIES.includes(draft.nationality) ? (
              <option value={draft.nationality}>{draft.nationality}</option>
            ) : null}
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="pf-sex">Sex</FieldLabel>
          <select id="pf-sex" className={inputCls} value={draft.sex}
            onChange={(e) => set({ sex: e.target.value === "Male" ? "Male" : "Female" })}>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="pf-residence">Where do you live?</FieldLabel>
          <select id="pf-residence" className={inputCls}
            value={abroad ? "abroad" : "liberia"}
            onChange={(e) => {
              const next = e.target.value === "abroad";
              setAbroad(next);
              if (next && draft.country === "Liberia") set({ country: "" });
            }}>
            <option value="liberia">In Liberia</option>
            <option value="abroad">Outside Liberia (diaspora)</option>
          </select>
        </div>
        {abroad ? (
          <>
            <div>
              <FieldLabel htmlFor="pf-country">Country you live in</FieldLabel>
              <select id="pf-country" className={inputCls} value={draft.country}
                onChange={(e) => set({ country: e.target.value })}>
                <option value="">Choose your country</option>
                {COUNTRIES.filter((c) => c !== "Liberia").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pf-tz">Your timezone</FieldLabel>
              <select id="pf-tz" className={inputCls} value={draft.timezone}
                onChange={(e) => set({ timezone: e.target.value })}>
                <option value="">Choose your timezone</option>
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <FieldLabel htmlFor="pf-county">County</FieldLabel>
              <select id="pf-county" className={inputCls} value={draft.county}
                onChange={(e) => set({ county: e.target.value, district: "", community: "", communityOther: "" })}>
                {COUNTIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pf-district">District</FieldLabel>
              <select id="pf-district" className={inputCls} value={draft.district}
                onChange={(e) => set({ district: e.target.value, community: "", communityOther: "" })}>
                <option value="">Choose your district</option>
                {(DISTRICTS[draft.county] ?? []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pf-community">Community</FieldLabel>
              <select id="pf-community" className={inputCls} value={draft.community}
                disabled={!draft.district}
                onChange={(e) => set({ community: e.target.value })}>
                <option value="">{draft.district ? "Choose your community" : "Choose your district first"}</option>
                {communitiesForDistrict(draft.county, draft.district).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Another community">Another community</option>
              </select>
              {draft.community === "Another community" ? (
                <div className="mt-2">
                  <FieldLabel htmlFor="pf-community-other">Type your community</FieldLabel>
                  <input id="pf-community-other" className={inputCls} value={draft.communityOther}
                    onChange={(e) => set({ communityOther: e.target.value })}
                    placeholder="Your community's name" />
                </div>
              ) : null}
            </div>
            <div>
              <FieldLabel htmlFor="pf-street">Street (optional)</FieldLabel>
              <input id="pf-street" className={inputCls} value={draft.street}
                onChange={(e) => set({ street: e.target.value })}
                placeholder="Street name or street number, if you have one" />
              <p className="mt-1 text-xs text-[var(--dim)]">
                Street is good to add, but it is not required like county,
                district, and community.
              </p>
            </div>
          </>
        )}
        {abroad ? (
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="pf-address">Home address</FieldLabel>
            <input id="pf-address" {...FIELDS.createProfile.address} className={inputCls} value={draft.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street, town, and area where you live" />
          </div>
        ) : null}
        <div>
          <FieldLabel htmlFor="pf-language">Language you want PortaGov to use</FieldLabel>
          <select id="pf-language" className={inputCls} value={draft.language}
            onChange={(e) =>
              set({
                language:
                  e.target.value === "Liberian English" || e.target.value === "Simple English"
                    ? e.target.value
                    : "English",
              })
            }>
            <option value="English">English</option>
            <option value="Liberian English">Liberian English</option>
            <option value="Simple English">Simple English</option>
          </select>
          <p className="mt-1 text-xs text-[var(--dim)]">
            We remember your choice and use it in your updates.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="pf-email">Email, if you have one</FieldLabel>
          <input id="pf-email" {...FIELDS.createProfile.email} type="email" className={inputCls} value={draft.email}
            onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
        </div>
        <div>
          <FieldLabel htmlFor="pf-emg-name">Emergency contact name</FieldLabel>
          <input id="pf-emg-name" {...FIELDS.createProfile.emergencyName} className={inputCls} value={draft.emergencyName}
            onChange={(e) => set({ emergencyName: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="pf-emg-phone">Emergency contact phone</FieldLabel>
          <PhoneInput id="pf-emg-phone" fieldProps={FIELDS.createProfile.emergencyPhone} value={draft.emergencyPhone}
            onChange={(v) => set({ emergencyPhone: v })}
            placeholder="770 000 000" />
          <p className="mt-1 text-xs text-[var(--dim)]">
            Pick the country of this number and the dialling code appears.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
        <p className="font-display font-bold text-[var(--text)]">Prove who you are</p>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Choose the document you have. A national ID is never a blocker on
          PortaGov: if you do not have one yet, use your passport or another
          document, and you can apply for a national ID right here on PortaGov.
        </p>
        <div className="mt-3">
          <FieldLabel htmlFor="pf-id-choice">Document you will use</FieldLabel>
          <select id="pf-id-choice" className={inputCls} value={draft.idChoice}
            onChange={(e) =>
              set({
                idChoice:
                  e.target.value === "passport"
                    ? "passport"
                    : e.target.value === "none"
                      ? "none"
                      : "nid",
              })
            }>
            <option value="nid">National ID</option>
            <option value="passport">Passport</option>
            <option value="none">I do not have a national ID or a passport yet</option>
          </select>
        </div>
        {draft.idChoice === "nid" ? (
          <div className="mt-3">
            <FieldLabel htmlFor="pf-nid">National ID number</FieldLabel>
            <input id="pf-nid" {...FIELDS.createProfile.nationalId} className={inputCls} value={draft.nationalId}
              onChange={(e) => set({ nationalId: e.target.value })}
              placeholder="LR1234567 or your 10 digit card number" />
            <p className="mt-1 text-xs text-[var(--dim)]">
              Type it exactly as it is on your card. PortaGov checks it
              against the Liberian national ID format: the 10 digit number,
              or the card number of 2 letters plus 7 digits, like LR1234567
              (older cards have 3 letters plus 7 digits).
            </p>
          </div>
        ) : null}
        {draft.idChoice === "passport" ? (
          <div className="mt-3">
            <FieldLabel htmlFor="pf-passport">Passport number</FieldLabel>
            <input id="pf-passport" {...FIELDS.createProfile.altIdNumber} className={inputCls} value={draft.passportNumber}
              onChange={(e) => set({ passportNumber: e.target.value })}
              placeholder="L12345678" />
            <p className="mt-1 text-xs text-[var(--dim)]">
              Printed at the top of your passport's photo page: one or two letters
              followed by digits, like PP1234567 or L12345678. PortaGov checks it against
              the Liberian passport format.
            </p>
          </div>
        ) : null}
        {draft.idChoice === "none" ? (
          <div className="mt-3 grid min-w-0 gap-3 [>&*]:min-w-0 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="pf-alt-type">Document you will use instead</FieldLabel>
              <select id="pf-alt-type" className={inputCls} value={draft.altIdType}
                onChange={(e) => set({ altIdType: e.target.value })}>
                <option>Birth certificate</option>
                <option>Voter card</option>
                <option>Photo plus witness</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pf-alt-num">That document's number, if it has one</FieldLabel>
              <input id="pf-alt-num" {...FIELDS.createProfile.altIdNumber} className={inputCls} value={draft.altIdNumber}
                onChange={(e) => set({ altIdNumber: e.target.value })} />
            </div>
            {draft.altIdType === "Photo plus witness" ? (
              <>
                <div>
                  <FieldLabel htmlFor="pf-wit-name">Witness full name</FieldLabel>
                  <input id="pf-wit-name" {...FIELDS.createProfile.witnessName} className={inputCls} value={draft.witnessName}
                    onChange={(e) => set({ witnessName: e.target.value })}
                    placeholder="A person who knows you and can confirm who you are" />
                </div>
                <div>
                  <FieldLabel htmlFor="pf-wit-phone">Witness phone number</FieldLabel>
                  <PhoneInput id="pf-wit-phone" fieldProps={FIELDS.createProfile.witnessPhone} value={draft.witnessPhone}
                    onChange={(v) => set({ witnessPhone: v })}
                    placeholder="770 000 000" />
                </div>
              </>
            ) : null}
            <p className="text-sm text-[var(--dim)] sm:col-span-2">
              When you are ready, the National Identification Registry service
              on PortaGov is where you register for your first national ID.
            </p>
          </div>
        ) : null}
      </div>

      {signup ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="font-display font-bold text-[var(--text)]">Make a strong password</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            At least 12 characters, with a capital letter, a small letter, a
            number, and a symbol like ! or #. Pick words you will remember.
            PortaGov stores it scrambled, never as plain words. Five wrong
            tries at sign-in lock the account for 15 minutes.
          </p>
          <div className="mt-3 grid min-w-0 gap-3 [>&*]:min-w-0 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="pf-pw">Password</FieldLabel>
              <input id="pf-pw" {...FIELDS.registerAccount.password} type="password" className={inputCls} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <FieldLabel htmlFor="pf-pw2">Type the password again</FieldLabel>
              <input id="pf-pw2" type="password" className={inputCls} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
        </div>
      ) : null}

      {signup ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-display font-bold text-[var(--text)]">
            Review everything before you send it
          </p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            This is everything you entered. Check every line, and if anything
            is wrong, change it above before you sign. Nothing is sent until
            you declare and sign below.
          </p>
          {(() => {
            const r = effective();
            const rows: [string, string][] = [
              ["Full name", r.fullName],
              ["Date of birth", r.dateOfBirth],
              ["Place of birth", r.placeOfBirth],
              ["Nationality", r.nationality],
              ["Sex", r.sex],
              ["Phone", r.phone],
              ["Email", r.email || "None given"],
              ["Where you live", abroad ? r.country : "Liberia"],
              ...(abroad
                ? ([["Timezone", r.timezone || "Not given"]] as [string, string][])
                : ([
                    ["County", draft.county],
                    ["District", draft.district || "Not given"],
                    [
                      "Community",
                      draft.community === "Another community"
                        ? draft.communityOther
                        : draft.community || "Not given",
                    ],
                    ["Street", draft.street.trim() || "Not given"],
                  ] as [string, string][])),
              ["Home address", r.address || "Not given"],
              [
                "Emergency contact",
                `${r.emergencyName}, ${r.emergencyPhone}`,
              ],
              [
                "Identity",
                r.hasNationalId
                  ? `National ID: ${r.nationalId}`
                  : r.altIdType
                    ? `${r.altIdType}${r.altIdNumber ? `: ${r.altIdNumber}` : ""}`
                    : "No national ID yet",
              ],
              ...(r.witnessName
                ? ([["Witness", `${r.witnessName}, ${r.witnessPhone}`]] as [string, string][])
                : []),
              ["Language", r.language],
            ];
            return (
              <dl className="mt-3 divide-y divide-[var(--border)] text-sm">
                {rows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <dt className="shrink-0 font-semibold text-[var(--dim)]">
                      {k}
                    </dt>
                    <dd className="min-w-0 flex-1 break-words text-right font-medium text-[var(--text)]">
                      {v && v.trim() ? v : "Not given"}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          })()}
          <label className="mt-4 flex items-start gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              I declare that all the information I have provided is true and
              correct. This confirmation is my digital signature, and it
              applies to every piece of information I am sending.
            </span>
          </label>
          <div className="mt-3">
            <FieldLabel htmlFor="pf-signature">
              Sign here: type your full name
            </FieldLabel>
            <input
              id="pf-signature"
              className={inputCls}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Your full name, exactly as entered above"
              autoComplete="name"
            />
            <p className="mt-1 text-xs text-[var(--dim)]">
              Your account is not created until you tick the declaration and
              sign with your full name, typed exactly as it appears in the
              review above, with the same capital letters.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
      <PrimaryButton type="submit" disabled={busy}>
        {busy ? "Saving..." : submitLabel}
      </PrimaryButton>
    </form>
  );
}

/* ---------- sign-in page (strong auth) ---------- */

function deviceInfo(): { deviceId: string; label: string } {
  let id = storage.get("portagov-device-id");
  if (!id) {
    id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    storage.set("portagov-device-id", id);
  }
  const ua = window.navigator.userAgent;
  const label = ua.includes("Android")
    ? "Android phone"
    : ua.includes("iPhone")
      ? "iPhone"
      : ua.includes("Windows")
        ? "Windows computer"
        : ua.includes("Mac")
          ? "Mac computer"
          : "This device";
  return { deviceId: id, label };
}

function SignInPage({
  after,
  onSignedIn,
}: {
  after: string;
  onSignedIn: (p: ProfileT, alert?: string) => void;
}) {
  const [mode, setMode] = useState<"choose" | "new" | "returning">("choose");
  const [regInfo, setRegInfo] = useState<{
    profileId: number;
    demoCode: string;
    needsEmail: boolean;
  } | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const verifyPhone = useMutation({
    mutationFn: async () =>
      await api.verifyPhoneCode({
        profileId: regInfo?.profileId ?? 0,
        code: phoneCode.trim(),
      }),
    onSuccess: (r) => {
      if (!r.ok || !r.profile) {
        setVerifyError(
          r.locked
            ? lockMessage(r.minutes_left)
            : r.attempts_left > 0 && r.attempts_left < 5
              ? `That code is not correct, or it has expired. You have ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left before the account locks for 15 minutes.`
              : "That code is not correct, or it has expired. Check and try again.",
        );
        return;
      }
      if (r.email_code) {
        setEmailStep(r.email_code);
        return;
      }
      onSignedIn(r.profile);
      nav(after || "#/account");
    },
    onError: (e) =>
      setVerifyError(e instanceof Error ? e.message : "Verification failed."),
  });
  const verifyEmail = useMutation({
    mutationFn: async () =>
      await api.verifyEmailCode({
        profileId: regInfo?.profileId ?? 0,
        code: emailCode.trim(),
      }),
    onSuccess: (r) => {
      if (!r.ok || !r.profile) {
        setVerifyError(
          r.locked
            ? lockMessage(r.minutes_left)
            : r.attempts_left > 0 && r.attempts_left < 5
              ? `That email code is not correct, or it has expired. You have ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left before the account locks for 15 minutes.`
              : "That email code is not correct, or it has expired.",
        );
        return;
      }
      onSignedIn(r.profile);
      nav(after || "#/account");
    },
    onError: (e) =>
      setVerifyError(e instanceof Error ? e.message : "Verification failed."),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="p-4 text-white sm:p-6" style={{ backgroundColor: "#0a2a5e" }}>
          <img src={logoMark} alt="PortaGov mark" className="h-16 w-16 rounded-full bg-white object-cover" />
          <h1 className="mt-3 font-display text-2xl font-extrabold">Sign in to PortaGov</h1>
          <p className="mt-1 text-sm text-white/85">
            Citizens. Services. Connected. Your account is protected: verified
            phone, strong password, and a warning whenever a new device signs
            in.
          </p>
        </div>
        <div className="min-w-0 p-4 sm:p-6">
          {regInfo ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[var(--text)]">
                Check your phone: enter your code
              </h2>
              <p className="text-sm text-[var(--dim)]">
                We sent a 6 number code by SMS to your phone. PortaGov only
                trusts accounts whose phone is proven with this code. In this
                build the code is shown here so you can finish now:{" "}
                <strong className="text-[var(--text)]">{regInfo.demoCode}</strong>
              </p>
              <div>
                <FieldLabel htmlFor="vc-phone">Phone code</FieldLabel>
                <input id="vc-phone" {...FIELDS.verifyPhoneCode.code} className={inputCls} value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="6 numbers" inputMode="numeric" />
              </div>
              {emailStep ? (
                <>
                  <p className="text-sm text-[var(--dim)]">
                    Phone proven. Now prove your email: we sent a code to your
                    email address. In this build it is shown here:{" "}
                    <strong className="text-[var(--text)]">{emailStep}</strong>
                  </p>
                  <div>
                    <FieldLabel htmlFor="vc-email">Email code</FieldLabel>
                    <input id="vc-email" {...FIELDS.verifyEmailCode.code} className={inputCls} value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="6 numbers" inputMode="numeric" />
                  </div>
                  <PrimaryButton
                    onClick={() => {
                      setVerifyError("");
                      verifyEmail.mutate();
                    }}
                    disabled={verifyEmail.isPending}
                  >
                    Prove my email and finish
                  </PrimaryButton>
                </>
              ) : (
                <PrimaryButton
                  onClick={() => {
                    setVerifyError("");
                    verifyPhone.mutate();
                  }}
                  disabled={verifyPhone.isPending}
                >
                  Check my code
                </PrimaryButton>
              )}
              {verifyError ? (
                <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                  {verifyError}
                </p>
              ) : null}
            </div>
          ) : mode === "choose" ? (
            <>
            <div className="grid min-w-0 gap-4 [>&*]:min-w-0 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("new")}
                className="rounded-xl border-2 border-[var(--border)] p-5 text-left"
                aria-label="I'm new here"
              >
                <p className="font-display text-lg font-bold text-[var(--text)]">I'm new here</p>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Create a trusted account: full details, a strong password,
                  and a phone code check. It takes a few minutes, once, and no
                  fake or half-finished profile can go forward.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("returning")}
                className="rounded-xl border-2 p-5 text-left"
                style={{ borderColor: "#d9a821" }}
                aria-label="I'm not new here"
              >
                <p className="font-display text-lg font-bold text-[var(--text)]">I'm not new here</p>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Sign in with your phone and password. New device? PortaGov
                  asks for a code and warns you, so nobody can quietly use
                  your account.
                </p>
              </button>
            </div>
            <p className="mt-4 text-center text-sm text-[var(--dim)]">
              Are you a PortaGov agent helping someone apply?{" "}
              <a href="#/centre" className="font-semibold underline">
                Open the county agent desk
              </a>
            </p>
            </>
          ) : mode === "returning" ? (
            <LoginForm
              onSignedIn={onSignedIn}
              after={after}
              onBack={() => setMode("choose")}
            />
          ) : (
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--text)]">
                Create your trusted account
              </h2>
              <p className="mb-4 mt-1 text-sm text-[var(--dim)]">
                Every field is checked. Your full name, date of birth, place
                of birth, address, and county or country must all be real and
                complete, because ministries will trust this data on your
                applications.
              </p>
              <ProfileForm
                signup
                submitLabel="Create my account"
                onSaved={() => undefined}
                onRegistered={(info) => setRegInfo(info)}
              />
              <div className="mt-4">
                <GhostButton onClick={() => setMode("choose")}>Back</GhostButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  onSignedIn,
  after,
  onBack,
}: {
  onSignedIn: (p: ProfileT, alert?: string) => void;
  after: string;
  onBack: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [profileId, setProfileId] = useState(0);
  const [demoCode, setDemoCode] = useState("");
  const [newDevice, setNewDevice] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const start = useMutation({
    mutationFn: async () => {
      const d = deviceInfo();
      const primary = phone.trim();
      const first = await api.loginStart({
        phone: primary,
        password,
        deviceId: d.deviceId,
        deviceLabel: d.label,
      });
      if (first.result !== "not_found") return first;
      // Accounts saved before the country picker may hold the local form
      // of the number (0770 000 000). Try that form once before giving up.
      const parts = splitPhone(primary);
      const legacy =
        parts.country === "Liberia" && parts.digits
          ? `0${parts.digits}`
          : "";
      if (legacy && legacy !== primary) {
        return await api.loginStart({
          phone: legacy,
          password,
          deviceId: d.deviceId,
          deviceLabel: d.label,
        });
      }
      return first;
    },
    onSuccess: (r) => {
      if (r.result === "ok" && r.profile) {
        onSignedIn(r.profile);
        nav(after || "#/account");
      } else if (r.result === "need_code") {
        setProfileId(r.profile_id);
        setDemoCode(r.demo_code);
        setNewDevice(r.new_device);
        setStep("code");
      } else if (r.result === "locked") {
        setError(
          `This account is locked for about ${r.minutes_left} minutes because of too many wrong passwords. Wait, then try again. Locking keeps thieves out.`,
        );
      } else if (r.result === "bad_credentials") {
        setError(
          "Phone or password is not correct. After 5 wrong tries the account locks for 15 minutes.",
        );
      } else {
        setError(
          "No account was found for that phone number. If this is your first time, choose I'm new here.",
        );
      }
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again."),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const d = deviceInfo();
      return await api.verifyLoginCode({
        profileId,
        code: code.trim(),
        deviceId: d.deviceId,
        deviceLabel: d.label,
        newPassword,
      });
    },
    onSuccess: (r) => {
      if (!r.ok || !r.profile) {
        setError(
          r.locked
            ? `${lockMessage(r.minutes_left)} Go back and sign in again for a fresh code after that time.`
            : r.attempts_left > 0 && r.attempts_left < 5
              ? `That code is not correct, or it has expired. You have ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left before the account locks for 15 minutes.`
              : "That code is not correct, or it has expired. Go back and sign in again for a fresh code.",
        );
        return;
      }
      /* The new-device warning used to be set here and then lost, because
         the page moved on at once. It now travels with the sign-in, so
         the person sees it on screen after signing in. */
      const alert = r.new_device_warning
        ? `You signed in from a new device (${deviceInfo().label}, ${new Date().toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}). If this was not you, change your password at once in My account and tell PortaGov on the Help page.`
        : undefined;
      onSignedIn(r.profile, alert);
      nav(after || "#/account");
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again."),
  });

  if (step === "code") {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-[var(--text)]">
          One more check: enter your code
        </h2>
        <p className="text-sm text-[var(--dim)]">
          {newDevice
            ? "This device is new to your account, so PortaGov needs a code before it trusts it. "
            : "Your account asks for a code at sign-in. "}
          We sent a 6 number code by SMS. In this build the code is shown
          here: <strong className="text-[var(--text)]">{demoCode}</strong>
        </p>
        <div>
          <FieldLabel htmlFor="li-code">Sign-in code</FieldLabel>
          <input id="li-code" {...FIELDS.verifyLoginCode.code} className={inputCls} value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 numbers" inputMode="numeric" />
        </div>
        <div>
          <FieldLabel htmlFor="li-newpw">
            Set a password (only if your account has none yet, for example one an officer made for you)
          </FieldLabel>
          <input id="li-newpw" {...FIELDS.verifyLoginCode.newPassword} type="password" className={inputCls} value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 12 characters, capital, small, number, symbol" />
        </div>
        {error ? (
          <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <PrimaryButton
            onClick={() => {
              setError("");
              finish.mutate();
            }}
            disabled={finish.isPending}
          >
            Finish sign-in
          </PrimaryButton>
          <GhostButton onClick={onBack}>Back</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setError("");
        start.mutate();
      }}
    >
      <div>
        <FieldLabel htmlFor="li-phone">Your phone number</FieldLabel>
        <PhoneInput id="li-phone" fieldProps={FIELDS.findProfileByPhone.phone}
          value={phone} onChange={setPhone}
          placeholder="770 000 000" />
        <p className="mt-1 text-xs text-[var(--dim)]">
          Pick your country and the dialling code appears. Then type the
          rest of your number.
        </p>
      </div>
      <div>
        <FieldLabel htmlFor="li-password">Your password</FieldLabel>
        <input id="li-password" {...FIELDS.loginStart.password} type="password" className={inputCls} value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          placeholder="Leave empty only if an officer made your account and you have no password yet" />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="submit" disabled={start.isPending}>
          {start.isPending ? "Checking..." : "Sign in"}
        </PrimaryButton>
        <GhostButton onClick={onBack}>Back</GhostButton>
      </div>
      <p className="text-sm text-[var(--dim)]">
        Five wrong passwords, or five wrong codes, lock the account for 15
        minutes. A new device always needs a code, and you are warned when
        one signs in.
      </p>
    </form>
  );
}

/* ---------- profile photo (account settings) ---------- */

/** Upload, square-crop and save a profile photo. Reuses the same
    canvas crop approach as the passport photo fix tool: move and zoom
    until the face sits in the square, then save. The saved photo is a
    small square JPEG stored with the profile, so the navbar avatar
    updates at once and the photo is still there after sign out and
    sign in on the same device. */
function ProfilePhotoSection({
  profile,
  onProfileChange,
}: {
  profile: ProfileT;
  onProfileChange: (p: ProfileT) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState("");
  const [scale, setScale] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !src) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const size = 256;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, size, size);
    const base = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * base * scale;
    const h = img.naturalHeight * base * scale;
    const x = (size - w) / 2 + offX;
    const y = (size - h) / 2 + offY;
    ctx2d.drawImage(img, x, y, w, h);
  };
  useEffect(draw, [src, scale, offX, offY]);

  const save = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Choose a photo first.");
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      return await api.updateProfilePhoto({ id: profile.id, photo: dataUrl });
    },
    onSuccess: (r) => {
      setSaved("Saved. Your photo is now your avatar at the top of every page.");
      setSrc("");
      onProfileChange(r.profile);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "The photo could not be saved."),
  });

  const remove = useMutation({
    mutationFn: async () => await api.updateProfilePhoto({ id: profile.id, photo: "" }),
    onSuccess: (r) => {
      setSaved("Photo removed. Your initials show in the top corner again.");
      onProfileChange(r.profile);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "The photo could not be removed."),
  });

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-xl font-bold text-[var(--text)]">Profile photo</h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        This photo shows in the top corner when you are signed in. If you
        have no photo, your initials show instead.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <ProfileAvatar profile={profile} size={64} />
        <div className="flex flex-wrap gap-3">
          <label className="inline-block cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]">
            {profile.photo ? "Change photo" : "Upload a photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Choose a profile photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setSaved("");
                  setError("");
                  setScale(1);
                  setOffX(0);
                  setOffY(0);
                  setSrc(URL.createObjectURL(f));
                }
                e.target.value = "";
              }}
            />
          </label>
          {profile.photo ? (
            <GhostButton onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Removing..." : "Remove photo"}
            </GhostButton>
          ) : null}
        </div>
      </div>
      {src ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[256px_1fr]">
          <div>
            <img ref={imgRef} src={src} alt="" className="hidden" onLoad={draw} />
            <canvas
              ref={canvasRef}
              width={256}
              height={256}
              className="w-full max-w-64 rounded-lg border"
              style={{ borderColor: "var(--border)" }}
              aria-label="Preview of your cropped profile photo"
            />
          </div>
          <div className="space-y-3">
            <div>
              <FieldLabel htmlFor="avatar-zoom">Zoom</FieldLabel>
              <input id="avatar-zoom" type="range" min={1} max={3} step={0.05}
                className="w-full" value={scale}
                onChange={(e) => setScale(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="avatar-x">Move left or right</FieldLabel>
              <input id="avatar-x" type="range" min={-100} max={100} step={1}
                className="w-full" value={offX}
                onChange={(e) => setOffX(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="avatar-y">Move up or down</FieldLabel>
              <input id="avatar-y" type="range" min={-100} max={100} step={1}
                className="w-full" value={offY}
                onChange={(e) => setOffY(Number(e.target.value))} />
            </div>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save this photo"}
            </PrimaryButton>
            <p className="text-sm text-[var(--dim)]">
              The photo is cropped to a square and saved at a small size, so
              it loads fast and stays saved on this device.
            </p>
          </div>
        </div>
      ) : null}
      {saved ? (
        <p className="mt-3 text-sm font-semibold text-[var(--text)]">{saved}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[var(--warn)]">{error}</p>
      ) : null}
    </div>
  );
}

/* ---------- account page ---------- */

function AccountPage({
  profile,
  onProfileChange,
  onSignOutEverywhere,
}: {
  profile: ProfileT;
  onProfileChange: (p: ProfileT) => void;
  onSignOutEverywhere: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const rows: [string, string][] = [
    ["Full name", profile.full_name],
    ["Date of birth", profile.date_of_birth],
    ["Place of birth", profile.place_of_birth],
    ["Nationality", profile.nationality],
    ["Sex", profile.sex],
    ["Address", profile.address],
    ["County", profile.county],
    ["Country", profile.country || "Liberia"],
    ["Timezone", profile.timezone || "Africa/Monrovia"],
    ["Language", profile.language || "English"],
    ["Phone", profile.phone],
    ["Email", profile.email || "Not provided"],
    ["Emergency contact", `${profile.emergency_name}, ${profile.emergency_phone}`],
    [
      "National ID",
      profile.has_national_id
        ? profile.national_id || "Not recorded"
        : `None yet, using ${profile.alt_id_type}${profile.alt_id_number ? ` (${profile.alt_id_number})` : ""}`,
    ],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">My account</h1>
          <p className="mt-1 text-[var(--dim)]">
            Your saved profile. Every application uses these details, and you
            can change anything here at any time.
          </p>
        </div>
      </div>

      <ProfilePhotoSection profile={profile} onProfileChange={onProfileChange} />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["#/applications", "My applications", "Track every application and its status."],
          ["#/wallet", "Document wallet", "Documents you upload once and reuse."],
          ["#/appointments", "Appointments", "Biometrics and collection visits."],
          ["#/payments", "Payments", "Your mobile money payment records."],
          ["#/family", "My family", "Family members saved to your household."],
          ["#/track", "Track by reference", "Follow one application by its reference number."],
        ].map(([href, t, d]) => (
          <a key={href} href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-display font-bold text-[var(--text)]">{t}</p>
            <p className="mt-1 text-sm text-[var(--dim)]">{d}</p>
          </a>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--text)]">Profile details</h2>
          {!editing ? (
            <PrimaryButton onClick={() => setEditing(true)}>Edit my details</PrimaryButton>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-4">
            <ProfileForm
              initial={profile}
              submitLabel="Save changes"
              onSaved={(p) => {
                onProfileChange(p);
                setEditing(false);
              }}
            />
            <div className="mt-3">
              <GhostButton onClick={() => setEditing(false)}>Cancel editing</GhostButton>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">{k}</dt>
                <dd className="mt-0.5 font-medium text-[var(--text)]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-6">
        <div className="space-y-5">
          <SignedInHome profile={profile} />
          <QrCard profile={profile} />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              My updates (SMS and WhatsApp)
            </h2>
            <div className="mt-3">
              <MessagesFeed profileId={profile.id} />
            </div>
          </div>
          <InboxPanel profile={profile} />
          <ResumeDrafts profile={profile} />
        </div>
      </div>

      <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Security, agents, favourites, my year, and my support tickets
        </summary>
        <div className="space-y-5 border-t border-[var(--border)] p-4">
          <SecurityPanel profile={profile} onProfileChange={onProfileChange} onSignOutEverywhere={onSignOutEverywhere} />
          <AgentPermissionsPanel profile={profile} />
          <ConsentCodeMaker profile={profile} />
          <FavouritesSection profile={profile} />
          <YearlySummary profile={profile} />
          <MyTickets phone={profile.phone} />
          <p className="text-sm text-[var(--dim)]">
            Need a person? The <a href="#/help" className="font-semibold underline">help page</a>{" "}
            reaches a real officer.
          </p>
        </div>
      </details>
    </div>
  );
}

/* ---------- application drafts: save now, finish later, on this device ---------- */

type ApplicationDraft = {
  serviceId: string;
  fieldValues: Record<string, string>;
  notes: string;
  channel: "Self service" | "Agent assisted" | "Diaspora";
  priority: "Standard" | "Fast-track" | "Emergency";
  checkedReqs: number[];
  pickedDocs: number[];
  diasporaCountry: string;
  agentName: string;
  onBehalf: string;
  pickup: "Monrovia" | "Embassy";
  lane: "Parent or self" | "School" | "Hospital";
  embassy: string;
  businessId: number;
  paymentPlan: boolean;
  savedAt: string;
};

function draftKeyFor(serviceId: string, profileId: number): string {
  return `portagov-draft-${serviceId}-${profileId}`;
}

function readApplicationDraft(key: string, serviceIdFromKey: string): ApplicationDraft | null {
  try {
    const raw = storage.get(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ApplicationDraft>;
    return {
      serviceId:
        typeof d.serviceId === "string" && d.serviceId ? d.serviceId : serviceIdFromKey,
      fieldValues: d.fieldValues ?? {},
      notes: d.notes ?? "",
      channel: d.channel ?? "Self service",
      priority: d.priority ?? "Standard",
      checkedReqs: d.checkedReqs ?? [],
      pickedDocs: d.pickedDocs ?? [],
      diasporaCountry: d.diasporaCountry ?? "",
      agentName: d.agentName ?? "",
      onBehalf: d.onBehalf ?? "",
      pickup: d.pickup ?? "Monrovia",
      lane: d.lane ?? "Parent or self",
      embassy: d.embassy ?? "",
      businessId: d.businessId ?? 0,
      paymentPlan: d.paymentPlan ?? false,
      savedAt: d.savedAt ?? "",
    };
  } catch {
    return null;
  }
}

/* Every unfinished application draft saved on this device, newest first.
   Drafts live in this device's storage only until the shared backend
   lands, so this list shows this device's drafts and says so. */
function listApplicationDrafts(profileId: number): ApplicationDraft[] {
  const prefix = "portagov-draft-";
  const suffix = `-${profileId}`;
  const out: ApplicationDraft[] = [];
  for (const key of storage.keys()) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const serviceId = key.slice(prefix.length, key.length - suffix.length);
    if (!serviceId) continue;
    const d = readApplicationDraft(key, serviceId);
    if (d) out.push(d);
  }
  return out.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
}

/* ---------- apply page ---------- */

/* The application form is one clear step at a time, with a small
   progress bar that says which step the person is on. */
const APPLY_STEPS = [
  "Who is applying",
  "Requirements checklist",
  "Details for this service",
  "Documents",
  "Speed and payment",
];

function fixInstruction(requirement: string): string {
  const r = requirement.toLowerCase();
  if (r.includes("photograph") || r.includes("photo"))
    return "How to fix: take one clear, recent photo with a white background, put it in your document wallet, then tick this box.";
  if (r.includes("wallet") || r.includes("certificate") || r.includes("passport") || r.includes("card") || r.includes("report") || r.includes("deed") || r.includes("contract") || r.includes("documents"))
    return "How to fix: add the document to your document wallet first (Wallet page), attach it below, then tick this box.";
  if (r.includes("number"))
    return "How to fix: find the number on your document and type it in the form below, then tick this box.";
  if (r.includes("profile"))
    return "How to fix: your PortaGov profile already holds this. Check it in My account, then tick this box.";
  if (r.includes("visit") || r.includes("biometric") || r.includes("enrolment"))
    return "How to fix: no action now. You book this visit after you submit, from your application page. Tick the box to say you understand.";
  return "How to fix: get this ready, then tick the box to confirm you have it.";
}

function ApplyPage({
  serviceId,
  profile,
}: {
  serviceId: string;
  profile: ProfileT;
}) {
  const service = serviceById(serviceId);
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<
    "Self service" | "Agent assisted" | "Diaspora"
  >("Self service");
  const [diasporaCountry, setDiasporaCountry] = useState("");
  const [agentName, setAgentName] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pickedDocs, setPickedDocs] = useState<number[]>([]);
  const [checkedReqs, setCheckedReqs] = useState<number[]>([]);
  const [onBehalf, setOnBehalf] = useState("");
  const [priority, setPriority] = useState<"Standard" | "Fast-track" | "Emergency">("Standard");
  const [pickup, setPickup] = useState<"Monrovia" | "Embassy">("Monrovia");
  const [lane, setLane] = useState<"Parent or self" | "School" | "Hospital">("Parent or self");
  const [embassy, setEmbassy] = useState(EMBASSIES[0] ?? "");
  const [businessId, setBusinessId] = useState(0);
  const [paymentPlan, setPaymentPlan] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [step, setStep] = useState(1);

  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const family = useQuery({
    queryKey: ["family", profile.id],
    queryFn: () => api.listFamily({ profileId: profile.id }),
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });
  const businesses = useQuery({
    queryKey: ["businesses", profile.id],
    queryFn: () => api.listBusinesses({ profileId: profile.id }),
  });

  const draftKey = service ? draftKeyFor(service.id, profile.id) : "";

  /* Everything on this form is part of the draft, so resuming brings
     back the whole form, not just the first fields. */
  const draftPayload = (): ApplicationDraft => ({
    serviceId: service?.id ?? "",
    fieldValues,
    notes,
    channel,
    priority,
    checkedReqs,
    pickedDocs,
    diasporaCountry,
    agentName,
    onBehalf,
    pickup,
    lane,
    embassy,
    businessId,
    paymentPlan,
    savedAt: new Date().toISOString(),
  });

  const saveDraftNow = () => {
    if (!draftKey) return;
    try {
      storage.set(draftKey, JSON.stringify(draftPayload()));
      setDraftSaved(true);
    } catch {
      // Storage full or blocked: the form still works.
    }
  };

  useEffect(() => {
    if (!draftKey || draftLoaded || !service) return;
    const d = readApplicationDraft(draftKey, service.id);
    if (d) {
      setFieldValues(d.fieldValues);
      setNotes(d.notes);
      setChannel(d.channel);
      setPriority(d.priority);
      setCheckedReqs(d.checkedReqs);
      setPickedDocs(d.pickedDocs);
      setDiasporaCountry(d.diasporaCountry);
      setAgentName(d.agentName);
      setOnBehalf(d.onBehalf);
      setPickup(d.pickup);
      setLane(d.lane);
      setEmbassy(d.embassy);
      setBusinessId(d.businessId);
      setPaymentPlan(d.paymentPlan);
    }
    setDraftLoaded(true);
  }, [draftKey, draftLoaded, service]);

  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    const t = window.setTimeout(() => {
      saveDraftNow();
    }, 400);
    return () => window.clearTimeout(t);
  }, [draftKey, draftLoaded, fieldValues, notes, channel, priority, checkedReqs, pickedDocs, diasporaCountry, agentName, onBehalf, pickup, lane, embassy, businessId, paymentPlan]);

  const details = service ? serviceDetails(service.id) : null;
  const fastLane =
    service?.id === "birth-certificate" && lane !== "Parent or self";
  const effectivePriority = fastLane ? "Fast-track" : priority;
  const priorityFee = fastLane
    ? 0
    : priority === "Fast-track"
      ? FAST_TRACK_FEE_USD
      : priority === "Emergency"
        ? EMERGENCY_FEE_USD
        : 0;
  const deliveryFee =
    channel === "Diaspora" && pickup === "Embassy" ? EMBASSY_DELIVERY_FEE_USD : 0;
  const total = (details?.feeUsd ?? 0) + priorityFee + deliveryFee;

  const submit = useMutation({
    mutationFn: async () => {
      if (!service || !details) throw new Error("Service not found.");
      /* Never submit a date field that is not a real date: normalise
         typed digits (03141995 becomes 1995-03-14) and refuse anything
         that still is not a date, with the field's own label. */
      for (const f of service.fields) {
        const err = dateFieldError(f, fieldValues[f.key] ?? "");
        if (err) throw new Error(err);
      }
      const normalisedValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(fieldValues)) {
        const f = service.fields.find((x) => x.key === k);
        normalisedValues[k] = f?.kind === "date" ? normalizeDateValue(v) : v;
      }
      return await api.submitApplication({
        profileId: profile.id,
        serviceId: service.id,
        serviceName: service.name,
        institution: ministryById(service.ministryId).name,
        channel,
        onBehalfOf: onBehalf,
        priority: effectivePriority,
        priorityFee,
        serviceFee: details.feeUsd,
        collectionChoice:
          channel === "Diaspora"
            ? pickup === "Embassy"
              ? "Delivery to a Liberian embassy"
              : "Collect in Monrovia"
            : "",
        embassy: channel === "Diaspora" && pickup === "Embassy" ? embassy : "",
        deliveryFee,
        diasporaCountry,
        agentName,
        businessId,
        paymentPlan,
        notes,
        details: [
          ...service.fields
            .map((f) => ({
              label: f.label,
              value: (normalisedValues[f.key] ?? "").trim(),
            }))
            .filter((d) => d.value.length > 0),
          ...(fastLane
            ? [
                {
                  label: "Fast lane",
                  value: `${lane} request, fast-tracked free of charge`,
                },
              ]
            : []),
        ],
        documentIds: pickedDocs,
      });
    },
    onSuccess: (r) => {
      try {
        storage.remove(draftKey);
      } catch {
        // Nothing to clean if storage is blocked.
      }
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      nav(`#/application/${r.application.id}`);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Submission failed. Try again."),
  });

  if (!service || !details) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">Service not found</h1>
        <p className="mt-2 text-[var(--dim)]">
          <a href="#/" className="font-semibold underline">Return to the home page</a> to
          choose a service.
        </p>
      </div>
    );
  }
  const m = ministryById(service.ministryId);
  const activeAgents = (agents.data?.agents ?? []).filter((a: AgentT) => a.active);
  const consentMembers = (family.data?.members ?? []).filter(
    (mem: MemberT) => mem.consent,
  );
  const fieldsFilled = service.fields.every(
    (f) => (fieldValues[f.key] ?? "").trim().length > 0,
  );
  const docsAttached = pickedDocs.length > 0;
  const checklist: { label: string; ok: boolean; fix: string }[] = [
    {
      label: "Your profile is complete and saved",
      ok: true,
      fix: "Already green: your details come from your saved profile.",
    },
    ...service.requirements.map((r, i) => ({
      label: r,
      ok: checkedReqs.includes(i),
      fix: fixInstruction(r),
    })),
    {
      label:
        service.fields.length > 0
          ? "Every question in the form below is answered"
          : "The form below is complete",
      ok: fieldsFilled,
      fix: "How to fix: answer every box in the Details section. Empty boxes keep this red.",
    },
    {
      label: "At least one document is attached from your wallet",
      ok: docsAttached,
      fix: "How to fix: tick a document in the Attach documents section. Wallet empty? Add the document on the Wallet page first, then come back. Your draft is saved on this phone, so you will not lose your work.",
    },
  ];
  const allGreen = checklist.every((c) => c.ok);
  const reqsDone = service.requirements.every((_, i) => checkedReqs.includes(i));

  /* Move to the next step only when this step is done. The form submit
     uses the same checks, so pressing Enter behaves like Continue. */
  const goNext = () => {
    if (step === 1) {
      if (channel === "Diaspora" && !diasporaCountry.trim()) {
        setError("Tell us which country you are applying from.");
        return;
      }
      if (channel === "Agent assisted" && !agentName.trim()) {
        setError("Choose or write the name of the agent helping you.");
        return;
      }
    }
    if (step === 2 && !reqsDone) {
      setError("Tick every requirement in the checklist first. Each red item tells you how to fix it.");
      return;
    }
    if (step === 3 && !fieldsFilled) {
      setError("Answer every box in the Details section first. Empty boxes keep the checklist red.");
      return;
    }
    if (step === 3) {
      for (const f of service.fields) {
        const err = dateFieldError(f, fieldValues[f.key] ?? "");
        if (err) {
          setError(err);
          return;
        }
      }
    }
    if (step === 4 && !docsAttached) {
      setError("Attach at least one document from your wallet first. Your draft is saved on this device, so you can add the document and come back.");
      return;
    }
    setError("");
    setStep((s) => Math.min(5, s + 1));
    window.scrollTo(0, 0);
  };
  const goBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-[var(--dim)]">
        <a href="#/" className="font-semibold underline">Home</a> /{" "}
        <a href={`#/ministry/${m.id}`} className="font-semibold underline">{m.name}</a> /{" "}
        <a href={`#/service/${service.id}`} className="font-semibold underline">{service.name}</a>
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-[var(--text)]">
        Apply: {service.name}
      </h1>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
        Applying as <strong className="text-[var(--text)]">{profile.full_name}</strong>,
        phone {profile.phone}, {profile.county} County. These details come from
        your saved profile.{" "}
        <a href="#/account" className="font-semibold underline">Change them in My account</a>{" "}
        if anything is wrong.
        {draftSaved ? (
          <span className="mt-1 block font-semibold text-[var(--text)]">
            Draft saved on this device. If your connection cuts or your
            battery dies, come back on this same device and your work is
            still here, listed under Drafts in My applications. Finishing
            the same draft on another device comes with the shared backend.
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-bold text-[var(--text)]">
          Fee for {service.name}: ${details.feeUsd} USD
          {details.feeUsd === 0
            ? ", free, nothing to pay"
            : `, about L$${feeInLrd(details.feeUsd).toLocaleString()} LRD`}
        </p>
        <p className="mt-1 text-xs text-[var(--dim)]">
          Rate used: {USD_TO_LRD_RATE_LABEL}. You see the fee in dollars and
          Liberian dollars before you start. You pay only after you submit,
          when PortaGov gives you a billing number.
        </p>
      </div>

      <div className="mt-4" aria-label={`Step ${step} of 5`}>
        <p className="text-sm font-bold text-[var(--text)]">
          Step {step} of 5: {APPLY_STEPS[step - 1]}
        </p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-alt)]"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-label={`Step ${step} of 5`}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${(step / 5) * 100}%`, backgroundColor: "#0a2a5e" }}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--dim)]">
          One step at a time. Your work is saved as a draft on this device as
          you go.
        </p>
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            saveDraftNow();
            nav("#/applications");
          }}
          className="text-sm font-semibold underline text-[var(--dim)]"
        >
          Save draft and finish later
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      {step === 2 ? (
      <div className="mt-5 rounded-xl border-2 bg-[var(--surface)] p-4" style={{ borderColor: allGreen ? "#166534" : "#d9a821" }}>
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Checklist: everything must be green before you can submit
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          This is the PortaGov way: you finish every requirement and document
          first, and submit only when everything is clear. A box turns green
          only when what you have matches exactly what the ministry stated
          for this service, word for word. If it is not an exact match, keep
          it red and fix it first. PortaGov then
          checks the documents, you pay your billing number, and only when the
          billing number is confirmed paid does PortaGov release your
          application to {m.name}.
        </p>
        <ul className="mt-3 space-y-2">
          {checklist.map((c, i) => (
            <li key={c.label} className="flex gap-3 rounded-lg bg-[var(--surface-alt)] p-3">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: c.ok ? "#166534" : "#b3261e" }}
              >
                {c.ok ? "✓" : "!"}
              </span>
              <div className="text-sm">
                {i >= 1 && i <= service.requirements.length ? (
                  <label className="flex cursor-pointer items-start gap-2 font-semibold text-[var(--text)]">
                    <input
                      type="checkbox"
                      aria-label={`I have this ready: ${c.label}`}
                      checked={c.ok}
                      onChange={(e) =>
                        setCheckedReqs((prev) =>
                          e.target.checked
                            ? [...prev, i - 1]
                            : prev.filter((x) => x !== i - 1),
                        )
                      }
                      className="mt-0.5 h-5 w-5"
                    />
                    {c.label}
                  </label>
                ) : (
                  <p className="font-semibold text-[var(--text)]">{c.label}</p>
                )}
                <p className={c.ok ? "text-[var(--dim)]" : "font-medium text-[var(--warn)]"}>
                  {c.ok ? "Ready." : c.fix}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[var(--dim)]">
          The last two items turn green as you finish the next steps. Tick
          every requirement above to continue.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <GhostButton onClick={goBack}>Back</GhostButton>
          <PrimaryButton type="button" onClick={goNext}>Continue</PrimaryButton>
        </div>
      </div>
      ) : null}

      <form
        className="mt-5 space-y-5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (step !== 5) {
            goNext();
            return;
          }
          setError("");
          if (!allGreen) {
            setError("The checklist is not all green yet. Fix the red items first: each one tells you in plain words how to fix it.");
            return;
          }
          if (channel === "Diaspora" && !diasporaCountry.trim()) {
            setError("Tell us which country you are applying from.");
            return;
          }
          if (channel === "Agent assisted" && !agentName.trim()) {
            setError("Choose or write the name of the agent helping you.");
            return;
          }
          submit.mutate();
        }}
      >
        {step === 1 ? (
          <>
        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <legend className="px-1 font-display font-bold text-[var(--text)]">
            Who is this application for?
          </legend>
          <select
            aria-label="Who is this application for"
            className={inputCls}
            value={onBehalf}
            onChange={(e) => setOnBehalf(e.target.value)}
          >
            <option value="">Myself, {profile.full_name}</option>
            {consentMembers.map((mem: MemberT) => (
              <option key={mem.id} value={mem.full_name}>
                My family member: {mem.full_name} ({mem.relationship}, consent on file)
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-[var(--dim)]">
            Family members appear here only when their consent is saved on the{" "}
            <a href="#/family" className="font-semibold underline">My family page</a>.
            PortaGov never applies for someone without their consent.
          </p>
        </fieldset>

        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <legend className="px-1 font-display font-bold text-[var(--text)]">
            How are you applying?
          </legend>
          <div className="space-y-2">
            {(
              [
                ["Self service", "I am applying for myself, from Liberia."],
                ["Agent assisted", "A PortaGov agent is helping me apply. The agent is named on my application."],
                ["Diaspora", "I am applying from outside Liberia."],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-start gap-2 text-sm text-[var(--text)]">
                <input
                  type="radio"
                  name="channel"
                  aria-label={value}
                  checked={channel === value}
                  onChange={() => setChannel(value)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <strong>{value}.</strong> {label}
                </span>
              </label>
            ))}
          </div>
          {channel === "Diaspora" ? (
            <div className="mt-3 space-y-3">
              <div>
                <FieldLabel htmlFor="ap-country">Country you are applying from</FieldLabel>
                <select id="ap-country" className={inputCls} value={diasporaCountry}
                  onChange={(e) => setDiasporaCountry(e.target.value)}>
                  <option value="">Choose your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--dim)]">
                  Liberians live in every country. Choose yours: your
                  embassy choices and timezone follow from it.
                </p>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-[var(--text)]">
                  When it is ready, how do you want it?
                </legend>
                <div className="mt-2 space-y-2">
                  <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <input type="radio" name="pickup" aria-label="Collect in Monrovia"
                      checked={pickup === "Monrovia"}
                      onChange={() => setPickup("Monrovia")} className="mt-1 h-4 w-4" />
                    <span>
                      <strong>Collect in Monrovia.</strong> You, or your proxy
                      with your consent code, collect in Monrovia. No delivery fee.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <input type="radio" name="pickup" aria-label="Delivery to a Liberian embassy"
                      checked={pickup === "Embassy"}
                      onChange={() => setPickup("Embassy")} className="mt-1 h-4 w-4" />
                    <span>
                      <strong>Delivery to a Liberian embassy.</strong> Your
                      document is sent to the embassy you choose. Delivery fee $
                      {EMBASSY_DELIVERY_FEE_USD}, shown here, no hidden fee.
                    </span>
                  </label>
                </div>
                {pickup === "Embassy" ? (
                  <div className="mt-2">
                    <FieldLabel htmlFor="ap-embassy">Choose the embassy</FieldLabel>
                    <select id="ap-embassy" className={inputCls} value={embassy}
                      onChange={(e) => setEmbassy(e.target.value)}>
                      {EMBASSIES.map((e2) => (
                        <option key={e2} value={e2}>{e2}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </fieldset>
            </div>
          ) : null}
          {channel === "Agent assisted" ? (
            <div className="mt-3">
              <FieldLabel htmlFor="ap-agent">Agent helping you</FieldLabel>
              {activeAgents.length > 0 ? (
                <select id="ap-agent" className={inputCls} value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}>
                  <option value="">Choose the agent</option>
                  {activeAgents.map((a: AgentT) => (
                    <option key={a.id} value={`${a.full_name}, ${a.county} County`}>
                      {a.full_name}, {a.county} County{a.service_centre ? `, ${a.service_centre}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="ap-agent" {...FIELDS.submitApplication.agentName} className={inputCls} value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Name of the PortaGov agent helping you" />
              )}
              <p className="mt-1 text-xs text-[var(--dim)]">
                The agent is named on your application, so you always know who helped you.
              </p>
            </div>
          ) : null}
        </fieldset>

        {service.id === "birth-certificate" ? (
          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <legend className="px-1 font-display font-bold text-[var(--text)]">
              School and hospital fast lane
            </legend>
            <p className="text-sm text-[var(--dim)]">
              Schools and hospitals asking for a birth certificate, for
              example for a pupil's enrolment or a baby's records, use the
              fast lane: the application is fast-tracked free of charge.
            </p>
            <div className="mt-2">
              <FieldLabel htmlFor="ap-lane">Who is asking?</FieldLabel>
              <select id="ap-lane" className={inputCls} value={lane}
                onChange={(e) =>
                  setLane(
                    e.target.value === "School"
                      ? "School"
                      : e.target.value === "Hospital"
                        ? "Hospital"
                        : "Parent or self",
                  )
                }>
                <option>Parent or self</option>
                <option>School</option>
                <option>Hospital</option>
              </select>
            </div>
            {fastLane ? (
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                Fast lane is on: this application will be fast-tracked, and
                the fast-track fee is waived for schools and hospitals.
              </p>
            ) : null}
          </fieldset>
        ) : null}
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={goNext}>Continue</PrimaryButton>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
        {service.fields.length > 0 ? (
          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <legend className="px-1 font-display font-bold text-[var(--text)]">
              Details for this service
            </legend>
            {(businesses.data?.businesses ?? []).length > 0 &&
            service.fields.some((f) => f.key === "businessName") ? (
              <div className="mb-3">
                <FieldLabel htmlFor="ap-bizpick">Use one of my saved businesses</FieldLabel>
                <select
                  id="ap-bizpick"
                  className={inputCls}
                  defaultValue=""
                  onChange={(e) => {
                    const b = (businesses.data?.businesses ?? []).find(
                      (x: BusinessT) => String(x.id) === e.target.value,
                    );
                    if (!b) return;
                    setFieldValues((v) => ({
                      ...v,
                      businessName: b.business_name,
                      ...(service.fields.some((f) => f.key === "registrationNumber")
                        ? { registrationNumber: b.registration_number }
                        : {}),
                      ...(service.fields.some((f) => f.key === "tin")
                        ? { tin: b.tin }
                        : {}),
                    }));
                  }}
                >
                  <option value="">Choose a business to fill the form</option>
                  {(businesses.data?.businesses ?? []).map((b: BusinessT) => (
                    <option key={b.id} value={b.id}>{b.business_name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {service.fields.map((f) => (
                <div key={f.key}>
                  <FieldLabel htmlFor={`ap-${f.key}`}>{f.label}</FieldLabel>
                  <input
                    id={`ap-${f.key}`}
                    type={f.kind === "date" ? "date" : undefined}
                    className={inputCls}
                    value={fieldValues[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    onBlur={(e) => {
                      if (f.kind !== "date") return;
                      const fixed = normalizeDateValue(e.target.value);
                      if (fixed !== e.target.value) {
                        setFieldValues((v) => ({ ...v, [f.key]: fixed }));
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
            No extra details are needed for this service. Continue to the
            next step.
          </p>
        )}
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={goBack}>Back</GhostButton>
              <PrimaryButton type="button" onClick={goNext}>Continue</PrimaryButton>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <legend className="px-1 font-display font-bold text-[var(--text)]">
            Attach documents from your wallet
          </legend>
          {docs.isPending ? (
            <p className="text-sm text-[var(--dim)]">Loading your wallet...</p>
          ) : docs.data && docs.data.documents.length > 0 ? (
            <div className="space-y-2">
              {docs.data.documents.map((d: DocumentT) => (
                <label key={d.id} className="flex items-start gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    aria-label={`Attach ${d.title}`}
                    checked={pickedDocs.includes(d.id)}
                    onChange={(e) =>
                      setPickedDocs((prev) =>
                        e.target.checked
                          ? [...prev, d.id]
                          : prev.filter((x) => x !== d.id),
                      )
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <strong>{d.title}</strong> ({d.doc_type})
                    {d.doc_number ? `, number ${d.doc_number}` : ""}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--dim)]">
              Your wallet is empty.{" "}
              <a href="#/wallet" className="font-semibold underline">
                Add your documents to the wallet first
              </a>
              . Your draft is saved on this device, so you will not
              lose your work.
            </p>
          )}
        </fieldset>

        <div>
          <FieldLabel htmlFor="ap-notes">Anything else the institution should know?</FieldLabel>
          <textarea id="ap-notes" {...FIELDS.submitApplication.notes} className={inputCls} rows={3} value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </div>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={goBack}>Back</GhostButton>
              <PrimaryButton type="button" onClick={goNext}>Continue</PrimaryButton>
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
        <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <legend className="px-1 font-display font-bold text-[var(--text)]">
            How fast do you need it?
          </legend>
          <div className="space-y-2">
            {(
              [
                ["Standard", `Normal time: ${details.processingTime}. No extra fee.`],
                ["Fast-track", `Moved ahead in the queue. Extra $${FAST_TRACK_FEE_USD}, shown here, no hidden fee.`],
                ["Emergency", `Urgent cases, for example travel for medical care or a death in the family. Extra $${EMERGENCY_FEE_USD}, shown here, no hidden fee.`],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-start gap-2 text-sm text-[var(--text)]">
                <input
                  type="radio"
                  name="priority"
                  aria-label={value}
                  checked={priority === value}
                  onChange={() => setPriority(value)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <strong>{value}.</strong> {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-display font-bold text-[var(--text)]">What you will pay</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{service.name} fee</dt>
              <dd className="text-right font-semibold text-[var(--text)]">
                ${details.feeUsd} USD
                <span className="block text-xs font-normal text-[var(--dim)]">
                  {details.feeUsd === 0
                    ? "Free, nothing to pay"
                    : `About L$${feeInLrd(details.feeUsd).toLocaleString()} LRD`}
                </span>
              </dd>
            </div>
            {priorityFee > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">{priority} fee</dt>
                <dd className="text-right font-semibold text-[var(--text)]">
                  ${priorityFee} USD
                  <span className="block text-xs font-normal text-[var(--dim)]">
                    About L${feeInLrd(priorityFee).toLocaleString()} LRD
                  </span>
                </dd>
              </div>
            ) : null}
            {deliveryFee > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--dim)]">Embassy delivery fee</dt>
                <dd className="text-right font-semibold text-[var(--text)]">
                  ${deliveryFee} USD
                  <span className="block text-xs font-normal text-[var(--dim)]">
                    About L${feeInLrd(deliveryFee).toLocaleString()} LRD
                  </span>
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2">
              <dt className="font-bold text-[var(--text)]">Total</dt>
              <dd className="text-right font-bold text-[var(--text)]">
                ${total} USD
                <span className="block text-xs font-normal text-[var(--dim)]">
                  {total === 0
                    ? "Free, nothing to pay"
                    : `About L$${feeInLrd(total).toLocaleString()} LRD`}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-[var(--dim)]">
            Rate used: {USD_TO_LRD_RATE_LABEL}. The Liberian dollar amounts
            are a guide at this rate.
          </p>
          <p className="mt-2 text-sm text-[var(--dim)]">
            No hidden fee. After you submit, PortaGov gives you a billing
            number. You pay that billing number from any phone with MTN MoMo
            or Orange Money, and PortaGov matches your payment to the billing
            number automatically.
          </p>
          {(businesses.data?.businesses ?? []).length > 0 ? (
            <div className="mt-3">
              <FieldLabel htmlFor="ap-business">File under my business (optional)</FieldLabel>
              <select id="ap-business" className={inputCls} value={businessId}
                onChange={(e) => setBusinessId(Number(e.target.value))}>
                <option value={0}>No, this is personal</option>
                {(businesses.data?.businesses ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.business_name}</option>
                ))}
              </select>
            </div>
          ) : null}
          {total >= 50 ? (
            <label className="mt-3 flex min-h-9 items-start gap-2 text-sm text-[var(--text)]">
              <input type="checkbox" checked={paymentPlan} onChange={(e) => setPaymentPlan(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                <strong>Payment plan:</strong> split this into two parts.
                Pay the first part now; PortaGov releases your application
                when the first part is confirmed. The second part is due
                before collection. The total never changes.
              </span>
            </label>
          ) : null}
          <div className="mt-3">
            <FraudWarning />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={goBack}>Back</GhostButton>
        </div>
        <PrimaryButton type="submit" disabled={submit.isPending || !allGreen}>
          {submit.isPending
            ? "Submitting..."
            : allGreen
              ? "Submit to PortaGov"
              : "Submit is locked until the checklist is all green"}
        </PrimaryButton>
        <div className="mt-3">
          <GhostButton
            onClick={() => {
              saveDraftNow();
              nav("#/applications");
            }}
          >
            Save draft and finish later
          </GhostButton>
          <p className="mt-2 text-sm text-[var(--dim)]">
            Your draft is kept on this device and listed under Drafts in My
            applications, so you can come back and finish it here any time.
            Finishing it on another device comes with the shared backend.
          </p>
        </div>
        <p className="text-sm text-[var(--dim)]">
          You get a tracking number and a billing number at once. PortaGov
          checks your documents, confirms your payment against the billing
          number, and only then releases your application to {m.name} and
          tells you it was submitted.
        </p>
          </>
        ) : null}
      </form>
    </div>
  );
}


/* ---------- applications list ---------- */

function ApplicationsPage({ profile }: { profile: ProfileT }) {
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const [drafts, setDrafts] = useState<ApplicationDraft[]>(() =>
    listApplicationDrafts(profile.id),
  );
  const discardDraft = (d: ApplicationDraft) => {
    try {
      storage.remove(draftKeyFor(d.serviceId, profile.id));
    } catch {
      /* Storage unavailable; the list still refreshes below. */
    }
    setDrafts(listApplicationDrafts(profile.id));
  };
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">My applications</h1>
      <p className="mt-1 text-[var(--dim)]">
        Every application you have sent to PortaGov, with its live status.
      </p>
      {drafts.length > 0 ? (
        <div className="mt-5">
          <SectionTitle sub="Unfinished applications saved on this device. Pick one up where you left off. Drafts stay on this device until the shared backend lets you finish on any device.">
            Drafts, finish later
          </SectionTitle>
          <div className="mt-3 space-y-3">
            {drafts.map((d) => {
              const s = serviceById(d.serviceId);
              return (
                <div
                  key={d.serviceId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div>
                    <p className="font-display font-bold text-[var(--text)]">
                      Draft: {s?.name ?? d.serviceId}
                    </p>
                    <p className="text-sm text-[var(--dim)]">
                      {d.savedAt ? `Last saved ${fmtDateTime(d.savedAt)}` : "Saved on this device"}
                      {s ? `, ${ministryById(s.ministryId).name}` : ""}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => nav(`#/apply/${d.serviceId}`)}>
                      Resume draft
                    </PrimaryButton>
                    <GhostButton onClick={() => discardDraft(d)}>
                      Discard draft
                    </GhostButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        {apps.isPending ? (
          <p className="text-[var(--dim)]">Loading your applications...</p>
        ) : apps.error ? (
          <p role="alert" className="text-[var(--warn)]">
            Your applications could not be loaded. Reload the page to try again.
          </p>
        ) : apps.data && apps.data.applications.length > 0 ? (
          apps.data.applications.map((a: ApplicationT) => (
            <ApplicationCard
              key={a.id}
              app={a}
              onOpen={() => nav(`#/application/${a.id}`)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg font-bold text-[var(--text)]">
              No applications yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
              When you start a service, it appears here with a reference number
              and a live status you can follow.
            </p>
            <div className="mt-4">
              <PrimaryButton onClick={() => nav("#/")}>Browse services</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- application detail ---------- */

/* ---------- your numbers: the three linked numbers ---------- */
/* One small, quiet box that shows the three numbers that belong to one
   application together, tracking, billing and transaction, so a citizen,
   an institution and PortaGov all see the same link. The numbers are
   already linked in the backend by application id; this only shows that
   link. Keep it plain: short labels, one row each, label in front of its
   value, nothing loud, no extra buttons. On a narrow phone each row
   stays on one line, label left, value right, wrapping neatly. */
function LinkedNumbersRow({
  label,
  value,
  dimValue,
}: {
  label: string;
  value: string;
  dimValue?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-[var(--dim)]">{label}</dt>
      <dd
        className={`min-w-0 text-right font-semibold break-all ${
          dimValue ? "text-[var(--dim)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function LinkedNumbers({
  tracking,
  billing,
  transaction,
  amountPaid,
  payerPhone,
}: {
  tracking: string;
  billing: string;
  transaction?: string | null;
  amountPaid?: number | null;
  payerPhone?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Your numbers
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        These three numbers belong to this one application. Any one of them
        finds the other two.
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        <LinkedNumbersRow label="Tracking number" value={tracking} />
        <LinkedNumbersRow label="Billing number" value={billing} />
        <LinkedNumbersRow
          label="Transaction number"
          value={transaction || "Not paid yet"}
          dimValue={!transaction}
        />
        {amountPaid != null ? (
          <LinkedNumbersRow label="Amount paid" value={`$${amountPaid}`} />
        ) : null}
        {payerPhone ? (
          <LinkedNumbersRow label="Paid from" value={payerPhone} />
        ) : null}
      </dl>
    </div>
  );
}

function ApplicationDetailPage({
  id,
  profile,
}: {
  id: number;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const app = apps.data?.applications.find((a: ApplicationT) => a.id === id);

  const [method, setMethod] = useState<"MTN MoMo" | "Orange Money">("MTN MoMo");
  const [payerPhone, setPayerPhone] = useState(profile.phone);
  const [txnRef, setTxnRef] = useState("");
  const [payError, setPayError] = useState("");
  /* Approved payment flow (Giin, 2026-11-27): type ANY MoMo number to
     pay from, click Make payment, the system shows the billing number
     and amount, the phone is prompted by USSD to press 1 and enter
     the MoMo PIN, PortaGov waits, then shows Transaction completed
     with the tracking/reference number. Real MoMo is not live yet,
     so the USSD prompt below is the mock stand-in for that phone
     prompt, with the same steps, and no real money moves. */
  const [payStep, setPayStep] = useState<"form" | "ussd" | "waiting" | "done">("form");
  const [payUssdStep, setPayUssdStep] = useState<1 | 2>(1);
  const [payStarted, setPayStarted] = useState<any>(null);
  const [payDone, setPayDone] = useState<any>(null);
  const refreshAfterPayment = (done?: any) => {
    /* Refresh the application too, not only the payments list: the
       amount paid and billing status live on the application, and
       without this the page kept showing $0 / "Not confirmed paid
       yet" until a manual reload after a confirmed payment.
       Update the cached application and payments at once, so the
       paid amount shows immediately in this same view even if the
       refetch is slow or a flaky connection drops it, then refetch
       both lists from the backend to confirm. */
    if (done) {
      const amount = Number(done.amount ?? 0);
      queryClient.setQueryData(
        ["applications", profile.id],
        (old: any) =>
          old?.applications
            ? {
                ...old,
                applications: old.applications.map((a: any) =>
                  a.id === id
                    ? {
                        ...a,
                        amount_paid: Math.max(Number(a.amount_paid ?? 0), amount),
                        billing_status: "Paid",
                        released: true,
                        status_note: "Paid and released to the institution.",
                      }
                    : a,
                ),
              }
            : old,
      );
      queryClient.setQueryData(["payments"], (old: any) => {
        const list = old?.payments ?? [];
        if (list.some((p: any) => p.transaction_ref === done.txn_ref && done.txn_ref)) return old;
        return {
          ...old,
          payments: [
            {
              id: done.id || 0,
              application_id: id,
              application_ref: app?.reference || "",
              billing_number: done.billing_number || "",
              service_name: app?.service_name || "",
              method: done.method || method,
              amount,
              payer_phone: done.payer_phone || payerPhone,
              transaction_ref: done.txn_ref || "",
              status: "Confirmed",
              refund_reason: "",
              created_at: new Date().toISOString(),
            },
            ...list,
          ],
        };
      });
    }
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.refetchQueries({ queryKey: ["payments"] });
    void queryClient.refetchQueries({ queryKey: ["applications"] });
  };
  const startPay = useMutation({
    mutationFn: async () =>
      await (api as any).startPayment({
        applicationId: id,
        method,
        payerPhone,
        transactionRef: txnRef,
      }),
    onSuccess: (r: any) => {
      if (!r.txn_ref) {
        // Free service, or already paid: nothing to confirm on a phone.
        setPayDone({ ...r, status: "Confirmed" });
        setPayStep("done");
        refreshAfterPayment(r);
        return;
      }
      setPayStarted(r);
      setPayUssdStep(1);
      setPayStep("ussd");
    },
    onError: (e) =>
      setPayError(e instanceof Error ? e.message : "Payment could not be started."),
  });
  const confirmPay = useMutation({
    mutationFn: async () =>
      await (api as any).confirmPayment({
        applicationId: id,
        txn_ref: payStarted?.txn_ref,
      }),
    onSuccess: (r: any) => {
      setPayDone(r);
      setPayStep("done");
      refreshAfterPayment(r);
    },
    onError: (e) => {
      setPayStep("ussd");
      setPayError(e instanceof Error ? e.message : "Payment could not be confirmed.");
    },
  });
  const pay = startPay;

  const [kind, setKind] = useState<"Biometrics" | "Collection" | "Interview">("Biometrics");
  const [groupSize, setGroupSize] = useState(1);
  const [office, setOffice] = useState(OFFICES[0] ?? "");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(TIME_SLOTS[1] ?? "");
  const [apptError, setApptError] = useState("");
  const [apptDone, setApptDone] = useState(false);
  const [ticket, setTicket] = useState("");
  const book = useMutation({
    mutationFn: async () => {
      if (date) {
        const day = new Date(`${date}T12:00:00`).getDay();
        if (day === 0 || day === 6) {
          throw new Error("PortaGov offices are open on weekdays only, Monday to Friday. Choose a weekday for your visit.");
        }
      }
      return await api.bookAppointment({
        profileId: profile.id,
        applicationId: id,
        kind,
        office,
        date,
        timeSlot: slot,
        groupSize,
      });
    },
    onSuccess: (r) => {
      setApptDone(true);
      setTicket(r.ticket);
      /* Show the new appointment on the Appointments page at once:
         add it to the cached list now, so the page never shows "No
         appointments yet" until a reload, then refetch to confirm. */
      queryClient.setQueryData(
        ["appointments", profile.id],
        (old: any) => {
          const list = old?.appointments ?? [];
          if (r.ticket && list.some((a: any) => a.ticket === r.ticket)) return old;
          return {
            ...old,
            appointments: [
              {
                id: 0,
                profile_id: profile.id,
                application_id: id,
                application_ref: app?.reference || "",
                kind,
                group_size: groupSize,
                ticket: r.ticket,
                office,
                date,
                time_slot: slot,
                status: "Booked",
                created_at: new Date().toISOString(),
              },
              ...list,
            ],
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.refetchQueries({ queryKey: ["appointments"] });
    },
    onError: (e) =>
      setApptError(e instanceof Error ? e.message : "Booking failed. Try again."),
  });

  if (apps.isPending) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-[var(--dim)]">Loading...</p>;
  }
  if (!app) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">Application not found</h1>
        <p className="mt-2 text-[var(--dim)]">
          <a href="#/applications" className="font-semibold underline">
            Return to my applications
          </a>
        </p>
      </div>
    );
  }
  const details = parseDetails(app.details);
  const docIds = parseIds(app.document_ids);
  const attached = (docs.data?.documents ?? []).filter((d: DocumentT) =>
    docIds.includes(d.id),
  );
  const myPayments = (payments.data?.payments ?? []).filter(
    (p: PaymentT) => p.application_id === app.id,
  );
  const service = serviceById(app.service_id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-[var(--dim)]">
        <a href="#/applications" className="font-semibold underline">My applications</a> /{" "}
        {app.reference}
      </p>
      <div className="mt-3 rounded-xl p-6 text-white" style={{ backgroundColor: "#0a2a5e" }}>
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#d9a821" }}>
          {app.released ? "With the institution" : "With PortaGov"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">{app.service_name}</h1>
        <p className="mt-1 text-white/85">
          {app.institution}. Submitted {fmtDateTime(app.created_at)}. Your
          tracking, billing and transaction numbers are together in Your
          numbers below.
        </p>
        <p className="mt-2 text-sm text-white/85">
          {app.released
            ? "PortaGov has released this application to the institution. It is now in the institution's hands, and PortaGov keeps tracking it with you."
            : "PortaGov is holding this application for review. The institution cannot see it yet. It is released only when PortaGov approves it, or at once when automatic release is on."}
        </p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Progress</h2>
          <p className="mt-2 text-sm text-[var(--text)]">
            <Chip tone="gold">{applicationStatusPlain(app.status).short}</Chip>
          </p>
          <p className="mt-2 text-sm text-[var(--text)]">
            Status: {app.status}. {applicationStatusPlain(app.status).meaning}
          </p>
          <div className="mt-3">
            <TimelineWithDates applicationId={app.id} status={app.status} />
          </div>
          {app.status_note ? (
            <div className="mt-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
              <strong>Latest note:</strong> {app.status_note}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">Application details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--dim)]">Applicant</dt>
                <dd className="font-semibold text-[var(--text)]">{app.applicant_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--dim)]">Channel</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {app.channel}
                  {app.channel === "Diaspora" && app.diaspora_country
                    ? `, from ${app.diaspora_country}`
                    : ""}
                  {app.channel === "Agent assisted" && app.agent_name
                    ? `, agent ${app.agent_name}`
                    : ""}
                </dd>
              </div>
              {details.map((d) => (
                <div key={d.label} className="flex justify-between gap-4">
                  <dt className="text-[var(--dim)]">{d.label}</dt>
                  <dd className="text-right font-semibold text-[var(--text)]">{d.value}</dd>
                </div>
              ))}
            </dl>
            {app.notes ? (
              <p className="mt-3 text-sm text-[var(--dim)]">
                <strong className="text-[var(--text)]">Your note:</strong> {app.notes}
              </p>
            ) : null}
            <h3 className="mt-4 font-display font-bold text-[var(--text)]">Documents attached</h3>
            {attached.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm text-[var(--dim)]">
                {attached.map((d: DocumentT) => (
                  <li key={d.id}>
                    {d.title} ({d.doc_type})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--dim)]">None attached.</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              Pay with mobile money
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Pay the institution's fee on MTN MoMo or Orange Money, then record
              the transaction reference here so your payment is matched to this
              application. PortaGov does not invent fees: the amount is the one
              the institution tells you for this service.
            </p>
            {myPayments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {myPayments.map((p: PaymentT) => (
                  <li key={p.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
                    <strong>{paymentMethodLabel(p)}</strong>, ${p.amount}, billing{" "}
                    {p.billing_number}, ref {p.transaction_ref}, from{" "}
                    {p.payer_phone}. Status: {p.status}. Recorded {fmtDate(p.created_at)}.
                    {p.status === "Confirmed" ? " Receipt saved in your wallet." : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {payStep === "done" && payDone ? (
              <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-4 text-sm text-[var(--text)]">
                <p className="font-display text-base font-bold">Transaction completed</p>
                <p className="mt-1">
                  Your payment of <strong>${payDone.amount}</strong> by {payDone.method || method} from{" "}
                  {payDone.payer_phone || payerPhone} is confirmed. Billing number{" "}
                  <strong>{payDone.billing_number || app.billing_number}</strong>.
                </p>
                <p className="mt-1">
                  Tracking / reference number: <strong>{app.reference}</strong>
                  {payDone.txn_ref ? (
                    <>, transaction reference <strong>{payDone.txn_ref}</strong></>
                  ) : null}
                  {payDone.user_ref ? (
                    <>, your reference from your phone: <strong>{payDone.user_ref}</strong></>
                  ) : null}
                  . The amount paid above is updated now, no need to reload the page.
                </p>
              </div>
            ) : payStep === "ussd" && payStarted ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--text)]">
                <p className="font-display font-bold">Pay on your phone</p>
                <p>
                  Billing number <strong>{payStarted.billing_number || app.billing_number}</strong>, amount{" "}
                  <strong>${payStarted.amount}</strong>. A prompt is on its way to{" "}
                  <strong>{payStarted.payer_phone}</strong>.
                </p>
                <div className="rounded-lg bg-[var(--surface)] p-3">
                  <p className="font-bold">On your phone you will see:</p>
                  <p className="mt-1">
                    PortaGov: pay ${payStarted.amount} for {app.service_name}, billing{" "}
                    {payStarted.billing_number || app.billing_number}. Press 1 to confirm, then enter your MoMo PIN.
                  </p>
                </div>
                <p className="text-xs text-[var(--dim)]">
                  Demo for now: no real money moves yet. When the real MoMo provider is live, this same prompt will
                  arrive on your phone by USSD.
                </p>
                {payUssdStep === 1 ? (
                  <PrimaryButton type="button" onClick={() => setPayUssdStep(2)}>
                    Press 1 to confirm
                  </PrimaryButton>
                ) : (
                  <>
                    <p className="font-semibold">Step 1 done. Now enter your MoMo PIN on your phone.</p>
                    <PrimaryButton
                      type="button"
                      disabled={confirmPay.isPending}
                      onClick={() => {
                        setPayError("");
                        setPayStep("waiting");
                        confirmPay.mutate();
                      }}
                    >
                      I entered my PIN
                    </PrimaryButton>
                  </>
                )}
                {payError ? (
                  <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                    {payError}
                  </p>
                ) : null}
              </div>
            ) : payStep === "waiting" ? (
              <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-4 text-sm text-[var(--text)]">
                <p className="font-display font-bold">Waiting for your phone...</p>
                <p className="mt-1">
                  PortaGov is waiting for the confirmation from {payStarted?.payer_phone || payerPhone}. Do not close
                  this page. When the transaction completes, this screen will show Transaction completed with your
                  tracking number.
                </p>
              </div>
            ) : (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  setPayError("");
                  if (!payerPhone.trim()) {
                    setPayError("Type the MoMo number you want to pay from.");
                    return;
                  }
                  startPay.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="pay-method">Payment method</FieldLabel>
                    <select id="pay-method" {...FIELDS.recordPayment.method} className={inputCls} value={method}
                      onChange={(e) => setMethod(e.target.value === "Orange Money" ? "Orange Money" : "MTN MoMo")}>
                      <option>MTN MoMo</option>
                      <option>Orange Money</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="pay-phone">Phone to pay from</FieldLabel>
                    <input id="pay-phone" {...FIELDS.recordPayment.payerPhone} className={inputCls} value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--dim)]">
                      Type any MoMo number you want to pay from. It does not have to be the number you signed up
                      with. The prompt will go to this number.
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--text)]">
                    Amount to pay: <strong>${app.total_due - app.amount_paid} USD</strong>, billing number{" "}
                    <strong>{app.billing_number}</strong>. PortaGov confirms the payment against this billing number
                    before anything is released.
                  </p>
                </div>
                <div>
                  <FieldLabel htmlFor="pay-ref">Your reference from your phone (optional)</FieldLabel>
                  <input id="pay-ref" {...FIELDS.recordPayment.transactionRef} required={false} className={inputCls} value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                    placeholder="Only if your MoMo message already gave you one" />
                  <p className="mt-1 text-xs text-[var(--dim)]">
                    If you type a reference here, PortaGov keeps it with this payment. You do not need one to pay.
                  </p>
                </div>
                {payError ? (
                  <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                    {payError}
                  </p>
                ) : null}
                <PrimaryButton type="submit" disabled={startPay.isPending}>
                  {startPay.isPending ? "Starting payment..." : "Make payment"}
                </PrimaryButton>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              Book your visit
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {service
                ? service.visitNote
                : "Book biometrics or collection at a time that suits you."}{" "}
              You only travel when there is something to do in person.
            </p>
            {apptDone ? (
              <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
                Appointment booked. Your ticket number is <strong>{ticket}</strong>. Bring it with you. PortaGov
                will remind you the day before, on {date ? fmtDate(dayBefore(date)) : "the day before your visit"},
                and the reminder is saved under{" "}
                <a href="#/appointments" className="underline">Appointments</a>. The SMS itself will be sent once
                the SMS sender is live.
              </p>
            ) : (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  setApptError("");
                  if (!date) {
                    setApptError("Choose a date for your visit.");
                    return;
                  }
                  book.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="bk-kind">Visit type</FieldLabel>
                    <select id="bk-kind" {...FIELDS.bookAppointment.kind} className={inputCls} value={kind}
                      onChange={(e) =>
                        setKind(
                          e.target.value === "Collection"
                            ? "Collection"
                            : e.target.value === "Interview"
                              ? "Interview"
                              : "Biometrics",
                        )
                      }>
                      <option>Biometrics</option>
                      <option>Collection</option>
                      <option>Interview</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="bk-office">Office</FieldLabel>
                    <select id="bk-office" {...FIELDS.bookAppointment.office} className={inputCls} value={office}
                      onChange={(e) => setOffice(e.target.value)}>
                      {OFFICES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="bk-date">Date</FieldLabel>
                    <input id="bk-date" {...FIELDS.bookAppointment.date} type="date" className={inputCls} value={date}
                      onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="bk-group">People coming (group booking, 1 to 30)</FieldLabel>
                    <input id="bk-group" {...FIELDS.bookAppointment.groupSize} type="number" className={inputCls} value={groupSize}
                      onChange={(e) => setGroupSize(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
                    <p className="mt-1 text-xs text-[var(--dim)]">
                      For a family or a school group, book once for everyone.
                    </p>
                  </div>
                  <div>
                    <FieldLabel htmlFor="bk-slot">Time</FieldLabel>
                    <select id="bk-slot" {...FIELDS.bookAppointment.timeSlot} className={inputCls} value={slot}
                      onChange={(e) => setSlot(e.target.value)}>
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {apptError ? (
                  <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                    {apptError}
                  </p>
                ) : null}
                <PrimaryButton type="submit" disabled={book.isPending}>
                  {book.isPending ? "Booking..." : "Book this visit"}
                </PrimaryButton>
              </form>
            )}
          </div>
        </div>
      </div>
      <ApplicationActivity app={app} />
      <ApplicationExtras app={app} profile={profile} />
      <div className="mt-5 space-y-5">
        <FraudWarning billingNumber={app.billing_number} />
        <ThreadPanel app={app} profile={profile} />
        <div className="grid gap-5 md:grid-cols-2">
          <PickupProxy app={app} profile={profile} />
          <CitizenEmbassyUpdates app={app} />
        </div>
        <VideoCallPanel app={app} />
        <VoiceNoteReply app={app} profile={profile} />
        <ApplicationTools app={app} profile={profile} />
        <CollectionSlip app={app} holderName={profile.full_name} />
      </div>
    </div>
  );
}

/* ---------- document wallet ---------- */

const DOC_TYPES = [
  "Passport photograph",
  "Birth certificate",
  "National ID",
  "Passport",
  "Voter card",
  "Police report",
  "Business registration",
  "Contract or letter",
  "Deed or land document",
  "Other document",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

type StagedDoc = {
  file: File;
  previewUrl: string | null;
  dims: { w: number; h: number } | null;
  /** Laplacian variance from measureSharpness, null when not measured yet. */
  sharpness: number | null;
  docNumber: string;
  issuedOn: string;
  expiresOn: string;
  customTitle: string;
};

/* ---------- document viewer (wallet) ---------- */

/** One document to show in the viewer: a saved wallet file, or a file
    staged for saving. The size comes from the file itself when it is
    known, or from the length of the stored data URL when it is not. */
type ViewerDoc = {
  title: string;
  fileName: string;
  contentType: string;
  url: string;
  sizeBytes: number | null;
  detail?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUrlSize(url: string): number | null {
  const marker = ";base64,";
  const at = url.indexOf(marker);
  if (!url.startsWith("data:") || at < 0) return null;
  const b64 = url.slice(at + marker.length).replace(/\s/g, "");
  if (!b64) return null;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function viewerDocFromSaved(d: DocumentT): ViewerDoc {
  return {
    title: d.title || d.doc_type,
    fileName: d.file_name,
    contentType: d.content_type,
    url: d.file_url,
    sizeBytes: dataUrlSize(d.file_url),
    detail: [
      d.doc_number ? `Number ${d.doc_number}` : "",
      d.expires_on ? `Expires ${d.expires_on}` : "",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** Full screen viewer for one wallet document. Images show at their
    actual uploaded size (100%), PDFs show in an embedded viewer, and
    any other file shows its name, type and size with a download and an
    open link, so no document is ever a dead click. Zoom in, zoom out,
    reset to actual size, fit to screen, and close are all here. Close
    works from the Close button, the Escape key, and tapping outside
    the viewer. On a phone the toolbar wraps and the content scrolls,
    so nothing overflows the screen. */
function DocumentViewer({
  doc,
  onClose,
}: {
  doc: ViewerDoc | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  /* Saved wallet files arrive as data: URLs, and Chrome blocks a
     data: URL inside an iframe ("This content is blocked"), and
     opening one in a new tab shows a blank page, so a PDF could
     never be previewed even though Download worked. Turn a data:
     URL into a blob: URL first: the same file, served in a way the
     browser's PDF viewer accepts. Blob: URLs already work as they
     are, and are left alone. */
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const docUrl = doc?.url ?? "";

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setBlobUrl(null);
    if (docUrl.startsWith("data:")) {
      void fetch(docUrl)
        .then((r) => r.blob())
        .then((b) => {
          if (cancelled) return;
          created = URL.createObjectURL(b);
          setBlobUrl(created);
        })
        .catch(() => {
          /* Keep the data: URL as a fallback: Download still works. */
        });
    }
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [docUrl]);

  /* The address the viewer actually shows: the blob: URL when one
     was made, otherwise the file's own address. */
  const displayUrl = blobUrl ?? docUrl;

  useEffect(() => {
    setZoom(1);
    setFit(false);
    setNatural(null);
  }, [doc?.url]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [doc, onClose]);

  if (!doc) return null;

  const isImage = doc.contentType.startsWith("image/");
  const isPdf = doc.contentType === "application/pdf";
  const canZoom = isImage || isPdf;
  const zoomLabel = fit
    ? "Fit to screen"
    : `${Math.round(zoom * 100)}% of actual size`;
  const zoomIn = () => {
    setFit(false);
    setZoom((z) => Math.min(4, Math.round(z * 1.25 * 100) / 100));
  };
  const zoomOut = () => {
    setFit(false);
    setZoom((z) => Math.max(0.25, Math.round((z / 1.25) * 100) / 100));
  };
  const resetZoom = () => {
    setFit(false);
    setZoom(1);
  };
  const fitToScreen = () => {
    setFit(true);
    setZoom(1);
  };
  const viewerBtn =
    "min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--text)] disabled:opacity-50";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${doc.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] p-3">
          <div className="min-w-0">
            <p className="truncate font-display font-bold text-[var(--text)]">
              {doc.title}
            </p>
            <p className="break-words text-sm text-[var(--dim)]">
              {doc.fileName}
              {doc.contentType ? `, ${doc.contentType}` : ""}
              {doc.sizeBytes !== null
                ? `, ${formatFileSize(doc.sizeBytes)}`
                : ""}
              {doc.detail ? `, ${doc.detail}` : ""}
              {isImage && natural
                ? `, ${natural.w} by ${natural.h} pixels`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the document viewer"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]"
          >
            Close
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] p-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoom || zoom <= 0.25}
            aria-label="Zoom out"
            className={viewerBtn}
          >
            Zoom out
          </button>
          <span
            className="min-w-[7rem] text-center text-sm font-bold text-[var(--text)]"
            aria-live="polite"
          >
            {canZoom ? zoomLabel : "No zoom for this file type"}
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoom || zoom >= 4}
            aria-label="Zoom in"
            className={viewerBtn}
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={!canZoom}
            aria-label="Reset to actual size, 100 percent"
            className={viewerBtn}
          >
            Actual size (100%)
          </button>
          <button
            type="button"
            onClick={fitToScreen}
            disabled={!canZoom}
            aria-label="Fit to screen"
            className={viewerBtn}
          >
            Fit to screen
          </button>
          <a
            href={displayUrl}
            download={doc.fileName || undefined}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--text)]"
          >
            Download
          </a>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[var(--surface-alt)]">
          {isImage ? (
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3">
              <img
                src={displayUrl}
                alt={doc.title}
                onLoad={(e) => {
                  const t = e.currentTarget;
                  setNatural({
                    w: t.naturalWidth,
                    h: t.naturalHeight,
                  });
                }}
                style={
                  fit
                    ? { maxWidth: "100%", maxHeight: "100%" }
                    : natural
                      ? {
                          width: natural.w * zoom,
                          height: "auto",
                          maxWidth: "none",
                        }
                      : { width: "auto", maxWidth: "none" }
                }
                className="shrink-0 rounded-lg border border-[var(--border)] bg-white"
              />
            </div>
          ) : isPdf ? (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div
                className="mx-auto"
                style={
                  fit
                    ? { width: "100%", height: "62vh" }
                    : { width: `${zoom * 100}%`, height: `${62 * zoom}vh` }
                }
              >
                <iframe
                  src={displayUrl}
                  title={doc.title}
                  className="h-full w-full rounded-lg border border-[var(--border)] bg-white"
                />
              </div>
              <p className="mt-2 text-center text-sm text-[var(--dim)]">
                If the PDF does not show here, use Download above, or{" "}
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  open it in a new tab
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="m-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
              <p className="font-display text-lg font-bold text-[var(--text)]">
                {doc.fileName || doc.title}
              </p>
              <p className="mt-2 text-sm text-[var(--dim)]">
                This file type cannot be shown inside PortaGov
                {doc.contentType ? ` (${doc.contentType})` : ""}
                {doc.sizeBytes !== null
                  ? `, size ${formatFileSize(doc.sizeBytes)}`
                  : ""}
                . Download it or open it to see it.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <a
                  href={displayUrl}
                  download={doc.fileName || undefined}
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: "#0a2a5e" }}
                >
                  Download the file
                </a>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)]"
                >
                  Open in a new tab
                </a>
              </div>
            </div>
          )}
        </div>
        <p className="border-t border-[var(--border)] p-2 text-center text-xs text-[var(--dim)]">
          Tap outside the viewer, or press Escape, to close it.
        </p>
      </div>
    </div>
  );
}

function WalletDocRow({
  docType,
  label,
  saved,
  staged,
  onPick,
  onUpdate,
  onClear,
  onRemove,
  removing,
  onView,
}: {
  docType: string;
  /** Shown heading for the row; extra "Other document" slots use
      "Other document (another one)" instead of their staging key. */
  label?: string;
  saved: DocumentT | undefined;
  staged: StagedDoc | undefined;
  onPick: (docType: string, f: File | null) => void;
  onUpdate: (docType: string, patch: Partial<StagedDoc>) => void;
  onClear: (docType: string) => void;
  onRemove: () => void;
  removing: boolean;
  onView: (doc: ViewerDoc) => void;
}) {
  const isPhoto = docType === "Passport photograph";
  const savedViewer: ViewerDoc | null =
    saved?.has_file && saved.file_url ? viewerDocFromSaved(saved) : null;
  const stagedViewer: ViewerDoc | null = staged?.previewUrl
    ? {
        title: staged.file.name,
        fileName: staged.file.name,
        contentType: staged.file.type || "application/octet-stream",
        url: staged.previewUrl,
        sizeBytes: staged.file.size,
      }
    : null;
  const photoTooSmall =
    isPhoto &&
    staged?.dims != null &&
    (staged.dims.w < 600 || staged.dims.h < 600);
  const stagedWarnings = staged ? checkStagedDoc(docType, staged) : [];
  const inputId = `wallet-file-${docType.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {savedViewer ? (
            <button
              type="button"
              onClick={() => onView(savedViewer)}
              aria-label={`View ${label ?? docType}`}
              className="text-left font-display font-bold text-[var(--text)] underline decoration-dotted underline-offset-4"
            >
              {label ?? docType}
            </button>
          ) : (
            <p className="font-display font-bold text-[var(--text)]">{label ?? docType}</p>
          )}
          {saved ? (
            <p className="text-sm text-[var(--dim)]">
              {saved.has_file
                ? `Saved file: ${saved.file_name}`
                : "Record only, no file uploaded yet."}
              {saved.doc_number ? `, number ${saved.doc_number}` : ""}
              {saved.expires_on ? `, expires ${saved.expires_on}` : ""}
            </p>
          ) : (
            <p className="text-sm text-[var(--dim)]">Not added yet.</p>
          )}
        </div>
        <Chip tone={saved ? "gold" : "plain"}>
          {saved ? (saved.has_file ? "Saved" : "Record only") : "Missing"}
        </Chip>
      </div>
      {savedViewer && savedViewer.contentType.startsWith("image/") ? (
        <button
          type="button"
          onClick={() => onView(savedViewer)}
          aria-label={`View ${docType}`}
          className="mt-3 block rounded-lg"
        >
          <img
            src={savedViewer.url}
            alt={savedViewer.title}
            className="max-h-40 w-auto rounded-lg border border-[var(--border)]"
          />
        </button>
      ) : savedViewer ? (
        <p className="mt-2 text-sm text-[var(--dim)]">
          Tap View below to open this document.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {savedViewer ? (
          <button
            type="button"
            onClick={() => onView(savedViewer)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]"
          >
            View
          </button>
        ) : null}
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]"
        >
          {saved ? "Update file" : "Upload file"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          aria-label={`${saved ? "Update" : "Upload"} ${docType}`}
          onChange={(e) => {
            onPick(docType, e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {saved ? (
          <GhostButton onClick={onRemove} disabled={removing}>
            Remove
          </GhostButton>
        ) : null}
        {isPhoto ? (
          <a href="#photo-fix" className="text-sm font-semibold underline">
            Crop and fix a photo below
          </a>
        ) : null}
      </div>
      {staged ? (
        <div className="mt-3 space-y-2 rounded-lg bg-[var(--surface-alt)] p-3">
          <p className="text-sm text-[var(--text)]">
            <strong>Ready to save:</strong> {staged.file.name}
          </p>
          {stagedViewer && staged.file.type.startsWith("image/") ? (
            <button
              type="button"
              onClick={() => onView(stagedViewer)}
              aria-label={`View ${staged.file.name}`}
              className="block rounded-lg"
            >
              <img
                src={stagedViewer.url}
                alt={`Preview of ${staged.file.name}`}
                className="max-h-40 w-auto rounded-lg border border-[var(--border)]"
              />
            </button>
          ) : stagedViewer ? (
            <p className="text-sm text-[var(--dim)]">
              {staged.file.name} is ready to view. Tap View below to open it.
            </p>
          ) : null}
          {stagedViewer ? (
            <button
              type="button"
              onClick={() => onView(stagedViewer)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)]"
            >
              View
            </button>
          ) : null}
          {isPhoto && staged.dims ? (
            <p className="text-sm text-[var(--text)]">
              Photograph size: {staged.dims.w} by {staged.dims.h} pixels.
              {photoTooSmall ? (
                <strong className="text-[var(--warn)]">
                  {" "}
                  Warning: this looks low quality or blurry for a passport
                  photograph. Use a sharper, full quality photo, because this
                  is the photo printed in your passport.
                </strong>
              ) : (
                " That is a good size for a passport photograph."
              )}
            </p>
          ) : null}
          {stagedWarnings.length > 0 ? (
            <div role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3">
              <p className="text-sm font-bold text-[var(--warn)]">
                Check this file before you save it
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
                {stagedWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-[var(--text)]">
                You can replace the file with a better one, or save it anyway
                from the Save button below. Saving a blurry photo or the wrong
                document can delay your application.
              </p>
              <button
                type="button"
                onClick={() => onClear(docType)}
                className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)]"
              >
                Replace this file
              </button>
            </div>
          ) : null}
          {docType === "Other document" || docType.startsWith("Other document#") ? (
            <div>
              <FieldLabel htmlFor={`${inputId}-title`}>Name for this document</FieldLabel>
              <input
                id={`${inputId}-title`}
                {...FIELDS.addDocument.title}
                className={inputCls}
                value={staged.customTitle}
                onChange={(e) => onUpdate(docType, { customTitle: e.target.value })}
                placeholder="My document"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor={`${inputId}-number`}>Document number, if it has one</FieldLabel>
              <input
                id={`${inputId}-number`}
                {...FIELDS.addDocument.docNumber}
                className={inputCls}
                value={staged.docNumber}
                onChange={(e) => onUpdate(docType, { docNumber: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${inputId}-issued`}>Issued on</FieldLabel>
              <input
                id={`${inputId}-issued`}
                {...FIELDS.addDocument.issuedOn}
                type="date"
                className={inputCls}
                value={staged.issuedOn}
                onChange={(e) => onUpdate(docType, { issuedOn: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${inputId}-expires`}>Expires on</FieldLabel>
              <input
                id={`${inputId}-expires`}
                {...FIELDS.addDocument.expiresOn}
                type="date"
                className={inputCls}
                value={staged.expiresOn}
                onChange={(e) => onUpdate(docType, { expiresOn: e.target.value })}
              />
            </div>
          </div>
          <button
            type="button"
            className="text-sm font-semibold underline"
            onClick={() => onClear(docType)}
          >
            Remove this file, do not save it
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WalletPage({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const [staged, setStaged] = useState<Record<string, StagedDoc>>({});
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [viewing, setViewing] = useState<ViewerDoc | null>(null);
  const [warnShown, setWarnShown] = useState(false);
  const [warnAcked, setWarnAcked] = useState("");
  /* Extra "Other document" slots, so a second (or third) Other
     document can be added without replacing the first. The main
     "Other document" row holds one document; each extra slot is
     staged under its own key, "Other document#2", "#3", ..., and is
     saved as a new "Other document" that never replaces another. */
  const [extraOtherKeys, setExtraOtherKeys] = useState<string[]>([]);
  const [extraOtherSeq, setExtraOtherSeq] = useState(2);

  const liveDocs = (docs.data?.documents ?? []).filter(
    (d: DocumentT) => d.status !== "Superseded",
  );
  /* Receipts in the wallet: every confirmed payment, with its billing
     number, amount, date, service and method, downloadable here. */
  const walletPayments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const walletApps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const myWalletAppIds = new Set(
    (walletApps.data?.applications ?? []).map((a: ApplicationT) => a.id),
  );
  const myWalletPayments = (walletPayments.data?.payments ?? []).filter(
    (p: PaymentT) => myWalletAppIds.has(p.application_id),
  );
  const savedByType = new Map<string, DocumentT>();
  for (const d of liveDocs) {
    if (!savedByType.has(d.doc_type)) savedByType.set(d.doc_type, d);
  }
  /* Documents that have no row of their own: any type outside the
     standard list, plus a second (or third) "Other document" with a
     different title. The rows above show only the first document of
     each type, so without this an extra Other document, for example
     a second birth record, would be saved but invisible and could
     never be opened in the viewer. */
  const seenOther = new Set<string>();
  const otherDocs = liveDocs.filter((d: DocumentT) => {
    if (!DOC_TYPES.includes(d.doc_type)) return true;
    if (d.doc_type !== "Other document") return false;
    if (seenOther.has(d.doc_type)) return true;
    seenOther.add(d.doc_type);
    return false;
  });
  const savedCount = DOC_TYPES.filter((t) => savedByType.has(t)).length;
  const stagedCount = Object.keys(staged).length;
  const warnedDocs = Object.entries(staged).flatMap(([docType, s]) =>
    checkStagedDoc(docType, s).map((warning) => ({ docType, warning })),
  );
  const warnKey = warnedDocs
    .map((d) => `${d.docType}: ${d.warning}`)
    .join(" | ");
  const needsAck = warnedDocs.length > 0 && warnAcked !== warnKey;

  const remove = useMutation({
    mutationFn: async (docId: number) => await api.deleteDocument({ id: docId }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["documents"] }),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Document could not be removed."),
  });

  const saveAll = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(staged);
      let saved = 0;
      for (const [docType, s] of entries) {
        /* An extra Other slot ("Other document#2", ...) is a new
           document, never an update: it is saved as "Other document"
           with no replacesDocumentId, so the first Other document
           stays in the wallet. Only the main row updates the saved
           document of its type. */
        const isExtraOther = docType.startsWith("Other document#");
        const realDocType = isExtraOther ? "Other document" : docType;
        if (realDocType === "Other document" && s.customTitle.trim().length < 2) {
          throw new Error(
            "Give the other document a name of at least 2 letters before saving.",
          );
        }
        const existing = isExtraOther ? undefined : savedByType.get(realDocType);
        const payload: Parameters<typeof api.addDocument>[0] = {
          profileId: profile.id,
          docType: realDocType,
          title:
            realDocType === "Other document"
              ? s.customTitle.trim()
              : realDocType,
          docNumber: s.docNumber,
          issuedOn: s.issuedOn,
          expiresOn: s.expiresOn,
          file: {
            dataBase64: await fileToBase64(s.file),
            fileName: s.file.name,
            contentType: s.file.type || "application/octet-stream",
          },
          replacesDocumentId: existing ? existing.id : 0,
        };
        await api.addDocument(payload);
        saved += 1;
      }
      return saved;
    },
    onSuccess: (n) => {
      setStaged((prev) => {
        for (const s of Object.values(prev)) {
          if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        }
        return {};
      });
      setExtraOtherKeys([]);
      setSavedMsg(
        `Saved ${n} document${n === 1 ? "" : "s"} to your wallet.`,
      );
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Documents could not be saved."),
  });

  const onPickFile = (docType: string, f: File | null) => {
    setSavedMsg("");
    setError("");
    setStaged((prev) => {
      const next = { ...prev };
      const old = next[docType];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      delete next[docType];
      if (!f) return next;
      const entry: StagedDoc = {
        file: f,
        previewUrl:
          f.type.startsWith("image/") || f.type === "application/pdf"
            ? URL.createObjectURL(f)
            : null,
        dims: null,
        sharpness: null,
        docNumber: "",
        issuedOn: "",
        expiresOn: "",
        customTitle: "",
      };
      next[docType] = entry;
      return next;
    });
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        setStaged((prev) => {
          const cur = prev[docType];
          if (!cur || cur.file !== f) return prev;
          return {
            ...prev,
            [docType]: {
              ...cur,
              dims: { w: img.naturalWidth, h: img.naturalHeight },
            },
          };
        });
        URL.revokeObjectURL(url);
        void measureSharpness(f).then((score) => {
          setStaged((prev) => {
            const cur = prev[docType];
            if (!cur || cur.file !== f) return prev;
            return { ...prev, [docType]: { ...cur, sharpness: score } };
          });
        });
      };
      img.src = url;
    }
  };

  const updateStaged = (docType: string, patch: Partial<StagedDoc>) => {
    setStaged((prev) => {
      const cur = prev[docType];
      if (!cur) return prev;
      return { ...prev, [docType]: { ...cur, ...patch } };
    });
  };

  const clearStaged = (docType: string) => {
    setStaged((prev) => {
      const next = { ...prev };
      const old = next[docType];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      delete next[docType];
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Document wallet</h1>
      <p className="mt-1 max-w-2xl text-[var(--dim)]">
        One wallet for every document. Upload once, at full quality, and reuse
        the same documents across every ministry and agency on PortaGov.
      </p>
      <p className="mt-2 max-w-2xl text-[var(--dim)]">
        Add your documents one by one below. Choose a file for each one, then
        press Save all documents once and they are all saved. Files are stored
        exactly as you upload them, never compressed by PortaGov.
      </p>
      {docs.isPending ? (
        <p className="mt-5 text-[var(--dim)]">Loading your wallet...</p>
      ) : (
        <>
          <p className="mt-5 font-display text-lg font-bold text-[var(--text)]" role="status">
            {savedCount} of {DOC_TYPES.length} documents saved
            {savedCount < DOC_TYPES.length
              ? `, ${DOC_TYPES.length - savedCount} still missing`
              : ""}
          </p>
          <div className="mt-3 space-y-3">
            {DOC_TYPES.map((t) => (
              <WalletDocRow
                key={t}
                docType={t}
                saved={savedByType.get(t)}
                staged={staged[t]}
                onPick={onPickFile}
                onUpdate={updateStaged}
                onClear={clearStaged}
                onRemove={() => {
                  const s = savedByType.get(t);
                  if (s) remove.mutate(s.id);
                }}
                removing={remove.isPending}
                onView={setViewing}
              />
            ))}
          </div>
          {/* A second Other document: its own row, its own title and
              View button, saved as a new document that never replaces
              the first Other document. */}
          {extraOtherKeys.length > 0 ? (
            <div className="mt-3 space-y-3">
              {extraOtherKeys.map((k) => (
                <WalletDocRow
                  key={k}
                  docType={k}
                  label="Other document (another one)"
                  saved={undefined}
                  staged={staged[k]}
                  onPick={onPickFile}
                  onUpdate={updateStaged}
                  onClear={clearStaged}
                  onRemove={() => {
                    setExtraOtherKeys((prev) => prev.filter((x) => x !== k));
                    clearStaged(k);
                  }}
                  removing={false}
                  onView={setViewing}
                />
              ))}
            </div>
          ) : null}
          <div className="mt-3">
            <GhostButton
              onClick={() => {
                const key = `Other document#${extraOtherSeq}`;
                setExtraOtherSeq((n) => n + 1);
                setExtraOtherKeys((prev) => [...prev, key]);
              }}
            >
              Add another Other document
            </GhostButton>
            <p className="mt-1 text-sm text-[var(--dim)]">
              For a second document that does not fit the list above, for
              example a clinic letter as well as a birth record. Each one
              keeps its own name and View button, and adding one never
              replaces the first.
            </p>
          </div>
          {otherDocs.length > 0 ? (
            <div className="mt-5">
              <h2 className="font-display text-lg font-bold text-[var(--text)]">
                Other saved documents
              </h2>
              <div className="mt-3 space-y-3">
                {otherDocs.map((d: DocumentT) => {
                  const otherViewer: ViewerDoc | null =
                    d.has_file && d.file_url ? viewerDocFromSaved(d) : null;
                  return (
                    <div
                      key={d.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          {otherViewer ? (
                            <button
                              type="button"
                              onClick={() => setViewing(otherViewer)}
                              aria-label={`View ${d.title}`}
                              className="text-left font-display font-bold text-[var(--text)] underline decoration-dotted underline-offset-4"
                            >
                              {d.title}
                            </button>
                          ) : (
                            <p className="font-display font-bold text-[var(--text)]">
                              {d.title}
                            </p>
                          )}
                          <p className="text-sm text-[var(--dim)]">
                            {d.doc_type}
                            {d.has_file ? `, file saved: ${d.file_name}` : ", record only, no file uploaded yet."}
                          </p>
                        </div>
                        <Chip tone="gold">Saved</Chip>
                      </div>
                      {otherViewer && d.content_type.startsWith("image/") ? (
                        <button
                          type="button"
                          onClick={() => setViewing(otherViewer)}
                          aria-label={`View ${d.title}`}
                          className="mt-3 block rounded-lg"
                        >
                          <img
                            src={d.file_url}
                            alt={d.title}
                            className="max-h-40 w-auto rounded-lg border border-[var(--border)]"
                          />
                        </button>
                      ) : otherViewer ? (
                        <p className="mt-2 text-sm text-[var(--dim)]">
                          Tap View below to open this document.
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {otherViewer ? (
                          <button
                            type="button"
                            onClick={() => setViewing(otherViewer)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]"
                          >
                            View
                          </button>
                        ) : null}
                        <GhostButton
                          onClick={() => remove.mutate(d.id)}
                          disabled={remove.isPending}
                        >
                          Remove
                        </GhostButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {error ? (
              <p role="alert" className="mb-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                {error}
              </p>
            ) : null}
            {savedMsg ? (
              <p role="status" className="mb-3 text-sm font-semibold text-[var(--text)]">
                {savedMsg}
              </p>
            ) : null}
            {warnedDocs.length > 0 && warnShown ? (
              <div role="alert" className="mb-3 rounded-lg bg-[var(--gold-soft)] p-3">
                <p className="text-sm font-bold text-[var(--warn)]">
                  Check these files before you save
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
                  {warnedDocs.map((d) => (
                    <li key={`${d.docType}: ${d.warning}`}>
                      <strong>{d.docType}:</strong> {d.warning}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-[var(--text)]">
                  Replace a file above with a better one, or save anyway if
                  you are sure this is the right file. A blurry photo or the
                  wrong document can delay your application.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PrimaryButton
                    type="button"
                    onClick={() => {
                      setWarnAcked(warnKey);
                      setWarnShown(false);
                      saveAll.mutate();
                    }}
                    disabled={saveAll.isPending}
                  >
                    Save anyway
                  </PrimaryButton>
                  <GhostButton onClick={() => setWarnShown(false)}>
                    Go back and replace a file
                  </GhostButton>
                </div>
              </div>
            ) : null}
            <PrimaryButton
              type="button"
              onClick={() => {
                if (needsAck) {
                  setWarnShown(true);
                  return;
                }
                saveAll.mutate();
              }}
              disabled={saveAll.isPending || stagedCount === 0}
            >
              {saveAll.isPending
                ? "Saving..."
                : stagedCount > 0
                  ? `Save all documents (${stagedCount})`
                  : "Save all documents"}
            </PrimaryButton>
            <p className="mt-2 text-sm text-[var(--dim)]">
              {stagedCount > 0
                ? `${stagedCount} document${stagedCount === 1 ? "" : "s"} ready to save. Nothing is saved until you press this button.`
                : "Choose a file above to get started. Saved documents stay in your wallet until you remove them."}
            </p>
          </div>
        </>
      )}

      <div className="mt-6 space-y-5">
        {myWalletPayments.length > 0 ? (
          <ReceiptDownloads payments={myWalletPayments} />
        ) : null}
        <ExpiryReminders profile={profile} />
        <ExpiryWalletList profile={profile} />
        <PhotoFixTool profile={profile} />
        <LostDocumentsPanel profile={profile} />
        <WalletRefunds profile={profile} />
      </div>
    </div>
  );
}

/* ---------- appointments page ---------- */

function AppointmentsPage({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const appts = useQuery({
    queryKey: ["appointments", profile.id],
    queryFn: () => api.listAppointments({ profileId: profile.id }),
  });
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  /* The service an appointment is for, from the application it was
     booked from, so the reminder lists that service's real
     requirements. */
  const serviceFor = (a: AppointmentT) => {
    const app = (apps.data?.applications ?? []).find(
      (x: ApplicationT) =>
        a.application_ref !== "" && x.reference === a.application_ref,
    );
    return app ? serviceById(app.service_id) : undefined;
  };
  const setStatus = useMutation({
    mutationFn: async (args: { id: number; status: "Attended" | "Missed" | "Cancelled" | "Booked" }) =>
      await api.updateAppointmentStatus(args),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Appointments</h1>
      <p className="mt-1 text-[var(--dim)]">
        Your booked visits: biometrics, collection, and interviews. Book a new
        one from any application's page.
      </p>
      <div className="mt-5 space-y-3">
        {appts.isPending ? (
          <p className="text-[var(--dim)]">Loading appointments...</p>
        ) : appts.data && appts.data.appointments.length > 0 ? (
          appts.data.appointments.map((a: AppointmentT) => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-[var(--text)]">
                    {a.kind}, {a.date}, {a.time_slot}
                  </p>
                  {a.ticket ? (
                    <p className="text-sm font-bold" style={{ color: "#0a2a5e" }}>
                      Ticket {a.ticket}
                    </p>
                  ) : null}
                  <p className="text-sm text-[var(--dim)]">{a.office}</p>
                  {a.application_ref ? (
                    <p className="text-sm text-[var(--dim)]">
                      For application {a.application_ref}
                    </p>
                  ) : null}
                </div>
                <Chip tone={a.status === "Booked" ? "gold" : "plain"}>{a.status}</Chip>
              </div>
              {a.status === "Booked" ? (
                <div className="mt-3">
                  <DayBeforeReminder appt={a} service={serviceFor(a)} />
                </div>
              ) : null}
              {a.status === "Booked" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton onClick={() => setStatus.mutate({ id: a.id, status: "Attended" })}>
                    Mark attended
                  </GhostButton>
                  <GhostButton onClick={() => setStatus.mutate({ id: a.id, status: "Cancelled" })}>
                    Cancel appointment
                  </GhostButton>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg font-bold text-[var(--text)]">No appointments yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
              You have no appointments booked yet. That is normal if you have
              not booked one. When a service needs you in person, you book
              the visit from that application&apos;s page, at a time you choose.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                href="#/applications"
                className="rounded-lg px-5 py-2.5 font-semibold text-white"
                style={{ backgroundColor: "#0a2a5e" }}
              >
                Book a visit from an application
              </a>
              <a
                href="#/"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-5 py-2.5 font-semibold text-[var(--text)]"
              >
                Browse services
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- payments page ---------- */

function PaymentsPage({ profile }: { profile: ProfileT }) {
  const [q, setQ] = useState("");
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const myAppIds = new Set((apps.data?.applications ?? []).map((a: ApplicationT) => a.id));
  const mine = (payments.data?.payments ?? []).filter((p: PaymentT) =>
    myAppIds.has(p.application_id),
  );
  const shown =
    q.trim() === ""
      ? mine
      : mine.filter((p: PaymentT) =>
          p.application_ref.toLowerCase().includes(q.trim().toLowerCase()),
        );
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Payments</h1>
      <p className="mt-1 text-[var(--dim)]">
        Every payment, receipt, and refund of yours, in one list. Record a
        new payment from the application's page.
      </p>
      <div className="mt-4">
        <FraudWarning />
      </div>
      <div className="mt-4 max-w-sm">
        <FieldLabel htmlFor="pay-search">Search by tracking number</FieldLabel>
        <input id="pay-search" className={inputCls} value={q}
          onChange={(e) => setQ(e.target.value)} placeholder="PG-2026-00001" />
      </div>
      <div className="mt-5 space-y-3">
        {payments.isPending || apps.isPending ? (
          <p className="text-[var(--dim)]">Loading payments...</p>
        ) : shown.length > 0 ? (
          shown.map((p: PaymentT) => (
            <button
              key={p.id}
              type="button"
              onClick={() => nav(`#/application/${p.application_id}`)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left"
            >
              <p className="font-display font-bold text-[var(--text)]">
                {paymentMethodLabel(p)}, ${p.amount}, application {p.application_ref}
              </p>
              <p className="text-sm text-[var(--dim)]">
                {p.service_name}, billing {p.billing_number}. Transaction {p.transaction_ref}, paid from {p.payer_phone},{" "}
                {fmtDate(p.created_at)}. Status: {p.status}.
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg font-bold text-[var(--text)]">
              {q.trim() ? "No payment matches that tracking number" : "No payments recorded yet"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
              When you pay for a service with MTN MoMo or Orange Money, record
              the transaction reference on the application and it appears here.
            </p>
          </div>
        )}
      </div>
      {mine.length > 0 ? (
        <div className="mt-6">
          <ReceiptDownloads payments={mine} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- family page ---------- */

function FamilyPage({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const family = useQuery({
    queryKey: ["family", profile.id],
    queryFn: () => api.listFamily({ profileId: profile.id }),
  });
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("Child");
  const [dob, setDob] = useState("");
  const [nid, setNid] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const add = useMutation({
    mutationFn: async () =>
      await api.addFamilyMember({
        profileId: profile.id,
        fullName,
        relationship,
        dateOfBirth: dob,
        nationalId: nid,
        consent,
      }),
    onSuccess: () => {
      setFullName("");
      setDob("");
      setNid("");
      void queryClient.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });
  const remove = useMutation({
    mutationFn: async (memberId: number) =>
      await api.deleteFamilyMember({ id: memberId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["family"] }),
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">My family</h1>
      <p className="mt-1 max-w-2xl text-[var(--dim)]">
        Save your household once. Family details are ready when you apply for
        services for a child, a parent, or another relative.
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {family.isPending ? (
            <p className="text-[var(--dim)]">Loading your family...</p>
          ) : family.data && family.data.members.length > 0 ? (
            family.data.members.map((mem: MemberT) => (
              <div key={mem.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <p className="font-display font-bold text-[var(--text)]">{mem.full_name}</p>
                  <p className="text-sm text-[var(--dim)]">
                    {mem.relationship}, born {mem.date_of_birth}
                    {mem.national_id ? `, national ID ${mem.national_id}` : ", no national ID recorded"}
                  </p>
                </div>
                <GhostButton onClick={() => remove.mutate(mem.id)} disabled={remove.isPending}>
                  Remove
                </GhostButton>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <p className="font-display text-lg font-bold text-[var(--text)]">No family members saved yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
                Add the people you apply for most, and their details are ready
                next time.
              </p>
            </div>
          )}
        </div>
        <form
          className="h-fit rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            if (fullName.trim().length < 2 || !dob) {
              setError("Add the person's full name and date of birth.");
              return;
            }
            add.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Add a family member</h2>
          <div className="mt-3 space-y-3">
            <div>
              <FieldLabel htmlFor="fam-name">Full name</FieldLabel>
              <input id="fam-name" {...FIELDS.addFamilyMember.fullName} className={inputCls} value={fullName}
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="fam-rel">Relationship to you</FieldLabel>
              <select id="fam-rel" {...FIELDS.addFamilyMember.relationship} className={inputCls} value={relationship}
                onChange={(e) => setRelationship(e.target.value)}>
                <option>Child</option>
                <option>Spouse</option>
                <option>Parent</option>
                <option>Sibling</option>
                <option>Other relative</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="fam-dob">Date of birth</FieldLabel>
              <input id="fam-dob" {...FIELDS.addFamilyMember.dateOfBirth} type="date" className={inputCls} value={dob}
                onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="fam-nid">National ID number, if any</FieldLabel>
              <input id="fam-nid" {...FIELDS.addFamilyMember.nationalId} className={inputCls} value={nid}
                onChange={(e) => setNid(e.target.value)} />
            </div>
            {error ? (
              <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                {error}
              </p>
            ) : null}
            <label className="flex min-h-9 items-start gap-2 text-sm text-[var(--text)]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>
                This person agrees to be saved in my family and to have
                applications made for them from my account. Family
                applications need consent, always.
              </span>
            </label>
            <PrimaryButton type="submit" disabled={add.isPending}>
              {add.isPending ? "Saving..." : "Save family member"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- track page ---------- */

function TrackPage({ profile }: { profile: ProfileT | null }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [searched, setSearched] = useState(false);
  const track = useMutation({
    mutationFn: async () =>
      await api.trackApplication({
        profileId: profile?.id ?? 0,
        reference: reference.trim(),
        phone: phone.trim(),
      }),
    onSuccess: () => setSearched(true),
  });
  const app = track.data?.application ?? null;
  const trackPayments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const trackPayment = app
    ? (trackPayments.data?.payments ?? [])
        .filter((pay: PaymentT) => pay.application_id === app.id && pay.status === "Confirmed")
        .sort((a: PaymentT, b: PaymentT) => b.created_at.localeCompare(a.created_at))[0]
    : undefined;
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Track an application</h1>
        <p className="mt-1 text-[var(--dim)]">
          Tracking is for PortaGov members only. Your application status is
          private, so PortaGov never shows it to someone who is not signed in.
        </p>
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-display text-lg font-bold text-[var(--text)]">
            Sign in, or create your account first
          </p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            If you already have a PortaGov account, sign in and you can track
            your own application with its reference number and your phone
            number. If you have never used PortaGov, create your account
            first, it takes a few minutes, once.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => nav("#/signin")}>Sign in</PrimaryButton>
            <GhostButton onClick={() => nav("#/signin")}>Create an account</GhostButton>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Track an application</h1>
      <p className="mt-1 text-[var(--dim)]">
        You are signed in as {profile.full_name}. Enter the reference number
        from your confirmation and the phone number on the application. Only
        your own applications can be tracked here.
      </p>
      <form
        className="mt-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setSearched(false);
          track.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="tr-ref">Application reference</FieldLabel>
          <input id="tr-ref" {...FIELDS.trackApplication.reference} className={inputCls} value={reference}
            onChange={(e) => setReference(e.target.value)} placeholder="PG-2026-00001" />
        </div>
        <div>
          <FieldLabel htmlFor="tr-phone">Phone number on the application</FieldLabel>
          <PhoneInput id="tr-phone" fieldProps={FIELDS.trackApplication.phone} value={phone}
            onChange={setPhone} placeholder="770 000 000" />
        </div>
        <PrimaryButton type="submit" disabled={track.isPending}>
          {track.isPending ? "Checking..." : "Track my application"}
        </PrimaryButton>
      </form>
      {searched && !app ? (
        <p role="alert" className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          No application matches that reference and phone number together.
          Check both and try again.
        </p>
      ) : null}
      {app ? (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold text-[var(--text)]">{app.service_name}</p>
              <p className="text-sm text-[var(--dim)]">
                {app.institution}, submitted {fmtDate(app.created_at)}
              </p>
            </div>
            <Chip tone="gold">{applicationStatusPlain(app.status).short}</Chip>
          </div>
          <p className="mt-2 text-sm text-[var(--dim)]">
            Status: {app.status}. {applicationStatusPlain(app.status).meaning}
          </p>
          <p className="mt-2 text-sm text-[var(--dim)]">
            {app.released
              ? "PortaGov has released this application to the institution."
              : "This application is still with PortaGov for review. The institution receives it only when PortaGov releases it."}
          </p>
          <div className="mt-4">
            <LinkedNumbers
              tracking={app.reference}
              billing={app.billing_number}
              transaction={trackPayment?.transaction_ref}
              amountPaid={app.amount_paid}
              payerPhone={trackPayment?.payer_phone}
            />
          </div>
          <div className="mt-4">
            <StatusTimeline status={app.status} />
          </div>
          {app.status_note ? (
            <p className="mt-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
              <strong>Latest note:</strong> {app.status_note}
            </p>
          ) : null}
          <div className="mt-4">
            <PrimaryButton onClick={() => nav(`#/application/${app.id}`)}>
              Open the full application
            </PrimaryButton>
            <p className="mt-2 text-sm text-[var(--dim)]">
              You are signed in, so the full application opens straight away:
              documents, payments, messages, and appointments.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- institution portal ---------- */

const INSTITUTION_STATUSES = [
  "Received by institution",
  "In review at institution",
  "Appointment set",
  "Ready for collection",
  "Completed",
  "More information needed",
] as const;

function InstitutionRow({ app }: { app: ApplicationT }) {
  const queryClient = useQueryClient();
  const flag = useFlags();
  const siblings = useQuery({
    queryKey: ["institution-apps"],
    queryFn: () => api.listInstitutionApplications({ limit: 100 }),
  });
  const duplicate = flag("duplicate_warning")
    ? (siblings.data?.applications ?? []).find(
        (a: ApplicationT) =>
          a.id !== app.id &&
          a.profile_id === app.profile_id &&
          a.service_id === app.service_id &&
          a.status !== "Completed",
      )
    : undefined;
  const [status, setStatus] = useState<string>(
    INSTITUTION_STATUSES.includes(app.status as (typeof INSTITUTION_STATUSES)[number])
      ? app.status
      : "Received by institution",
  );
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: async () =>
      await api.updateApplicationStatus({
        id: app.id,
        status: status as (typeof INSTITUTION_STATUSES)[number],
        statusNote: note,
        officerName:
          typeof window !== "undefined"
            ? storage.get("portagov-officer") ?? ""
            : "",
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["institution-apps"] });
      void queryClient.invalidateQueries({ queryKey: ["all-apps"] });
    },
  });
  const details = parseDetails(app.details);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display font-bold text-[var(--text)]">
            {app.service_name}, {app.applicant_name}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {app.institution}, reference {app.reference}, submitted{" "}
            {fmtDate(app.created_at)}, {app.channel}
            {app.channel === "Diaspora" && app.diaspora_country
              ? ` from ${app.diaspora_country}`
              : ""}
          </p>
        </div>
        <Chip tone="gold">{applicationStatusPlain(app.status).short}</Chip>
      </div>
      {details.length > 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">
          {details.map((d) => `${d.label}: ${d.value}`).join(". ")}
        </p>
      ) : null}
      {app.notes ? (
        <p className="mt-1 text-sm text-[var(--dim)]">Citizen's note: {app.notes}</p>
      ) : null}
      {duplicate ? (
        <p className="mt-2 rounded-lg p-2.5 text-sm font-bold text-white" style={{ backgroundColor: "#b3261e" }} role="alert">
          Duplicate warning: this same citizen already has {duplicate.reference}{" "}
          open for this same service ({duplicate.status}). Check it before
          starting work, so the citizen is never charged or processed twice.
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
        <div>
          <FieldLabel htmlFor={`inst-status-${app.id}`}>Set status</FieldLabel>
          <select id={`inst-status-${app.id}`} {...FIELDS.updateApplicationStatus.status} className={inputCls} value={status}
            onChange={(e) => setStatus(e.target.value)}>
            {INSTITUTION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor={`inst-note-${app.id}`}>Note to the citizen</FieldLabel>
          <input id={`inst-note-${app.id}`} {...FIELDS.updateApplicationStatus.statusNote} className={inputCls} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: come with your old passport on Tuesday" />
        </div>
        <PrimaryButton onClick={() => update.mutate()} disabled={update.isPending}>
          {update.isPending ? "Saving..." : saved ? "Saved" : "Update citizen"}
        </PrimaryButton>
      </div>
      <div className="mt-2">
        <LiberianReplyChips onPick={setNote} />
      </div>
      <InstitutionRowExtras app={app} />
    </div>
  );
}

function InstitutionPage() {
  const [ministry, setMinistry] = useState("All institutions");
  const [search, setSearch] = useState("");
  const apps = useQuery({
    queryKey: ["institution-apps"],
    queryFn: () => api.listInstitutionApplications({ limit: 100 }),
  });
  const all = apps.data?.applications ?? [];
  const filtered = all.filter(
    (a: ApplicationT) =>
      (ministry === "All institutions" || a.institution === ministry) &&
      (search.trim() === "" ||
        a.reference.toLowerCase().includes(search.trim().toLowerCase()) ||
        a.applicant_name.toLowerCase().includes(search.trim().toLowerCase())),
  );
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#92580a" }}>
        Institution portal
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--text)]">
        Institution desk
      </h1>
      <p className="mt-2 max-w-3xl text-[var(--dim)]">
        This is where ministries and agencies receive and process applications.
        You only see applications PortaGov has released to you. Anything still
        under PortaGov review is held on the platform side and does not appear
        here, by design: PortaGov is the intermediary, and release is its
        decision.
      </p>
      <details className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Embassy space: diaspora applications and embassy updates
        </summary>
        <div className="border-t border-[var(--border)] p-4">
          <EmbassyDesk />
        </div>
      </details>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="inst-filter">Institution</FieldLabel>
          <select id="inst-filter" className={inputCls} value={ministry}
            onChange={(e) => setMinistry(e.target.value)}>
            <option>All institutions</option>
            {MINISTRIES.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="inst-search">Search by reference or name</FieldLabel>
          <input id="inst-search" className={inputCls} value={search}
            onChange={(e) => setSearch(e.target.value)} placeholder="PG-2026-00001" />
        </div>
      </div>
      {ministry !== "All institutions" ? (
        <div className="mt-5 space-y-5">
          <OfficerWorkList institution={ministry} />
          <InstitutionDailySummary institution={ministry} />
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        {apps.isPending ? (
          <p className="text-[var(--dim)]">Loading released applications...</p>
        ) : filtered.length > 0 ? (
          filtered.map((a: ApplicationT) => <InstitutionRow key={a.id} app={a} />)
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg font-bold text-[var(--text)]">
              Nothing released to show
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
              When PortaGov releases an application to an institution, it
              appears here at once. Applications still under PortaGov review
              stay on the platform side.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- platform portal (PortaGov council / super-admin) ---------- */

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PlatformRow({ app }: { app: ApplicationT }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["all-apps"] });
    void queryClient.invalidateQueries({ queryKey: ["institution-apps"] });
    void queryClient.invalidateQueries({ queryKey: ["report"] });
  };
  const release = useMutation({
    mutationFn: async () => await api.releaseApplication({ id: app.id, statusNote: note }),
    onSuccess: invalidate,
  });
  const recall = useMutation({
    mutationFn: async () => await api.recallApplication({ id: app.id, statusNote: note }),
    onSuccess: invalidate,
  });
  const askInfo = useMutation({
    mutationFn: async () =>
      await api.updateApplicationStatus({
        id: app.id,
        status: "More information needed",
        statusNote: note || "PortaGov needs more information before this can be released.",
      }),
    onSuccess: invalidate,
  });
  const busy = release.isPending || recall.isPending || askInfo.isPending;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display font-bold text-[var(--text)]">
            {app.service_name}, {app.applicant_name}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {app.institution}, reference {app.reference}, submitted{" "}
            {fmtDate(app.created_at)}, {app.channel}
          </p>
        </div>
        <div className="flex gap-2">
          <Chip tone={app.released ? "gold" : "plain"}>
            {app.released ? "Released to institution" : "Held by PortaGov"}
          </Chip>
          {!app.released ? (
            <Chip>
              {(() => {
                const hrs = Math.max(
                  0,
                  Math.round((Date.now() - new Date(app.created_at).getTime()) / 3600000),
                );
                return hrs >= 48
                  ? `Waiting ${hrs} hours, escalated to a senior officer`
                  : hrs >= 1
                    ? `Waiting ${hrs} hour${hrs === 1 ? "" : "s"} for release`
                    : "Just arrived, waiting for release";
              })()}
            </Chip>
          ) : null}
          <Chip>{applicationStatusPlain(app.status).short}</Chip>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <FieldLabel htmlFor={`plat-note-${app.id}`}>Note (goes to the citizen)</FieldLabel>
          <input id={`plat-note-${app.id}`} {...FIELDS.releaseApplication.statusNote} className={inputCls} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note recorded with this decision" />
        </div>
        <div className="flex flex-wrap gap-2">
          {!app.released ? (
            <>
              <PrimaryButton onClick={() => release.mutate()} disabled={busy}>
                Release to institution
              </PrimaryButton>
              <GhostButton onClick={() => askInfo.mutate()} disabled={busy}>
                Ask citizen for more information
              </GhostButton>
            </>
          ) : (
            <GhostButton onClick={() => recall.mutate()} disabled={busy}>
              Recall to PortaGov
            </GhostButton>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformPage() {
  const queryClient = useQueryClient();
  const mode = useQuery({
    queryKey: ["release-mode"],
    queryFn: () => api.getReleaseMode({}),
  });
  const report = useQuery({
    queryKey: ["report"],
    queryFn: () => api.getReport({}),
  });
  const apps = useQuery({
    queryKey: ["all-apps"],
    queryFn: () => api.listAllApplications({ limit: 100 }),
  });
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const setMode = useMutation({
    mutationFn: async (m: "automatic" | "manual") =>
      await api.setReleaseMode({ mode: m }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["release-mode"] }),
  });
  const [copied, setCopied] = useState(false);

  const all = apps.data?.applications ?? [];
  const held = all.filter((a: ApplicationT) => !a.released);
  const released = all.filter((a: ApplicationT) => a.released);
  const isAuto = mode.data?.mode === "automatic";

  const summaryText = report.data
    ? [
        "PortaGov government report",
        `Applications: ${report.data.total_applications}`,
        `Citizen profiles: ${report.data.total_profiles}`,
        `Payments recorded: ${report.data.total_payments}`,
        `Appointments booked: ${report.data.total_appointments}`,
        `Held by PortaGov: ${held.length}`,
        `Released to institutions: ${released.length}`,
        "By institution: " +
          report.data.by_institution.map((r) => `${r.label} ${r.count}`).join("; "),
        "By status: " +
          report.data.by_status.map((r) => `${r.label} ${r.count}`).join("; "),
      ].join("\n")
    : "";

  return (
    <div>
      <section
        className="relative overflow-hidden text-white"
        style={{ backgroundColor: "#0a2a5e" }}
      >
        <video
          aria-hidden
          className="hero-bg-video absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_LOGO_POSTER}
        >
          <source src={HERO_LOGO_VIDEO} type="video/mp4" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(5, 22, 48, 0.6)" }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-10">
          <p
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: "#d9a821" }}
          >
            Platform portal, PortaGov council
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">
            Platform console
          </h1>
          <p className="mt-2 max-w-3xl leading-relaxed text-white/85">
            PortaGov is the intermediary between citizens and institutions. Every
            application lands here first. This console decides release, watches
            every institution, and prepares the reports that go to government.
          </p>
        </div>
        <div
          style={{ backgroundColor: "#d9a821" }}
          className="relative h-1.5"
        />
      </section>
      <div className="mx-auto max-w-5xl px-4 py-8">
      <div>
        <DailySummaryPanel />
      </div>

      <div className="mt-6 rounded-xl p-6 text-white" style={{ backgroundColor: "#0a2a5e" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-bold">Release mode</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/85">
              {isAuto
                ? "Automatic release is ON. Every new application is sent straight to its institution the moment a citizen submits it."
                : "Automatic release is OFF (manual). PortaGov holds every application and a person here must approve and release each one before the institution can see it."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAuto}
            aria-label="Automatic release"
            disabled={setMode.isPending || mode.isPending}
            onClick={() => setMode.mutate(isAuto ? "manual" : "automatic")}
            className="flex items-center gap-3 rounded-full border border-white/40 px-4 py-2"
          >
            <span
              className="relative inline-block h-7 w-12 rounded-full"
              style={{ backgroundColor: isAuto ? "#d9a821" : "rgba(255,255,255,0.3)" }}
            >
              <span
                className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all"
                style={{ left: isAuto ? 22 : 2 }}
              />
            </span>
            <span className="font-bold">{isAuto ? "Automatic" : "Manual"}</span>
          </button>
        </div>
        <p className="mt-3 text-sm text-white/70">
          The switch is the global rule. Below it, every single application
          also carries its own release control, so the council can release or
          recall one application whatever the global rule says.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Applications", report.data?.total_applications ?? 0],
          ["Held by PortaGov", held.length],
          ["Released", released.length],
          ["Citizen profiles", report.data?.total_profiles ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p className="font-display text-3xl font-extrabold text-[var(--text)]">{value}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--dim)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SectionTitle sub="Applications waiting on PortaGov. Release each one to its institution, or ask the citizen for more information first.">
          Review queue: held by PortaGov ({held.length})
        </SectionTitle>
        <div className="space-y-3">
          {apps.isPending ? (
            <p className="text-[var(--dim)]">Loading the queue...</p>
          ) : held.length > 0 ? (
            held.map((a: ApplicationT) => <PlatformRow key={a.id} app={a} />)
          ) : (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              Nothing is being held right now.
              {isAuto
                ? " Automatic release is on, so new applications pass straight through."
                : " New manual submissions will wait here for approval."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle sub="Every application on the platform, with its own release control. Recalling one removes it from the institution's desk until it is released again.">
          All applications ({all.length})
        </SectionTitle>
        <div className="space-y-3">
          {all.length > 0 ? (
            all.map((a: ApplicationT) => <PlatformRow key={a.id} app={a} />)
          ) : (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              No applications yet. They appear here the moment a citizen submits.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Government report</h2>
          {report.data ? (
            <div className="mt-3 space-y-4 text-sm">
              <div>
                <p className="font-bold text-[var(--text)]">By institution</p>
                {report.data.by_institution.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[var(--dim)]">
                    {report.data.by_institution.map((r) => (
                      <li key={r.label} className="flex justify-between gap-4">
                        <span>{r.label}</span>
                        <strong className="text-[var(--text)]">{r.count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--dim)]">No data yet.</p>
                )}
              </div>
              <div>
                <p className="font-bold text-[var(--text)]">By status</p>
                <ul className="mt-1 space-y-1 text-[var(--dim)]">
                  {report.data.by_status.map((r) => (
                    <li key={r.label} className="flex justify-between gap-4">
                      <span>{r.label}</span>
                      <strong className="text-[var(--text)]">{r.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-bold text-[var(--text)]">By channel</p>
                <ul className="mt-1 space-y-1 text-[var(--dim)]">
                  {report.data.by_channel.map((r) => (
                    <li key={r.label} className="flex justify-between gap-4">
                      <span>{r.label}</span>
                      <strong className="text-[var(--text)]">{r.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--dim)]">Loading report...</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton
              onClick={() =>
                downloadCsv("portagov-applications.csv", [
                  ["Reference", "Applicant", "Service", "Institution", "Status", "Released", "Channel", "Submitted"],
                  ...all.map((a: ApplicationT) => [
                    a.reference,
                    a.applicant_name,
                    a.service_name,
                    a.institution,
                    a.status,
                    a.released ? "Yes" : "No, held by PortaGov",
                    a.channel,
                    a.created_at,
                  ]),
                ])
              }
            >
              Download applications CSV
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                void navigator.clipboard
                  .writeText(summaryText)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? "Summary copied" : "Copy report summary for government"}
            </GhostButton>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Payments across the platform
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {report.data?.total_payments ?? 0} payments recorded,{" "}
            {report.data?.total_appointments ?? 0} appointments booked.
          </p>
          <div className="mt-3 space-y-2">
            {(payments.data?.payments ?? []).slice(0, 8).map((p: PaymentT) => (
              <p key={p.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
                <strong>{p.method}</strong>, {p.application_ref}, ref{" "}
                {p.transaction_ref}, {p.status}, {fmtDate(p.created_at)}.
              </p>
            ))}
            {(payments.data?.payments ?? []).length === 0 ? (
              <p className="text-sm text-[var(--dim)]">No payments recorded yet.</p>
            ) : null}
          </div>
          <div className="mt-4">
            <GhostButton
              onClick={() =>
                downloadCsv("portagov-payments.csv", [
                  ["Application", "Method", "Payer phone", "Transaction reference", "Status", "Recorded"],
                  ...(payments.data?.payments ?? []).map((p: PaymentT) => [
                    p.application_ref,
                    p.method,
                    p.payer_phone,
                    p.transaction_ref,
                    p.status,
                    p.created_at,
                  ]),
                ])
              }
            >
              Download payments CSV
            </GhostButton>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <PlatformExtras />
        <ChatInbox />
      </div>

      <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Staff, help desk, shifts, and the knowledge base
        </summary>
        <div className="space-y-5 border-t border-[var(--border)] p-4">
          <StaffPortalManager />
              <StaffCatalogueSearch />
          <HelpDeskPanel />
          <ShiftBoard />
          <KnowledgeBasePanel addedBy="Platform console" />
          <QualityPanel reviewer="Platform console" />
        </div>
      </details>

      <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Money safety, health, and the audit trail
        </summary>
        <div className="space-y-5 border-t border-[var(--border)] p-4">
          <PlatformHealth />
          <FraudPanel />
          <ReconciliationPanel />
          <AuditPanel />
        </div>
      </details>

      <div className="mt-6">
        <FeatureTogglesPanel />
      </div>

      <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Institutions joining, and reports for government
        </summary>
        <div className="space-y-5 border-t border-[var(--border)] p-4">
          <OnboardingApprovals />
          <InstitutionPipelinePanel />
          <GovReportsPanel />
          <MoneyPanel />
          <SlowestAlertsPanel />
          <ComplaintsLearningPanel canAdd />
        </div>
      </details>
      </div>
    </div>
  );
}

/* ---------- access page ---------- */

function AccessPage({ profile }: { profile: ProfileT | null }) {
  const cards = [
    {
      t: "Document wallet",
      d: "Your documents are collected once, saved to your profile, and reused by every institution. No carrying the same papers from office to office, and no re-uploading for every application.",
      link: "#/wallet",
      cta: "Open my wallet",
    },
    {
      t: "Mobile money",
      d: "Pay with MTN MoMo or Orange Money from your phone, then record the transaction reference on your application so the payment is matched to you. PortaGov never invents a fee: the amount is the institution's own fee for that service.",
      link: "#/payments",
      cta: "See my payments",
    },
    {
      t: "Agent assisted applications",
      d: "Not confident online, or no smartphone of your own? A PortaGov agent at a service centre or in your community can sit with you and apply in your name. Choose Agent assisted when you start the service and add the agent's name.",
      link: "#/",
      cta: "Browse services",
    },
    {
      t: "Diaspora applications",
      d: "Living abroad does not cut you off from home. Liberians in any country in the world apply for passports, certificates, and family services from wherever they live, with their own country, timezone, and embassy choices. Choose Diaspora when you start the service and pick your country.",
      link: "#/",
      cta: "Browse services",
    },
    {
      t: "Basic phones and low bandwidth",
      d: "PortaGov pages are light and work on slow connections. Tracking is private: sign in as a member, then use your reference number and phone number to follow your own application, on a smartphone, a basic phone browser, or at a service centre.",
      link: "#/track",
      cta: "Track an application",
    },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Five ways PortaGov reaches everyone
      </h1>
      <p className="mt-2 text-[var(--dim)]">
        PortaGov was designed for the whole country and for Liberians in
        every country abroad, not only for people with
        new phones and fast internet in Monrovia.
      </p>
      <div className="mt-6 space-y-4">
        {cards.map((c) => (
          <div key={c.t} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">{c.t}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">{c.d}</p>
            <div className="mt-3">
              <GhostButton onClick={() => nav(c.link)}>{c.cta}</GhostButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-8">
        <UssdPanel profile={profile} />
        <HelperNearMe />
        <NeighbourMode />
        <AgentsDirectory />
        <p className="text-sm text-[var(--dim)]">
          Looking for a place instead?{" "}
          <a href="#/near" className="font-semibold underline">Near me</a>{" "}
          finds your closest County Service Centre, embassy, or payment
          point, with directions and hours.
        </p>
      </div>
    </div>
  );
}

/* ---------- how it works page ---------- */

function HowPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">How PortaGov works</h1>
      <div className="mt-6 space-y-6">
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">For citizens</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed text-[var(--dim)]">
            <li>
              <strong className="text-[var(--text)]">Create your account once.</strong>{" "}
              New here? Your first sign-in collects your full name, date and
              place of birth, address, county, phone, and emergency contact, and
              saves them to your profile. A national ID is optional, never a
              blocker. Not new here? Sign in with your phone and your saved
              profile loads, ready to reuse and ready to edit.
            </li>
            <li>
              <strong className="text-[var(--text)]">Fill your document wallet once.</strong>{" "}
              Birth certificate, ID, passport photograph, and other documents,
              stored at full quality and reused by every institution.
            </li>
            <li>
              <strong className="text-[var(--text)]">Apply from home.</strong>{" "}
              Pick a ministry, pick its service, confirm your details, attach
              documents from your wallet, and submit. You get a reference
              number at once.
            </li>
            <li>
              <strong className="text-[var(--text)]">PortaGov reviews first.</strong>{" "}
              Your application stays with PortaGov until it is released to the
              institution, at once when automatic release is on, or after a
              person approves it in manual mode.
            </li>
            <li>
              <strong className="text-[var(--text)]">The institution confirms and processes.</strong>{" "}
              You follow every step on your application page or by reference
              number.
            </li>
            <li>
              <strong className="text-[var(--text)]">Travel once, with a purpose.</strong>{" "}
              Biometrics at a booked time, or collection when your document is
              ready. No speculative trips, no queueing to apply.
            </li>
          </ol>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">The three portals</h2>
          <p className="mt-2 leading-relaxed text-[var(--dim)]">
            PortaGov runs as three connected portals. The{" "}
            <strong className="text-[var(--text)]">citizen portal</strong> is
            where citizens apply and track. The{" "}
            <strong className="text-[var(--text)]">institution portal</strong>{" "}
            is where ministries and agencies receive released applications and
            process them. The{" "}
            <strong className="text-[var(--text)]">platform portal</strong> is
            the PortaGov council side: release decisions, oversight of every
            institution, and reports to government. All three read and write
            the same live records, so a change in one is visible in the others
            at once.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">How the platform is built</h2>
          <p className="mt-2 leading-relaxed text-[var(--dim)]">
            Behind the portals, PortaGov is built the way a national service
            platform should be: one identity for each citizen, a government
            service bus carrying applications between institutions, a central
            API gateway, token based sign-in, and policy based access control
            so each institution sees only its own released work. Security is
            built into every layer, and the database is designed to migrate
            cleanly as the platform grows.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">Government partnership</h2>
          <p className="mt-2 leading-relaxed text-[var(--dim)]">
            PortaGov is built to partner with the Government of Liberia. The
            government owns the services and the decisions; PortaGov is the
            intermediary that carries citizens to them, and the platform
            console sends reports to government on volumes, institutions, and
            payments.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ---------- app root ---------- */

function routeToHash(route: Route): string {
  switch (route.name) {
    case "ministry":
      return `#/ministry/${route.id}`;
    case "service":
      return `#/service/${route.id}`;
    case "apply":
      return `#/apply/${route.serviceId}`;
    case "application":
      return `#/application/${route.id}`;
    case "portal":
      return `#/institution/${route.id}`;
    case "shared":
      return `#/shared/${route.token}`;
    default:
      return `#/${route.name === "home" ? "" : route.name}`;
  }
}

export function App() {
  const route = useRoute();
  const qc = useQueryClient();

  /* Action handlers refresh the app's data views through the query
     client, the way ctx.invalidateQueries() did on the server. */
  useEffect(() => {
    bindQueryClient(qc);
  }, [qc]);

  /* Land at the top of every new page. The reset in nav() runs before
     React swaps the page, so repeat it once the new page has rendered
     and again a moment later, in case the shell restores the old scroll
     position after the swap. */
  useEffect(() => {
    scrollToTop();
    const raf = requestAnimationFrame(() => scrollToTop());
    const timer = setTimeout(scrollToTop, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [route]);

  /* Every internal anchor in the app routes through nav(), not just the
     ones with onClick handlers. In the phone shell an anchor's default
     hash jump can be swallowed, which left links looking dead; routing
     the click through app state makes every link work the same way. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href^="#/"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      nav(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [afterSignIn, setAfterSignIn] = useState("#/account");
  /* Alert shown on screen after a sign-in, for example when the sign-in
     came from a new device. It stays until the person closes it, so it
     is never lost by moving to the next page. */
  const [securityAlert, setSecurityAlert] = useState("");

  useEffect(() => {
    const phone = storage.get("portagov-phone");
    if (!phone) {
      setAuthReady(true);
      return;
    }
    let live = true;
    /* A saved session is only restored when it is still valid on this
       device. After sign out everywhere, this device must sign in
       again like every other device. */
    api
      .checkCitizenSession({ phone, deviceId: deviceInfo().deviceId })
      .then((r) => {
        if (!live) return;
        if (r.valid && r.profile) setProfile(r.profile);
        else storage.remove("portagov-phone");
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setAuthReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const onSignedIn = (p: ProfileT, alert?: string) => {
    setProfile(p);
    storage.set("portagov-phone", p.phone);
    if (alert) setSecurityAlert(alert);
  };
  const onProfileChange = (p: ProfileT) => {
    setProfile(p);
    storage.set("portagov-phone", p.phone);
  };
  const signOut = () => {
    setProfile(null);
    setSecurityAlert("");
    storage.remove("portagov-phone");
    nav("#/");
  };
  /* Sign out everywhere, in one tap: the account record marks every
     device signed out, then this device signs out too. Today the data
     lives on this device only, so this signs out this device and the
     sessions recorded here; on the shared backend the same record
     signs out every device at once. */
  const signOutEverywhere = async () => {
    if (profile) {
      try {
        await api.signOutAll({ profileId: profile.id });
      } catch {
        /* The local sign-out below still runs. */
      }
    }
    signOut();
  };

  const goApply = (service: Service) => {
    if (profile) {
      nav(`#/apply/${service.id}`);
    } else {
      setAfterSignIn(`#/apply/${service.id}`);
      nav("#/signin");
    }
  };

  const portal: "citizen" | "institution" | "platform" =
    route.name === "institution" || route.name === "portal"
      ? "institution"
      : route.name === "reports"
        ? "platform"
        : "citizen";

  const flag = useFlags();
  const [prefs, setPrefs] = useState(() => {
    /* One colour mode only: light or dark. A saved choice wins; the first
       visit follows the device setting once, then the toggle button is
       the only control. Older saves of "auto" resolve to the device
       setting a single time and are then stored as light or dark. */
    let systemDark = false;
    try {
      systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      systemDark = false;
    }
    try {
      const savedTheme = storage.get("portagov-theme-mode");
      return {
        large: storage.get("portagov-large-text") === "1",
        hc: storage.get("portagov-high-contrast") === "1",
        theme: (savedTheme === "dark" || (savedTheme !== "light" && systemDark)
          ? "dark"
          : "light") as "light" | "dark",
        low: storage.get("portagov-low-data") === "1",
      };
    } catch {
      return {
        large: false,
        hc: false,
        theme: (systemDark ? "dark" : "light") as "light" | "dark",
        low: false,
      };
    }
  });
  const [accessOpen, setAccessOpen] = useState(false);
  const accessRef = useRef<HTMLDivElement | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  /* Close the profile avatar menu when the person taps or clicks
     anywhere outside it, or presses Escape, the same way the
     Accessibility dropdown closes. */
  useEffect(() => {
    if (!avatarOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAvatarOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [avatarOpen]);
  /* Close the Accessibility dropdown when the person taps or clicks
     anywhere outside it, or presses Escape, so it never stays open
     after they have moved on. */
  useEffect(() => {
    if (!accessOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (accessRef.current && !accessRef.current.contains(e.target as Node)) setAccessOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccessOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accessOpen]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.large = prefs.large ? "true" : "false";
    root.dataset.hc = prefs.hc ? "true" : "false";
    root.dataset.theme = prefs.theme;
    try {
      storage.set("portagov-large-text", prefs.large ? "1" : "0");
      storage.set("portagov-high-contrast", prefs.hc ? "1" : "0");
      storage.set("portagov-theme-mode", prefs.theme);
      storage.set("portagov-low-data", prefs.low ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [prefs]);

  const needsAuth = PROTECTED.has(route.name);
  const showSignInGate = needsAuth && authReady && !profile;

  let body: ReactNode;
  if (!authReady && needsAuth) {
    body = (
      <p className="mx-auto max-w-4xl px-4 py-16 text-center text-[var(--dim)]">
        Loading your PortaGov account...
      </p>
    );
  } else if (showSignInGate) {
    body = (
      <SignInPage
        after={routeToHash(route)}
        onSignedIn={onSignedIn}
      />
    );
  } else {
    switch (route.name) {
      case "home":
        body = <HomePage profile={profile} goApply={goApply} lowData={prefs.low} />;
        break;
      case "ministry":
        body = <MinistryPage id={route.id} />;
        break;
      case "service":
        body = <ServicePage id={route.id} profile={profile} goApply={goApply} />;
        break;
      case "signin":
        body = profile ? (
          <div className="mx-auto max-w-2xl px-4 py-10 text-center">
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">
              You are signed in as {profile.full_name}
            </h1>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <PrimaryButton onClick={() => nav("#/account")}>Go to my account</PrimaryButton>
            </div>
          </div>
        ) : (
          <SignInPage after={afterSignIn} onSignedIn={onSignedIn} />
        );
        break;
      case "account":
        body = profile ? (
          <AccountPage
            profile={profile}
            onProfileChange={onProfileChange}
            onSignOutEverywhere={() => void signOutEverywhere()}
          />
        ) : null;
        break;
      case "apply":
        body = profile ? (
          <ApplyPage serviceId={route.serviceId} profile={profile} />
        ) : null;
        break;
      case "applications":
        body = profile ? <ApplicationsPage profile={profile} /> : null;
        break;
      case "application":
        body = profile ? (
          <ApplicationDetailPage id={route.id} profile={profile} />
        ) : null;
        break;
      case "wallet":
        body = profile ? <WalletPage profile={profile} /> : null;
        break;
      case "appointments":
        body = profile ? <AppointmentsPage profile={profile} /> : null;
        break;
      case "payments":
        body = profile ? <PaymentsPage profile={profile} /> : null;
        break;
      case "family":
        body = profile ? <FamilyPage profile={profile} /> : null;
        break;
      case "track":
        body = <TrackPage profile={profile} />;
        break;
      case "institution":
        body = <InstitutionDirectoryPage />;
        break;
      case "portal":
        body = <InstitutionPortalPage ministryId={route.id} profile={profile} />;
        break;
      case "staff":
        body = <StaffPortalPage />;
        break;
      case "status":
        body = <StatusPage />;
        break;
      case "near":
        body = <NearMePage />;
        break;
      case "shared":
        body = <SharedPage token={route.token} />;
        break;
      case "onboarding":
        body = <OnboardingStudioPage />;
        break;
      case "reports":
        body = <PlatformPage />;
        break;
      case "access":
        body = <AccessPage profile={profile} />;
        break;
      case "how":
        body = <HowPage />;
        break;
      case "help":
        body = <HelpPage profile={profile} />;
        break;
      case "centre":
        body = <CentrePage />;
        break;
      case "business":
        body = profile ? (
          <BizPortalPage profile={profile} goApply={goApply} />
        ) : null;
        break;
      case "verify":
        body = <VerifyPage />;
        break;
      case "queues":
        body = <QueuesPage profile={profile} />;
        break;
      case "privacy":
        body = <PrivacyPage />;
        break;
      case "certificate":
        body = profile ? (
          <CertificatePage applicationId={route.id} />
        ) : null;
        break;
      case "embassies":
        body = <EmbassiesPage />;
        break;
      case "dashboard":
        body = <PublicDashboardPage />;
        break;
      case "training":
        body = <TrainingPage />;
        break;
      default:
        body = <HomePage profile={profile} goApply={goApply} lowData={prefs.low} />;
    }
  }

  const portalLink = (label: string, href: string, active: boolean) => (
    <a
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className="whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold"
      style={
        active
          ? { backgroundColor: "#0a2a5e", color: "#ffffff" }
          : { color: "var(--text)" }
      }
    >
      {label}
    </a>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20 md:pb-0">
      <SafeAreaTopScrim backgroundColor="var(--surface)" />
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] pt-safe">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <a
            href="#/"
            aria-label="PortaGov home"
            className="flex shrink-0 items-center gap-2.5"
          >
            <img src={logoBadge} alt="" className="h-10 w-10 shrink-0" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[22px] font-bold lowercase tracking-tight text-[var(--text)]">
                portagov
              </span>
              <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--warn)] sm:block">
                Citizens. Services. Connected.
              </span>
            </span>
          </a>
          {portal !== "citizen" ? (
            <div className="hidden items-center gap-1 md:flex">
              {portalLink("Citizen portal", "#/", false)}
              {portalLink("Institution portal", "#/institution", portal === "institution")}
              {portalLink("Platform portal", "#/reports", portal === "platform")}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={prefs.theme === "dark"}
              aria-label={
                prefs.theme === "dark"
                  ? "Dark mode is on. Switch to light mode"
                  : "Light mode is on. Switch to dark mode"
              }
              title={
                prefs.theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  theme: p.theme === "dark" ? "light" : "dark",
                }))
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{
                color: "var(--text)",
                borderColor: "var(--border)",
                backgroundColor: "var(--surface-alt)",
              }}
            >
              {prefs.theme === "dark" ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
            <div className="relative" ref={accessRef}>
              <button
                type="button"
                aria-expanded={accessOpen}
                aria-label="Accessibility options"
                onClick={() => setAccessOpen((o) => !o)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                style={{
                  color: "var(--text)",
                  borderColor: "var(--border)",
                  backgroundColor: accessOpen ? "var(--gold-soft)" : "var(--surface-alt)",
                }}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="5" r="2" />
                  <path d="M4 9h16" />
                  <path d="M12 9v5" />
                  <path d="m12 14-3 7" />
                  <path d="m12 14 3 7" />
                </svg>
              </button>
              {accessOpen ? (
                <div
                  role="group"
                  aria-label="Reading and display options"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border p-2 shadow-lg"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  {(
                    [
                      ["Large text", prefs.large, () => setPrefs((p) => ({ ...p, large: !p.large }))],
                      ["High contrast", prefs.hc, () => setPrefs((p) => ({ ...p, hc: !p.hc }))],
                      ["Low data", prefs.low, () => setPrefs((p) => ({ ...p, low: !p.low }))],
                    ] as const
                  ).map(([label, on, toggle]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={toggle}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
                      style={
                        on
                          ? { backgroundColor: "#0a2a5e", color: "#fff" }
                          : { color: "var(--text)" }
                      }
                    >
                      {label}
                      <span aria-hidden>{on ? "On" : "Off"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {profile ? (
              <div className="relative shrink-0" ref={avatarRef}>
                <button
                  type="button"
                  aria-expanded={avatarOpen}
                  aria-label={`Account menu for ${profile.full_name}`}
                  onClick={() => setAvatarOpen((o) => !o)}
                  className="flex items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: avatarOpen ? "#d9a821" : "var(--border)",
                    backgroundColor: "var(--surface-alt)",
                  }}
                >
                  <ProfileAvatar profile={profile} size={36} />
                </button>
                {avatarOpen ? (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border p-2 shadow-lg"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <p className="max-w-full truncate px-3 pb-1 pt-2 text-sm font-bold text-[var(--text)]">
                      {profile.full_name}
                    </p>
                    <a
                      href="#/account"
                      role="menuitem"
                      onClick={() => setAvatarOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text)]"
                    >
                      Account settings
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarOpen(false);
                        signOut();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--text)]"
                    >
                      Sign out
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAvatarOpen(false);
                        void signOutEverywhere();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--text)]"
                    >
                      Sign out everywhere
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <PrimaryButton onClick={() => nav("#/signin")}>Sign in</PrimaryButton>
            )}
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-2 md:flex-nowrap md:overflow-x-auto">
          {(
            [
              ["Home", "#/", route.name === "home"],
              ["How it works", "#/how", route.name === "how"],
              ["Ways to apply", "#/access", route.name === "access"],
              ["Track", "#/track", route.name === "track"],
              ["Embassies", "#/embassies", route.name === "embassies"],
              ...(profile
                ? ([
                    ["My applications", "#/applications", route.name === "applications" || route.name === "application"],
                    ["Wallet", "#/wallet", route.name === "wallet"],
                    ["Appointments", "#/appointments", route.name === "appointments"],
                    ["My account", "#/account", route.name === "account"],
                  ] as const)
                : []),
            ] as const
          ).map(([label, href, active]) => (
            <a
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold"
              style={
                active
                  ? { backgroundColor: "var(--gold-soft)", color: "var(--text)" }
                  : { color: "var(--dim)" }
              }
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {profile && securityAlert ? (
        <div className="mx-auto max-w-6xl px-4 pt-3" role="alert">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--gold-soft)] p-4">
            <p className="flex-1 text-sm font-semibold text-[var(--warn)]">
              {securityAlert}{" "}
              <a href="#/account" className="underline" onClick={() => setSecurityAlert("")}>
                Change your password in My account
              </a>
            </p>
            <button
              type="button"
              onClick={() => setSecurityAlert("")}
              aria-label="Close this warning"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm font-bold text-[var(--text)]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <main>
        {route.name !== "home" ? (
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-3">
            <BackArrow />
            <CloseX />
          </div>
        ) : null}
        {body}
      </main>

      {portal === "citizen" ? (
        <>
          {flag("liberian_english") ? <LiberianEnglishButton /> : null}
          {flag("assistant") ? <AssistantPanel profile={profile} route={route} /> : null}
        </>
      ) : null}

      <footer className="mt-10 pb-16 text-white md:pb-0" style={{ backgroundColor: "#071f45" }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <img src={logoMark} alt="PortaGov mark" className="h-14 w-14 rounded-full bg-white object-cover" />
            <p className="mt-3 font-display text-lg font-bold">portagov</p>
            <p className="text-sm text-white/75">Citizens. Services. Connected.</p>
          </div>
          {portal === "citizen" ? (
            <>
              <div className="text-sm leading-relaxed text-white/80">
                <p className="font-bold text-white">For citizens</p>
                <ul className="mt-1 space-y-1.5">
                  <li>
                    <a href="#/signin" className="underline">Sign in or create your account</a>
                  </li>
                  <li>
                    <a href="#/track" className="underline">Track an application</a>
                  </li>
                  <li>
                    <a href="#/access" className="underline">Ways to apply</a>
                  </li>
                  <li>
                    <a href="#/how" className="underline">How PortaGov works</a>
                  </li>
                  <li>
                    <a href="#/help" className="underline">Get help</a>
                  </li>
                  <li>
                    <a href="#/privacy" className="underline">Privacy in plain words</a>
                  </li>
                </ul>
              </div>
              <div className="text-sm leading-relaxed text-white/80">
                <p className="font-bold text-white">Liberian embassies</p>
                <p className="mt-1">
                  Living abroad?{" "}
                  <a href="#/embassies" className="underline">The embassy directory</a>{" "}
                  lists every Liberian embassy with its hours, contacts, and
                  what it can collect or deliver for you. You can also{" "}
                  <a href="#/access" className="underline">apply from abroad</a>{" "}
                  and choose embassy collection when you start a service.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm leading-relaxed text-white/80">
                <p className="font-bold text-white">The portals</p>
                <p className="mt-1">
                  <a href="#/" className="underline">Citizen portal</a>: apply and
                  track.
                  <br />
                  <a href="#/institution" className="underline">Institution portal</a>:
                  ministries and agencies receive released applications.
                  <br />
                  <a href="#/reports" className="underline">Platform portal</a>: the
                  PortaGov council, release decisions and government reports.
                </p>
              </div>
              <div className="text-sm leading-relaxed text-white/80">
                <p className="font-bold text-white">For officers and staff</p>
                <p className="mt-1">
                  <a href="#/staff" className="underline">Staff portal</a>,{" "}
                  <a href="#/queues" className="underline">County queues</a>,{" "}
                  <a href="#/dashboard" className="underline">Public dashboard</a>,{" "}
                  <a href="#/status" className="underline">System status</a>,{" "}
                  <a href="#/near" className="underline">Near me</a>,{" "}
                  <a href="#/business" className="underline">Business portal</a>,{" "}
                  <a href="#/onboarding" className="underline">Join as an institution</a>,{" "}
                  <a href="#/embassies" className="underline">Embassy directory</a>,{" "}
                  <a href="#/privacy" className="underline">Privacy in plain words</a>
                </p>
              </div>
            </>
          )}
          <div className="text-sm leading-relaxed text-white/80">
            <p className="font-bold text-white">Built by GIIN</p>
            <p className="mt-1">
              Global Impact Innovators Ltd
              <br />
              info@giin.co.rw, www.giin.co.rw
              <br />
              +250 798 655 345, Kigali, Rwanda
            </p>
          </div>
        </div>
        <div style={{ backgroundColor: "#d9a821" }} className="h-1.5" />
      </footer>

      <nav
        aria-label={portal === "citizen" ? "Citizen shortcuts" : "Portal switcher"}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {portal === "citizen" ? (
          <div className="grid grid-cols-4">
            {(
              [
                ["Home", "#/", route.name === "home"],
                ["Track", "#/track", route.name === "track"],
                ["Embassies", "#/embassies", route.name === "embassies"],
                profile
                  ? ["Account", "#/account", route.name === "account"]
                  : ["Sign in", "#/signin", route.name === "signin"],
              ] as readonly (readonly [string, string, boolean])[]
            ).map(([label, href, active]) => (
              <a
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="py-3 text-center text-sm font-bold"
                style={
                  active
                    ? { color: "var(--accent)", borderTop: "3px solid #d9a821" }
                    : { color: "var(--dim)", borderTop: "3px solid transparent" }
                }
              >
                {label}
              </a>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {(
              [
                ["Citizen", "#/", false],
                ["Institution", "#/institution", portal === "institution"],
                ["Platform", "#/reports", portal === "platform"],
              ] as const
            ).map(([label, href, active]) => (
              <a
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="py-3 text-center text-sm font-bold"
                style={
                  active
                    ? { color: "var(--accent)", borderTop: "3px solid #d9a821" }
                    : { color: "var(--dim)", borderTop: "3px solid transparent" }
                }
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}

/* ---------- messages feed (SMS, WhatsApp, direct institution messages) ---------- */

type MessageT = ApiResponse<typeof api, "listMessages">["messages"][number];

function MessagesFeed({
  profileId,
  applicationId,
}: {
  profileId: number;
  applicationId?: number;
}) {
  const msgs = useQuery({
    queryKey: ["messages", profileId],
    queryFn: () => api.listMessages({ profileId }),
  });
  const all = msgs.data?.messages ?? [];
  const list = applicationId
    ? all.filter((m: MessageT) => m.application_id === applicationId)
    : all;
  const seen = new Set<string>();
  const deduped = list.filter((m: MessageT) => {
    const key = `${m.kind}|${m.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (msgs.isPending) return <p className="text-sm text-[var(--dim)]">Loading updates...</p>;
  if (deduped.length === 0)
    return (
      <p className="text-sm text-[var(--dim)]">
        No phone updates yet. Every step of your application sends you an SMS
        and a WhatsApp message in simple English, and they are all kept here.
      </p>
    );
  return (
    <ul className="space-y-2">
      {deduped.slice(0, 20).map((m: MessageT) => (
        <li key={m.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
          <p className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
            <span>{m.kind}</span>
            <span>SMS and WhatsApp</span>
            <span>{fmtDateTime(m.created_at)}</span>
          </p>
          <p className="mt-1 text-[var(--text)]">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------- live timeline with dates ---------- */

function TimelineWithDates({
  applicationId,
  status,
}: {
  applicationId: number;
  status: string;
}) {
  const events = useQuery({
    queryKey: ["events", applicationId],
    queryFn: () => api.listStatusEvents({ applicationId }),
  });
  const evs = events.data?.events ?? [];
  const dateFor = (step: string) => {
    const match = [...evs].reverse().find((e) => e.status === step);
    return match ? fmtDateTime(match.created_at) : null;
  };
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  if (idx < 0) {
    return (
      <div>
        <StatusTimeline status={status} />
        {evs.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-[var(--dim)]">
            {evs.map((e) => (
              <li key={e.id}>
                <strong className="text-[var(--text)]">{e.status}</strong>,{" "}
                {fmtDateTime(e.created_at)}
                {e.note ? `. ${e.note}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <ol>
      {STATUS_STEPS.map((step, i) => {
        const d = dateFor(step);
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  i < idx
                    ? { backgroundColor: "#0a2a5e", color: "#fff" }
                    : i === idx
                      ? { backgroundColor: "#d9a821", color: "#0a2a5e" }
                      : {
                          backgroundColor: "var(--surface-alt)",
                          color: "var(--dim)",
                          border: "1px solid var(--border)",
                        }
                }
              >
                {i < idx ? "✓" : i + 1}
              </span>
              {i < STATUS_STEPS.length - 1 ? (
                <span className="w-px flex-1 bg-[var(--border)]" style={{ minHeight: 14 }} />
              ) : null}
            </div>
            <div className="pb-3">
              <p
                className={
                  i === idx
                    ? "text-sm font-bold text-[var(--text)]"
                    : "text-sm text-[var(--dim)]"
                }
              >
                {step}
                {i === idx ? " (now)" : ""}
              </p>
              {d ? <p className="text-xs text-[var(--dim)]">{d}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- full activity record for one application ---------- */

type ActivityEntryT = ApiResponse<
  typeof api,
  "listApplicationActivity"
>["entries"][number];

function ApplicationActivity({ app }: { app: ApplicationT }) {
  const activity = useQuery({
    queryKey: ["application-activity", app.id],
    queryFn: () => api.listApplicationActivity({ applicationId: app.id }),
  });
  const entries = activity.data?.entries ?? [];
  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Activity record for {app.reference}
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every touch on this application, in order, with who did it and when.
        Nothing here is guessed: each line comes from a real stored event.
      </p>
      {activity.isPending ? (
        <p className="mt-3 text-sm text-[var(--dim)]">Loading the record...</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No activity recorded yet for this application.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((e, i) => (
            <li key={`${e.created_at}-${i}`} className="flex gap-3">
              <span
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#0a2a5e" }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text)]">
                  {e.title}
                </p>
                <p className="text-xs text-[var(--dim)]">
                  {e.actor} {e.actor ? "· " : ""}
                  {fmtDateTime(e.created_at)}
                  {e.kind !== "Status" ? ` · ${e.kind}` : ""}
                </p>
                {e.detail ? (
                  <p className="mt-1 text-sm text-[var(--dim)]">{e.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------- application extras: billing, updates, certificate, complaints, rating ---------- */

function ApplicationExtras({
  app,
  profile,
}: {
  app: ApplicationT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const cert = useQuery({
    queryKey: ["certificate", app.id],
    queryFn: () => api.getCertificate({ applicationId: app.id }),
    enabled: app.status === "Completed",
  });
  const myComplaints = useQuery({
    queryKey: ["my-complaints", profile.id],
    queryFn: () => api.listMyComplaints({ profileId: profile.id }),
  });
  /* The latest confirmed payment for this application, so the
     transaction number in Your numbers below is the real one. */
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const latestPayment = (payments.data?.payments ?? [])
    .filter((pay: PaymentT) => pay.application_id === app.id && pay.status === "Confirmed")
    .sort((a: PaymentT, b: PaymentT) => b.created_at.localeCompare(a.created_at))[0];
  const [kind, setKind] = useState<"Complaint" | "Appeal">("Complaint");
  const [reason, setReason] = useState("");
  const [caseDone, setCaseDone] = useState(false);
  const [caseError, setCaseError] = useState("");
  const fileCase = useMutation({
    mutationFn: async () =>
      await api.submitComplaint({
        applicationId: app.id,
        profileId: profile.id,
        kind,
        reason,
      }),
    onSuccess: () => {
      setCaseDone(true);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["my-complaints"] });
    },
    onError: (e) =>
      setCaseError(e instanceof Error ? e.message : "Could not send. Try again."),
  });
  const [speed, setSpeed] = useState(5);
  const [clarity, setClarity] = useState(5);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);
  const [rateError, setRateError] = useState("");
  const rate = useMutation({
    mutationFn: async () =>
      await api.rateInstitution({
        applicationId: app.id,
        profileId: profile.id,
        speed,
        clarity,
        comment,
      }),
    onSuccess: () => setRated(true),
    onError: (e) =>
      setRateError(e instanceof Error ? e.message : "Rating could not be saved."),
  });
  const totalDue = app.service_fee + app.priority_fee + app.delivery_fee;
  const cases = (myComplaints.data?.complaints ?? []).filter(
    (c) => c.application_id === app.id,
  );

  return (
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Your numbers
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          These three numbers belong to this one application. Any one of them
          finds the other two.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <LinkedNumbersRow label="Tracking number" value={app.reference} />
          <LinkedNumbersRow label="Billing number" value={app.billing_number} />
          <LinkedNumbersRow
            label="Transaction number"
            value={latestPayment?.transaction_ref || "Not paid yet"}
            dimValue={!latestPayment}
          />
          {latestPayment ? (
            <LinkedNumbersRow label="Paid from" value={latestPayment.payer_phone} />
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--dim)]">Service fee</dt>
            <dd className="font-semibold text-[var(--text)]">${app.service_fee}</dd>
          </div>
          {app.priority_fee > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--dim)]">{app.priority} fee</dt>
              <dd className="font-semibold text-[var(--text)]">${app.priority_fee}</dd>
            </div>
          ) : null}
          {app.delivery_fee > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--dim)]">Embassy delivery fee</dt>
              <dd className="font-semibold text-[var(--text)]">${app.delivery_fee}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2">
            <dt className="font-bold text-[var(--text)]">Total to pay</dt>
            <dd className="font-bold text-[var(--text)]">${totalDue}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--dim)]">Amount paid so far</dt>
            <dd className="font-semibold text-[var(--text)]">${app.amount_paid}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--dim)]">Billing status</dt>
            <dd>
              <Chip tone={app.billing_status === "Paid" ? "gold" : "plain"}>
                {app.billing_status === "Paid"
                  ? "Billing number confirmed paid"
                  : "Not confirmed paid yet"}
              </Chip>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-[var(--dim)]">
          The rule is simple: PortaGov releases your application to{" "}
          {app.institution} only when the billing number above is confirmed
          paid
          {totalDue === 0
            ? ", and this service is free, so it counts as paid at once"
            : ""}
          . After release, {app.institution} messages you directly about the
          way forward and when to pick up your service. PortaGov still tracks
          the amount paid and this tracking number, and updates you at every
          step.
        </p>
        {app.collection_choice ? (
          <p className="mt-2 text-sm text-[var(--dim)]">
            <strong className="text-[var(--text)]">Collection choice:</strong>{" "}
            {app.collection_choice}
            {app.embassy ? `, ${app.embassy}` : ""}
          </p>
        ) : null}
        {cert.data?.certificate ? (
          <div className="mt-4 rounded-lg p-4 text-white" style={{ backgroundColor: "#0a2a5e" }}>
            <p className="font-display font-bold">Your digital certificate is ready</p>
            <p className="mt-1 text-sm text-white/85">
              Certificate number {cert.data.certificate.cert_number}. Anyone
              can check it is real with the QR code.
            </p>
            <div className="mt-3">
              <GoldButton onClick={() => nav(`#/certificate/${app.id}`)}>
                Open my certificate
              </GoldButton>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Updates from PortaGov and {app.institution}
          </h2>
          <div className="mt-3">
            <MessagesFeed profileId={profile.id} applicationId={app.id} />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Complaint or appeal
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Not happy, or you want a decision looked at again? Your complaint
            or appeal goes to PortaGov itself, not only to the institution.
            PortaGov reviews it and answers you here.
          </p>
          {cases.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {cases.map((c) => (
                <li key={c.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
                  <strong>{c.kind}</strong> on tracking number {c.application_ref}, filed {fmtDateTime(c.created_at)}. Status: {c.status}. {c.reason}
                  {c.reply ? (
                    <span className="block mt-1">
                      <strong>PortaGov replied:</strong> {c.reply}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {caseDone ? (
            <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
              Sent to PortaGov. Watch this page for the answer.
            </p>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                setCaseError("");
                if (reason.trim().length < 5) {
                  setCaseError("Tell us what happened, in a few words.");
                  return;
                }
                fileCase.mutate();
              }}
            >
              <div className="flex gap-2">
                {(["Complaint", "Appeal"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className="rounded-full px-4 py-2 text-sm font-bold"
                    style={
                      kind === k
                        ? { backgroundColor: "#0a2a5e", color: "#fff" }
                        : {
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                          }
                    }
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div>
                <FieldLabel htmlFor={`case-${app.id}`}>
                  {kind === "Appeal"
                    ? "Why should PortaGov look at this decision again?"
                    : "What is the problem?"}
                </FieldLabel>
                <textarea id={`case-${app.id}`} {...FIELDS.submitComplaint.reason} className={inputCls} rows={3} value={reason}
                  onChange={(e) => setReason(e.target.value)} />
              </div>
              {caseError ? (
                <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                  {caseError}
                </p>
              ) : null}
              <PrimaryButton type="submit" disabled={fileCase.isPending}>
                Send to PortaGov
              </PrimaryButton>
            </form>
          )}
        </div>

        {app.status === "Completed" ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              Rate {app.institution}
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Your rating builds the institution's trust score, which the
              platform watches to find slow ministries.
            </p>
            {rated ? (
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                Thank you. Your rating is saved.
              </p>
            ) : (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  rate.mutate();
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor={`rate-speed-${app.id}`}>Speed (1 to 5)</FieldLabel>
                    <input id={`rate-speed-${app.id}`} {...FIELDS.rateInstitution.speed} type="number"
                      className={inputCls} value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value) || 1)} />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`rate-clarity-${app.id}`}>Clarity (1 to 5)</FieldLabel>
                    <input id={`rate-clarity-${app.id}`} {...FIELDS.rateInstitution.clarity} type="number"
                      className={inputCls} value={clarity}
                      onChange={(e) => setClarity(Number(e.target.value) || 1)} />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor={`rate-comment-${app.id}`}>Comment, if you want</FieldLabel>
                  <input id={`rate-comment-${app.id}`} {...FIELDS.rateInstitution.comment} className={inputCls} value={comment}
                    onChange={(e) => setComment(e.target.value)} />
                </div>
                {rateError ? (
                  <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                    {rateError}
                  </p>
                ) : null}
                <PrimaryButton type="submit" disabled={rate.isPending}>
                  Save my rating
                </PrimaryButton>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- expiry reminders ---------- */

const RENEWAL_FOR_DOC: Record<string, string> = {
  Passport: "passport-renewal",
  "Driver licence": "driver-licence-renewal",
  "Business registration": "business-renewal",
  "National ID": "national-id-replacement",
};

function ExpiryReminders({ profile }: { profile: ProfileT }) {
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const [armed, setArmed] = useState<number | null>(null);
  const now = Date.now();
  const items = (docs.data?.documents ?? [])
    .filter((d: DocumentT) => d.expires_on)
    .map((d: DocumentT) => ({
      doc: d,
      days: Math.ceil(
        (new Date(`${d.expires_on}T00:00:00`).getTime() - now) / 86400000,
      ),
    }))
    .filter((x) => x.days <= 90)
    .sort((a, b) => a.days - b.days);
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl bg-[var(--gold-soft)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Expiry reminders
      </h2>
      <p className="mt-1 text-sm text-[var(--text)]">
        PortaGov reminds you 90, 30, and 7 days before a passport, licence, or
        certificate expires. Renewal takes two taps: tap Renew, then tap
        Confirm and apply.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map(({ doc, days }) => {
          const renewal = RENEWAL_FOR_DOC[doc.doc_type];
          const tier = days < 0 ? "Expired" : days <= 7 ? "7 day reminder" : days <= 30 ? "30 day reminder" : "90 day reminder";
          return (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] p-3">
              <p className="text-sm text-[var(--text)]">
                <strong>{doc.title}</strong> ({doc.doc_type}){" "}
                {days < 0
                  ? `expired on ${fmtDate(doc.expires_on)}, ${Math.abs(days)} days ago`
                  : days === 0
                    ? `expires today, ${fmtDate(doc.expires_on)}`
                    : `expires in ${days} days, on ${fmtDate(doc.expires_on)}`}
                . <Chip tone="gold">{tier}</Chip>
              </p>
              {renewal ? (
                armed === doc.id ? (
                  <PrimaryButton
                    onClick={() => nav(`#/apply/${renewal}`)}
                  >
                    Confirm and apply (tap 2)
                  </PrimaryButton>
                ) : (
                  <GhostButton onClick={() => setArmed(doc.id)}>
                    Renew (tap 1)
                  </GhostButton>
                )
              ) : (
                <GhostButton onClick={() => nav("#/wallet")}>
                  Update in my wallet
                </GhostButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- public service finder ---------- */

function FinderSection() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query
    ? SERVICES.filter((s) => {
        const m = ministryById(s.ministryId);
        return (
          s.name.toLowerCase().includes(query) ||
          s.blurb.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query)
        );
      })
    : [];
  return (
    <section className="mx-auto max-w-6xl px-4 pb-2">
      <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#d9a821" }}>
        <SectionTitle sub="No sign-in needed to look. Search any service and see the cost, the documents, the time it takes, and where you collect. Sign-in is only asked when you start.">
          Find a service
        </SectionTitle>
        <div>
          <FieldLabel htmlFor="finder-q">What service are you looking for?</FieldLabel>
          <input
            id="finder-q"
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try passport, police, birth, business, tax"
          />
        </div>
        {query ? (
          results.length > 0 ? (
            <div className="mt-4 space-y-3">
              {results.map((s) => {
                const d = serviceDetails(s.id);
                const m = ministryById(s.ministryId);
                return (
                  <a key={s.id} href={`#/service/${s.id}`} className="block rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-display font-bold text-[var(--text)]">{s.name}</p>
                      <Chip tone="gold">{d.feeUsd === 0 ? "Free" : `$${d.feeUsd}`}</Chip>
                    </div>
                    <p className="mt-1 text-sm text-[var(--dim)]">{m.name}</p>
                    <div className="mt-2 grid gap-1 text-sm text-[var(--dim)]">
                      <p><strong className="text-[var(--text)]">Documents:</strong> {s.requirements.join("; ")}</p>
                      <p><strong className="text-[var(--text)]">Time:</strong> {d.processingTime}</p>
                      <p><strong className="text-[var(--text)]">Collect at:</strong> {d.collectionPoint}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--dim)]">
              No service matches that word yet. Try passport, police, birth,
              business, tax, licence, or land.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}

/* ---------- fraud warning (shown on every payment surface) ---------- */

function FraudWarning({ billingNumber }: { billingNumber?: string }) {
  return (
    <div className="rounded-lg border-2 p-3 text-sm" style={{ borderColor: "#d9a821", backgroundColor: "var(--gold-soft)" }}>
      <strong className="text-[var(--text)]">Fraud warning:</strong>{" "}
      <span className="text-[var(--text)]">
        PortaGov will never ask you to pay money to a personal phone number,
        and no officer can ask for payment outside PortaGov. Only pay to your
        official billing number
        {billingNumber ? (
          <>
            : <strong>{billingNumber}</strong>
          </>
        ) : (
          " shown on your application"
        )}
        . If anybody asks you to pay another number, do not pay. Report it on
        the Help page.
      </span>
    </div>
  );
}

/* ---------- message thread inside an application (after release) ---------- */

function ThreadPanel({
  app,
  profile,
}: {
  app: ApplicationT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const msgs = useQuery({
    queryKey: ["messages", profile.id],
    queryFn: () => api.listMessages({ profileId: profile.id }),
  });
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const reply = useMutation({
    mutationFn: async () =>
      await api.replyToInstitution({
        applicationId: app.id,
        profileId: profile.id,
        body,
      }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Message could not be sent."),
  });
  const thread = (msgs.data?.messages ?? [])
    .filter(
      (m: MessageT) =>
        m.application_id === app.id &&
        (m.kind.startsWith("Direct from") || m.kind.startsWith("Citizen to")),
    )
    .reverse();
  if (!app.released) return null;
  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Talk with {app.institution}
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        After release, you and the institution talk here directly, under
        tracking number {app.reference}. The institution tells you the way
        forward and when to pick up your service. PortaGov can see the thread
        and keeps it safe.
      </p>
      <div className="mt-3 space-y-2">
        {thread.length > 0 ? (
          thread.map((m: MessageT) => (
            <div
              key={m.id}
              className={
                m.kind.startsWith("Citizen to")
                  ? "ml-8 rounded-lg p-3 text-sm text-white"
                  : "mr-8 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]"
              }
              style={
                m.kind.startsWith("Citizen to")
                  ? { backgroundColor: "#0a2a5e" }
                  : undefined
              }
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                {m.kind}, {fmtDateTime(m.created_at)}
              </p>
              <p className="mt-1">{m.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--dim)]">
            No messages yet. When {app.institution} writes to you, it shows
            here.
          </p>
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError("");
          if (body.trim().length < 1) {
            setError("Write your message first, then press Send.");
            return;
          }
          reply.mutate();
        }}
      >
        <input
          aria-label="Write to the institution"
          {...FIELDS.replyToInstitution.body}
          className={inputCls}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Write to ${app.institution}...`}
        />
        <PrimaryButton type="submit" disabled={reply.isPending}>
          Send
        </PrimaryButton>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- pickup code and proxy consent ---------- */

function PickupProxy({
  app,
  profile,
}: {
  app: ApplicationT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const [proxyName, setProxyName] = useState("");
  const [proxyId, setProxyId] = useState("");
  const [error, setError] = useState("");
  const [doneCode, setDoneCode] = useState("");
  const setProxy = useMutation({
    mutationFn: async () =>
      await api.setProxy({
        applicationId: app.id,
        profileId: profile.id,
        proxyName,
        proxyId,
      }),
    onSuccess: (r) => {
      setDoneCode(r.proxy_code);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not save. Try again."),
  });
  const showPickup = app.status === "Ready for collection" || app.status === "Completed";
  if (!showPickup && !app.released) return null;
  return (
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {showPickup ? (
        <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
          <h2 className="font-display text-lg font-bold">Ready to collect</h2>
          <p className="mt-1 text-sm text-white/85">
            Show this pickup code at collection for tracking number{" "}
            {app.reference}. You got the same code by SMS and WhatsApp.
          </p>
          <p className="mt-3 font-display text-4xl font-extrabold tracking-widest" style={{ color: "#d9a821" }}>
            {app.pickup_code || "Check your phone messages for the code"}
          </p>
          <p className="mt-2 text-sm text-white/85">
            Bring your ID. If someone else is collecting for you, they need
            their own ID and your proxy consent code below.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Pickup code</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            When {app.institution} says your service is ready, PortaGov sends
            you a pickup code by SMS and WhatsApp. You show the code at
            collection. It appears here too.
          </p>
        </div>
      )}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Let someone else collect for you
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Only with your consent. Name the person here: PortaGov records it,
          gives you a consent code, and that person must bring their own ID
          plus the code. Nobody else can collect for you.
        </p>
        {app.proxy_name ? (
          <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            <strong>Recorded proxy:</strong> {app.proxy_name}, ID {app.proxy_id}.
            Consent code: <strong>{app.proxy_code}</strong>. Give the code only
            to {app.proxy_name}.
          </p>
        ) : doneCode ? (
          <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            Consent recorded. Consent code: <strong>{doneCode}</strong>
          </p>
        ) : (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setError("");
              if (proxyName.trim().length < 2 || proxyId.trim().length < 3) {
                setError("Add the person's full name and their ID number.");
                return;
              }
              setProxy.mutate();
            }}
          >
            <div>
              <FieldLabel htmlFor={`proxy-name-${app.id}`}>Proxy's full name</FieldLabel>
              <input id={`proxy-name-${app.id}`} {...FIELDS.setProxy.proxyName} className={inputCls} value={proxyName}
                onChange={(e) => setProxyName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor={`proxy-id-${app.id}`}>Proxy's ID number (national ID, passport, or voter card)</FieldLabel>
              <input id={`proxy-id-${app.id}`} {...FIELDS.setProxy.proxyId} className={inputCls} value={proxyId}
                onChange={(e) => setProxyId(e.target.value)} />
            </div>
            {error ? (
              <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                {error}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={setProxy.isPending}>
              Record consent and get the code
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- certificate page ---------- */

function CertificatePage({ applicationId }: { applicationId: number }) {
  const cert = useQuery({
    queryKey: ["certificate", applicationId],
    queryFn: () => api.getCertificate({ applicationId }),
  });
  const [qr, setQr] = useState("");
  const c = cert.data?.certificate;
  useEffect(() => {
    if (!c) return;
    let live = true;
    QRCode.toDataURL(
      `PortaGov certificate ${c.cert_number}. Holder: ${c.holder_name}. Service: ${c.service_name}. Issued by ${c.institution} through PortaGov. Application ${c.reference}. Verify this number on the PortaGov Verify page.`,
      { width: 220, margin: 1 },
    )
      .then((url) => {
        if (live) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [c]);
  if (cert.isPending)
    return <p className="mx-auto max-w-3xl px-4 py-10 text-[var(--dim)]">Loading certificate...</p>;
  if (!c)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">No certificate yet</h1>
        <p className="mt-2 text-[var(--dim)]">
          A digital certificate is issued when the institution completes your
          application. <a href="#/applications" className="font-semibold underline">Back to my applications</a>
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border-4 bg-[var(--surface)] p-6" style={{ borderColor: "#0a2a5e" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <img src={logoMark} alt="PortaGov mark" className="h-20 w-20 rounded-full object-cover" />
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--dim)]">
              Digital certificate
            </p>
            <p className="font-display text-lg font-extrabold text-[var(--text)]">{c.cert_number}</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-[var(--dim)]">This certificate is given to</p>
          <p className="font-display text-3xl font-extrabold text-[var(--text)]">{c.holder_name}</p>
          <p className="mt-2 text-[var(--dim)]">
            for <strong className="text-[var(--text)]">{c.service_name}</strong>,
            issued by {c.institution} through PortaGov.
          </p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Application tracking number {c.reference}. Issued {fmtDate(c.issued_at)}.
          </p>
        </div>
        <div className="mt-5 flex flex-col items-center">
          {qr ? (
            <img src={qr} alt={`QR code for certificate ${c.cert_number}`} className="h-44 w-44" />
          ) : null}
          <p className="mt-2 max-w-md text-center text-sm text-[var(--dim)]">
            Scan the QR code, or type the certificate number on the{" "}
            <a href="#/verify" className="font-semibold underline">Verify page</a>,
            to check this certificate is real.
          </p>
        </div>
        <div style={{ backgroundColor: "#d9a821" }} className="mt-5 h-1.5 rounded" />
        <p className="mt-3 text-center text-sm font-semibold text-[var(--dim)]">
          portagov, Citizens. Services. Connected.
        </p>
      </div>
    </div>
  );
}

/* ---------- public certificate verification ---------- */

function VerifyPage() {
  const [number, setNumber] = useState("");
  const [checked, setChecked] = useState(false);
  const verify = useMutation({
    mutationFn: async () =>
      await api.verifyCertificate({ certNumber: number.trim() }),
    onSuccess: () => setChecked(true),
  });
  const result = verify.data;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Check a certificate
      </h1>
      <p className="mt-1 text-[var(--dim)]">
        Anybody can check a PortaGov digital certificate here. No sign-in
        needed. Type the certificate number exactly as it is written on the
        certificate.
      </p>
      <form
        className="mt-5 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setChecked(false);
          verify.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="vf-number">Certificate number</FieldLabel>
          <input id="vf-number" {...FIELDS.verifyCertificate.certNumber} className={inputCls} value={number}
            onChange={(e) => setNumber(e.target.value)} placeholder="PGC-2026-00001" />
        </div>
        <PrimaryButton type="submit" disabled={verify.isPending}>
          {verify.isPending ? "Checking..." : "Check this certificate"}
        </PrimaryButton>
      </form>
      {checked && result ? (
        result.valid && result.certificate ? (
          <div className="mt-4 rounded-xl border-2 p-5" style={{ borderColor: "#166534" }}>
            <p className="font-display text-lg font-bold text-[var(--text)]">
              This certificate is real.
            </p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {result.certificate.cert_number}, given to{" "}
              {result.certificate.holder_name} for{" "}
              {result.certificate.service_name}, issued by{" "}
              {result.certificate.institution} on{" "}
              {fmtDate(result.certificate.issued_at)}. Application{" "}
              {result.certificate.reference}.
            </p>
          </div>
        ) : (
          <p role="alert" className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
            No certificate with that number exists on PortaGov. Check the
            number and try again. If someone gave you this certificate, be
            careful: it may not be real.
          </p>
        )
      ) : null}
    </div>
  );
}

/* ---------- help page: Liberian English, voice notes, ask a real person, call-back ---------- */

const VOICE_STEPS: { title: string; text: string }[] = [
  {
    title: "Step 1: Make your account",
    text: "First, make your PortaGov account. If you are new, we will ask for your name, your date of birth, your town, and your phone number. We save it one time. Next time, you just sign in with your phone number.",
  },
  {
    title: "Step 2: Put your papers in your wallet",
    text: "Put your papers in your wallet. Your birth certificate, your ID card, and your passport photo. Put them one time. Every office will use the same papers.",
  },
  {
    title: "Step 3: Choose your service and apply",
    text: "Choose the service you want, like passport or police clearance. Fill the small form and press Submit. You will get your application number right away. Keep that number safe.",
  },
  {
    title: "Step 4: PortaGov checks first",
    text: "PortaGov will check your application first. When it is good, PortaGov sends it to the office in charge. The office cannot see it before PortaGov sends it.",
  },
  {
    title: "Step 5: Messages and collection",
    text: "We will send you SMS and WhatsApp messages for every step. When your paper is ready, we will tell you to come and collect it. For passport, you come one time for your fingerprint and photo.",
  },
  {
    title: "Step 6: If you need help",
    text: "If you have any problem, press Ask Us Anything on the Help page. A real person from PortaGov will answer you. You can also ask us to call you back.",
  },
];

function HelpPage({ profile }: { profile: ProfileT | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [topic, setTopic] = useState("My application");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const ask = useMutation({
    mutationFn: async () =>
      await api.submitHelpRequest({
        profileId: profile?.id ?? null,
        name,
        phone,
        topic,
        message,
      }),
    onSuccess: () => {
      setSent(true);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["my-help"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Your question could not be sent."),
  });
  const [cbName, setCbName] = useState(profile?.full_name ?? "");
  const [cbPhone, setCbPhone] = useState(profile?.phone ?? "");
  const [cbTopic, setCbTopic] = useState("Help me apply");
  const [cbDone, setCbDone] = useState(false);
  const callback = useMutation({
    mutationFn: async () =>
      await api.requestCallback({ name: cbName, phone: cbPhone, topic: cbTopic }),
    onSuccess: () => setCbDone(true),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Call-back request failed."),
  });
  const myHelp = useQuery({
    queryKey: ["my-help", phone],
    queryFn: () => api.listHelpRequestsByPhone({ phone: phone.trim() }),
    enabled: phone.trim().length >= 7,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Help, in simple words
      </h1>
      <p className="mt-2 max-w-2xl text-[var(--dim)]">
        This page talks plain. Press play to hear each step out loud, read the
        words, or ask us anything and a real person from PortaGov will answer
        you. No machine answers your questions here.
      </p>

      <div className="mt-6 space-y-3">
        {VOICE_STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">{s.title}</h2>
            <p className="mt-1 leading-relaxed text-[var(--dim)]">{s.text}</p>
            <ListenButton text={s.text} label={`Listen: ${s.title}`} />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <form
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            if (message.trim().length < 5) {
              setError("Write your question first, even small.");
              return;
            }
            ask.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Ask us anything</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            A real person on the PortaGov team reads and answers. We answer on
            this page, under your phone number.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <FieldLabel htmlFor="help-name">Your name</FieldLabel>
              <input id="help-name" {...FIELDS.submitHelpRequest.name} className={inputCls} value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="help-phone">Your phone number</FieldLabel>
              <input id="help-phone" {...FIELDS.submitHelpRequest.phone} className={inputCls} value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="help-topic">What is it about?</FieldLabel>
              <select id="help-topic" {...FIELDS.submitHelpRequest.topic} className={inputCls} value={topic}
                onChange={(e) => setTopic(e.target.value)}>
                <option>My application</option>
                <option>Payment and billing</option>
                <option>My documents</option>
                <option>Passport photo</option>
                <option>Someone asked me to pay a personal number</option>
                <option>Other question</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="help-msg">Your question</FieldLabel>
              <textarea id="help-msg" {...FIELDS.submitHelpRequest.message} className={inputCls} rows={4} value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write it the way you talk. We will understand." />
            </div>
            {sent ? (
              <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
                We got your question. A real person will answer. Come back to
                this page to see the answer.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                {error}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={ask.isPending}>
              Send my question
            </PrimaryButton>
          </div>
        </form>

        <div className="space-y-5">
          <form
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              callback.mutate();
            }}
          >
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              Ask us to call you back
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Leave your number and what you need. The help team will call you.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <FieldLabel htmlFor="cb-name">Your name</FieldLabel>
                <input id="cb-name" {...FIELDS.requestCallback.name} className={inputCls} value={cbName}
                  onChange={(e) => setCbName(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="cb-phone">Number to call</FieldLabel>
                <input id="cb-phone" {...FIELDS.requestCallback.phone} className={inputCls} value={cbPhone}
                  onChange={(e) => setCbPhone(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="cb-topic">What do you need?</FieldLabel>
                <input id="cb-topic" {...FIELDS.requestCallback.topic} className={inputCls} value={cbTopic}
                  onChange={(e) => setCbTopic(e.target.value)} />
              </div>
              {cbDone ? (
                <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
                  Done. We will call you back.
                </p>
              ) : null}
              <PrimaryButton type="submit" disabled={callback.isPending}>
                Request call-back
              </PrimaryButton>
            </div>
          </form>

          <LiveChatPanel profile={profile} />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">
              My questions and the answers
            </h2>
            <div className="mt-3 space-y-2">
              {myHelp.data && myHelp.data.requests.length > 0 ? (
                myHelp.data.requests.map((r) => (
                  <div key={r.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
                    <p className="font-bold text-[var(--text)]">
                      {r.topic}, {r.status}
                    </p>
                    <p className="mt-1 text-[var(--text)]">{r.message}</p>
                    {r.reply ? (
                      <p className="mt-1 text-[var(--dim)]">
                        <strong className="text-[var(--text)]">PortaGov answered:</strong>{" "}
                        {r.reply}
                      </p>
                    ) : (
                      <p className="mt-1 text-[var(--dim)]">No answer yet. We are on it.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--dim)]">
                  Put your phone number in the form and your questions and
                  answers show here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <ComplaintsLearningPanel canAdd={false} />
      </div>
    </div>
  );
}

/* ---------- county service centre mode (walk-in, officer helps on the spot) ---------- */

function CentrePage() {
  /* County agent mode: the helper must first sign in as a registered
     PortaGov agent, by name and phone, before they can apply for
     anyone. The desk never trusts a typed-in name. */
  const [agent, setAgent] = useState<AgentT | null>(null);
  const [agentId, setAgentId] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentError, setAgentError] = useState("");
  const [centre, setCentre] = useState(OFFICES[0] ?? "");
  const [citizen, setCitizen] = useState<ProfileT | null>(null);
  const [phone, setPhone] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [serviceId, setServiceId] = useState(SERVICES[0]?.id ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [doneRef, setDoneRef] = useState("");
  const [error, setError] = useState("");
  const service = serviceById(serviceId);

  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });
  const activeAgents = (agents.data?.agents ?? []).filter((a: AgentT) => a.active);
  const signInAgent = useMutation({
    mutationFn: async () =>
      await api.agentSignIn({ agentId: Number(agentId), phone: agentPhone.trim() }),
    onSuccess: (r) => {
      setAgent(r.agent);
      setAgentError("");
      if (r.agent.service_centre && OFFICES.includes(r.agent.service_centre)) {
        setCentre(r.agent.service_centre);
      }
    },
    onError: (e) =>
      setAgentError(e instanceof Error ? e.message : "Could not sign in as this agent."),
  });
  const signOutAgent = () => {
    setAgent(null);
    setAgentId("");
    setAgentPhone("");
    setCitizen(null);
    setPhone("");
    setLookupMsg("");
    setFieldValues({});
    setDoneRef("");
    setError("");
  };

  const lookup = useMutation({
    mutationFn: async () => await api.findProfileByPhone({ phone: phone.trim() }),
    onSuccess: (r) => {
      if (r.profile) {
        setCitizen(r.profile);
        setLookupMsg(`Found: ${r.profile.full_name}. Their saved profile will be used.`);
      } else {
        setCitizen(null);
        setLookupMsg(
          "No profile for that number. Fill the first-time form below with the citizen and save: it becomes their PortaGov profile.",
        );
      }
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!citizen || !service) throw new Error("Pick the citizen and the service first.");
      for (const f of service.fields) {
        const err = dateFieldError(f, fieldValues[f.key] ?? "");
        if (err) throw new Error(err);
      }
      const d = serviceDetails(service.id);
      return await api.submitApplication({
        profileId: citizen.id,
        serviceId: service.id,
        serviceName: service.name,
        institution: ministryById(service.ministryId).name,
        channel: "Agent assisted",
        agentName: `${agent?.full_name ?? "County agent"}, ${centre}`,
        notes: "Applied at a County Service Centre, officer assisted, walk-in.",
        details: service.fields
          .map((f) => ({
            label: f.label,
            value: (f.kind === "date"
              ? normalizeDateValue(fieldValues[f.key] ?? "")
              : (fieldValues[f.key] ?? "")
            ).trim(),
          }))
          .filter((x) => x.value.length > 0),
        documentIds: [],
        serviceFee: d.feeUsd,
      });
    },
    onSuccess: (r) => setDoneRef(r.application.reference),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not submit. Try again."),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#92580a" }}>
        County Service Centre mode
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--text)]">
        Walk-in desk
      </h1>
      <p className="mt-2 max-w-3xl text-[var(--dim)]">
        For citizens who walk in with no phone or no internet. A registered
        PortaGov agent signs in here first, then helps the citizen apply on
        the spot, on the same PortaGov system, with the same tracking number,
        the same billing, and the same phone updates as applying from home.
        Nothing here is a side channel. The citizen's own contact details
        are recorded, so every update still reaches them.
      </p>

      {!agent ? (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Step 1: the agent signs in</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Only a registered PortaGov agent can use this desk. Pick your
            name and enter the phone number PortaGov has for you.
          </p>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setAgentError("");
              if (!agentId) {
                setAgentError("Pick your name from the list of registered agents.");
                return;
              }
              signInAgent.mutate();
            }}
          >
            <div className="min-w-56 flex-1">
              <FieldLabel htmlFor="ctr-agent">Your name, as registered</FieldLabel>
              <select id="ctr-agent" className={inputCls} value={agentId}
                onChange={(e) => setAgentId(e.target.value)}>
                <option value="">Choose your name</option>
                {activeAgents.map((a: AgentT) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}, {a.county} County{a.service_centre ? `, ${a.service_centre}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-56 flex-1">
              <FieldLabel htmlFor="ctr-agent-phone">Your agent phone number</FieldLabel>
              <input id="ctr-agent-phone" {...FIELDS.agentSignIn.phone} className={inputCls} value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)} />
            </div>
            <PrimaryButton type="submit" disabled={signInAgent.isPending}>
              {signInAgent.isPending ? "Checking..." : "Sign in as this agent"}
            </PrimaryButton>
          </form>
          {agents.isPending ? (
            <p className="mt-2 text-sm text-[var(--dim)]">Loading registered agents...</p>
          ) : activeAgents.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--dim)]">
              No registered agents yet. PortaGov registers agents county by
              county in the platform console; until then, this desk stays closed.
            </p>
          ) : null}
          {agentError ? (
            <p role="alert" className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
              {agentError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Agent and centre</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Signed in as <strong className="text-[var(--text)]">{agent.full_name}</strong>, {agent.county} County
            agent. Every application you submit here is named for you, so the
            citizen always knows who helped them.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ctr-centre">Service centre</FieldLabel>
              <select id="ctr-centre" className={inputCls} value={centre}
                onChange={(e) => setCentre(e.target.value)}>
                {OFFICES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <GhostButton onClick={signOutAgent}>Sign out, finish helping</GhostButton>
            </div>
          </div>
        </div>
      )}

      {agent ? (
      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">Step 2: the citizen</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            lookup.mutate();
          }}
        >
          <div className="min-w-56 flex-1">
            <FieldLabel htmlFor="ctr-phone">Citizen's phone number</FieldLabel>
            <input id="ctr-phone" {...FIELDS.findProfileByPhone.phone} className={inputCls} value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </div>
          <PrimaryButton type="submit" disabled={lookup.isPending}>
            Find the citizen
          </PrimaryButton>
        </form>
        {lookupMsg ? <p className="mt-2 text-sm font-semibold text-[var(--text)]">{lookupMsg}</p> : null}
        {!citizen ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-[var(--dim)]">
              New citizen? Their first-time setup, saved once to their profile.
              You check their ID in person, so their profile counts as
              verified and they do not need a phone code to apply. Record the
              contact where their own updates should go, their own number if
              they have one, or a family member's number who will pass the
              messages on, and their email if they have one.
            </p>
            <ProfileForm
              officerMode
              submitLabel="Save citizen profile"
              onSaved={(p) => {
                setCitizen(p);
                setLookupMsg(`Profile saved for ${p.full_name}.`);
              }}
            />
          </div>
        ) : null}
      </div>
      ) : null}

      {agent && citizen ? (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Step 3: apply for {citizen.full_name}
          </h2>
          <div className="mt-3">
            <FieldLabel htmlFor="ctr-service">Service</FieldLabel>
            <select id="ctr-service" className={inputCls} value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}, {ministryById(s.ministryId).shortName}
                </option>
              ))}
            </select>
          </div>
          {service ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {service.fields.map((f) => (
                <div key={f.key}>
                  <FieldLabel htmlFor={`ctr-${f.key}`}>{f.label}</FieldLabel>
                  <input id={`ctr-${f.key}`} className={inputCls}
                    type={f.kind === "date" ? "date" : undefined}
                    value={fieldValues[f.key] ?? ""} placeholder={f.placeholder}
                    onChange={(e) =>
                      setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    onBlur={(e) => {
                      if (f.kind !== "date") return;
                      const fixed = normalizeDateValue(e.target.value);
                      if (fixed !== e.target.value) {
                        setFieldValues((v) => ({ ...v, [f.key]: fixed }));
                      }
                    }} />
                </div>
              ))}
            </div>
          ) : null}
          {service ? (
            <p className="mt-3 text-sm text-[var(--dim)]">
              Fee on PortaGov: ${serviceDetails(service.id).feeUsd}. The citizen
              gets a billing number and pays by MoMo or Orange Money, same as
              from home. The application is tracked under the citizen's own
              profile.
            </p>
          ) : null}
          {doneRef ? (
            <div className="mt-3 space-y-3">
              <p className="rounded-lg p-4 text-white" style={{ backgroundColor: "#0a2a5e" }}>
                Done. Tracking number <strong>{doneRef}</strong>. Tell the citizen
                to keep it: every update comes to their phone by SMS and WhatsApp.
                The application record names you, {agent?.full_name}, as the agent
                who helped.
              </p>
              <GhostButton
                onClick={() => {
                  setCitizen(null);
                  setPhone("");
                  setLookupMsg("");
                  setFieldValues({});
                  setDoneRef("");
                  setError("");
                }}
              >
                Help the next person
              </GhostButton>
            </div>
          ) : (
            <div className="mt-4">
              <PrimaryButton
                onClick={() => {
                  setError("");
                  submit.mutate();
                }}
                disabled={submit.isPending}
              >
                {submit.isPending ? "Submitting..." : "Submit for the citizen"}
              </PrimaryButton>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- business side ---------- */

type BusinessT = ApiResponse<typeof api, "listBusinesses">["businesses"][number];

function AgentsDirectory() {
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });
  const active = (agents.data?.agents ?? []).filter((a: AgentT) => a.active);
  const byCounty = new Map<string, AgentT[]>();
  for (const a of active) {
    byCounty.set(a.county, [...(byCounty.get(a.county) ?? []), a]);
  }
  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        PortaGov agents in your county
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Agents are registered by PortaGov and named on every application they
        help with, so you always know who helped you.
      </p>
      {agents.isPending ? (
        <p className="mt-3 text-sm text-[var(--dim)]">Loading agents...</p>
      ) : active.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[...byCounty.entries()].map(([county, list]) => (
            <div key={county} className="rounded-lg bg-[var(--surface-alt)] p-3">
              <p className="font-display font-bold text-[var(--text)]">{county} County</p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
                {list.map((a) => (
                  <li key={a.id}>
                    <strong className="text-[var(--text)]">{a.full_name}</strong>
                    {a.service_centre ? `, ${a.service_centre}` : ""}, {a.phone}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--dim)]">
          Agents are being registered county by county. Until an agent is
          listed here for your county, the agent desk stays closed: only a
          registered agent can apply for someone else.
        </p>
      )}
      <div className="mt-4">
        <GhostButton onClick={() => nav("#/centre")}>
          Agent sign in: open the county agent desk
        </GhostButton>
      </div>
    </div>
  );
}

/* ---------- trust badge for a ministry ---------- */

function TrustBadge({ institution }: { institution: string }) {
  const trust = useQuery({
    queryKey: ["trust"],
    queryFn: () => api.getTrustScores({}),
  });
  const mine = (trust.data?.scores ?? []).find((s) => s.institution === institution);
  if (!mine) return null;
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm">
      <span className="font-display font-extrabold" style={{ color: "#0a2a5e" }}>
        Trust score {mine.score}/100
      </span>
      <span className="text-[var(--dim)]">
        from {mine.ratings_count} citizen ratings, speed {mine.avg_speed}/5,
        clarity {mine.avg_clarity}/5
      </span>
    </div>
  );
}

/* ---------- county queues page ---------- */

function QueuesPage({ profile }: { profile: ProfileT | null }) {
  const queues = useQuery({
    queryKey: ["queues"],
    queryFn: () => api.getOfficeQueues({}),
  });
  const rows = queues.data?.rows ?? [];
  const byOffice = new Map<string, { total: number; days: { date: string; booked: number }[] }>();
  for (const r of rows) {
    const cur = byOffice.get(r.office) ?? { total: 0, days: [] };
    cur.total += r.booked;
    cur.days.push({ date: r.date, booked: r.booked });
    byOffice.set(r.office, cur);
  }
  const level = (n: number) => (n >= 12 ? "Busy" : n >= 5 ? "Moderate" : "Quiet");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        How busy is each centre?
      </h1>
      <p className="mt-1 max-w-2xl text-[var(--dim)]">
        Live from booked appointments. Pick a quieter centre or a quieter day
        when you book from your application's page, and spend less time
        waiting.
      </p>
      <div className="mt-5">
        <QueueJoinPanel profile={profile} />
      </div>
      <div className="mt-5 space-y-3">
        {OFFICES.map((office) => {
          const data = byOffice.get(office) ?? { total: 0, days: [] };
          return (
            <div key={office} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display font-bold text-[var(--text)]">{office}</p>
                <Chip tone={level(data.total) === "Quiet" ? "gold" : "plain"}>
                  {level(data.total)}, {data.total} visits booked
                </Chip>
              </div>
              {data.days.length > 0 ? (
                <p className="mt-1 text-sm text-[var(--dim)]">
                  {data.days
                    .slice(0, 5)
                    .map((d) => `${d.date}: ${d.booked} booked`)
                    .join(". ")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[var(--dim)]">
                  No visits booked yet. This centre is quiet: a good time to book.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- platform extras: payments desk, complaints, help inbox, agents, trust, weekly reports ---------- */

function PlatformExtras() {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const complaints = useQuery({
    queryKey: ["complaints"],
    queryFn: () => api.listComplaints({ limit: 50 }),
  });
  const help = useQuery({
    queryKey: ["help-requests"],
    queryFn: () => api.listHelpRequests({ limit: 50 }),
  });
  const callbacks = useQuery({
    queryKey: ["callbacks"],
    queryFn: () => api.listCallbacks({}),
  });
  const trust = useQuery({
    queryKey: ["trust"],
    queryFn: () => api.getTrustScores({}),
  });
  const weekly = useQuery({
    queryKey: ["weekly"],
    queryFn: () => api.getWeeklyReport({}),
  });
  const snapshots = useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.listReportSnapshots({ limit: 12 }),
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });

  const payStatus = useMutation({
    mutationFn: async (args: { paymentId: number; status: "Confirmed" | "Refunded" }) =>
      await api.updatePaymentStatus(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["all-apps"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
  const [complaintReplies, setComplaintReplies] = useState<Record<number, string>>({});
  const resolve = useMutation({
    mutationFn: async (args: { id: number; status: "Under review by PortaGov" | "Resolved"; reply: string }) =>
      await api.resolveComplaint(args),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["complaints"] }),
  });
  const [helpReplies, setHelpReplies] = useState<Record<number, string>>({});
  const replyHelp = useMutation({
    mutationFn: async (args: { id: number; reply: string }) =>
      await api.replyHelpRequest(args),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["help-requests"] }),
  });
  const cbDone = useMutation({
    mutationFn: async (id: number) => await api.markCallbackDone({ id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["callbacks"] }),
  });
  const genWeekly = useMutation({
    mutationFn: async () => await api.generateWeeklyReport({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      void queryClient.invalidateQueries({ queryKey: ["weekly"] });
    },
  });
  const [agentName, setAgentName] = useState("");
  const [agentCounty, setAgentCounty] = useState("Montserrado");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentCentre, setAgentCentre] = useState("");
  const addAgent = useMutation({
    mutationFn: async () =>
      await api.addAgent({
        fullName: agentName,
        county: agentCounty,
        phone: agentPhone,
        serviceCentre: agentCentre,
      }),
    onSuccess: () => {
      setAgentName("");
      setAgentPhone("");
      setAgentCentre("");
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
  const setAgent = useMutation({
    mutationFn: async (args: { id: number; active: boolean }) =>
      await api.setAgentActive(args),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  const toConfirm = (payments.data?.payments ?? []).filter(
    (p: PaymentT) => p.status === "Recorded",
  );
  const refundQueue = (payments.data?.payments ?? []).filter(
    (p: PaymentT) => p.status === "Refund requested",
  );

  return (
    <div className="mt-10 space-y-8">
      <div>
        <SectionTitle sub="Confirming a payment marks its billing number paid, sends the citizen the payment-received confirmation, and releases the application when automatic release is on. Refunds complete the refund path the citizen started.">
          Payments desk: confirm and refund
        </SectionTitle>
        <div className="space-y-3">
          {toConfirm.length === 0 && refundQueue.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              No payments waiting for confirmation and no refunds requested.
            </p>
          ) : null}
          {toConfirm.map((p: PaymentT) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--text)]">
                <strong>{p.method}</strong>, ${p.amount}, application{" "}
                {p.application_ref}, transaction {p.transaction_ref}, from{" "}
                {p.payer_phone}, {fmtDate(p.created_at)}
              </p>
              <PrimaryButton
                onClick={() => payStatus.mutate({ paymentId: p.id, status: "Confirmed" })}
                disabled={payStatus.isPending}
              >
                Confirm payment received
              </PrimaryButton>
            </div>
          ))}
          {refundQueue.map((p: PaymentT) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--text)]">
                <strong>Refund requested:</strong> {p.method}, ${p.amount},
                application {p.application_ref}. Reason: {p.refund_reason}
              </p>
              <GhostButton
                onClick={() => payStatus.mutate({ paymentId: p.id, status: "Refunded" })}
                disabled={payStatus.isPending}
              >
                Mark refund paid back
              </GhostButton>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle sub="Appeals and complaints come to PortaGov, not only to the institution. Answer here and the citizen sees it on their application.">
          Complaints and appeals ({(complaints.data?.complaints ?? []).length})
        </SectionTitle>
        <div className="space-y-3">
          {(complaints.data?.complaints ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--text)]">
                <strong>{c.kind}</strong> on {c.application_ref}, {c.status},{" "}
                {fmtDate(c.created_at)}
              </p>
              <p className="mt-1 text-sm text-[var(--dim)]">{c.reason}</p>
              {c.reply ? (
                <p className="mt-1 text-sm text-[var(--dim)]">
                  <strong className="text-[var(--text)]">PortaGov replied:</strong> {c.reply}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  aria-label={`Reply to complaint ${c.id}`}
                  {...FIELDS.resolveComplaint.reply}
                  className={`${inputCls} max-w-md flex-1`}
                  value={complaintReplies[c.id] ?? ""}
                  onChange={(e) =>
                    setComplaintReplies((r) => ({ ...r, [c.id]: e.target.value }))
                  }
                  placeholder="PortaGov's answer to the citizen"
                />
                <GhostButton
                  onClick={() =>
                    resolve.mutate({
                      id: c.id,
                      status: "Under review by PortaGov",
                      reply: complaintReplies[c.id] ?? c.reply,
                    })
                  }
                >
                  Mark under review
                </GhostButton>
                <PrimaryButton
                  onClick={() =>
                    resolve.mutate({
                      id: c.id,
                      status: "Resolved",
                      reply: complaintReplies[c.id] ?? c.reply,
                    })
                  }
                >
                  Resolve with this answer
                </PrimaryButton>
              </div>
            </div>
          ))}
          {(complaints.data?.complaints ?? []).length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              No complaints or appeals yet.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <SectionTitle sub="Questions from the Help page. A real person answers; the citizen sees the answer on the Help page.">
            Ask us anything inbox
          </SectionTitle>
          <div className="space-y-3">
            {(help.data?.requests ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-bold text-[var(--text)]">
                  {r.name}, {r.phone}, {r.topic}, {r.status}
                </p>
                <p className="mt-1 text-sm text-[var(--dim)]">{r.message}</p>
                {r.reply ? (
                  <p className="mt-1 text-sm text-[var(--dim)]">
                    <strong className="text-[var(--text)]">Answered:</strong> {r.reply}
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      aria-label={`Reply to ${r.name}`}
                      {...FIELDS.replyHelpRequest.reply}
                      className={`${inputCls} flex-1`}
                      value={helpReplies[r.id] ?? ""}
                      onChange={(e) =>
                        setHelpReplies((x) => ({ ...x, [r.id]: e.target.value }))
                      }
                      placeholder="Your answer, in simple words"
                    />
                    <PrimaryButton
                      onClick={() =>
                        replyHelp.mutate({ id: r.id, reply: helpReplies[r.id] ?? "" })
                      }
                      disabled={replyHelp.isPending}
                    >
                      Answer
                    </PrimaryButton>
                  </div>
                )}
              </div>
            ))}
            {(help.data?.requests ?? []).length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                No questions waiting.
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <SectionTitle sub="Citizens who asked the help team to call them.">
            Call-back requests
          </SectionTitle>
          <div className="space-y-3">
            {(callbacks.data?.callbacks ?? []).map((cb) => (
              <div key={cb.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm text-[var(--text)]">
                  <strong>{cb.name}</strong>, {cb.phone}, {cb.topic}. {cb.status}
                </p>
                {cb.status === "Waiting" ? (
                  <GhostButton onClick={() => cbDone.mutate(cb.id)}>
                    Mark called back
                  </GhostButton>
                ) : null}
              </div>
            ))}
            {(callbacks.data?.callbacks ?? []).length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                No call-backs waiting.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Institution trust scores
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            From citizen ratings of speed and clarity, slowest first, so the
            platform can see slow ministries early.
          </p>
          <div className="mt-3 space-y-2">
            {(trust.data?.scores ?? []).map((s) => (
              <p key={s.institution} className="flex justify-between gap-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
                <span className="text-[var(--text)]">
                  <strong>{s.institution}</strong>, {s.ratings_count} ratings
                </span>
                <strong style={{ color: s.score < 60 ? "#92580a" : "#0a2a5e" }}>
                  {s.score}/100
                </strong>
              </p>
            ))}
            {(trust.data?.scores ?? []).length === 0 ? (
              <p className="text-sm text-[var(--dim)]">
                No ratings yet. Scores appear when citizens rate completed
                applications.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            Weekly government report, per ministry
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            A fresh snapshot is generated automatically every week, and can be
            generated by hand here. Counts and average processing time per
            ministry.
          </p>
          <div className="mt-3 space-y-2">
            {(weekly.data?.rows ?? []).map((r) => (
              <p key={r.institution} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
                <strong>{r.institution}:</strong> {r.submitted_week} new this
                week, {r.completed_week} completed this week, {r.total} total,{" "}
                {r.avg_hours != null
                  ? `average ${r.avg_hours} hours to complete`
                  : "no completions yet to time"}
                .
              </p>
            ))}
            {(weekly.data?.rows ?? []).length === 0 ? (
              <p className="text-sm text-[var(--dim)]">No applications yet this week.</p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => genWeekly.mutate()} disabled={genWeekly.isPending}>
              {genWeekly.isPending ? "Generating..." : "Generate this week's snapshot now"}
            </PrimaryButton>
            <p className="text-sm text-[var(--dim)]">
              {(snapshots.data?.snapshots ?? []).length} snapshots stored.
              {(snapshots.data?.snapshots ?? [])[0]
                ? ` Latest: ${(snapshots.data?.snapshots ?? [])[0]?.period_label}.`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold text-[var(--text)]">
          Agent network management
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Registered agents appear in the public county directory and are
          named on the applications they help with.
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            addAgent.mutate();
          }}
        >
          <div>
            <FieldLabel htmlFor="ag-name">Agent's full name</FieldLabel>
            <input id="ag-name" {...FIELDS.addAgent.fullName} className={inputCls} value={agentName}
              onChange={(e) => setAgentName(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ag-county">County</FieldLabel>
            <select id="ag-county" {...FIELDS.addAgent.county} className={inputCls} value={agentCounty}
              onChange={(e) => setAgentCounty(e.target.value)}>
              {COUNTIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="ag-phone">Agent's phone</FieldLabel>
            <input id="ag-phone" {...FIELDS.addAgent.phone} className={inputCls} value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ag-centre">Service centre</FieldLabel>
            <input id="ag-centre" {...FIELDS.addAgent.serviceCentre} className={inputCls} value={agentCentre}
              onChange={(e) => setAgentCentre(e.target.value)} />
          </div>
          <PrimaryButton type="submit" disabled={addAgent.isPending}>
            Register agent
          </PrimaryButton>
        </form>
        <div className="mt-3 space-y-2">
          {(agents.data?.agents ?? []).map((a: AgentT) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
              <p className="text-[var(--text)]">
                <strong>{a.full_name}</strong>, {a.county} County, {a.phone}
                {a.service_centre ? `, ${a.service_centre}` : ""}.{" "}
                {a.active ? "Active" : "Inactive"}
              </p>
              <GhostButton
                onClick={() => setAgent.mutate({ id: a.id, active: !a.active })}
              >
                {a.active ? "Deactivate" : "Activate"}
              </GhostButton>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- photo guide (visual, drawn guide, not a photograph) ---------- */

function PhotoGuide() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Photo guide: how your passport photo must look
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <svg viewBox="0 0 200 240" role="img" aria-label="Drawing of a correct passport photo: head and shoulders centred in the frame, white background" className="mx-auto w-full max-w-56 rounded-lg border-2" style={{ borderColor: "#166534", backgroundColor: "#ffffff" }}>
            <rect x="10" y="10" width="180" height="220" fill="none" stroke="#166534" strokeDasharray="6 4" strokeWidth="2" />
            <circle cx="100" cy="95" r="38" fill="#d9c9a8" />
            <path d="M100 133 c-34 0 -52 22 -56 50 l0 47 l112 0 l0 -47 c-4 -28 -22 -50 -56 -50 z" fill="#0a2a5e" />
            <text x="100" y="28" textAnchor="middle" fontSize="11" fill="#166534" fontWeight="bold">WHITE BACKGROUND</text>
          </svg>
          <p className="mt-2 text-center text-sm font-bold" style={{ color: "#166534" }}>
            Correct: face in the middle, head and shoulders showing, white behind you
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-bold text-[var(--text)]">Do these things:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-[var(--dim)]">
            <li>Stand in front of a plain white wall or white cloth.</li>
            <li>Look straight at the camera, face in the middle of the frame.</li>
            <li>Show your head and your shoulders, like the drawing.</li>
            <li>Good light on your face, no shadow on one side.</li>
            <li>Keep the photo full quality. Do not compress it or send a screenshot of a photo.</li>
          </ul>
          <p className="font-bold text-[var(--text)]">Do not do these things:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-[var(--dim)]">
            <li>No hat, no sunglasses, no dark glasses.</li>
            <li>No coloured or busy background.</li>
            <li>No selfie from far away, no photo of a photo.</li>
            <li>No blurry photo. If PortaGov warns you in the wallet, take a new one.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- privacy page, plain words ---------- */

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Your privacy, in plain words
      </h1>
      <div className="mt-5 space-y-5 leading-relaxed text-[var(--dim)]">
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">What we keep</h2>
          <p className="mt-1">
            We keep the things you give us: your name, your date of birth,
            your address, your phone, your documents, and your applications.
            We keep them so government can serve you. We do not keep things
            you did not give us.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">Who sees your things</h2>
          <p className="mt-1">
            PortaGov sees your application first. The ministry in charge sees
            it only after PortaGov releases it, and only when your billing
            number is confirmed paid where a fee applies. If you are abroad,
            the Liberian embassy in your country also gets the updates for
            your application, so it can help you where you are. Nobody else
            sees your things. We do not sell your information. Never.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">How we protect your account</h2>
          <p className="mt-1">
            Your password is stored scrambled, never as plain words. Your
            phone must be proven with a code before your account can apply
            for anything. A new device needs a code too, and we warn you when
            one signs in. Five wrong passwords lock the account for 15
            minutes. You can turn on two-factor codes in My account for even
            stronger protection.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">Your choices</h2>
          <p className="mt-1">
            You can see and change your details any time in My account. Your
            documents stay in your wallet, including your payment receipts,
            which stay there forever. If you want something removed, ask on
            the Help page and a real person will handle it.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">Money safety</h2>
          <p className="mt-1">
            PortaGov will never ask you to pay to a personal number. You only
            pay to the official billing number on your own application. If
            anybody asks for money another way, it is fraud: do not pay, and
            report it on the Help page.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ---------- ministry announcement board ---------- */

type AnnouncementT =
  ApiResponse<typeof api, "listAnnouncements">["announcements"][number];

function AnnouncementsBoard({ ministry }: { ministry?: string }) {
  const posts = useQuery({
    queryKey: ["announcements", ministry ?? "all"],
    queryFn: () => api.listAnnouncements({ ministry: ministry ?? "", limit: 20 }),
  });
  const list = posts.data?.announcements ?? [];
  if (!posts.isPending && list.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Announcement board{ministry ? `: ${ministry}` : ""}
      </h2>
      <div className="mt-3 space-y-3">
        {list.map((a: AnnouncementT) => (
          <div key={a.id} className="rounded-lg bg-[var(--surface-alt)] p-3">
            <p className="text-sm font-bold text-[var(--text)]">
              {a.title}{" "}
              <span className="font-semibold text-[var(--dim)]">
                {ministry ? "" : `${a.ministry}, `}
                {fmtDate(a.created_at)}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--dim)]">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- live chat with a real officer ---------- */

function LiveChatPanel({ profile }: { profile: ProfileT | null }) {
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [name, setName] = useState(profile?.full_name ?? "");
  const [body, setBody] = useState("");
  const [chatError, setChatError] = useState("");
  const thread = useQuery({
    queryKey: ["chat", phone],
    queryFn: () => api.listChatThread({ phone: phone.trim() }),
    enabled: phone.trim().length >= 7,
    refetchInterval: 8000,
  });
  const send = useMutation({
    mutationFn: async () =>
      await api.sendChatMessage({ phone: phone.trim(), name, body }),
    onSuccess: () => {
      setBody("");
      void thread.refetch();
    },
  });
  return (
    <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#0a2a5e" }}>
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Live chat with a PortaGov officer
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        A real officer answers here, not a machine. Write your phone number
        so the officer knows your thread, then write your message.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="chat-name">Your name</FieldLabel>
          <input id="chat-name" {...FIELDS.sendChatMessage.name} className={inputCls} value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="chat-phone">Your phone number</FieldLabel>
          <input id="chat-phone" {...FIELDS.sendChatMessage.phone} className={inputCls} value={phone}
            onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-[var(--surface-alt)] p-3">
        {(thread.data?.messages ?? []).length > 0 ? (
          (thread.data?.messages ?? []).map((m) => (
            <div
              key={m.id}
              className={
                m.sender === "Citizen"
                  ? "ml-10 rounded-lg p-3 text-sm text-white"
                  : "mr-10 rounded-lg bg-[var(--surface)] p-3 text-sm text-[var(--text)]"
              }
              style={m.sender === "Citizen" ? { backgroundColor: "#0a2a5e" } : undefined}
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                {m.sender === "Citizen" ? "You" : "PortaGov officer"},{" "}
                {fmtDateTime(m.created_at)}
              </p>
              <p className="mt-0.5">{m.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--dim)]">
            No messages yet. Write below and the officer will answer in this
            same place.
          </p>
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setChatError("");
          if (phone.trim().length < 7) {
            setChatError("Add your phone number first, so the officer knows your thread.");
            return;
          }
          if (body.trim().length < 1) {
            setChatError("Write your message first, then press Send.");
            return;
          }
          send.mutate();
        }}
      >
        <input
          aria-label="Write a chat message"
          {...FIELDS.sendChatMessage.body}
          className={inputCls}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write to the officer..."
        />
        <PrimaryButton type="submit" disabled={send.isPending}>
          Send
        </PrimaryButton>
      </form>
      {chatError ? (
        <p role="alert" className="mt-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {chatError}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- platform chat inbox ---------- */

function ChatInbox() {
  const queryClient = useQueryClient();
  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.listChatThreads({}),
  });
  const [openPhone, setOpenPhone] = useState("");
  const [reply, setReply] = useState("");
  const thread = useQuery({
    queryKey: ["chat", openPhone],
    queryFn: () => api.listChatThread({ phone: openPhone }),
    enabled: openPhone.length >= 7,
  });
  const send = useMutation({
    mutationFn: async () =>
      await api.officerReplyChat({ phone: openPhone, body: reply }),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["chat"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    },
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Live chat inbox (real officer replies)
      </h2>
      <div className="mt-3 space-y-2">
        {(threads.data?.threads ?? []).map((t) => (
          <button
            key={t.phone}
            type="button"
            onClick={() => setOpenPhone(t.phone)}
            className="w-full rounded-lg bg-[var(--surface-alt)] p-3 text-left text-sm"
          >
            <strong className="text-[var(--text)]">{t.name || t.phone}</strong>{" "}
            <span className="text-[var(--dim)]">
              {t.phone}, {t.count} messages. Last: {t.last_body}
            </span>
          </button>
        ))}
        {(threads.data?.threads ?? []).length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No chats yet.</p>
        ) : null}
      </div>
      {openPhone ? (
        <div className="mt-4">
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-[var(--surface-alt)] p-3">
            {(thread.data?.messages ?? []).map((m) => (
              <p key={m.id} className="text-sm text-[var(--text)]">
                <strong>{m.sender}:</strong> {m.body}{" "}
                <span className="text-[var(--dim)]">{fmtDateTime(m.created_at)}</span>
              </p>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (reply.trim()) send.mutate();
            }}
          >
            <input
              aria-label="Officer reply"
              {...FIELDS.officerReplyChat.body}
              className={inputCls}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Officer reply..."
            />
            <PrimaryButton type="submit" disabled={send.isPending}>
              Reply
            </PrimaryButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- receipts in payments ---------- */

/* Company wallet payments are recorded with a WALLET- transaction
   reference, so show the real method here instead of the stored label. */
function paymentMethodLabel(p: PaymentT): string {
  return p.transaction_ref.startsWith("WALLET-") ? "Company wallet" : p.method;
}

function downloadReceipt(p: PaymentT) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>PortaGov receipt ${p.application_ref}</title></head><body style="font-family:sans-serif;color:#0a2a5e;max-width:640px;margin:40px auto;padding:24px;border:3px solid #0a2a5e">
<h1 style="font-size:22px">PortaGov payment receipt</h1>
<p>Citizens. Services. Connected.</p>
<table style="width:100%;font-size:15px;line-height:2">
<tr><td><strong>Service</strong></td><td>${p.service_name}</td></tr>
<tr><td><strong>Billing number</strong></td><td>${p.billing_number}</td></tr>
<tr><td><strong>Tracking number</strong></td><td>${p.application_ref}</td></tr>
<tr><td><strong>Method</strong></td><td>${paymentMethodLabel(p)}</td></tr>
<tr><td><strong>Amount</strong></td><td>$${p.amount}</td></tr>
<tr><td><strong>Paid from</strong></td><td>${p.payer_phone}</td></tr>
<tr><td><strong>Transaction reference</strong></td><td>${p.transaction_ref}</td></tr>
<tr><td><strong>Status</strong></td><td>${p.status}</td></tr>
<tr><td><strong>Date</strong></td><td>${fmtDate(p.created_at)}</td></tr>
</table>
<p style="font-size:13px">Keep this receipt. PortaGov will never ask you to pay to a personal number, only to the billing number on this receipt.</p>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portagov-receipt-${p.application_ref}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReceiptDownloads({ payments }: { payments: PaymentT[] }) {
  const confirmed = payments.filter((p) => p.status === "Confirmed" || p.status === "Refunded");
  if (confirmed.length === 0) return null;
  return (
    <div className="mt-6">
      <SectionTitle sub="Your receipt also lives in your document wallet forever, saved the moment PortaGov confirms the payment. Download or print it here any time.">
        Receipts
      </SectionTitle>
      <div className="space-y-3">
        {confirmed.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm text-[var(--dim)]">
              Receipt: {p.service_name}, {paymentMethodLabel(p)}, {fmtDate(p.created_at)}. Status:{" "}
              {p.status}.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <LinkedNumbersRow label="Tracking number" value={p.application_ref} />
              <LinkedNumbersRow label="Billing number" value={p.billing_number} />
              <LinkedNumbersRow label="Transaction number" value={p.transaction_ref} />
              <LinkedNumbersRow label="Amount paid" value={`$${p.amount}`} />
              <LinkedNumbersRow label="Paid from" value={p.payer_phone} />
            </dl>
            <div className="mt-4">
              <GhostButton onClick={() => downloadReceipt(p)}>
                Download receipt (printable)
              </GhostButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- refund request row for payments ---------- */

function RefundRequest({ payment }: { payment: PaymentT }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const request = useMutation({
    mutationFn: async () =>
      await api.requestRefund({ paymentId: payment.id, reason }),
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Refund request failed."),
  });
  if (payment.status === "Refund requested")
    return (
      <p className="mt-2 text-sm font-semibold text-[var(--warn)]">
        Refund requested. Reason: {payment.refund_reason}. PortaGov reviews
        refunds on the platform side and pays back to the same mobile money
        number.
      </p>
    );
  if (payment.status === "Refunded")
    return (
      <p className="mt-2 text-sm font-semibold text-[var(--text)]">
        This payment was refunded to your mobile money number.
      </p>
    );
  if (payment.status !== "Confirmed" && payment.status !== "Recorded") return null;
  return (
    <div className="mt-2">
      {open ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            if (reason.trim().length < 3) {
              setError("Tell us why, in a few words.");
              return;
            }
            request.mutate();
          }}
        >
          <input
            aria-label="Why do you need a refund"
            {...FIELDS.requestRefund.reason}
            className={`${inputCls} max-w-sm flex-1`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need a refund?"
          />
          <PrimaryButton type="submit" disabled={request.isPending}>
            Send refund request
          </PrimaryButton>
          {error ? (
            <p role="alert" className="w-full text-sm font-semibold text-[var(--warn)]">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <GhostButton onClick={() => setOpen(true)}>
          Request a refund for this payment
        </GhostButton>
      )}
    </div>
  );
}

/* ---------- expiry wallet (all documents with dates) ---------- */

function ExpiryWalletList({ profile }: { profile: ProfileT }) {
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const withExpiry = (docs.data?.documents ?? [])
    .filter((d: DocumentT) => d.expires_on)
    .sort((a: DocumentT, b: DocumentT) => a.expires_on.localeCompare(b.expires_on));
  if (withExpiry.length === 0) return null;
  const now = Date.now();
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        My documents expiry wallet
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every document with an expiry date, in one place, with the days left.
        Add expiry dates when you save a document and PortaGov watches them
        for you.
      </p>
      <ul className="mt-3 space-y-2">
        {withExpiry.map((d: DocumentT) => {
          const days = Math.ceil(
            (new Date(`${d.expires_on}T00:00:00`).getTime() - now) / 86400000,
          );
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
              <span className="text-[var(--text)]">
                <strong>{d.title}</strong> ({d.doc_type}), expires {fmtDate(d.expires_on)}
              </span>
              <Chip tone={days <= 30 ? "gold" : "plain"}>
                {days < 0 ? `Expired ${Math.abs(days)} days ago` : `${days} days left`}
              </Chip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- account security panel ---------- */

function SecurityPanel({
  profile,
  onProfileChange,
  onSignOutEverywhere,
}: {
  profile: ProfileT;
  onProfileChange: (p: ProfileT) => void;
  onSignOutEverywhere: () => void;
}) {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["devices", profile.id],
    queryFn: () => api.listDevices({ profileId: profile.id }),
  });
  const history = useQuery({
    queryKey: ["sign-in-history", profile.id],
    queryFn: () => api.listSignInEvents({ profileId: profile.id }),
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const toggle = useMutation({
    mutationFn: async (enabled: boolean) =>
      await api.setTwoFactor({ profileId: profile.id, enabled }),
    onSuccess: (_r, enabled) => {
      onProfileChange({ ...profile, two_factor: enabled });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
  const change = useMutation({
    mutationFn: async () =>
      await api.changePassword({
        profileId: profile.id,
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setMsg("Password changed. Use the new one next time you sign in.");
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Password could not be changed."),
  });
  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-xl font-bold text-[var(--text)]">Account security</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-bold text-[var(--text)]">Phone verified</dt>
          <dd className="text-[var(--dim)]">{profile.phone_verified ? "Yes, by code" : profile.id_checked_by_officer ? "Checked by an officer in person" : "Not yet"}</dd>
        </div>
        <div>
          <dt className="font-bold text-[var(--text)]">Email verified</dt>
          <dd className="text-[var(--dim)]">{profile.email ? (profile.email_verified ? "Yes, by code" : "Not yet") : "No email on account"}</dd>
        </div>
        <div>
          <dt className="font-bold text-[var(--text)]">Password</dt>
          <dd className="text-[var(--dim)]">{profile.has_password ? "Set, stored scrambled" : "Not set yet"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-alt)] p-3">
        <p className="text-sm text-[var(--text)]">
          <strong>Two-factor sign-in codes:</strong>{" "}
          {profile.two_factor
            ? "On. Every sign-in needs a code, even on your own phone."
            : "Off. Codes are still needed on new devices. Turn this on for the strongest protection."}
        </p>
        <GhostButton
          onClick={() => toggle.mutate(!profile.two_factor)}
          disabled={toggle.isPending}
        >
          {profile.two_factor ? "Turn two-factor off" : "Turn two-factor on"}
        </GhostButton>
      </div>
      <div className="mt-4">
        <p className="font-display font-bold text-[var(--text)]">Devices on this account</p>
        <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
          {(devices.data?.devices ?? []).map((d) => (
            <li key={d.id}>
              {d.label || "Device"}, first seen {fmtDate(d.first_seen)}, last
              seen {fmtDate(d.last_seen)}
            </li>
          ))}
          {(devices.data?.devices ?? []).length === 0 ? (
            <li>No devices recorded yet.</li>
          ) : null}
        </ul>
        <p className="mt-1 text-xs text-[var(--dim)]">
          A new device always needs a code, and PortaGov warns you when one
          signs in. If you see a device you do not know, change your password
          at once.
        </p>
      </div>
      <div className="mt-4">
        <p className="font-display font-bold text-[var(--text)]">Sign-in history</p>
        <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
          {(history.data?.events ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2">
              <span>
                {fmtDateTime(e.signed_in_at)}, {e.device_label || "Device"}
              </span>
              {e.is_new_device ? (
                <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-bold text-[var(--warn)]">
                  New device
                </span>
              ) : null}
            </li>
          ))}
          {(history.data?.events ?? []).length === 0 ? (
            <li>No sign-ins recorded yet. Sign-ins from this device are recorded from now on.</li>
          ) : null}
        </ul>
        <p className="mt-1 text-xs text-[var(--dim)]">
          If a sign-in here was not you, change your password at once and
          sign out everywhere below.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-alt)] p-3">
        <p className="text-sm text-[var(--text)]">
          <strong>Sign out everywhere:</strong> signs out this device and
          every other device on this account, in one tap. Today your data
          lives on this device only, so this signs out this device and the
          sessions recorded here. On the shared PortaGov backend it will
          sign out every device at once.
        </p>
        {confirmSignOutAll ? (
          <span className="flex flex-wrap gap-2">
            <PrimaryButton onClick={onSignOutEverywhere}>
              Yes, sign out everywhere
            </PrimaryButton>
            <GhostButton onClick={() => setConfirmSignOutAll(false)}>
              Keep me signed in
            </GhostButton>
          </span>
        ) : (
          <GhostButton onClick={() => setConfirmSignOutAll(true)}>
            Sign out everywhere
          </GhostButton>
        )}
      </div>
      {profile.has_password ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            setMsg("");
            change.mutate();
          }}
        >
          <div>
            <FieldLabel htmlFor="sec-current">Current password</FieldLabel>
            <input id="sec-current" {...FIELDS.changePassword.currentPassword} type="password" className={inputCls} value={current}
              onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="sec-next">New password (10+ characters, capital, small, number, symbol)</FieldLabel>
            <input id="sec-next" {...FIELDS.changePassword.newPassword} type="password" className={inputCls} value={next}
              onChange={(e) => setNext(e.target.value)} />
          </div>
          <PrimaryButton type="submit" disabled={change.isPending}>
            Change password
          </PrimaryButton>
          {msg ? <p className="text-sm font-semibold text-[var(--text)] sm:col-span-3">{msg}</p> : null}
          {error ? (
            <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)] sm:col-span-3">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

/* ---------- embassy desk (institution portal) and citizen embassy thread ---------- */

type EmbassyUpdateT =
  ApiResponse<typeof api, "listEmbassyUpdates">["updates"][number];

function EmbassyThread({ app }: { app: ApplicationT }) {
  const queryClient = useQueryClient();
  const updates = useQuery({
    queryKey: ["embassy-updates", app.id],
    queryFn: () => api.listEmbassyUpdates({ applicationId: app.id }),
  });
  const [body, setBody] = useState("");
  const [sender, setSender] = useState<"Institution" | "Embassy">("Institution");
  const post = useMutation({
    mutationFn: async () =>
      await api.postEmbassyUpdate({
        applicationId: app.id,
        sender,
        body,
      }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["embassy-updates"] });
    },
  });
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">
        Embassy space: {app.embassy || `Embassy of Liberia, ${app.diaspora_country}`}
      </p>
      <p className="text-xs text-[var(--dim)]">
        Status, documents, and collection or delivery details shared between
        the institution, the embassy, and the citizen. The citizen sees every
        update in their application.
      </p>
      <div className="mt-2 space-y-2">
        {(updates.data?.updates ?? []).map((u: EmbassyUpdateT) => (
          <p key={u.id} className="rounded bg-[var(--surface)] p-2 text-sm text-[var(--text)]">
            <strong>{u.sender}:</strong> {u.body}{" "}
            <span className="text-[var(--dim)]">{fmtDateTime(u.created_at)}</span>
          </p>
        ))}
        {(updates.data?.updates ?? []).length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No embassy updates yet.</p>
        ) : null}
      </div>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (body.trim().length >= 3) post.mutate();
        }}
      >
        <select
          aria-label="Posting as"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm"
          value={sender}
          onChange={(e) => setSender(e.target.value === "Embassy" ? "Embassy" : "Institution")}
        >
          <option value="Institution">As the institution</option>
          <option value="Embassy">As the embassy</option>
        </select>
        <input
          aria-label="Embassy space update"
          {...FIELDS.postEmbassyUpdate.body}
          className={`${inputCls} min-w-52 flex-1`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="For example: passport received at the embassy, ready for the citizen to collect on Friday"
        />
        <PrimaryButton type="submit" disabled={post.isPending}>
          Post update
        </PrimaryButton>
      </form>
    </div>
  );
}

function EmbassyDesk({ institution }: { institution?: string } = {}) {
  const apps = useQuery({
    queryKey: ["diaspora-apps"],
    queryFn: () => api.listDiasporaApplications({ limit: 100 }),
  });
  const [country, setCountry] = useState("All countries");
  const all = (apps.data?.applications ?? []).filter(
    (a: ApplicationT) => !institution || a.institution === institution,
  );
  const countries = [
    ...new Set(all.map((a: ApplicationT) => a.diaspora_country).filter(Boolean)),
  ];
  const filtered = all.filter(
    (a: ApplicationT) =>
      country === "All countries" || a.diaspora_country === country,
  );
  return (
    <div className="mt-10">
      <SectionTitle sub="Liberians live in every country, so every diaspora application is linked to the Liberian embassy for that citizen's country. The embassy is updated with the same status, documents, and collection or delivery details, and can help the citizen locally.">
        Embassy desk: diaspora applications by country
      </SectionTitle>
      <div className="mb-4 max-w-sm">
        <FieldLabel htmlFor="emb-country">Country</FieldLabel>
        <select id="emb-country" className={inputCls} value={country}
          onChange={(e) => setCountry(e.target.value)}>
          <option>All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        {apps.isPending ? (
          <p className="text-[var(--dim)]">Loading diaspora applications...</p>
        ) : filtered.length > 0 ? (
          filtered.map((a: ApplicationT) => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-[var(--text)]">
                    {a.service_name}, {a.applicant_name}
                  </p>
                  <p className="text-sm text-[var(--dim)]">
                    From {a.diaspora_country || "abroad"}
                    tracking {a.reference},{" "}
                    {a.institution}, status {a.status}
                    {a.collection_choice
                      ? `, ${a.collection_choice}${a.embassy ? `: ${a.embassy}` : ""}`
                      : ""}
                  </p>
                </div>
                <Chip tone="gold">{applicationStatusPlain(a.status).short}</Chip>
              </div>
              <EmbassyThread app={a} />
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
            No released diaspora applications
            {country !== "All countries" ? ` from ${country}` : ""} yet. When a
            citizen abroad is released to an institution, their application
            and embassy space appear here.
          </p>
        )}
      </div>
    </div>
  );
}

function CitizenEmbassyUpdates({ app }: { app: ApplicationT }) {
  const updates = useQuery({
    queryKey: ["embassy-updates", app.id],
    queryFn: () => api.listEmbassyUpdates({ applicationId: app.id }),
    enabled: app.channel === "Diaspora",
  });
  if (app.channel !== "Diaspora") return null;
  const list = updates.data?.updates ?? [];
  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Your embassy space
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {app.embassy || `The Liberian embassy for ${app.diaspora_country}`}{" "}
        follows this application with {app.institution}: status, documents,
        and collection or delivery details, so the embassy can help you where
        you live. You can also write to the ministry in the thread above, and
        the ministry updates you there, including who will receive and hand
        over your document.
      </p>
      <div className="mt-3 space-y-2">
        {list.length > 0 ? (
          list.map((u: EmbassyUpdateT) => (
            <p key={u.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
              <strong>{u.sender}:</strong> {u.body}{" "}
              <span className="text-[var(--dim)]">{fmtDateTime(u.created_at)}</span>
            </p>
          ))
        ) : (
          <p className="text-sm text-[var(--dim)]">
            No embassy updates yet. They appear here as your application moves.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- currency and fee converter (diaspora) ---------- */

/* World currencies, in A to Z order by code, with a guide rate in
   units per one US dollar. The converter crosses any two through the US
   dollar, so any pair works. Guide rates help you plan; the rate on the
   day you pay is the one that counts. The Liberian dollar rate is the
   Central Bank of Liberia market midpoint of 25 November 2026. */
const FX_CURRENCIES: { code: string; label: string; perUsd: number }[] = [
  { code: "AED", label: "UAE dirham", perUsd: 3.6725 },
  { code: "AFN", label: "Afghan afghani", perUsd: 66 },
  { code: "ALL", label: "Albanian lek", perUsd: 82 },
  { code: "AMD", label: "Armenian dram", perUsd: 387 },
  { code: "ANG", label: "Netherlands Antillean guilder", perUsd: 1.79 },
  { code: "AOA", label: "Angolan kwanza", perUsd: 915 },
  { code: "ARS", label: "Argentine peso", perUsd: 1470 },
  { code: "AUD", label: "Australian dollar", perUsd: 1.52 },
  { code: "AWG", label: "Aruban florin", perUsd: 1.79 },
  { code: "AZN", label: "Azerbaijani manat", perUsd: 1.7 },
  { code: "BAM", label: "Bosnia and Herzegovina convertible mark", perUsd: 1.8 },
  { code: "BBD", label: "Barbadian dollar", perUsd: 2 },
  { code: "BDT", label: "Bangladeshi taka", perUsd: 122 },
  { code: "BGN", label: "Bulgarian lev", perUsd: 1.8 },
  { code: "BHD", label: "Bahraini dinar", perUsd: 0.376 },
  { code: "BIF", label: "Burundian franc", perUsd: 2980 },
  { code: "BMD", label: "Bermudian dollar", perUsd: 1 },
  { code: "BND", label: "Brunei dollar", perUsd: 1.34 },
  { code: "BOB", label: "Bolivian boliviano", perUsd: 6.91 },
  { code: "BRL", label: "Brazilian real", perUsd: 5.35 },
  { code: "BSD", label: "Bahamian dollar", perUsd: 1 },
  { code: "BTN", label: "Bhutanese ngultrum", perUsd: 88.7 },
  { code: "BWP", label: "Botswana pula", perUsd: 13.6 },
  { code: "BYN", label: "Belarusian ruble", perUsd: 3.27 },
  { code: "BZD", label: "Belize dollar", perUsd: 2.01 },
  { code: "CAD", label: "Canadian dollar", perUsd: 1.4 },
  { code: "CDF", label: "Congolese franc", perUsd: 2800 },
  { code: "CHF", label: "Swiss franc", perUsd: 0.885 },
  { code: "CLP", label: "Chilean peso", perUsd: 930 },
  { code: "CNY", label: "Chinese yuan", perUsd: 7.1 },
  { code: "COP", label: "Colombian peso", perUsd: 3750 },
  { code: "CRC", label: "Costa Rican colon", perUsd: 505 },
  { code: "CUP", label: "Cuban peso", perUsd: 24 },
  { code: "CVE", label: "Cape Verdean escudo", perUsd: 101 },
  { code: "CZK", label: "Czech koruna", perUsd: 23.2 },
  { code: "DJF", label: "Djiboutian franc", perUsd: 177.7 },
  { code: "DKK", label: "Danish krone", perUsd: 6.87 },
  { code: "DOP", label: "Dominican peso", perUsd: 64.5 },
  { code: "DZD", label: "Algerian dinar", perUsd: 130 },
  { code: "EGP", label: "Egyptian pound", perUsd: 47.6 },
  { code: "ERN", label: "Eritrean nakfa", perUsd: 15 },
  { code: "ETB", label: "Ethiopian birr", perUsd: 155 },
  { code: "EUR", label: "Euro", perUsd: 0.92 },
  { code: "FJD", label: "Fijian dollar", perUsd: 2.24 },
  { code: "FKP", label: "Falkland Islands pound", perUsd: 0.79 },
  { code: "GBP", label: "British pound", perUsd: 0.79 },
  { code: "GEL", label: "Georgian lari", perUsd: 2.7 },
  { code: "GHS", label: "Ghana cedi", perUsd: 11 },
  { code: "GIP", label: "Gibraltar pound", perUsd: 0.79 },
  { code: "GMD", label: "Gambian dalasi", perUsd: 74 },
  { code: "GNF", label: "Guinean franc", perUsd: 8650 },
  { code: "GTQ", label: "Guatemalan quetzal", perUsd: 7.66 },
  { code: "GYD", label: "Guyanese dollar", perUsd: 209 },
  { code: "HKD", label: "Hong Kong dollar", perUsd: 7.78 },
  { code: "HNL", label: "Honduran lempira", perUsd: 26.2 },
  { code: "HTG", label: "Haitian gourde", perUsd: 130.6 },
  { code: "HUF", label: "Hungarian forint", perUsd: 318 },
  { code: "IDR", label: "Indonesian rupiah", perUsd: 16650 },
  { code: "ILS", label: "Israeli new shekel", perUsd: 3.24 },
  { code: "INR", label: "Indian rupee", perUsd: 88.7 },
  { code: "IQD", label: "Iraqi dinar", perUsd: 1310 },
  { code: "IRR", label: "Iranian rial", perUsd: 42000 },
  { code: "ISK", label: "Icelandic krona", perUsd: 138 },
  { code: "JMD", label: "Jamaican dollar", perUsd: 158 },
  { code: "JOD", label: "Jordanian dinar", perUsd: 0.709 },
  { code: "JPY", label: "Japanese yen", perUsd: 156 },
  { code: "KES", label: "Kenyan shilling", perUsd: 129 },
  { code: "KGS", label: "Kyrgyz som", perUsd: 87.3 },
  { code: "KHR", label: "Cambodian riel", perUsd: 4000 },
  { code: "KMF", label: "Comorian franc", perUsd: 452 },
  { code: "KPW", label: "North Korean won", perUsd: 900 },
  { code: "KRW", label: "South Korean won", perUsd: 1470 },
  { code: "KWD", label: "Kuwaiti dinar", perUsd: 0.308 },
  { code: "KYD", label: "Cayman Islands dollar", perUsd: 0.833 },
  { code: "KZT", label: "Kazakhstani tenge", perUsd: 520 },
  { code: "LAK", label: "Lao kip", perUsd: 21800 },
  { code: "LBP", label: "Lebanese pound", perUsd: 89500 },
  { code: "LKR", label: "Sri Lankan rupee", perUsd: 305 },
  { code: "LRD", label: "Liberian dollar", perUsd: 164.38 },
  { code: "LSL", label: "Lesotho loti", perUsd: 18.2 },
  { code: "LYD", label: "Libyan dinar", perUsd: 5.4 },
  { code: "MAD", label: "Moroccan dirham", perUsd: 9.2 },
  { code: "MDL", label: "Moldovan leu", perUsd: 16.9 },
  { code: "MGA", label: "Malagasy ariary", perUsd: 4470 },
  { code: "MKD", label: "Macedonian denar", perUsd: 56.6 },
  { code: "MMK", label: "Myanmar kyat", perUsd: 2100 },
  { code: "MNT", label: "Mongolian tugrik", perUsd: 3560 },
  { code: "MOP", label: "Macanese pataca", perUsd: 8.03 },
  { code: "MRU", label: "Mauritanian ouguiya", perUsd: 39.9 },
  { code: "MUR", label: "Mauritian rupee", perUsd: 46.3 },
  { code: "MVR", label: "Maldivian rufiyaa", perUsd: 15.4 },
  { code: "MWK", label: "Malawian kwacha", perUsd: 1735 },
  { code: "MXN", label: "Mexican peso", perUsd: 18.3 },
  { code: "MYR", label: "Malaysian ringgit", perUsd: 4.13 },
  { code: "MZN", label: "Mozambican metical", perUsd: 63.8 },
  { code: "NAD", label: "Namibian dollar", perUsd: 18.2 },
  { code: "NGN", label: "Nigerian naira", perUsd: 1470 },
  { code: "NIO", label: "Nicaraguan cordoba", perUsd: 36.8 },
  { code: "NOK", label: "Norwegian krone", perUsd: 11 },
  { code: "NPR", label: "Nepalese rupee", perUsd: 142 },
  { code: "NZD", label: "New Zealand dollar", perUsd: 1.75 },
  { code: "OMR", label: "Omani rial", perUsd: 0.385 },
  { code: "PAB", label: "Panamanian balboa", perUsd: 1 },
  { code: "PEN", label: "Peruvian sol", perUsd: 3.36 },
  { code: "PGK", label: "Papua New Guinean kina", perUsd: 4.2 },
  { code: "PHP", label: "Philippine peso", perUsd: 58.9 },
  { code: "PKR", label: "Pakistani rupee", perUsd: 278 },
  { code: "PLN", label: "Polish zloty", perUsd: 3.64 },
  { code: "PYG", label: "Paraguayan guarani", perUsd: 7150 },
  { code: "QAR", label: "Qatari riyal", perUsd: 3.64 },
  { code: "RON", label: "Romanian leu", perUsd: 4.36 },
  { code: "RSD", label: "Serbian dinar", perUsd: 107.6 },
  { code: "RUB", label: "Russian ruble", perUsd: 78 },
  { code: "RWF", label: "Rwandan franc", perUsd: 1455 },
  { code: "SAR", label: "Saudi riyal", perUsd: 3.75 },
  { code: "SBD", label: "Solomon Islands dollar", perUsd: 8.4 },
  { code: "SCR", label: "Seychellois rupee", perUsd: 14.2 },
  { code: "SDG", label: "Sudanese pound", perUsd: 600 },
  { code: "SEK", label: "Swedish krona", perUsd: 10.5 },
  { code: "SGD", label: "Singapore dollar", perUsd: 1.3 },
  { code: "SHP", label: "Saint Helena pound", perUsd: 0.79 },
  { code: "SLE", label: "Sierra Leonean leone", perUsd: 22.4 },
  { code: "SOS", label: "Somali shilling", perUsd: 571 },
  { code: "SRD", label: "Surinamese dollar", perUsd: 37.5 },
  { code: "SSP", label: "South Sudanese pound", perUsd: 4700 },
  { code: "STN", label: "Sao Tome and Principe dobra", perUsd: 22.5 },
  { code: "SYP", label: "Syrian pound", perUsd: 13000 },
  { code: "SZL", label: "Swazi lilangeni", perUsd: 18.2 },
  { code: "THB", label: "Thai baht", perUsd: 32.5 },
  { code: "TJS", label: "Tajikistani somoni", perUsd: 9.4 },
  { code: "TMT", label: "Turkmenistani manat", perUsd: 3.5 },
  { code: "TND", label: "Tunisian dinar", perUsd: 2.93 },
  { code: "TOP", label: "Tongan paanga", perUsd: 2.36 },
  { code: "TRY", label: "Turkish lira", perUsd: 42.4 },
  { code: "TTD", label: "Trinidad and Tobago dollar", perUsd: 6.77 },
  { code: "TWD", label: "New Taiwan dollar", perUsd: 31.3 },
  { code: "TZS", label: "Tanzanian shilling", perUsd: 2460 },
  { code: "UAH", label: "Ukrainian hryvnia", perUsd: 41.8 },
  { code: "UGX", label: "Ugandan shilling", perUsd: 3660 },
  { code: "USD", label: "US dollar", perUsd: 1 },
  { code: "UYU", label: "Uruguayan peso", perUsd: 39.9 },
  { code: "UZS", label: "Uzbekistani som", perUsd: 12000 },
  { code: "VES", label: "Venezuelan bolivar", perUsd: 245 },
  { code: "VND", label: "Vietnamese dong", perUsd: 26300 },
  { code: "VUV", label: "Vanuatu vatu", perUsd: 119 },
  { code: "WST", label: "Samoan tala", perUsd: 2.74 },
  { code: "XAF", label: "Central African CFA franc", perUsd: 603 },
  { code: "XCD", label: "East Caribbean dollar", perUsd: 2.7 },
  { code: "XOF", label: "West African CFA franc", perUsd: 603 },
  { code: "XPF", label: "CFP franc", perUsd: 110 },
  { code: "YER", label: "Yemeni rial", perUsd: 238 },
  { code: "ZAR", label: "South African rand", perUsd: 17.2 },
  { code: "ZMW", label: "Zambian kwacha", perUsd: 22.5 },
  { code: "ZWL", label: "Zimbabwean ZiG", perUsd: 26 },
];

/* Flag shown beside each currency in the pickers. The shared CFA and CFP
   currencies and the East Caribbean dollar are used by several countries,
   so they carry no single flag. */
const FX_FLAGS: Record<string, string> = {
  AED: "🇦🇪",
  AFN: "🇦🇫",
  ALL: "🇦🇱",
  AMD: "🇦🇲",
  ANG: "🇨🇼",
  AOA: "🇦🇴",
  ARS: "🇦🇷",
  AUD: "🇦🇺",
  AWG: "🇦🇼",
  AZN: "🇦🇿",
  BAM: "🇧🇦",
  BBD: "🇧🇧",
  BDT: "🇧🇩",
  BGN: "🇧🇬",
  BHD: "🇧🇭",
  BIF: "🇧🇮",
  BMD: "🇧🇲",
  BND: "🇧🇳",
  BOB: "🇧🇴",
  BRL: "🇧🇷",
  BSD: "🇧🇸",
  BTN: "🇧🇹",
  BWP: "🇧🇼",
  BYN: "🇧🇾",
  BZD: "🇧🇿",
  CAD: "🇨🇦",
  CDF: "🇨🇩",
  CHF: "🇨🇭",
  CLP: "🇨🇱",
  CNY: "🇨🇳",
  COP: "🇨🇴",
  CRC: "🇨🇷",
  CUP: "🇨🇺",
  CVE: "🇨🇻",
  CZK: "🇨🇿",
  DJF: "🇩🇯",
  DKK: "🇩🇰",
  DOP: "🇩🇴",
  DZD: "🇩🇿",
  EGP: "🇪🇬",
  ERN: "🇪🇷",
  ETB: "🇪🇹",
  EUR: "🇪🇺",
  FJD: "🇫🇯",
  FKP: "🇫🇰",
  GBP: "🇬🇧",
  GEL: "🇬🇪",
  GHS: "🇬🇭",
  GIP: "🇬🇮",
  GMD: "🇬🇲",
  GNF: "🇬🇳",
  GTQ: "🇬🇹",
  GYD: "🇬🇾",
  HKD: "🇭🇰",
  HNL: "🇭🇳",
  HTG: "🇭🇹",
  HUF: "🇭🇺",
  IDR: "🇮🇩",
  ILS: "🇮🇱",
  INR: "🇮🇳",
  IQD: "🇮🇶",
  IRR: "🇮🇷",
  ISK: "🇮🇸",
  JMD: "🇯🇲",
  JOD: "🇯🇴",
  JPY: "🇯🇵",
  KES: "🇰🇪",
  KGS: "🇰🇬",
  KHR: "🇰🇭",
  KMF: "🇰🇲",
  KPW: "🇰🇵",
  KRW: "🇰🇷",
  KWD: "🇰🇼",
  KYD: "🇰🇾",
  KZT: "🇰🇿",
  LAK: "🇱🇦",
  LBP: "🇱🇧",
  LKR: "🇱🇰",
  LRD: "🇱🇷",
  LSL: "🇱🇸",
  LYD: "🇱🇾",
  MAD: "🇲🇦",
  MDL: "🇲🇩",
  MGA: "🇲🇬",
  MKD: "🇲🇰",
  MMK: "🇲🇲",
  MNT: "🇲🇳",
  MOP: "🇲🇴",
  MRU: "🇲🇷",
  MUR: "🇲🇺",
  MVR: "🇲🇻",
  MWK: "🇲🇼",
  MXN: "🇲🇽",
  MYR: "🇲🇾",
  MZN: "🇲🇿",
  NAD: "🇳🇦",
  NGN: "🇳🇬",
  NIO: "🇳🇮",
  NOK: "🇳🇴",
  NPR: "🇳🇵",
  NZD: "🇳🇿",
  OMR: "🇴🇲",
  PAB: "🇵🇦",
  PEN: "🇵🇪",
  PGK: "🇵🇬",
  PHP: "🇵🇭",
  PKR: "🇵🇰",
  PLN: "🇵🇱",
  PYG: "🇵🇾",
  QAR: "🇶🇦",
  RON: "🇷🇴",
  RSD: "🇷🇸",
  RUB: "🇷🇺",
  RWF: "🇷🇼",
  SAR: "🇸🇦",
  SBD: "🇸🇧",
  SCR: "🇸🇨",
  SDG: "🇸🇩",
  SEK: "🇸🇪",
  SGD: "🇸🇬",
  SHP: "🇸🇭",
  SLE: "🇸🇱",
  SOS: "🇸🇴",
  SRD: "🇸🇷",
  SSP: "🇸🇸",
  STN: "🇸🇹",
  SYP: "🇸🇾",
  SZL: "🇸🇿",
  THB: "🇹🇭",
  TJS: "🇹🇯",
  TMT: "🇹🇲",
  TND: "🇹🇳",
  TOP: "🇹🇴",
  TRY: "🇹🇷",
  TTD: "🇹🇹",
  TWD: "🇹🇼",
  TZS: "🇹🇿",
  UAH: "🇺🇦",
  UGX: "🇺🇬",
  USD: "🇺🇸",
  UYU: "🇺🇾",
  UZS: "🇺🇿",
  VES: "🇻🇪",
  VND: "🇻🇳",
  VUV: "🇻🇺",
  WST: "🇼🇸",
  XAF: "",
  XCD: "",
  XOF: "",
  XPF: "",
  YER: "🇾🇪",
  ZAR: "🇿🇦",
  ZMW: "🇿🇲",
  ZWL: "🇿🇼",
};

function CurrencyConverter({ feeUsd }: { feeUsd?: number }) {
  const [amountText, setAmountText] = useState(String(feeUsd ?? 25));
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("LRD");
  const [rateOverride, setRateOverride] = useState("");
  const fromRate = FX_CURRENCIES.find((c) => c.code === from)?.perUsd ?? 1;
  const toRate = FX_CURRENCIES.find((c) => c.code === to)?.perUsd ?? 1;
  const guideRate = fromRate > 0 ? toRate / fromRate : 0;
  const usedRate = rateOverride.trim() !== "" && Number(rateOverride) > 0
    ? Number(rateOverride)
    : guideRate;
  const amount = Number(amountText) || 0;
  const result = amount * usedRate;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const pickFrom = (code: string) => {
    setFrom(code);
    setRateOverride("");
  };
  const pickTo = (code: string) => {
    setTo(code);
    setRateOverride("");
  };
  const currencyOptions = (id: string) =>
    FX_CURRENCIES.map((c) => (
      <option key={`${id}-${c.code}`} value={c.code}>
        {FX_FLAGS[c.code] ? `${FX_FLAGS[c.code]} ` : ""}{c.code}, {c.label}
      </option>
    ));
  const pickerCls =
    "shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-display text-base font-bold text-[var(--text)] shadow-sm";
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="font-display text-xl font-extrabold text-[var(--text)]">
          Fee converter
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          What the fee means in your money. Type, and the answer updates as
          you type, no button to press.
        </p>
      </div>
      <div className="p-5 sm:p-6">
        <div className="relative">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="fx-amount" className="block text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                Amount
              </label>
              <input id="fx-amount" type="number" min={0} step="any" inputMode="decimal"
                className="w-full min-w-0 bg-transparent font-display text-3xl font-extrabold text-[var(--text)] outline-none"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="fx-from" className="sr-only">From currency</label>
              <select id="fx-from" className={pickerCls} value={from}
                onChange={(e) => pickFrom(e.target.value)}>
                {currencyOptions("from")}
              </select>
            </div>
          </div>
          <div className="relative z-10 -my-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                pickFrom(to);
                pickTo(from);
              }}
              aria-label="Swap the two currencies"
              title="Swap the two currencies"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: "#0a2a5e", border: "2px solid #d9a821" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                <path d="M7 4v13M7 4L4 7m3-3 3 3M17 20V7m0 13 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div
            className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3"
            style={{ borderColor: "#d9a821", backgroundColor: "var(--gold-soft)" }}
          >
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                Converted amount
              </p>
              <p className="truncate font-display text-3xl font-extrabold text-[var(--text)]">
                {fmt(result)}
              </p>
              <p className="text-sm font-semibold text-[var(--dim)]">
                {fmt(amount)} {from} in {FX_CURRENCIES.find((c) => c.code === to)?.label ?? to}
              </p>
            </div>
            <div>
              <label htmlFor="fx-to" className="sr-only">To currency</label>
              <select id="fx-to" className={pickerCls} value={to}
                onChange={(e) => pickTo(e.target.value)}>
                {currencyOptions("to")}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-center text-sm text-[var(--dim)]">
          <p>
            Rate used: <strong className="text-[var(--text)]">1 {from} = {usedRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}</strong>
            {rateOverride.trim() !== "" && Number(rateOverride) > 0
              ? " (the rate you typed)"
              : " (guide rate)"}
            {usedRate > 0
              ? <> · 1 {to} = {(1 / usedRate).toLocaleString(undefined, { maximumFractionDigits: 4 })} {from}</>
              : null}
          </p>
          <p>
            {feeUsd
              ? <>PortaGov fee for this service: <strong className="text-[var(--text)]">${feeUsd} USD</strong>. This converter adds no fee of its own.</>
              : "This converter adds no fee of its own. PortaGov fees are charged in US dollars."}
          </p>
          <p className="text-xs">
            Guide rates help you plan; the rate on the day you pay is the one
            that counts.
          </p>
        </div>
        <details className="mt-3 text-center">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">
            Use a different rate
          </summary>
          <div className="mx-auto mt-2 max-w-xs text-left">
            <FieldLabel htmlFor="fx-rate">Your rate: 1 {from} equals how many {to}?</FieldLabel>
            <input id="fx-rate" type="number" min={0} step="any" inputMode="decimal"
              className={inputCls} value={rateOverride}
              onChange={(e) => setRateOverride(e.target.value)}
              placeholder={guideRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
            <p className="mt-1 text-xs text-[var(--dim)]">
              If your bank or money service quotes you another rate, type it
              here and the answer updates at once.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ---------- embassy directory page ---------- */

function EmbassiesPage() {
  const [country, setCountry] = useState("All countries");
  const [flippedName, setFlippedName] = useState("");
  const countries = [...new Set(EMBASSY_DIRECTORY.map((e) => e.country))].sort();
  const list = EMBASSY_DIRECTORY.filter(
    (e) => country === "All countries" || e.country === country,
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Liberian embassies around the world
      </h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-[var(--dim)]">
        Liberians live in every country, and PortaGov works in all of them.
        When you apply from abroad and choose embassy delivery, your document
        goes to the embassy for your country, and the embassy follows your
        application in its own PortaGov space: status, documents, and
        collection or delivery details, so it can help you where you live.
        Hours below are the directory guide; the embassy confirms the exact
        collection time inside your application.
      </p>
      <div className="mt-5 max-w-sm">
        <FieldLabel htmlFor="emb-filter">Country</FieldLabel>
        <select id="emb-filter" className={inputCls} value={country}
          onChange={(e) => setCountry(e.target.value)}>
          <option>All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {list.map((e) => {
          const flipped = flippedName === e.name;
          const toggle = () => setFlippedName(flipped ? "" : e.name);
          return (
            <div
              key={e.name}
              className="h-80 cursor-pointer [perspective:1200px]"
              onClick={toggle}
            >
              <div
                className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
                style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* Front: only the embassy and its country. */}
                <div className="absolute inset-0 flex flex-col justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                    Embassy
                  </p>
                  <p className="mt-2 font-display text-xl font-bold leading-snug text-[var(--text)]">
                    {e.name}
                  </p>
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    {e.city}, {e.country}
                  </p>
                  <button
                    type="button"
                    aria-expanded={flipped}
                    aria-label={`Flip the card for ${e.name} to read its details`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggle();
                    }}
                    className="mt-4 self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]"
                  >
                    Tap the card to flip it and read more
                  </button>
                </div>
                {/* Back: everything else, to read through. */}
                <div className="absolute inset-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-base font-bold text-[var(--text)]">{e.name}</p>
                    <button
                      type="button"
                      aria-label={`Flip the card for ${e.name} back to the front`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggle();
                      }}
                      className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]"
                    >
                      Flip back
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text)]">
                    <strong>Hours:</strong> {e.hours}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    <strong>Can collect or deliver:</strong> {e.collects.join(", ")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                    <strong>Contact:</strong> {e.contact}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-[var(--accent)]">
                    Tap the card again to flip it back to the front.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <CurrencyConverter />
      </div>
    </div>
  );
}

/* ---------- public dashboard (no private data) ---------- */

function PublicDashboardPage() {
  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => api.getPublicStats({}),
  });
  const d = stats.data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        PortaGov in numbers
      </h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-[var(--dim)]">
        Public numbers only. No names, no personal details, nothing private:
        how many applications moved, how fast each ministry works, and how
        many services were completed. This is how citizens and government
        hold PortaGov and the institutions to account.
      </p>
      {stats.isPending ? (
        <p className="mt-6 text-[var(--dim)]">Loading the numbers...</p>
      ) : d ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl p-6 text-white" style={{ backgroundColor: "#0a2a5e" }}>
              <p className="font-display text-4xl font-extrabold">{d.applications_this_month}</p>
              <p className="mt-1 text-sm text-white/85">
                Applications in {d.month_label}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="font-display text-4xl font-extrabold text-[var(--text)]">{d.completions}</p>
              <p className="mt-1 text-sm text-[var(--dim)]">Services completed in total</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="font-display text-4xl font-extrabold text-[var(--text)]">{d.total_applications}</p>
              <p className="mt-1 text-sm text-[var(--dim)]">Applications since PortaGov opened</p>
            </div>
          </div>
          <div className="mt-8">
            <SectionTitle sub="Average days from application to completion, per ministry or agency. Shorter is faster.">
              Speed per ministry
            </SectionTitle>
            <div className="space-y-3">
              {d.institutions.length > 0 ? (
                d.institutions.map((i) => (
                  <div key={i.institution} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="font-display font-bold text-[var(--text)]">{i.institution}</p>
                    <p className="text-sm text-[var(--dim)]">
                      {i.applications} applications, {i.completed} completed
                      {i.completed > 0 ? `, average ${i.avg_days} days` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--dim)]">
                  No applications yet. The numbers appear here as citizens apply.
                </p>
              )}
            </div>
          </div>
          <LeaderboardSection />
        </>
      ) : (
        <p className="mt-6 text-[var(--dim)]">The numbers could not load. Try again.</p>
      )}
    </div>
  );
}

/* ---------- officer training page ---------- */

const TRAINING_LESSONS = [
  {
    title: "Lesson 1: How release works",
    steps: [
      "A citizen submits to PortaGov first. Your institution sees nothing at that stage.",
      "PortaGov checks the documents. When the billing number is confirmed paid, PortaGov releases the application to you.",
      "Released applications land in your institution inbox. If PortaGov recalls one, it leaves your inbox and returns to PortaGov review.",
      "Never ask a citizen to restart or to pay again: the tracking number and billing number follow the application everywhere.",
    ],
  },
  {
    title: "Lesson 2: Updating the citizen",
    steps: [
      "Open the application in your inbox and set its status as work moves: Received, In review, Appointment set, Ready for collection, Completed.",
      "Add a plain note the citizen can understand. The citizen sees it under the same tracking number, with the date.",
      "Use the direct message form to tell the citizen the way forward and the pickup time. After release, you speak to the citizen directly; PortaGov only tracks.",
      "Ready for collection sends the citizen a pickup code by SMS. They show the code when they collect.",
    ],
  },
  {
    title: "Lesson 3: The embassy space",
    steps: [
      "Diaspora applications are linked to the Liberian embassy in the citizen's country.",
      "Post status, document, and collection or delivery updates in the embassy space on the application. The embassy and the citizen both see them.",
      "If the embassy will hand over the document, say who receives it and when, in the embassy space and the message thread.",
    ],
  },
  {
    title: "Lesson 4: Video verification and trust",
    steps: [
      "When you must check a document face to face, request a video verification call inside PortaGov and set a time. Never use a personal number.",
      "Citizens rate your speed and clarity after service. Your trust score is public to the platform: answer fast, write clearly, keep times you promise.",
      "If you lose connection, use the offline backup on the institution page: download the queue, work from it, and the portal syncs when you are back.",
    ],
  },
];

function TrainingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Training for institution officers
      </h1>
      <p className="mt-2 leading-relaxed text-[var(--dim)]">
        Short lessons for officers who work the institution portal: release,
        messaging citizens, the embassy space, video verification, and your
        trust score. Each lesson takes about two minutes. Voice notes for
        citizens are on the Help page.
      </p>
      <div className="mt-6 space-y-4">
        {TRAINING_LESSONS.map((l) => (
          <div key={l.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-display text-lg font-bold text-[var(--text)]">{l.title}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--dim)]">
              {l.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- near me: centres, embassies, payment points ---------- */

function mapsSearchUrl(label: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
}
function mapsDirectionsUrl(label: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`;
}

function NearMePage() {
  const [county, setCounty] = useState("Montserrado");
  const [abroadCountry, setAbroadCountry] = useState("");
  const centres = OFFICES.filter(
    (o) => county === "Montserrado" ? o.includes("Monrovia") : o.includes(county),
  );
  const centreList = centres.length > 0 ? centres : OFFICES.slice(0, 5);
  const embassy = EMBASSY_DIRECTORY.find((e) => e.country === abroadCountry);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Near me: service centres, embassies, payment points
      </h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-[var(--dim)]">
        Find the closest PortaGov service centre in your county, the Liberian
        embassy for your country when you are abroad, and where to pay. Tap
        Directions to open the way in your maps app.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="near-county">Your county in Liberia</FieldLabel>
          <select id="near-county" className={inputCls} value={county}
            onChange={(e) => setCounty(e.target.value)}>
            {COUNTIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="near-abroad">Or your country abroad (diaspora)</FieldLabel>
          <select id="near-abroad" className={inputCls} value={abroadCountry}
            onChange={(e) => setAbroadCountry(e.target.value)}>
            <option value="">I am in Liberia</option>
            {[...new Set(EMBASSY_DIRECTORY.map((e) => e.country))].sort().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle sub={`Hours: ${SERVICE_CENTRE_HOURS} Book on your application page to skip the queue.`}>
          Service centres for {county}
        </SectionTitle>
        <div className="space-y-3">
          {centreList.map((o) => (
            <div key={o} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div>
                <p className="font-display font-bold text-[var(--text)]">{o}</p>
                <p className="text-sm text-[var(--dim)]">{SERVICE_CENTRE_HOURS}</p>
              </div>
              <div className="flex gap-2">
                <a href={mapsDirectionsUrl(o)} target="_blank" rel="noopener"
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: "#0a2a5e" }}>
                  Directions
                </a>
                <a href={mapsSearchUrl(o)} target="_blank" rel="noopener"
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]">
                  Open in maps
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {embassy ? (
        <div className="mt-8">
          <SectionTitle>Your embassy abroad</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div>
              <p className="font-display font-bold text-[var(--text)]">{embassy.name}</p>
              <p className="text-sm text-[var(--dim)]">
                {embassy.city}, {embassy.country}. Hours: {embassy.hours}. Collects:{" "}
                {embassy.collects.join(", ")}.
              </p>
            </div>
            <a href={mapsDirectionsUrl(`${embassy.name}, ${embassy.city}`)} target="_blank" rel="noopener"
              className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: "#0a2a5e" }}>
              Directions
            </a>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <SectionTitle sub="You never travel to pay. Quote your billing number at any agent, or pay from your own phone.">
          Payment points
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["MTN MoMo agent points", `Any MTN MoMo agent in ${county} or anywhere in Liberia can take your payment against your billing number.`],
            ["Orange Money agent points", `Any Orange Money agent in ${county} or anywhere in Liberia can take your payment against your billing number.`],
          ].map(([t = "", d = ""]) => (
            <div key={t} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="font-display font-bold text-[var(--text)]">{t}</p>
              <p className="mt-1 text-sm text-[var(--dim)]">{d}</p>
              <a href={mapsSearchUrl(`${t.replace(" points", "")} agent, ${county}, Liberia`)}
                target="_blank" rel="noopener"
                className="mt-2 inline-block text-sm font-bold underline" style={{ color: "#0a2a5e" }}>
                Find one near you
              </a>
            </div>
          ))}
        </div>
        <FraudWarning />
      </div>
    </div>
  );
}

/* ---------- USSD menu for basic phones (same live data) ---------- */

function UssdPanel({ profile }: { profile: ProfileT | null }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [hint, setHint] = useState("");
  const track = useMutation({
    mutationFn: async () =>
      await api.trackApplication({
        profileId: profile?.id ?? 0,
        reference: reference.trim(),
        phone: phone.trim(),
      }),
  });
  const app = track.data?.application ?? null;
  return (
    <div className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Basic phones: the USSD menu
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        On a basic phone with no internet, the PortaGov USSD menu lets
        members check their own application status and billing number. The
        menu asks for your tracking number and the phone number on your
        application, exactly like this working preview. The short code is
        being activated with MTN and Orange for Liberia; until it is live,
        this preview and any smartphone show the same live answers.
        {profile
          ? ""
          : " You are not signed in, so this preview cannot show any status: sign in or create an account first, just like on the Track page."}
      </p>
      <div className="mx-auto mt-4 max-w-xs rounded-2xl border-4 border-[var(--text)] bg-[var(--surface-alt)] p-4 font-mono text-sm">
        <p className="font-bold text-[var(--text)]">PortaGov USSD</p>
        <p className="mt-1 text-[var(--dim)]">1. Check application status</p>
        <p className="text-[var(--dim)]">2. See my billing number</p>
        <div className="mt-3 space-y-2">
          <input aria-label="USSD tracking number" {...FIELDS.trackApplication.reference} className={`${inputCls} font-sans`}
            value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Tracking number, PG-2026-00001" />
          <input aria-label="USSD phone number" {...FIELDS.trackApplication.phone} className={`${inputCls} font-sans`}
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone on the application" />
          <PrimaryButton
            onClick={() => {
              setHint("");
              if (!profile) {
                setHint("Tracking is for PortaGov members only. Sign in or create an account first, then dial.");
                return;
              }
              if (!reference.trim() || !phone.trim()) {
                setHint("Type both your tracking number and the phone number on your application, then dial.");
                return;
              }
              track.mutate();
            }}
            disabled={track.isPending}
          >
            {track.isPending ? "Checking..." : "Dial (preview)"}
          </PrimaryButton>
          {hint ? (
            <p role="alert" className="rounded bg-[var(--gold-soft)] p-2 font-sans text-sm font-semibold text-[var(--warn)]">
              {hint}
            </p>
          ) : null}
        </div>
        {track.isSuccess ? (
          app ? (
            <div className="mt-3 rounded bg-[var(--surface)] p-3 font-sans text-sm text-[var(--text)]">
              <p><strong>{app.service_name}</strong></p>
              <p>Status: {app.status}, {applicationStatusPlain(app.status).short}. {applicationStatusPlain(app.status).meaning}</p>
              <p>
                Billing number: {app.billing_number} ({app.billing_status}
                {app.total_due > 0 ? `, $${app.total_due}` : ""})
              </p>
            </div>
          ) : (
            <p role="alert" className="mt-3 rounded bg-[var(--gold-soft)] p-3 font-sans text-sm font-semibold text-[var(--warn)]">
              No application matches that tracking number and phone together.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}

/* ---------- video verification calls inside PortaGov ---------- */

type VideoCallT = ApiResponse<typeof api, "listVideoCalls">["calls"][number];

function VideoCallPanel({
  app,
  asInstitution,
}: {
  app: ApplicationT;
  asInstitution?: boolean;
}) {
  const queryClient = useQueryClient();
  const calls = useQuery({
    queryKey: ["video-calls", app.id],
    queryFn: () => api.listVideoCalls({ applicationId: app.id }),
  });
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const request = useMutation({
    mutationFn: async () =>
      await api.requestVideoCall({
        applicationId: app.id,
        requestedBy: asInstitution ? "Institution" : "Citizen",
        scheduledAt: when,
        note,
      }),
    onSuccess: () => {
      setWhen("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["video-calls"] });
    },
  });
  const update = useMutation({
    mutationFn: async (v: { id: number; status: "Scheduled" | "Done" | "Missed"; scheduledAt: string }) =>
      await api.updateVideoCall(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["video-calls"] }),
  });
  const list = calls.data?.calls ?? [];
  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Video verification call
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        When {app.institution} must check a document face to face, the call
        happens inside PortaGov at a set time, never on anybody's personal
        number. Join from this page when the time comes.
      </p>
      <div className="mt-3 space-y-2">
        {list.map((c: VideoCallT) => (
          <div key={c.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="text-[var(--text)]">
              <strong>{c.status}</strong>, asked by {c.requested_by}
              {c.scheduled_at ? `, at ${c.scheduled_at}` : ", no time set yet"}
              {c.note ? `. ${c.note}` : ""}
            </p>
            {asInstitution ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <GhostButton onClick={() => update.mutate({ id: c.id, status: "Done", scheduledAt: c.scheduled_at })}>
                  Mark done
                </GhostButton>
                <GhostButton onClick={() => update.mutate({ id: c.id, status: "Missed", scheduledAt: c.scheduled_at })}>
                  Mark missed
                </GhostButton>
              </div>
            ) : c.status === "Scheduled" ? (
              <p className="mt-1 font-semibold text-[var(--text)]">
                Be on this page a few minutes before {c.scheduled_at}. Your
                officer starts the call here.
              </p>
            ) : null}
          </div>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No video call on this application yet.</p>
        ) : null}
      </div>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          request.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor={`vc-when-${app.id}`}>
            {asInstitution ? "Set a time (date and hour)" : "Ask for a call, suggest a time"}
          </FieldLabel>
          <input id={`vc-when-${app.id}`} {...FIELDS.requestVideoCall.scheduledAt} className={inputCls} value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="Friday 10:00 AM" />
        </div>
        <div>
          <FieldLabel htmlFor={`vc-note-${app.id}`}>What must be checked?</FieldLabel>
          <input id={`vc-note-${app.id}`} {...FIELDS.requestVideoCall.note} className={inputCls} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: show the original birth certificate" />
        </div>
        <PrimaryButton type="submit" disabled={request.isPending}>
          {asInstitution ? "Schedule the call" : "Request a call"}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ---------- application tools: payment plan, print at centre, share link ---------- */

function ApplicationTools({
  app,
  profile,
}: {
  app: ApplicationT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const [office, setOffice] = useState(OFFICES[0] ?? "");
  const [printCode, setPrintCode] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const print = useMutation({
    mutationFn: async () =>
      await api.requestPrint({
        applicationId: app.id,
        profileId: profile.id,
        office,
      }),
    onSuccess: (r) => setPrintCode(r.print_code),
  });
  const share = useMutation({
    mutationFn: async () =>
      await api.createShareLink({ applicationId: app.id, profileId: profile.id }),
    onSuccess: (r) => setToken(r.token),
  });
  const revoke = useMutation({
    mutationFn: async () =>
      await api.revokeShareLink({ applicationId: app.id, profileId: profile.id }),
    onSuccess: () => {
      setToken("");
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
  const sharePath = token ? `#/shared/${token}` : "";
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display font-bold text-[var(--text)]">Payment plan</h2>
        {app.payment_plan ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            You are paying in two parts: <strong className="text-[var(--text)]">${app.amount_paid} paid</strong> of{" "}
            ${app.total_due}. The second part, ${app.total_due - app.amount_paid},
            is due before collection. Billing status: {app.billing_status}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--dim)]">
            No payment plan on this application. For expensive services you
            can choose "Pay in two parts" when you apply: the second part is
            due before collection, with no hidden fee.
          </p>
        )}
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display font-bold text-[var(--text)]">Print at a centre</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          No printer at home? Ask the centre to print this application's
          documents, then collect the prints with your code.
        </p>
        <div className="mt-2">
          <FieldLabel htmlFor={`print-office-${app.id}`}>Centre</FieldLabel>
          <select id={`print-office-${app.id}`} className={inputCls} value={office}
            onChange={(e) => setOffice(e.target.value)}>
            {OFFICES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <GhostButton onClick={() => print.mutate()} disabled={print.isPending}>
            Request printing
          </GhostButton>
        </div>
        {printCode ? (
          <p className="mt-2 text-sm font-bold text-[var(--text)]">
            Your print code is {printCode}. Give it at {office}.
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display font-bold text-[var(--text)]">Share my application</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Give a family member or helper a secure link that shows the status
          only. They can change nothing, see no documents and no payments.
          You can cancel the link any time.
        </p>
        {token ? (
          <div className="mt-2 space-y-2">
            <p className="break-all rounded bg-[var(--surface-alt)] p-2 text-sm font-semibold text-[var(--text)]">
              {sharePath}
            </p>
            <div className="flex flex-wrap gap-2">
              <GhostButton
                onClick={() => {
                  void navigator.clipboard?.writeText(sharePath);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy the link ending"}
              </GhostButton>
              <GhostButton onClick={() => revoke.mutate()} disabled={revoke.isPending}>
                Cancel the link
              </GhostButton>
            </div>
            <p className="text-xs text-[var(--dim)]">
              Send the person this ending together with the PortaGov address
              you are using, so their browser opens your shared status page.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <GhostButton onClick={() => share.mutate()} disabled={share.isPending}>
              Create a view-only link
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- shared application page (view only) ---------- */

function SharedPage({ token }: { token: string }) {
  const shared = useQuery({
    queryKey: ["shared", token],
    queryFn: () => api.getSharedApplication({ token }),
  });
  const d = shared.data;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Shared application status
      </h1>
      <p className="mt-1 text-[var(--dim)]">
        The owner of this application shared its status with you. This page
        is view only: nothing here can be changed.
      </p>
      {shared.isPending ? (
        <p className="mt-5 text-[var(--dim)]">Loading...</p>
      ) : d?.found ? (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-display text-lg font-bold text-[var(--text)]">
            {d.service_name}, for {d.first_name}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {d.institution}, tracking number {d.reference}
          </p>
          <p className="mt-2">
            <Chip tone="gold">{d.status}</Chip>
          </p>
          <ol className="mt-4 space-y-2">
            {d.events.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-2 text-sm">
                <span className="font-semibold text-[var(--text)]">{e.status}</span>
                <span className="text-[var(--dim)]">{fmtDateTime(e.created_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p role="alert" className="mt-5 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          This link does not work. The owner may have cancelled it. Ask them
          for a fresh link.
        </p>
      )}
    </div>
  );
}

/* ---------- lost documents: report and replacement ---------- */

const REPLACEMENT_FOR: Record<string, string> = {
  Passport: "passport-renewal",
  "National ID card": "national-id-replacement",
  "Driver licence": "driver-licence-renewal",
  "Business registration certificate": "business-renewal",
};

function LostDocumentsPanel({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["lost-reports", profile.id],
    queryFn: () => api.listLostReports({ profileId: profile.id }),
  });
  const [docType, setDocType] = useState("Passport");
  const [docNumber, setDocNumber] = useState("");
  const [details, setDetails] = useState("");
  const [issued, setIssued] = useState("");
  const report = useMutation({
    mutationFn: async () =>
      await api.reportLostDocument({
        profileId: profile.id,
        docType,
        docNumber,
        details,
      }),
    onSuccess: (r) => {
      setIssued(r.reference);
      setDocNumber("");
      setDetails("");
      void queryClient.invalidateQueries({ queryKey: ["lost-reports"] });
    },
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Lost a document? Report it here
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Reporting takes one minute and gives you a lost-document reference
        number. The reference protects you if someone tries to use your
        document, and the replacement application uses it. Wrong name on a
        document instead? Use the{" "}
        <a href="#/service/name-correction" className="font-semibold underline">
          Name correction service
        </a>
        .
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          report.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="lost-type">What did you lose?</FieldLabel>
          <select id="lost-type" className={inputCls} value={docType}
            onChange={(e) => setDocType(e.target.value)}>
            {Object.keys(REPLACEMENT_FOR).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="Birth certificate">Birth certificate</option>
            <option value="Other document">Other document</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="lost-num">Its number, if you know it</FieldLabel>
          <input id="lost-num" {...FIELDS.reportLostDocument.docNumber} className={inputCls} value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="lost-details">When and where did you lose it?</FieldLabel>
          <input id="lost-details" {...FIELDS.reportLostDocument.details} className={inputCls} value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="For example: lost in a taxi in Monrovia last week" />
        </div>
        <div>
          <PrimaryButton type="submit" disabled={report.isPending}>
            Report it lost
          </PrimaryButton>
        </div>
      </form>
      {issued ? (
        <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-bold text-[var(--text)]">
          Reported. Your lost-document reference is {issued}. Keep it safe
          and quote it in your replacement application.
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        {(reports.data?.reports ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <span className="text-[var(--text)]">
              <strong>{r.doc_type}</strong>, reference {r.reference}, reported{" "}
              {fmtDate(r.created_at)}, status {r.status}
            </span>
            {REPLACEMENT_FOR[r.doc_type] ? (
              <a href={`#/service/${REPLACEMENT_FOR[r.doc_type]}`}
                className="font-bold underline" style={{ color: "#0a2a5e" }}>
                Start the replacement
              </a>
            ) : (
              <a href="#/service/birth-certificate" className="font-bold underline" style={{ color: "#0a2a5e" }}>
                Apply for a new one
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- bulk applications (schools, guardians, businesses) ---------- */

function BulkApplicationsPanel({
  profile,
  businessId,
  bulkLabel,
}: {
  profile: ProfileT;
  businessId?: number;
  bulkLabel: string;
}) {
  const [serviceId, setServiceId] = useState("birth-certificate");
  const [lines, setLines] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const service = serviceById(serviceId);
  const run = async () => {
    setError("");
    setResults([]);
    if (!service) return;
    const people = lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, dob] = l.split(",").map((x) => x.trim());
        return { name: name ?? "", dob: dob ?? "" };
      })
      .filter((p) => p.name.length >= 2);
    if (people.length === 0) {
      setError("Write at least one person, one per line: Full name, year-month-day of birth.");
      return;
    }
    if (people.length > 30) {
      setError("Thirty people at a time, please. Split bigger lists into groups of thirty.");
      return;
    }
    setBusy(true);
    const details = serviceDetails(service.id);
    const out: string[] = [];
    for (const person of people) {
      try {
        const r = await api.submitApplication({
          profileId: profile.id,
          serviceId: service.id,
          serviceName: service.name,
          institution: ministryById(service.ministryId).name,
          channel: "Self service",
          onBehalfOf: person.name,
          priority: "Standard",
          priorityFee: 0,
          serviceFee: details.feeUsd,
          collectionChoice: "",
          embassy: "",
          deliveryFee: 0,
          diasporaCountry: "",
          agentName: "",
          notes: "",
          businessId: businessId ?? 0,
          paymentPlan: false,
          details: [
            ...(person.dob
              ? [{ label: "Date of birth", value: person.dob }]
              : []),
            { label: "Filed in bulk by", value: bulkLabel },
          ],
          documentIds: [],
        });
        out.push(`${person.name}: tracking ${r.application.reference}`);
      } catch (e) {
        out.push(
          `${person.name}: not filed, ${e instanceof Error ? e.message : "try again"}`,
        );
      }
      setResults([...out]);
    }
    setBusy(false);
  };
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Bulk applications: many people at once
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Schools file birth certificates for a whole class, guardians file
        for several children, and businesses file for staff, all in one go.
        One line per person: full name, then date of birth. Every person
        gets their own tracking number, and each application is checked by
        PortaGov like any other. Documents for each person can be attached
        from the wallet on the person's own application page afterwards.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="bulk-service">Service</FieldLabel>
          <select id="bulk-service" className={inputCls} value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}>
            {SERVICES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <FieldLabel htmlFor="bulk-lines">People, one per line</FieldLabel>
        <textarea id="bulk-lines" className={inputCls} rows={6} value={lines}
          onChange={(e) => setLines(e.target.value)}
          placeholder={"Musu Kamara, 2015-04-02\nJames Kollie, 2014-09-18"} />
      </div>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
      <div className="mt-3">
        <PrimaryButton onClick={() => void run()} disabled={busy}>
          {busy ? "Filing..." : "File all applications"}
        </PrimaryButton>
      </div>
      {results.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-[var(--text)]">
          {results.map((r) => (
            <li key={r} className="rounded bg-[var(--surface-alt)] p-2">{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- my government year summary ---------- */

function YearlySummary({ profile }: { profile: ProfileT }) {
  const year = new Date().getFullYear();
  const summary = useQuery({
    queryKey: ["yearly", profile.id, year],
    queryFn: () => api.getYearlySummary({ profileId: profile.id, year }),
  });
  const d = summary.data;
  if (summary.isPending || !d) return null;
  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-xl font-bold text-[var(--text)]">
        Your {year} with government
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          <strong className="font-display text-2xl">{d.applications_count}</strong>
          <br />applications this year
        </p>
        <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          <strong className="font-display text-2xl">{d.completed}</strong>
          <br />services completed
        </p>
        <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          <strong className="font-display text-2xl">${d.total_paid}</strong>
          <br />paid through PortaGov
        </p>
      </div>
      {d.by_service.length > 0 ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          Services used: {d.by_service.map((s) => `${s.service} (${s.count})`).join(", ")}.
        </p>
      ) : null}
      {d.expiring_soon.length > 0 ? (
        <p className="mt-2 text-sm font-semibold text-[var(--warn)]">
          Expiring within 90 days:{" "}
          {d.expiring_soon.map((x) => `${x.title} (${x.expires_on})`).join(", ")}.
          Renew from your wallet reminders.
        </p>
      ) : null}
    </div>
  );
}

/* ---------- emergency and disaster banner ---------- */

function EmergencyBanner() {
  const posts = useQuery({
    queryKey: ["announcements", "urgent"],
    queryFn: () => api.listAnnouncements({ ministry: "", limit: 50 }),
  });
  const urgent = (posts.data?.announcements ?? []).filter((a) => a.urgent);
  if (urgent.length === 0) return null;
  const first = urgent[0];
  if (!first) return null;
  return (
    <div role="alert" className="text-white" style={{ backgroundColor: "#b91c1c" }}>
      <div className="mx-auto max-w-6xl px-4 py-3">
        <p className="font-display font-extrabold uppercase tracking-wide">
          Emergency notice: {first.title}
        </p>
        <p className="text-sm text-white/90">
          {first.body} ({first.ministry}, {fmtDate(first.created_at)})
        </p>
      </div>
    </div>
  );
}

/* ---------- institution reports strip ---------- */

function InstitutionReports({ institution }: { institution: string }) {
  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => api.getPublicStats({}),
  });
  const mine = stats.data?.institutions.find((i) => i.institution === institution);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Your numbers and trust score
      </h2>
      <div className="mt-2">
        <TrustBadge institution={institution} />
      </div>
      {mine ? (
        <p className="mt-2 text-sm text-[var(--dim)]">
          {mine.applications} applications received, {mine.completed} completed
          {mine.completed > 0
            ? `, average processing time ${mine.avg_days} days from application to completion`
            : ""}
          . The platform's weekly government report carries the full picture
          for every ministry.
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--dim)]">
          No released applications for this institution yet, so there are no
          processing times to show.
        </p>
      )}
    </div>
  );
}

/* ---------- daily summary for one institution ---------- */

/** Today's numbers for one institution only, counted from its real
    applications for today: how many came in, how many were finished,
    and how many are still waiting. Finished means completed today.
    Still waiting means released to the institution and not finished
    yet. The date is shown, so yesterday's numbers are never mistaken
    for today's. */
function InstitutionDailySummary({ institution }: { institution: string }) {
  const s = useQuery({
    queryKey: ["institution-daily-summary", institution],
    queryFn: () => api.getInstitutionDailySummary({ institution }),
  });
  const d = s.data;
  return (
    <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
      <h2 className="font-display text-lg font-bold">Today at {institution}</h2>
      <p className="text-sm text-white/85">{d?.date_label ?? "Loading..."}</p>
      {d ? (
        <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            [`${d.came_in_today}`, "came in today"],
            [`${d.finished_today}`, "finished today"],
            [`${d.still_waiting}`, "still waiting"],
            [`${d.ready_for_collection}`, "ready for collection"],
          ].map(([n, label]) => (
            <div key={label} className="rounded-lg bg-white/10 p-3">
              <p className="font-display text-2xl font-extrabold" style={{ color: "#d9a821" }}>{n}</p>
              <p className="text-xs text-white/85">{label}</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm text-white/85">
        Came in counts applications submitted today. Finished counts
        applications completed today. Still waiting counts applications
        already released to this institution that are not finished yet.
      </p>
    </div>
  );
}

/* ---------- institution staff roster ---------- */

function StaffPanel({ institution }: { institution: string }) {
  const queryClient = useQueryClient();
  const staff = useQuery({
    queryKey: ["staff", institution],
    queryFn: () => api.listStaff({ institution }),
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState("Receiving officer");
  const [phone, setPhone] = useState("");
  const add = useMutation({
    mutationFn: async () =>
      await api.addStaff({ institution, name, role, phone }),
    onSuccess: () => {
      setName("");
      setPhone("");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Staff and roles: {institution}
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        The officers who work this desk and what each one is responsible
        for. Keep the roster true: citizens and the platform judge the
        institution by the people named here.
      </p>
      <ul className="mt-3 space-y-2">
        {(staff.data?.staff ?? []).map((s) => (
          <li key={s.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            <strong>{s.name}</strong>, {s.role}
            {s.phone ? `, ${s.phone}` : ""}
          </li>
        ))}
        {(staff.data?.staff ?? []).length === 0 ? (
          <li className="text-sm text-[var(--dim)]">No staff on the roster yet.</li>
        ) : null}
      </ul>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="staff-name">Officer name</FieldLabel>
          <input id="staff-name" {...FIELDS.addStaff.name} className={inputCls} value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="staff-role">Role</FieldLabel>
          <select id="staff-role" className={inputCls} value={role}
            onChange={(e) => setRole(e.target.value)}>
            <option>Receiving officer</option>
            <option>Reviewing officer</option>
            <option>Embassy liaison</option>
            <option>Supervisor</option>
            <option>Head of institution desk</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="staff-phone">Phone</FieldLabel>
          <input id="staff-phone" {...FIELDS.addStaff.phone} className={inputCls} value={phone}
            onChange={(e) => setPhone(e.target.value)} />
        </div>
        <PrimaryButton type="submit" disabled={add.isPending}>
          Add officer
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ---------- favourites (remembered on this device) ---------- */

function favouriteIds(profileId: number): string[] {
  try {
    const raw = storage.get(`portagov-favs-${profileId}`);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function FavouriteStar({
  profile,
  serviceId,
}: {
  profile: ProfileT;
  serviceId: string;
}) {
  const [favs, setFavs] = useState<string[]>(() => favouriteIds(profile.id));
  const isFav = favs.includes(serviceId);
  return (
    <button
      type="button"
      aria-label={isFav ? "Remove from my favourites" : "Add to my favourites"}
      aria-pressed={isFav}
      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-bold"
      style={isFav ? { backgroundColor: "#d9a821", color: "#0a2a5e" } : { color: "var(--text)" }}
      onClick={() => {
        const next = isFav
          ? favs.filter((f) => f !== serviceId)
          : [...favs, serviceId];
        setFavs(next);
        storage.set(
          `portagov-favs-${profile.id}`,
          JSON.stringify(next),
        );
      }}
    >
      {isFav ? "★ Favourite" : "☆ Add to favourites"}
    </button>
  );
}

function FavouritesSection({ profile }: { profile: ProfileT }) {
  const [favs] = useState<string[]>(() => favouriteIds(profile.id));
  const list = SERVICES.filter((s) => favs.includes(s.id));
  if (list.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">My favourites</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <a key={s.id} href={`#/service/${s.id}`}
            className="rounded-lg bg-[var(--surface-alt)] p-3">
            <p className="font-display font-bold text-[var(--text)]">{s.name}</p>
            <p className="text-sm text-[var(--dim)]">{s.blurb}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------- inbox: SMS, WhatsApp and email in one place, one thread per application ---------- */

function InboxPanel({ profile }: { profile: ProfileT }) {
  const msgs = useQuery({
    queryKey: ["messages", profile.id],
    queryFn: () => api.listMessages({ profileId: profile.id }),
  });
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const all = msgs.data?.messages ?? [];
  const byApp = new Map<number, MessageT[]>();
  const general: MessageT[] = [];
  const seen = new Set<string>();
  for (const m of all) {
    const key = `${m.application_id}|${m.kind}|${m.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (m.application_id) {
      const arr = byApp.get(m.application_id) ?? [];
      arr.push(m);
      byApp.set(m.application_id, arr);
    } else {
      general.push(m);
    }
  }
  const refFor = (id: number) =>
    (apps.data?.applications ?? []).find((a: ApplicationT) => a.id === id);
  const threadBlock = (title: string, list: MessageT[], appId?: number) => (
    <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display font-bold text-[var(--text)]">{title}</p>
        {appId ? (
          <a href={`#/application/${appId}`} className="text-sm font-bold underline" style={{ color: "#0a2a5e" }}>
            Open the application
          </a>
        ) : null}
      </div>
      <ul className="mt-2 space-y-2">
        {list.slice(0, 8).map((m) => (
          <li key={m.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
              SMS, WhatsApp{m.body ? "" : ""} and email thread, {m.kind},{" "}
              {fmtDateTime(m.created_at)}
            </p>
            <p className="mt-0.5 text-[var(--text)]">{m.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div>
      <SectionTitle sub="Every message PortaGov and your institutions sent you, SMS, WhatsApp and email together, one thread per application. Nothing is scattered.">
        My inbox
      </SectionTitle>
      <div className="space-y-3">
        {[...byApp.entries()].map(([appId, list]) => {
          const app = refFor(appId);
          return threadBlock(
            app
              ? `${app.service_name}, ${app.reference}`
              : `Application ${appId}`,
            list,
            appId,
          );
        })}
        {general.length > 0
          ? threadBlock("General PortaGov messages", general)
          : null}
        {byApp.size === 0 && general.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
            No messages yet. When anything moves on your account or
            applications, the message lands here and on your phone.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- help a neighbour mode (agent helps with the citizen's consent code) ---------- */

function NeighbourMode() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [citizen, setCitizen] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");
  const [serviceId, setServiceId] = useState(SERVICES[0]?.id ?? "");
  const [done, setDone] = useState("");
  const verify = useMutation({
    mutationFn: async () =>
      await api.verifyAgentConsent({ phone: phone.trim(), code: code.trim() }),
    onSuccess: (r) => {
      if (!r.ok) {
        setError("That consent code is not correct, or it has expired. The citizen can make a fresh one in My account.");
        return;
      }
      setCitizen({ id: r.profile_id, name: r.full_name });
      setError("");
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Consent check failed."),
  });
  const submit = useMutation({
    mutationFn: async () => {
      const service = serviceById(serviceId);
      if (!service || !citizen) throw new Error("Choose a service first.");
      const details = serviceDetails(service.id);
      return await api.submitApplication({
        profileId: citizen.id,
        serviceId: service.id,
        serviceName: service.name,
        institution: ministryById(service.ministryId).name,
        channel: "Agent assisted",
        onBehalfOf: "",
        priority: "Standard",
        priorityFee: 0,
        serviceFee: details.feeUsd,
        collectionChoice: "",
        embassy: "",
        deliveryFee: 0,
        diasporaCountry: "",
        agentName,
        notes: "",
        businessId: 0,
        paymentPlan: false,
        details: [
          {
            label: "Help a neighbour",
            value: `Started by ${agentName} with the citizen's one-time consent code. The citizen approved this help, and it is recorded.`,
          },
        ],
        documentIds: [],
      });
    },
    onSuccess: (r) => {
      setDone(
        `Filed for ${citizen?.name}. Tracking number ${r.application.reference}. The citizen was notified that you helped, with your name on it. They complete documents and payment under the same tracking number.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["all-apps"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not file. Try again."),
  });
  return (
    <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#d9a821" }}>
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Help a neighbour mode (agents and trusted helpers)
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Helping someone who cannot apply alone? The citizen first makes a
        one-time consent code in My account and reads it to you. You enter
        their phone and the code here. The application is filed under the
        citizen, your name is recorded as the helper, and the citizen is
        told. No code, no access: nobody can apply in another person's name
        quietly.
      </p>
      {!citizen ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            verify.mutate();
          }}
        >
          <div>
            <FieldLabel htmlFor="nb-phone">Citizen's phone number</FieldLabel>
            <input id="nb-phone" {...FIELDS.verifyAgentConsent.phone} className={inputCls} value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="nb-code">Their consent code</FieldLabel>
            <input id="nb-code" {...FIELDS.verifyAgentConsent.code} className={inputCls} value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="6 numbers" inputMode="numeric" />
          </div>
          <div>
            <FieldLabel htmlFor="nb-agent">Your name (the helper)</FieldLabel>
            <input id="nb-agent" {...FIELDS.submitApplication.agentName} className={inputCls} value={agentName}
              onChange={(e) => setAgentName(e.target.value)} />
          </div>
          <PrimaryButton type="submit" disabled={verify.isPending}>
            Check consent
          </PrimaryButton>
        </form>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
            Consent confirmed: you are helping {citizen.name}. This help is
            recorded with your name, {agentName || "helper"}.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <FieldLabel htmlFor="nb-service">Service they need</FieldLabel>
              <select id="nb-service" className={inputCls} value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}>
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <PrimaryButton onClick={() => submit.mutate()} disabled={submit.isPending}>
              Start their application
            </PrimaryButton>
          </div>
          {done ? (
            <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
              {done}
            </p>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConsentCodeMaker({ profile }: { profile: ProfileT }) {
  const [code, setCode] = useState("");
  const make = useMutation({
    mutationFn: async () => await api.createConsentCode({ profileId: profile.id }),
    onSuccess: (r) => setCode(r.demo_code),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Let someone help you apply
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        If an agent, a family member, or a trusted person will apply for
        you, make a one-time consent code and read it to them. They can only
        help with this code, their name is recorded, and you are told what
        they filed. In this build the code is shown here; on the live
        network it also arrives by SMS.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={() => make.mutate()} disabled={make.isPending}>
          Make my consent code
        </PrimaryButton>
        {code ? (
          <p className="font-display text-2xl font-extrabold tracking-widest text-[var(--text)]">
            {code}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- county leaderboard (public) ---------- */

function LeaderboardSection() {
  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getCountyLeaderboard({}),
  });
  const d = board.data;
  if (board.isPending || !d || d.counties.length === 0) return null;
  return (
    <div className="mt-8">
      <SectionTitle sub="Good work, shown in public: the fastest county, the most trusted ministry, and every county's completions. No private data.">
        Leaderboard for good work
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#d9a821" }}>
            Fastest county
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {d.fastest_county || "No completions yet"}
          </p>
          <p className="text-sm text-white/85">
            The county whose applications finish fastest, on average.
          </p>
        </div>
        <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#d9a821" }}>
          <p className="text-sm font-bold uppercase tracking-widest text-[var(--dim)]">
            Most trusted ministry
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-[var(--text)]">
            {d.most_trusted_ministry || "No ratings yet"}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {d.most_trusted_score > 0
              ? `Trust score ${d.most_trusted_score} out of 100, from citizen ratings of speed and clarity.`
              : "Citizens rate speed and clarity after each service."}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {d.counties.map((c, i) => (
          <div key={c.county} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            <span className="font-display font-bold text-[var(--text)]">
              {i + 1}. {c.county}
            </span>
            <span className="text-[var(--dim)]">
              {c.applications} applications, {c.completed} completed
              {c.completed > 0 ? `, average ${c.avg_days} days` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- refunds inside the wallet ---------- */

function WalletRefunds({ profile }: { profile: ProfileT }) {
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const apps = useQuery({
    queryKey: ["applications", profile.id],
    queryFn: () => api.listApplications({ profileId: profile.id }),
  });
  const myIds = new Set((apps.data?.applications ?? []).map((a: ApplicationT) => a.id));
  const mine = (payments.data?.payments ?? []).filter((p: PaymentT) => myIds.has(p.application_id));
  if (mine.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Refunds from my wallet
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Paid the wrong billing number, or a service was refused? Ask for
        your money back here. Approved refunds go back to the same MTN MoMo
        or Orange Money number you paid from, never to a different number.
      </p>
      <div className="mt-3 space-y-3">
        {mine.map((p: PaymentT) => (
          <div key={p.id} className="rounded-lg bg-[var(--surface-alt)] p-3">
            <p className="text-sm text-[var(--text)]">
              <strong>{p.method}</strong>, ${p.amount}, application{" "}
              {p.application_ref}, paid from {p.payer_phone}, status {p.status}
            </p>
            <RefundRequest payment={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- what happens next + price history (service page) ---------- */

function ServiceJourney({ service }: { service: Service }) {
  const m = ministryById(service.ministryId);
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        What happens next, step by step
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <div>
          <p className="font-display font-bold" style={{ color: "#0a2a5e" }}>You, the citizen</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
            <li>Sign in and start this service. Your saved profile fills the form.</li>
            <li>Finish the checklist: every requirement green, documents attached from your wallet.</li>
            <li>Pay your billing number with MTN MoMo or Orange Money, from any phone.</li>
            <li>Watch the tracking number, answer messages in your application thread, and come in only when told: {service.visitNote}</li>
          </ol>
        </div>
        <div>
          <p className="font-display font-bold" style={{ color: "#0a2a5e" }}>PortaGov</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
            <li>Receives your application first and checks your documents.</li>
            <li>Confirms your payment against the billing number and sends you the confirmation and receipt.</li>
            <li>Releases your application to {m.name} only when the billing number is confirmed paid.</li>
            <li>Keeps tracking your amount paid and tracking number, and updates you at every step.</li>
          </ol>
        </div>
        <div>
          <p className="font-display font-bold" style={{ color: "#0a2a5e" }}>{m.name}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
            <li>Receives your released application and confirms receipt.</li>
            <li>Processes it and updates the status under your tracking number.</li>
            <li>Messages you directly about the way forward and when to collect.</li>
            <li>{service.visitType === "Fully online" ? "Issues the result to your PortaGov account." : "Hands over your document at collection, against your pickup code."}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function PriceHistory({ service }: { service: Service }) {
  const d = serviceDetails(service.id);
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Fee and its history
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        The fee on PortaGov for this service is <strong className="text-[var(--text)]">${d.feeUsd}</strong>.
        Fees live in the PortaGov catalogue, and an institution can set its
        own fee in its portal; when a fee changes, the change, its date, and
        its reason are recorded here, in public.
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--dim)]">
        <li>
          <strong className="text-[var(--text)]">${d.feeUsd}</strong>, set when
          PortaGov opened its catalogue. Reason: the opening catalogue fee
          for {service.name}.
        </li>
      </ul>
    </div>
  );
}

function RealTiming({ serviceId }: { serviceId: string }) {
  const timings = useQuery({
    queryKey: ["service-timings"],
    queryFn: () => api.getServiceTimings({}),
  });
  const mine = timings.data?.timings.find((t) => t.service_id === serviceId);
  const d = serviceDetails(serviceId);
  return (
    <p className="mt-2 text-sm text-[var(--dim)]">
      {mine && mine.completed > 0 ? (
        <>
          Real time from finished applications: people who completed this
          service waited about <strong className="text-[var(--text)]">{mine.avg_days} days</strong> on
          average, across {mine.completed} completed application
          {mine.completed === 1 ? "" : "s"}. The catalogue estimate is{" "}
          {d.processingTime}.
        </>
      ) : (
        <>
          Catalogue estimate: {d.processingTime}. As applications complete,
          the real average time from finished applications is shown here.
        </>
      )}
    </p>
  );
}

/* ---------- voice note reply to the institution ---------- */

function VoiceNoteReply({
  app,
  profile,
}: {
  app: ApplicationT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: async (file: File) => {
      const base = await fileToBase64(file);
      const doc = await api.addDocument({
        profileId: profile.id,
        docType: "Voice note",
        title: `Voice note for ${app.institution}, ${app.reference}`,
        file: {
          dataBase64: base,
          fileName: file.name,
          contentType: file.type || "audio/mpeg",
        },
      });
      await api.replyToInstitution({
        applicationId: app.id,
        profileId: profile.id,
        body: `I sent you a voice note about this application. It is saved in my documents as Voice note ${doc.id} for this application. Please listen and reply here.`,
      });
      return doc;
    },
    onSuccess: () => {
      setMsg("Voice note sent. It is saved with your documents, and the institution was told in this thread.");
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Voice note could not be sent."),
  });
  if (!app.released) return null;
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">
        Or reply with a voice note
      </p>
      <p className="text-sm text-[var(--dim)]">
        Writing is hard for some of us. Record a voice note on your phone
        and send it: it goes to {app.institution} inside PortaGov, in this
        same thread, not to a personal number.
      </p>
      <label className="mt-2 inline-block cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)]">
        {send.isPending ? "Sending..." : "Choose or record a voice note"}
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          aria-label="Send a voice note to the institution"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setError("");
              setMsg("");
              send.mutate(f);
            }
          }}
        />
      </label>
      {msg ? <p className="mt-2 text-sm font-semibold text-[var(--text)]">{msg}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--warn)]">{error}</p>
      ) : null}
    </div>
  );
}

/* ---------- platform: health, fraud, backup, audit ---------- */

function PlatformHealth() {
  const health = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.getSystemHealth({}),
  });
  const backup = useQuery({
    queryKey: ["backup-status"],
    queryFn: () => api.getBackupStatus({}),
  });
  const runBackup = useMutation({
    mutationFn: async () => await api.runBackupCheck({}),
    onSuccess: () => void backup.refetch(),
  });
  const d = health.data;
  const dot = (ok: boolean, warn: boolean) => (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 rounded-full"
      style={{ backgroundColor: ok ? "#166534" : warn ? "#d9a821" : "#b91c1c" }}
    />
  );
  const row = (label: string, ok: boolean, warn: boolean, text: string) => (
    <li className="flex items-start gap-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
      {dot(ok, warn)}
      <span className="text-[var(--text)]">
        <strong>{label}:</strong> {text}
      </span>
    </li>
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        System health
      </h2>
      {d ? (
        <>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Checked {fmtDateTime(d.checked_at)}. Green means working, gold
            means working with nothing to show yet or a queue to clear, red
            means attention needed. Message channels are logged inside
            PortaGov; carrier delivery connects through the SMS and WhatsApp
            gateways at launch.
          </p>
          <ul className="mt-3 space-y-2">
            {row(
              "Payments",
              d.payments_confirmed > 0,
              d.payments_confirmed === 0,
              `${d.payments_recorded} recorded and waiting, ${d.payments_confirmed} confirmed, ${d.payments_refund_requested} refund requests open.`,
            )}
            {row(
              "SMS",
              d.sms_count > 0,
              d.sms_count === 0,
              `${d.sms_count} SMS updates logged and queued for the gateway.`,
            )}
            {row(
              "WhatsApp",
              d.whatsapp_count > 0,
              d.whatsapp_count === 0,
              `${d.whatsapp_count} WhatsApp updates logged and queued for the gateway.`,
            )}
            {row(
              "Email",
              d.email_count > 0,
              d.email_count === 0,
              `${d.email_count} email updates logged, sent to citizens who gave an email address.`,
            )}
            {row(
              "Release queue",
              d.held === 0,
              d.held > 0,
              `${d.held} applications held by PortaGov right now, release mode is ${d.release_mode}.`,
            )}
            {row(
              "Citizen help",
              d.open_complaints === 0 && d.open_help === 0,
              d.open_complaints > 0 || d.open_help > 0,
              `${d.open_complaints} open complaints and appeals, ${d.open_help} open help requests.`,
            )}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--dim)]">Loading health...</p>
      )}
      <div className="mt-4 rounded-lg bg-[var(--surface-alt)] p-3">
        <p className="text-sm font-bold text-[var(--text)]">
          Daily backup and restore check
        </p>
        <p className="mt-1 text-sm text-[var(--dim)]">
          {backup.data?.checked_at
            ? `Last check ${fmtDateTime(backup.data.checked_at)}: ${backup.data.total_rows} records read back across ${backup.data.tables.length} tables, all readable. The check runs every day on its own, and you can run it now.`
            : "No check has run yet. The check runs every day on its own; run the first one now."}
        </p>
        <div className="mt-2">
          <GhostButton onClick={() => runBackup.mutate()} disabled={runBackup.isPending}>
            Run the backup check now
          </GhostButton>
        </div>
        {backup.data && backup.data.tables.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--dim)]">
            {backup.data.tables.map((t) => `${t.name}: ${t.rows}`).join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FraudPanel() {
  const scan = useQuery({
    queryKey: ["fraud-scan"],
    queryFn: () => api.getFraudScan({}),
  });
  const flags = scan.data?.flags ?? [];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Fraud and duplicate detector
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        The platform scans payments and applications for the patterns fraud
        uses: the same transaction reference twice, one payer phone serving
        many accounts, the same person and service under different accounts,
        and payments left unconfirmed. A flag is a thing to check, not a
        verdict.
      </p>
      <div className="mt-3 space-y-2">
        {scan.isPending ? (
          <p className="text-sm text-[var(--dim)]">Scanning...</p>
        ) : flags.length > 0 ? (
          flags.map((f) => (
            <p key={f.kind + f.detail} className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
              {f.kind}: {f.detail}
            </p>
          ))
        ) : (
          <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
            No flags right now. The scan runs every time this console opens.
          </p>
        )}
      </div>
    </div>
  );
}

function AuditPanel({ institution }: { institution?: string }) {
  const audit = useQuery({
    queryKey: ["audit", institution ?? "all"],
    queryFn: () => api.listAuditLog({ institution: institution ?? "", limit: 50 }),
  });
  const entries = audit.data?.entries ?? [];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Audit trail: who did what, when
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every status change by an officer carries the officer's name. If a
        citizen asks what happened to their application, this trail answers.
      </p>
      <ul className="mt-3 space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            <strong>{e.actor}</strong> at {e.institution}: {e.action}
            {e.application_ref ? ` on ${e.application_ref}` : ""},{" "}
            {fmtDateTime(e.created_at)}
          </li>
        ))}
        {entries.length === 0 ? (
          <li className="text-sm text-[var(--dim)]">
            No officer actions recorded yet. Actions appear here as officers
            work, with their names from the desk sign-in.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/* ---------- institution template reply library ---------- */

function TemplateLibrary({ institution }: { institution: string }) {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ["templates", institution],
    queryFn: () => api.listReplyTemplates({ institution }),
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const add = useMutation({
    mutationFn: async () =>
      await api.addReplyTemplate({ institution, title, body }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => await api.deleteReplyTemplate({ id }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Template reply library
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Answers your officers send often, written once, in plain words.
        Pick one in the message form on any application and adjust it
        before sending.
      </p>
      <ul className="mt-3 space-y-2">
        {(templates.data?.templates ?? []).map((t) => (
          <li key={t.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="font-bold text-[var(--text)]">{t.title}</p>
            <p className="text-[var(--dim)]">{t.body}</p>
            <button type="button" className="mt-1 text-sm font-bold text-[var(--warn)] underline"
              onClick={() => del.mutate(t.id)}>
              Remove template
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setFormError("");
          if (!title.trim() || !body.trim()) {
            setFormError("Give the template a name and write the reply text, then save.");
            return;
          }
          add.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="tpl-title">Template name</FieldLabel>
          <input id="tpl-title" {...FIELDS.addReplyTemplate.title} className={inputCls} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="For example: Come for biometrics" />
        </div>
        <div>
          <FieldLabel htmlFor="tpl-body">The reply text</FieldLabel>
          <input id="tpl-body" {...FIELDS.addReplyTemplate.body} className={inputCls} value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Plain words the citizen will read" />
        </div>
        <div>
          <PrimaryButton type="submit" disabled={add.isPending}>
            Save template
          </PrimaryButton>
        </div>
        {formError ? (
          <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)] sm:col-span-2">
            {formError}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/* ---------- officer queue: one queue per officer ---------- */

/** Waiting work at one institution, split by officer. An application sits
    with the officer who last touched it (from the audit log, which
    records the officer's name on every status change). Anything no
    officer has picked up yet sits under "Not yet picked up", so nothing
    waits without a name on it. Urgent means Fast-track or Emergency
    priority, or waiting more than 48 hours. Waiting time is computed
    from the real submitted time of each application. Nothing here is
    invented: an empty queue shows as empty. */
const OFFICER_WAITING_STATUSES = [
  "Received by institution",
  "In review at institution",
] as const;

function isOfficerUrgent(a: ApplicationT): boolean {
  if (a.priority === "Emergency" || a.priority === "Fast-track") return true;
  return Date.now() - new Date(a.created_at).getTime() >= 48 * 3600000;
}

function sortOfficerQueue(list: ApplicationT[]): ApplicationT[] {
  return [...list].sort((x, y) => {
    const ux = isOfficerUrgent(x) ? 0 : 1;
    const uy = isOfficerUrgent(y) ? 0 : 1;
    if (ux !== uy) return ux - uy;
    return x.created_at.localeCompare(y.created_at);
  });
}

function OfficerWorkList({ institution }: { institution: string }) {
  const apps = useQuery({
    queryKey: ["institution-apps"],
    queryFn: () => api.listInstitutionApplications({ limit: 100 }),
  });
  const appts = useQuery({
    queryKey: ["inst-appointments", institution],
    queryFn: () => api.listInstitutionAppointments({ institution }),
  });
  const staff = useQuery({
    queryKey: ["staff", institution],
    queryFn: () => api.listStaff({ institution }),
  });
  const audit = useQuery({
    queryKey: ["audit-log", institution],
    queryFn: () => api.listAuditLog({ institution, limit: 100 }),
  });
  const today = new Date().toISOString().slice(0, 10);
  const mine = (apps.data?.applications ?? []).filter(
    (a: ApplicationT) => a.institution === institution,
  );
  const waiting = mine.filter((a: ApplicationT) =>
    (OFFICER_WAITING_STATUSES as readonly string[]).includes(a.status),
  );
  const urgentCount = waiting.filter(isOfficerUrgent).length;
  const todayAppts = (appts.data?.appointments ?? []).filter(
    (a) => a.date === today,
  );
  const lastOfficerByRef = new Map<string, string>();
  for (const e of audit.data?.entries ?? []) {
    if (e.application_ref && !lastOfficerByRef.has(e.application_ref)) {
      lastOfficerByRef.set(e.application_ref, e.actor);
    }
  }
  const officers = staff.data?.staff ?? [];
  const groups: { name: string; role: string; items: ApplicationT[] }[] =
    officers.map((s) => ({
      name: s.name,
      role: s.role,
      items: sortOfficerQueue(
        waiting.filter((a) => lastOfficerByRef.get(a.reference) === s.name),
      ),
    }));
  const unassigned = sortOfficerQueue(
    waiting.filter((a) => !lastOfficerByRef.get(a.reference)),
  );
  return (
    <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#0a2a5e" }}>
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Officer queue
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Who is waiting, who is urgent, and how long each person has waited.
        An application sits with the officer who last touched it. Urgent
        means Fast-track or Emergency, or waiting more than 48 hours.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [`${waiting.length}`, "waiting"],
          [`${urgentCount}`, "urgent"],
          [
            waiting.length > 0
              ? waitLabel(
                  waiting.reduce((oldest, a) =>
                    a.created_at < oldest.created_at ? a : oldest,
                  ).created_at,
                )
              : "none",
            "longest wait",
          ],
        ].map(([n, label]) => (
          <div key={label} className="rounded-lg bg-[var(--surface-alt)] p-3">
            <p className="font-display text-2xl font-extrabold text-[var(--text)]">{n}</p>
            <p className="text-xs text-[var(--dim)]">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-[var(--text)]">
        <strong>Appointments today ({todayAppts.length}):</strong>{" "}
        {todayAppts.length > 0
          ? todayAppts.map((a) => `${a.time_slot}, ${a.applicant_name}, ${a.service_name}, ticket ${a.ticket}`).join("; ")
          : "none booked for today."}
      </p>
      {waiting.length === 0 ? (
        <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          Nothing waiting. Good work.
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const urgent = g.items.filter(isOfficerUrgent).length;
          return (
            <div key={g.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display font-bold text-[var(--text)]">
                  {g.name}
                  {g.role ? `, ${g.role}` : ""}
                </p>
                <Chip tone={urgent > 0 ? "gold" : "plain"}>
                  {g.items.length} waiting{urgent > 0 ? `, ${urgent} urgent` : ""}
                </Chip>
              </div>
              {g.items.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
                  {g.items.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {a.reference}, {a.service_name}, {a.applicant_name}, waiting {waitLabel(a.created_at)}
                      </span>
                      {isOfficerUrgent(a) ? (
                        <Chip tone="gold">
                          Urgent{a.priority === "Emergency" || a.priority === "Fast-track" ? `, ${a.priority}` : ", waiting over 48 hours"}
                        </Chip>
                      ) : null}
                      <Chip>{applicationStatusPlain(a.status).short}</Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[var(--dim)]">Nothing waiting with this officer.</p>
              )}
            </div>
          );
        })}
        {unassigned.length > 0 || officers.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-display font-bold text-[var(--text)]">
                Not yet picked up
              </p>
              <Chip tone={unassigned.some(isOfficerUrgent) ? "gold" : "plain"}>
                {unassigned.length} waiting
                {unassigned.filter(isOfficerUrgent).length > 0
                  ? `, ${unassigned.filter(isOfficerUrgent).length} urgent`
                  : ""}
              </Chip>
            </div>
            {officers.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">
                No officers on the roster yet. Add officers under Officers and
                roles, and each application will sit with the officer who
                picks it up.
              </p>
            ) : null}
            <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
              {unassigned.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {a.reference}, {a.service_name}, {a.applicant_name}, waiting {waitLabel(a.created_at)}
                  </span>
                  {isOfficerUrgent(a) ? (
                    <Chip tone="gold">
                      Urgent{a.priority === "Emergency" || a.priority === "Fast-track" ? `, ${a.priority}` : ", waiting over 48 hours"}
                    </Chip>
                  ) : null}
                  <Chip>{applicationStatusPlain(a.status).short}</Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-[var(--dim)]">
        Diaspora and embassy cases on this desk:{" "}
        {mine.filter((a: ApplicationT) => a.channel === "Diaspora").length}.
        Answer embassy spaces before the day ends.
      </p>
    </div>
  );
}

/* ---------- resume where you left off (drafts) ---------- */

function ResumeDrafts({ profile }: { profile: ProfileT }) {
  const [drafts, setDrafts] = useState<{ serviceId: string; name: string }[]>([]);
  useEffect(() => {
    const found: { serviceId: string; name: string }[] = [];
    for (const key of storage.keys()) {
      const match = /^portagov-draft-(.+)-(\d+)$/.exec(key);
      if (match && match[1] && Number(match[2]) === profile.id) {
        const svc = serviceById(match[1]);
        if (svc) found.push({ serviceId: svc.id, name: svc.name });
      }
    }
    setDrafts(found);
  }, [profile.id]);
  if (drafts.length === 0) return null;
  return (
    <div className="rounded-xl border-2 bg-[var(--surface)] p-5" style={{ borderColor: "#d9a821" }}>
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Start where you left off
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Your phone died or the internet dropped? Your unfinished
        applications are saved on this device, exactly where you stopped.
        Tap one to continue.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {drafts.map((d) => (
          <a key={d.serviceId} href={`#/apply/${d.serviceId}`}
            className="rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: "#0a2a5e" }}>
            Continue: {d.name}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------- what to bring (appointment one-screen list) ---------- */

/* The day before an appointment, as a plain date. The reminder for a
   visit is set for this date, and the message tells the person what
   to bring. */
function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* What to bring for an appointment, from the real requirements of the
   service the appointment is for. Falls back to the visit-type list
   when the appointment is not linked to a service. */
function bringItemsForAppointment(
  appt: AppointmentT,
  service?: Service,
): string[] {
  const ticket = `Your ticket number: ${appt.ticket || "on this screen"}`;
  const idLine =
    "Your national ID, passport, voter card, or birth certificate, the one on your profile";
  if (!service) {
    return appt.kind === "Collection"
      ? [
          ticket,
          "Your pickup code, from the SMS and your application page",
          "Your national ID, or the document you used on your profile",
          "If someone else collects for you: their own ID and your proxy consent code",
        ]
      : appt.kind === "Print pickup"
        ? [
            ticket,
            "Your print code, from your application page",
            "Your national ID, or the document you used on your profile",
          ]
        : [
            ticket,
            idLine,
            "Your original documents for the service, not only copies",
            "For a passport photo sitting: plain clothes with no hat and no sunglasses, white background at the office",
          ];
  }
  const items = [ticket, ...service.requirements, idLine];
  if (appt.kind === "Biometrics" && service.id.startsWith("passport")) {
    items.push(
      "For a passport photo sitting: plain clothes with no hat and no sunglasses, white background at the office",
    );
  }
  if (appt.kind === "Collection") {
    items.push("Your pickup code, from the SMS and your application page");
    items.push(
      "If someone else collects for you: their own ID and your proxy consent code",
    );
  }
  return items;
}

function BringList({ appt, service }: { appt: AppointmentT; service?: Service }) {
  const items = bringItemsForAppointment(appt, service);
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">
        Bring this to your appointment
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--dim)]">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Arrive 15 minutes early at {appt.office}. Your slot is {appt.time_slot}{" "}
        on {appt.date}.
      </p>
    </div>
  );
}

/* The reminder for the day before a visit, shown on the appointment
   itself. The reminder is saved on this device and shown here, with
   the date it is set for and what to bring for that service. The SMS
   itself will be sent once the SMS sender is live, so this box says
   so plainly instead of claiming a text already went out. */
function DayBeforeReminder({ appt, service }: { appt: AppointmentT; service?: Service }) {
  const reminderDate = dayBefore(appt.date);
  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">
        Reminder, the day before: {fmtDate(reminderDate)}
      </p>
      <p className="mt-1 text-sm text-[var(--dim)]">
        PortaGov reminder: you have a {appt.kind.toLowerCase()} visit tomorrow,{" "}
        {fmtDate(appt.date)}, {appt.time_slot}, at {appt.office}. Your ticket
        number is {appt.ticket || "on this screen"}.
      </p>
      <BringList appt={appt} service={service} />
      <p className="mt-2 text-sm text-[var(--dim)]">
        This reminder is saved on this device and shown here. The SMS itself
        will be sent once the SMS sender is live.
      </p>
    </div>
  );
}

/* ---------- photo crop and fix tool ---------- */

/* ---------- photo crop and fix tool ---------- */

// A passport photograph is a portrait photo. The crop below outputs a
// portrait image, 700 by 900 pixels (a 7 by 9 shape, the same shape as the
// commonly recommended 35 by 45 mm guide size). 35 by 45 mm is a guide
// recommendation only, not an official size, so it is never shown as one.
const CROP_WIDTH = 700;
const CROP_HEIGHT = 900;

function PhotoFixTool({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState("");
  const [scale, setScale] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [saved, setSaved] = useState("");
  const [savedSize, setSavedSize] = useState("");
  const [error, setError] = useState("");
  const docs = useQuery({
    queryKey: ["documents", profile.id],
    queryFn: () => api.listDocuments({ profileId: profile.id }),
  });
  const photos = (docs.data?.documents ?? []).filter(
    (d: DocumentT) => d.doc_type === "Passport photograph" && d.status !== "Superseded",
  );
  const [replaceId, setReplaceId] = useState(0);
  const [quality, setQuality] = useState("");

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !src) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, CROP_WIDTH, CROP_HEIGHT);
    const base = Math.max(
      CROP_WIDTH / img.naturalWidth,
      CROP_HEIGHT / img.naturalHeight,
    );
    const w = img.naturalWidth * base * scale;
    const h = img.naturalHeight * base * scale;
    let x = (CROP_WIDTH - w) / 2 + offX * 3;
    let y = (CROP_HEIGHT - h) / 2 + offY * 3;
    // Keep the photo covering the whole frame, so moving it can never
    // leave a white edge in the saved photo.
    x = Math.min(0, Math.max(CROP_WIDTH - w, x));
    y = Math.min(0, Math.max(CROP_HEIGHT - h, y));
    ctx2d.drawImage(img, x, y, w, h);
    try {
      const data = ctx2d.getImageData(0, 0, CROP_WIDTH, CROP_HEIGHT).data;
      let total = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        count += 1;
      }
      const avg = count > 0 ? total / count : 128;
      if (avg < 55) {
        setQuality(
          "Quality check: this photo looks too dark. Take it again in good light, facing a window, before an officer ever sees it. A dark photo can delay your passport.",
        );
      } else if (avg > 245) {
        setQuality(
          "Quality check: this photo looks washed out, too bright. Take it again away from strong light behind you.",
        );
      } else {
        setQuality("Quality check: the light in this photo looks good.");
      }
    } catch {
      setQuality("");
    }
  };
  useEffect(draw, [src, scale, offX, offY]);

  const save = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Choose a photo first.");
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95),
      );
      if (!blob) throw new Error("The photo could not be prepared.");
      const file = new File([blob], "passport-photo-cropped.jpg", {
        type: "image/jpeg",
      });
      const base = await fileToBase64(file);
      await api.addDocument({
        profileId: profile.id,
        docType: "Passport photograph",
        title: "Passport photograph",
        file: {
          dataBase64: base,
          fileName: file.name,
          contentType: "image/jpeg",
        },
        replacesDocumentId: replaceId,
      });
      return { kb: Math.max(1, Math.round(blob.size / 1024)) };
    },
    onSuccess: (r) => {
      setSaved(
        replaceId > 0
          ? "Saved. The cropped photo replaces the old one in your wallet, and your services will use the cropped photo."
          : "Saved. The cropped photo is now the passport photograph in your wallet, at the top of this page.",
      );
      setSavedSize(
        `Cropped photo size: ${CROP_WIDTH} by ${CROP_HEIGHT} pixels, portrait, about ${r.kb} KB.`,
      );
      void docs.refetch();
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "The photo could not be saved."),
  });

  return (
    <div id="photo-fix" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Photo crop and fix tool
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Fix a passport photo right here, no other app needed. Choose the
        photo, move and zoom until your head and shoulders sit inside the
        frame like the photo guide shows, then save. The finished photo is
        portrait, {CROP_WIDTH} by {CROP_HEIGHT} pixels. Guide size: 35 by
        45 mm is a commonly recommended guide size, not an official size.
        PortaGov saves it at full quality, never squeezed down, and under
        the 1 MB portal scan limit, because this photo goes in your
        passport.
      </p>
      <label className="mt-3 inline-block cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold text-[var(--text)]">
        Choose a photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Choose a photo to fix"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setSaved("");
              setSavedSize("");
              setError("");
              setScale(1);
              setOffX(0);
              setOffY(0);
              setReplaceId(0);
              setSrc(URL.createObjectURL(f));
            }
            e.target.value = "";
          }}
        />
      </label>
      {src ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[300px_1fr]">
          <div>
            <img ref={imgRef} src={src} alt="" className="hidden" onLoad={draw} />
            <div className="relative w-full max-w-[280px]">
              <canvas
                ref={canvasRef}
                width={CROP_WIDTH}
                height={CROP_HEIGHT}
                className="w-full rounded-lg border-2"
                style={{ borderColor: "#166534" }}
                aria-label="Preview of your cropped passport photo"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-[50%] border-2 border-dashed border-white/90"
                style={{ left: "18%", right: "18%", top: "7%", height: "52%" }}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--dim)]">
              Preview: this is exactly the photo that will be saved,{" "}
              {CROP_WIDTH} by {CROP_HEIGHT} pixels, portrait.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <FieldLabel htmlFor="fix-zoom">Zoom</FieldLabel>
              <input id="fix-zoom" type="range" min={1} max={3} step={0.05}
                className="w-full" value={scale}
                onChange={(e) => setScale(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="fix-x">Move left or right</FieldLabel>
              <input id="fix-x" type="range" min={-100} max={100} step={1}
                className="w-full" value={offX}
                onChange={(e) => setOffX(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="fix-y">Move up or down</FieldLabel>
              <input id="fix-y" type="range" min={-100} max={100} step={1}
                className="w-full" value={offY}
                onChange={(e) => setOffY(Number(e.target.value))} />
            </div>
            {photos.length > 0 ? (
              <div>
                <FieldLabel htmlFor="fix-replace">Replace an old photo in the wallet?</FieldLabel>
                <select id="fix-replace" className={inputCls} value={replaceId}
                  onChange={(e) => setReplaceId(Number(e.target.value))}>
                  <option value={0}>No, save as a new photo</option>
                  {photos.map((d: DocumentT) => (
                    <option key={d.id} value={d.id}>
                      Replace: {d.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save the cropped photo to my wallet"}
            </PrimaryButton>
            {quality ? (
              <p className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                {quality}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="text-sm font-semibold text-[var(--text)]">{saved}</p>
            ) : null}
            {savedSize ? (
              <p className="text-sm text-[var(--dim)]">{savedSize}</p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm font-semibold text-[var(--warn)]">{error}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- staff service catalogue search ---------- */

function StaffCatalogueSearch() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query
    ? SERVICES.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          ministryById(s.ministryId).name.toLowerCase().includes(query),
      ).slice(0, 8)
    : [];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Find any service, fast
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        For officers and help desks: search the whole catalogue by service
        or institution and see the fee in seconds.
      </p>
      <div className="mt-3">
        <FieldLabel htmlFor="staff-search">Search the catalogue</FieldLabel>
        <input id="staff-search" className={inputCls} value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Passport, police, business, tax..." />
      </div>
      {query ? (
        <ul className="mt-3 space-y-2">
          {results.map((s) => (
            <li key={s.id}>
              <a href={`#/service/${s.id}`} className="block rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
                <strong className="text-[var(--text)]">{s.name}</strong>{" "}
                <span className="text-[var(--dim)]">
                  {ministryById(s.ministryId).name}, fee $
                  {serviceDetails(s.id).feeUsd}, {serviceDetails(s.id).processingTime}
                </span>
              </a>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="text-sm text-[var(--dim)]">No service matches. Try another word.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- payment reconciliation (platform) ---------- */

function ReconciliationPanel() {
  const recon = useQuery({
    queryKey: ["reconciliation"],
    queryFn: () => api.getReconciliation({}),
  });
  const rows = recon.data?.rows ?? [];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Payment reconciliation
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every MTN MoMo and Orange Money payment is matched to its billing
        number automatically. Mismatches are flagged here, never hidden:{" "}
        {recon.data?.total_flags ?? 0} to check.
      </p>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 20).map((r) => (
          <div key={r.reference} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="text-[var(--text)]">
              <strong>{r.billing_number}</strong> ({r.reference}, {r.service_name}):
              due ${r.total_due}, confirmed ${r.confirmed}
              {r.recorded_waiting > 0 ? `, recorded waiting $${r.recorded_waiting}` : ""},
              billing {r.billing_status}
            </p>
            {r.flag ? (
              <p className="mt-1 font-semibold text-[var(--warn)]">{r.flag}</p>
            ) : (
              <p className="mt-1 text-[var(--dim)]">Matched. Nothing to check.</p>
            )}
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No billings yet.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- ready to collect queue ---------- */

function ReadyQueue({ institution }: { institution?: string }) {
  const apps = useQuery({
    queryKey: ["institution-apps"],
    queryFn: () => api.listInstitutionApplications({ limit: 100 }),
  });
  const ready = (apps.data?.applications ?? []).filter(
    (a: ApplicationT) =>
      a.status === "Ready for collection" &&
      (!institution || a.institution === institution),
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Ready to collect queue ({ready.length})
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Separate from work in review: these are finished and waiting for
        their owners. Check the pickup code before you hand anything over.
      </p>
      <ul className="mt-3 space-y-2">
        {ready.map((a: ApplicationT) => (
          <li key={a.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            <strong>{a.service_name}</strong> for {a.applicant_name}, {a.reference},
            ready since {fmtDate(a.updated_at)}, pickup code{" "}
            <strong>{a.pickup_code || "sent by SMS"}</strong>
          </li>
        ))}
        {ready.length === 0 ? (
          <li className="text-sm text-[var(--dim)]">Nothing is waiting for collection right now.</li>
        ) : null}
      </ul>
    </div>
  );
}

/* ---------- document verification checklist (officer) ---------- */

function DocumentVerification({ app }: { app: ApplicationT }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const docs = useQuery({
    queryKey: ["app-docs", app.id],
    queryFn: () => api.listApplicationDocuments({ applicationId: app.id }),
    enabled: open,
  });
  const checks = useQuery({
    queryKey: ["doc-checks", app.id],
    queryFn: () => api.listDocumentChecks({ applicationId: app.id }),
    enabled: open,
  });
  const officer =
    typeof window !== "undefined"
      ? storage.get("portagov-officer") ?? ""
      : "";
  const setCheck = useMutation({
    mutationFn: async (v: {
      documentId: number;
      isReal: boolean;
      isClear: boolean;
      isValid: boolean;
    }) =>
      await api.setDocumentCheck({
        applicationId: app.id,
        officerName: officer,
        ...v,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["doc-checks"] }),
  });
  const checkFor = (docId: number) =>
    (checks.data?.checks ?? []).find((c) => c.document_id === docId);
  const list = docs.data?.documents ?? [];
  const allDone =
    list.length > 0 &&
    list.every((d) => {
      const c = checkFor(d.id);
      return c?.is_real && c?.is_clear && c?.is_valid;
    });
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--text)]">
          Document verification checklist
        </p>
        <GhostButton onClick={() => setOpen(!open)}>
          {open ? "Hide documents" : "Verify documents"}
        </GhostButton>
      </div>
      {open ? (
        <div className="mt-2 space-y-3">
          {docs.isPending ? (
            <p className="text-sm text-[var(--dim)]">Loading documents...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[var(--dim)]">
              No documents were attached to this application.
            </p>
          ) : (
            list.map((d) => {
              const c = checkFor(d.id);
              const state = {
                isReal: c?.is_real ?? false,
                isClear: c?.is_clear ?? false,
                isValid: c?.is_valid ?? false,
              };
              const tick = (patch: Partial<typeof state>) =>
                setCheck.mutate({ documentId: d.id, ...state, ...patch });
              return (
                <div key={d.id} className="rounded-lg bg-[var(--surface)] p-3">
                  <p className="text-sm font-bold text-[var(--text)]">
                    {d.title} ({d.doc_type})
                    {d.doc_number ? `, number ${d.doc_number}` : ""}
                  </p>
                  <p className="text-sm text-[var(--dim)]">
                    Validity: {d.validity}
                    {d.expires_on ? `, expires ${d.expires_on}` : ""}
                    {d.has_file ? (
                      <>
                        .{" "}
                        <a href={d.file_url} target="_blank" rel="noopener" className="font-semibold underline">
                          Open the document
                        </a>
                      </>
                    ) : (
                      ". No file was uploaded for this document."
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-[var(--text)]">
                    {(
                      [
                        ["isReal", "It is real"],
                        ["isClear", "It is clear to read"],
                        ["isValid", "It is valid and in date"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`${label}: ${d.title}`}
                          className="h-5 w-5"
                          checked={state[key]}
                          onChange={(e) => tick({ [key]: e.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <p className="text-sm font-semibold text-[var(--text)]">
            {allDone
              ? "All documents verified: real, clear, and valid. This application can move forward."
              : "Every document must be ticked real, clear, and valid before this application moves forward. If one fails, tell the citizen in the message form what to fix."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- bulk message tool (institution) ---------- */

function BulkMessageTool({ institution }: { institution: string }) {
  const [serviceName, setServiceName] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState("");
  const send = useMutation({
    mutationFn: async () =>
      await api.bulkMessageInstitution({ institution, serviceName, body }),
    onSuccess: (r) => {
      setResult(`Sent to ${r.notified} waiting citizen${r.notified === 1 ? "" : "s"}. Each one got it on SMS, WhatsApp, and in their application thread.`);
      setBody("");
    },
  });
  const services = servicesForMinistry(
    MINISTRIES.find((m) => m.name === institution)?.id ?? "",
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Bulk message: one update to everyone waiting
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Office closed for a holiday, a system delay, a new collection day:
        write it once and every citizen waiting on this institution hears
        it, under their own tracking number.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`bulk-svc-${institution}`}>Only this service (optional)</FieldLabel>
          <select id={`bulk-svc-${institution}`} className={inputCls} value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}>
            <option value="">All services of this institution</option>
            {services.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor={`bulk-body-${institution}`}>Your update</FieldLabel>
          <input id={`bulk-body-${institution}`} {...FIELDS.bulkMessageInstitution.body} className={inputCls} value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="For example: our office is closed Friday for the holiday, collections move to Monday" />
        </div>
      </div>
      <div className="mt-3">
        <PrimaryButton
          onClick={() => {
            if (body.trim().length >= 5) send.mutate();
          }}
          disabled={send.isPending}
        >
          Send to everyone waiting
        </PrimaryButton>
      </div>
      {result ? (
        <p className="mt-2 text-sm font-semibold text-[var(--text)]">{result}</p>
      ) : null}
    </div>
  );
}

/* ---------- support tickets (citizen view) ---------- */

function ticketNumber(id: number, createdAt: string): string {
  const year = new Date(createdAt).getFullYear() || 2026;
  return `SUP-${year}-${String(id).padStart(5, "0")}`;
}

function MyTickets({ phone }: { phone: string }) {
  const tickets = useQuery({
    queryKey: ["my-tickets", phone],
    queryFn: () => api.listHelpRequestsByPhone({ phone }),
  });
  const list = tickets.data?.requests ?? [];
  if (list.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        My support tickets
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every question you send becomes a ticket with a number, a real
        person assigned to it, and a reply time you can hold us to: PortaGov
        answers within one working day.
      </p>
      <div className="mt-3 space-y-3">
        {list.map((t) => {
          const hours =
            t.answered_at && t.created_at
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(t.answered_at).getTime() -
                      new Date(t.created_at).getTime()) /
                      3600000,
                  ),
                )
              : null;
          return (
            <div key={t.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
              <p className="font-bold text-[var(--text)]">
                Ticket {ticketNumber(t.id, t.created_at)}: {t.topic}
              </p>
              <p className="text-[var(--dim)]">{t.message}</p>
              <p className="mt-1 text-[var(--dim)]">
                Status: {t.status}
                {t.assigned_to ? `, handled by ${t.assigned_to}` : ", waiting to be assigned"}
                {hours !== null
                  ? `, answered in about ${hours} hour${hours === 1 ? "" : "s"}`
                  : ", answer promised within one working day"}
              </p>
              {t.reply ? (
                <p className="mt-1 rounded bg-[var(--surface)] p-2 text-[var(--text)]">
                  <strong>Reply:</strong> {t.reply}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- business and NGO portal (its own portal, sign-in, dashboard, navigation) ---------- */

const MINISTRY_COLORS: Record<string, string> = {
  foreign: "#0a2a5e",
  health: "#0e7a5f",
  police: "#274690",
  identification: "#5b4a9e",
  commerce: "#8a6d1a",
  revenue: "#7a4a12",
  transport: "#14532d",
  internal: "#6d28d9",
  labour: "#9a3412",
  land: "#3f6212",
};

function ministryColor(id: string): string {
  return MINISTRY_COLORS[id] ?? "#0a2a5e";
}

function monogramOf(name: string): string {
  return name
    .replace(/^(Ministry of|Liberia|National)\s+/gi, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type BizT = ApiResponse<typeof api, "listBusinesses">["businesses"][number];

function CompanyWalletPanel({
  business,
  profile,
}: {
  business: BizT;
  profile: ProfileT;
}) {
  const queryClient = useQueryClient();
  const wallet = useQuery({
    queryKey: ["biz-wallet", business.id],
    queryFn: () => api.getBusinessWallet({ businessId: business.id }),
  });
  const bizApps = useQuery({
    queryKey: ["biz-apps", business.id],
    queryFn: () => api.listBusinessApplications({ businessId: business.id }),
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"MTN MoMo" | "Orange Money">("MTN MoMo");
  const [txn, setTxn] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const deposit = useMutation({
    mutationFn: async () =>
      await api.depositBusinessFunds({
        businessId: business.id,
        profileId: profile.id,
        amount: Number(amount) || 0,
        method,
        transactionRef: txn,
      }),
    onSuccess: (r) => {
      setMsg(`Deposit recorded. Company wallet balance: $${r.balance}.`);
      setAmount("");
      setTxn("");
      void queryClient.invalidateQueries({ queryKey: ["biz-wallet"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Deposit failed."),
  });
  const pay = useMutation({
    mutationFn: async (applicationId: number) =>
      await api.payFromBusinessWallet({
        businessId: business.id,
        profileId: profile.id,
        applicationId,
      }),
    onSuccess: (r) => {
      setMsg(`Paid $${r.amount} from the wallet. New balance: $${r.balance}. The receipt lives on that person's application and in this wallet's history.`);
      void queryClient.invalidateQueries({ queryKey: ["biz-wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["biz-apps"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Payment failed."),
  });
  const unpaid = (bizApps.data?.applications ?? []).filter(
    (a: ApplicationT) => a.billing_status !== "Paid" && a.total_due > 0,
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Company wallet: {business.business_name}
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        One balance for the whole organisation. Deposit once, then pay the
        billing numbers of many employees from it. Every payment keeps its
        own receipt on that person's application.
      </p>
      <p className="mt-3 font-display text-4xl font-extrabold text-[var(--text)]">
        ${wallet.data?.balance ?? 0}
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError("");
          setMsg("");
          if ((Number(amount) || 0) < 1 || txn.trim().length < 3) {
            setError("Write the deposit amount and the mobile money transaction reference.");
            return;
          }
          deposit.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="cw-amount">Deposit amount (USD)</FieldLabel>
          <input id="cw-amount" {...FIELDS.depositBusinessFunds.amount} type="number" className={inputCls} value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="cw-method">Paid by</FieldLabel>
          <select id="cw-method" className={inputCls} value={method}
            onChange={(e) => setMethod(e.target.value === "Orange Money" ? "Orange Money" : "MTN MoMo")}>
            <option>MTN MoMo</option>
            <option>Orange Money</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="cw-txn">Transaction reference</FieldLabel>
          <input id="cw-txn" {...FIELDS.depositBusinessFunds.transactionRef} className={inputCls} value={txn}
            onChange={(e) => setTxn(e.target.value)} />
        </div>
        <PrimaryButton type="submit" disabled={deposit.isPending}>
          Deposit
        </PrimaryButton>
      </form>
      {unpaid.length > 0 ? (
        <div className="mt-4">
          <p className="font-display font-bold text-[var(--text)]">
            Unpaid billings under this business
          </p>
          <ul className="mt-2 space-y-2">
            {unpaid.map((a: ApplicationT) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
                <span className="text-[var(--text)]">
                  {a.applicant_name}, {a.service_name}, billing {a.billing_number},
                  due ${a.total_due - a.amount_paid}
                </span>
                <GhostButton onClick={() => pay.mutate(a.id)} disabled={pay.isPending}>
                  Pay from wallet
                </GhostButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4">
        <p className="font-display font-bold text-[var(--text)]">Wallet history</p>
        <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
          {(wallet.data?.transactions ?? []).map((t) => (
            <li key={t.id}>
              {t.kind}: ${t.amount}, {t.note}
              {t.application_ref ? `, application ${t.application_ref}` : ""},{" "}
              {fmtDate(t.created_at)}
            </li>
          ))}
          {(wallet.data?.transactions ?? []).length === 0 ? (
            <li>No wallet movement yet.</li>
          ) : null}
        </ul>
      </div>
      {msg ? <p className="mt-2 text-sm font-semibold text-[var(--text)]">{msg}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BizPortalPage({
  profile,
  goApply,
}: {
  profile: ProfileT;
  goApply: (service: Service) => void;
}) {
  const queryClient = useQueryClient();
  const businesses = useQuery({
    queryKey: ["businesses", profile.id],
    queryFn: () => api.listBusinesses({ profileId: profile.id }),
  });
  const [bizId, setBizId] = useState(0);
  const [tab, setTab] = useState<"dashboard" | "services" | "team" | "wallet" | "payments" | "bulk">("dashboard");
  const list = businesses.data?.businesses ?? [];
  const biz = list.find((b) => b.id === bizId) ?? list[0];
  const bizApps = useQuery({
    queryKey: ["biz-apps", biz?.id ?? 0],
    queryFn: () => api.listBusinessApplications({ businessId: biz?.id ?? 0 }),
    enabled: !!biz,
  });
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.listPayments({ limit: 100 }),
  });
  const team = useQuery({
    queryKey: ["team", biz?.id ?? 0],
    queryFn: () => api.listTeamMembers({ businessId: biz?.id ?? 0 }),
    enabled: !!biz,
  });
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const addMember = useMutation({
    mutationFn: async () =>
      await api.addTeamMember({
        businessId: biz?.id ?? 0,
        profileId: profile.id,
        name: memberName,
        role: memberRole,
        phone: memberPhone,
      }),
    onSuccess: () => {
      setMemberName("");
      setMemberRole("");
      setMemberPhone("");
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
  const removeMember = useMutation({
    mutationFn: async (id: number) =>
      await api.removeTeamMember({ id, profileId: profile.id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
  const [org, setOrg] = useState({ name: "", reg: "", tin: "", county: "Montserrado", activity: "" });
  const addOrg = useMutation({
    mutationFn: async () =>
      await api.addBusiness({
        profileId: profile.id,
        businessName: org.name,
        registrationNumber: org.reg,
        tin: org.tin,
        county: org.county,
        activity: org.activity,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["businesses"] }),
  });
  const bizPayments = (payments.data?.payments ?? []).filter((p: PaymentT) =>
    (bizApps.data?.applications ?? []).some(
      (a: ApplicationT) => a.id === p.application_id,
    ),
  );
  const tabs = [
    ["dashboard", "Dashboard"],
    ["services", "Registrations and permits"],
    ["team", "Team members"],
    ["wallet", "Company wallet"],
    ["payments", "Payment history"],
    ["bulk", "Bulk applications"],
  ] as const;
  const bizServices = SERVICES.filter((s) =>
    ["business-registration", "business-renewal", "tax-clearance", "tin-registration"].includes(s.id),
  );
  return (
    <div>
      <section className="text-white" style={{ background: "linear-gradient(135deg, #0a2a5e 0%, #123a7d 60%, #8a6d1a 130%)" }}>
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#d9a821" }}>
            Business and NGO portal
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">
            {biz ? biz.business_name : "Your organisation on PortaGov"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">
            A separate portal for companies and NGOs: your organisation
            profile, team, registrations, permits, tax clearance, licence
            renewals, bulk applications for staff, one company wallet, and
            your full payment history. Separate from the citizen portal,
            linked through PortaGov.
          </p>
          {list.length > 0 ? (
            <div className="mt-4 max-w-sm">
              <label className="text-sm font-bold" htmlFor="biz-select">
                Organisation
              </label>
              <select id="biz-select" className="mt-1 w-full rounded-lg px-3 py-2 text-[var(--text)]"
                value={biz?.id ?? 0}
                onChange={(e) => setBizId(Number(e.target.value))}>
                {list.map((b) => (
                  <option key={b.id} value={b.id}>{b.business_name}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div style={{ backgroundColor: "#d9a821" }} className="h-1.5" />
      </section>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {!biz ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl font-bold text-[var(--text)]">
              Create your organisation profile
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Every field is checked. The registration number and TIN are
              the ones the Liberia Business Registry and the Revenue
              Authority hold for you: write them exactly.
            </p>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (org.name.trim().length >= 2) addOrg.mutate();
              }}
            >
              <div>
                <FieldLabel htmlFor="org-name">Organisation name (required)</FieldLabel>
                <input id="org-name" {...FIELDS.addBusiness.businessName} className={inputCls} value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value })}
                  placeholder="The full legal name of the company or NGO" />
              </div>
              <div>
                <FieldLabel htmlFor="org-reg">Business registration number</FieldLabel>
                <input id="org-reg" {...FIELDS.addBusiness.registrationNumber} className={inputCls} value={org.reg}
                  onChange={(e) => setOrg({ ...org, reg: e.target.value })}
                  placeholder="From your registration certificate" />
              </div>
              <div>
                <FieldLabel htmlFor="org-tin">Tax identification number (TIN)</FieldLabel>
                <input id="org-tin" {...FIELDS.addBusiness.tin} className={inputCls} value={org.tin}
                  onChange={(e) => setOrg({ ...org, tin: e.target.value })}
                  placeholder="From the Liberia Revenue Authority" />
              </div>
              <div>
                <FieldLabel htmlFor="org-county">County of operation (required)</FieldLabel>
                <select id="org-county" className={inputCls} value={org.county}
                  onChange={(e) => setOrg({ ...org, county: e.target.value })}>
                  {COUNTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="org-activity">What does the organisation do?</FieldLabel>
                <input id="org-activity" {...FIELDS.addBusiness.activity} className={inputCls} value={org.activity}
                  onChange={(e) => setOrg({ ...org, activity: e.target.value })}
                  placeholder="For example: trading, construction, health NGO" />
              </div>
              <div>
                <PrimaryButton type="submit" disabled={addOrg.isPending}>
                  Create organisation profile
                </PrimaryButton>
              </div>
            </form>
          </div>
        ) : (
          <>
            <nav aria-label="Business portal" className="flex gap-1 overflow-x-auto pb-2">
              {tabs.map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  aria-current={tab === key ? "page" : undefined}
                  className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold"
                  style={
                    tab === key
                      ? { backgroundColor: "#0a2a5e", color: "#fff" }
                      : { color: "var(--text)" }
                  }>
                  {label}
                </button>
              ))}
            </nav>
            {tab === "dashboard" ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Applications under this business", bizApps.data?.applications.length ?? 0],
                    ["Completed", (bizApps.data?.applications ?? []).filter((a: ApplicationT) => a.status === "Completed").length],
                    ["Unpaid billings", (bizApps.data?.applications ?? []).filter((a: ApplicationT) => a.billing_status !== "Paid").length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                      <p className="font-display text-3xl font-extrabold text-[var(--text)]">{value}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--dim)]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {(bizApps.data?.applications ?? []).slice(0, 6).map((a: ApplicationT) => (
                    <ApplicationCard key={a.id} app={a} onOpen={() => { window.location.hash = `#/application/${a.id}`; }} />
                  ))}
                  {(bizApps.data?.applications ?? []).length === 0 ? (
                    <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                      Nothing filed under this business yet. File from
                      Registrations and permits, and choose this business on
                      the application form so it lands here.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {tab === "services" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {bizServices.map((s) => (
                  <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <p className="font-display text-lg font-bold text-[var(--text)]">{s.name}</p>
                    <p className="mt-1 text-sm text-[var(--dim)]">{s.blurb}</p>
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      Fee ${serviceDetails(s.id).feeUsd}, {serviceDetails(s.id).processingTime}
                    </p>
                    <div className="mt-3">
                      <PrimaryButton onClick={() => goApply(s)}>Start</PrimaryButton>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-[var(--dim)] md:col-span-2">
                  On the application form, pick this business under "File
                  under my business" so the application, its billing, and
                  its receipt all live in this portal.
                </p>
              </div>
            ) : null}
            {tab === "team" ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="font-display text-lg font-bold text-[var(--text)]">Team members</h2>
                <ul className="mt-3 space-y-2">
                  {(team.data?.members ?? []).map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
                      <span className="text-[var(--text)]">
                        <strong>{m.name}</strong>{m.role ? `, ${m.role}` : ""}{m.phone ? `, ${m.phone}` : ""}
                      </span>
                      <button type="button" className="font-bold text-[var(--warn)] underline"
                        onClick={() => removeMember.mutate(m.id)}>
                        Remove
                      </button>
                    </li>
                  ))}
                  {(team.data?.members ?? []).length === 0 ? (
                    <li className="text-sm text-[var(--dim)]">No team members yet.</li>
                  ) : null}
                </ul>
                <form
                  className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (memberName.trim().length >= 2) addMember.mutate();
                  }}
                >
                  <div>
                    <FieldLabel htmlFor="tm-name">Full name (required)</FieldLabel>
                    <input id="tm-name" {...FIELDS.addTeamMember.name} className={inputCls} value={memberName}
                      onChange={(e) => setMemberName(e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="tm-role">Role in the organisation</FieldLabel>
                    <input id="tm-role" {...FIELDS.addTeamMember.role} className={inputCls} value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      placeholder="Manager, Accountant, Director" />
                  </div>
                  <div>
                    <FieldLabel htmlFor="tm-phone">Phone number</FieldLabel>
                    <input id="tm-phone" {...FIELDS.addTeamMember.phone} className={inputCls} value={memberPhone}
                      onChange={(e) => setMemberPhone(e.target.value)} />
                  </div>
                  <PrimaryButton type="submit" disabled={addMember.isPending}>
                    Add member
                  </PrimaryButton>
                </form>
              </div>
            ) : null}
            {tab === "wallet" ? (
              <div className="mt-4">
                <CompanyWalletPanel business={biz} profile={profile} />
              </div>
            ) : null}
            {tab === "payments" ? (
              <div className="mt-4">
                {bizPayments.length > 0 ? (
                  <div className="space-y-3">
                    {bizPayments.map((p: PaymentT) => (
                      <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
                        {p.method}, ${p.amount}, application {p.application_ref},
                        transaction {p.transaction_ref}, status {p.status},{" "}
                        {fmtDate(p.created_at)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                    No payments under this business yet.
                  </p>
                )}
                <ReceiptDownloads payments={bizPayments} />
              </div>
            ) : null}
            {tab === "bulk" ? (
              <div className="mt-4">
                <BulkApplicationsPanel
                  profile={profile}
                  businessId={biz.id}
                  bulkLabel={`${biz.business_name} (business portal)`}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- institution personal portal (own branding, services, inbox, calendar, payments, reports) ---------- */

function InstitutionServicesEditor({ institution }: { institution: string }) {
  const queryClient = useQueryClient();
  const ministry = MINISTRIES.find((m) => m.name === institution);
  const settings = useQuery({
    queryKey: ["inst-services", institution],
    queryFn: () => api.listInstitutionServices({ institution }),
  });
  const services = ministry ? servicesForMinistry(ministry.id) : [];
  const overrideFor = (serviceId: string) =>
    (settings.data?.settings ?? []).find((s) => s.service_id === serviceId);
  const [editing, setEditing] = useState("");
  const [fee, setFee] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async (serviceId: string) =>
      await api.setInstitutionService({
        institution,
        serviceId,
        feeUsd: fee === "" ? null : Number(fee),
        processingTime: time,
        note,
      }),
    onSuccess: () => {
      setEditing("");
      void queryClient.invalidateQueries({ queryKey: ["inst-services"] });
    },
  });
  return (
    <div className="space-y-3">
      {services.map((s) => {
        const o = overrideFor(s.id);
        const d = serviceDetails(s.id);
        return (
          <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display font-bold text-[var(--text)]">{s.name}</p>
                <p className="text-sm text-[var(--dim)]">
                  {o
                    ? `Your portal fee: ${o.fee_usd !== null ? `$${o.fee_usd}` : "not set"}, your time: ${o.processing_time || d.processingTime}${o.note ? `. ${o.note}` : ""}`
                    : `Catalogue fee $${d.feeUsd}, ${d.processingTime}. Set your own below.`}
                </p>
              </div>
              <ServiceClosedToggle institution={institution} serviceId={s.id} serviceName={s.name} />
              <GhostButton
                onClick={() => {
                  setEditing(editing === s.id ? "" : s.id);
                  setFee(o?.fee_usd !== null && o?.fee_usd !== undefined ? String(o.fee_usd) : "");
                  setTime(o?.processing_time ?? "");
                  setNote(o?.note ?? "");
                }}
              >
                {editing === s.id ? "Close" : "Set our fee and time"}
              </GhostButton>
            </div>
            {editing === s.id ? (
              <form
                className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  save.mutate(s.id);
                }}
              >
                <div>
                  <FieldLabel htmlFor={`isf-fee-${s.id}`}>Our fee in USD (blank keeps catalogue)</FieldLabel>
                  <input id={`isf-fee-${s.id}`} {...FIELDS.setInstitutionService.feeUsd} type="number" className={inputCls} value={fee}
                    onChange={(e) => setFee(e.target.value)} />
                </div>
                <div>
                  <FieldLabel htmlFor={`isf-time-${s.id}`}>Our processing time</FieldLabel>
                  <input id={`isf-time-${s.id}`} {...FIELDS.setInstitutionService.processingTime} className={inputCls} value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="For example: 3 to 5 working days" />
                </div>
                <div>
                  <FieldLabel htmlFor={`isf-note-${s.id}`}>Note for citizens</FieldLabel>
                  <input id={`isf-note-${s.id}`} {...FIELDS.setInstitutionService.note} className={inputCls} value={note}
                    onChange={(e) => setNote(e.target.value)} />
                </div>
                <PrimaryButton type="submit" disabled={save.isPending}>
                  Save
                </PrimaryButton>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function InstitutionPortalPage({ ministryId, profile }: { ministryId: string; profile: ProfileT | null }) {
  const ministry = MINISTRIES.find((m) => m.id === ministryId);
  const [tab, setTab] = useState<"inbox" | "embassy" | "appointments" | "payments" | "services" | "officers" | "announcements" | "reports">("inbox");
  const apps = useQuery({
    queryKey: ["institution-apps"],
    queryFn: () => api.listInstitutionApplications({ limit: 100 }),
  });
  const appts = useQuery({
    queryKey: ["inst-appointments", ministry?.name ?? ""],
    queryFn: () => api.listInstitutionAppointments({ institution: ministry?.name ?? "" }),
    enabled: !!ministry,
  });
  const pays = useQuery({
    queryKey: ["inst-payments", ministry?.name ?? ""],
    queryFn: () => api.listInstitutionPayments({ institution: ministry?.name ?? "" }),
    enabled: !!ministry,
  });
  if (!ministry) {
    return <OnboardedPortalPage slug={ministryId} profile={profile} />;
  }
  const color = ministryColor(ministry.id);
  const mine = (apps.data?.applications ?? []).filter(
    (a: ApplicationT) => a.institution === ministry.name,
  );
  const tabs = [
    ["inbox", "Inbox"],
    ["embassy", "Embassy space"],
    ["appointments", "Appointment calendar"],
    ["payments", "Payments"],
    ["services", "Our services and fees"],
    ["officers", "Officers and roles"],
    ["announcements", "Announcements"],
    ["reports", "Reports and trust"],
  ] as const;
  return (
    <div>
      <section className="text-white" style={{ backgroundColor: color }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-7">
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-extrabold"
            style={{ backgroundColor: "#d9a821", color: "#0a2a5e" }}
          >
            {monogramOf(ministry.name)}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Institution portal
            </p>
            <h1 className="font-display text-2xl font-extrabold md:text-3xl">
              {ministry.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">{ministry.blurb}</p>
          </div>
        </div>
        <div style={{ backgroundColor: "#d9a821" }} className="h-1.5" />
      </section>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav aria-label={`${ministry.name} portal`} className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold"
              style={
                tab === key
                  ? { backgroundColor: color, color: "#fff" }
                  : { color: "var(--text)" }
              }>
              {label}
            </button>
          ))}
        </nav>
        {tab === "inbox" ? (
          <div className="mt-4 space-y-5">
            <OfficerWorkList institution={ministry.name} />
            <ReadyQueue institution={ministry.name} />
            <div className="space-y-3">
              {mine.length > 0 ? (
                mine.map((a: ApplicationT) => <InstitutionRow key={a.id} app={a} />)
              ) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                  No released applications for {ministry.name} yet. PortaGov
                  releases applications here after review and confirmed
                  payment. Nothing from another institution ever appears in
                  this inbox: each institution sees only its own.
                </p>
              )}
            </div>
            <BulkMessageTool institution={ministry.name} />
          </div>
        ) : null}
        {tab === "embassy" ? (
          <div className="mt-4">
            <EmbassyDesk institution={ministry.name} />
          </div>
        ) : null}
        {tab === "appointments" ? (
          <div className="mt-4 space-y-3">
            {(appts.data?.appointments ?? []).length > 0 ? (
              (appts.data?.appointments ?? []).map((a) => (
                <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
                  <p className="font-display font-bold text-[var(--text)]">
                    {a.date}, {a.time_slot}: {a.service_name}
                  </p>
                  <p className="text-[var(--dim)]">
                    {a.applicant_name}, ticket {a.ticket}, {a.kind}, group of{" "}
                    {a.group_size}, at {a.office}, application {a.application_ref},
                    status {a.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                No appointments booked on this institution's applications yet.
              </p>
            )}
          </div>
        ) : null}
        {tab === "payments" ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
              Confirmed total for {ministry.name}:{" "}
              <strong>${pays.data?.total_confirmed ?? 0}</strong>. This view
              shows only this institution's payments, separate from every
              other ministry.
            </p>
            {(pays.data?.payments ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
                {p.method}, ${p.amount}, application {p.application_ref},
                transaction {p.transaction_ref}, status {p.status},{" "}
                {fmtDate(p.created_at)}
              </div>
            ))}
            {(pays.data?.payments ?? []).length === 0 ? (
              <p className="text-sm text-[var(--dim)]">No payments yet.</p>
            ) : null}
          </div>
        ) : null}
        {tab === "services" ? (
          <div className="mt-4">
            <InstitutionServicesEditor institution={ministry.name} />
          </div>
        ) : null}
        {tab === "officers" ? (
          <div className="mt-4 space-y-5">
            <StaffPanel institution={ministry.name} />
            <TemplateLibrary institution={ministry.name} />
            <AuditPanel institution={ministry.name} />
          </div>
        ) : null}
        {tab === "announcements" ? (
          <div className="mt-4">
            <AnnouncementsBoard ministry={ministry.name} />
          </div>
        ) : null}
        {tab === "reports" ? (
          <div className="mt-4 space-y-5">
            <InstitutionDailySummary institution={ministry.name} />
            <InstitutionReports institution={ministry.name} />
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-display text-lg font-bold text-[var(--text)]">
                Downloadable service performance report
              </h2>
              <p className="mt-1 text-sm text-[var(--dim)]">
                Your applications, statuses, and payments as a spreadsheet
                file, for your own records and your ministry's reporting.
              </p>
              <div className="mt-3">
                <PrimaryButton
                  onClick={() =>
                    downloadCsv(`${ministry.id}-performance-report.csv`, [
                      ["Reference", "Applicant", "Service", "Status", "Channel", "Billing", "Billing status", "Amount paid", "Submitted"],
                      ...mine.map((a: ApplicationT) => [
                        a.reference,
                        a.applicant_name,
                        a.service_name,
                        a.status,
                        a.channel,
                        a.billing_number,
                        a.billing_status,
                        String(a.amount_paid),
                        a.created_at,
                      ]),
                    ])
                  }
                >
                  Download the report (CSV)
                </PrimaryButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- onboarded institution portal (created in the studio, no code) ---------- */

type BuilderChecklistItem = { label: string; required: boolean; greenRule: string };

function parseChecklist(json: string): BuilderChecklistItem[] {
  try {
    const v: unknown = JSON.parse(json);
    if (Array.isArray(v)) {
      return v
        .filter(
          (x): x is BuilderChecklistItem =>
            typeof x === "object" &&
            x !== null &&
            "label" in x &&
            typeof (x as { label: unknown }).label === "string",
        )
        .map((x) => ({
          label: x.label,
          required: x.required !== false,
          greenRule: typeof x.greenRule === "string" ? x.greenRule : "",
        }));
    }
  } catch {
    // A damaged checklist reads as no checklist.
  }
  return [];
}

function DynamicServiceApply({
  institutionName,
  service,
  profile,
}: {
  institutionName: string;
  service: { slug: string; name: string; fee_usd: number; checklist: string };
  profile: ProfileT;
}) {
  const [checked, setChecked] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [doneRef, setDoneRef] = useState("");
  const items = parseChecklist(service.checklist);
  const requiredIdx = items
    .map((it, i) => (it.required ? i : -1))
    .filter((i) => i >= 0);
  const allRequired = requiredIdx.every((i) => checked.includes(i));
  const submit = useMutation({
    mutationFn: async () =>
      await api.submitApplication({
        profileId: profile.id,
        serviceId: service.slug,
        serviceName: service.name,
        institution: institutionName,
        channel: "Self service",
        onBehalfOf: "",
        priority: "Standard",
        priorityFee: 0,
        serviceFee: service.fee_usd,
        collectionChoice: "",
        embassy: "",
        deliveryFee: 0,
        diasporaCountry: "",
        agentName: "",
        notes: "",
        businessId: 0,
        paymentPlan: false,
        details: items
          .filter((_, i) => checked.includes(i))
          .map((it) => ({ label: "Checklist confirmed", value: it.label })),
        documentIds: [],
      }),
    onSuccess: (r) => setDoneRef(r.application.reference),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Submission failed."),
  });
  if (doneRef) {
    return (
      <p className="mt-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
        Submitted to PortaGov. Your tracking number is {doneRef}. Find it in{" "}
        <a href="#/applications" className="underline">My applications</a> to
        attach documents and pay the billing number.
      </p>
    );
  }
  return (
    <div className="mt-2">
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
              <label className="flex items-start gap-2 font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5"
                  aria-label={`Ready: ${it.label}`}
                  checked={checked.includes(i)}
                  onChange={(e) =>
                    setChecked((prev) =>
                      e.target.checked
                        ? [...prev, i]
                        : prev.filter((x) => x !== i),
                    )
                  }
                />
                {it.label}
                {it.required ? " (required)" : " (optional)"}
              </label>
              {it.greenRule ? (
                <p className="mt-1 text-[var(--dim)]">
                  Turns green when: {it.greenRule}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--warn)]">{error}</p>
      ) : null}
      <div className="mt-3">
        <PrimaryButton
          onClick={() => {
            setError("");
            if (!allRequired) {
              setError("Every required checklist item must be green before you can submit, the same rule for every institution on PortaGov.");
              return;
            }
            submit.mutate();
          }}
          disabled={submit.isPending}
        >
          {submit.isPending ? "Submitting..." : "Submit to PortaGov"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function OnboardedPortalPage({ slug, profile }: { slug: string; profile: ProfileT | null }) {
  const data = useQuery({
    queryKey: ["onboarded", slug],
    queryFn: () => api.getOnboardedInstitution({ slug }),
  });
  const inst = data.data?.institution;
  if (data.isPending) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-[var(--dim)]">Loading this institution's portal...</p>;
  }
  if (!inst) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Institution not found</h1>
        <p className="mt-2 text-[var(--dim)]">
          This portal does not exist yet. Institutions join through
          PortaGov onboarding.
        </p>
      </div>
    );
  }
  return (
    <div>
      <section className="text-white" style={{ backgroundColor: inst.color }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-7">
          <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white font-display text-2xl font-extrabold" style={{ color: inst.color }}>
            {inst.monogram}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Institution portal{inst.status !== "Live" ? `, ${inst.status}` : ""}
            </p>
            <h1 className="font-display text-2xl font-extrabold md:text-3xl">{inst.name}</h1>
            {inst.about ? (
              <p className="mt-1 max-w-2xl text-sm text-white/85">{inst.about}</p>
            ) : null}
          </div>
        </div>
        <div style={{ backgroundColor: "#d9a821" }} className="h-1.5" />
      </section>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {inst.status !== "Live" ? (
          <p className="rounded-xl bg-[var(--gold-soft)] p-4 text-sm font-semibold text-[var(--warn)]">
            This portal is in {inst.status} mode. Citizens see it fully when
            PortaGov has verified the institution and its officers and the
            portal is switched to Live. Nothing here affects any live
            institution.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-[var(--dim)]">
          Contact: {inst.contact_name || "the institution"}
          {inst.contact_email ? `, ${inst.contact_email}` : ""}
          {inst.contact_phone ? `, ${inst.contact_phone}` : ""}
        </p>
        <div className="mt-6">
          <SectionTitle sub="Services this institution built on PortaGov, with their own fees, times, documents and checklists.">
            Services rendered here
          </SectionTitle>
          <div className="space-y-4">
            {(data.data?.services ?? []).map((s) => (
              <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="font-display text-lg font-bold text-[var(--text)]">{s.name}</p>
                {s.blurb ? <p className="mt-1 text-sm text-[var(--dim)]">{s.blurb}</p> : null}
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Fee ${s.fee_usd}
                  {s.processing_time ? `, ${s.processing_time}` : ""}
                </p>
                {profile ? (
                  inst.status === "Live" ? (
                    <DynamicServiceApply institutionName={inst.name} service={s} profile={profile} />
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[var(--warn)]">
                      This portal is in {inst.status} mode, so applications
                      open when PortaGov switches it to Live.
                    </p>
                  )
                ) : (
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    <a href="#/signin" className="font-semibold underline">Sign in</a>{" "}
                    to apply for this service.
                  </p>
                )}
              </div>
            ))}
            {(data.data?.services ?? []).length === 0 ? (
              <p className="text-sm text-[var(--dim)]">
                This institution has not added services yet. They are built
                in the onboarding studio, with no code.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- onboarding studio (92-99) ---------- */

function OnboardingStudioPage() {
  const queryClient = useQueryClient();
  const institutions = useQuery({
    queryKey: ["onboarded-all"],
    queryFn: () => api.listOnboardedInstitutions({ includeAll: true }),
  });
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    color: "#0A2A5E",
    monogram: "",
    about: "",
  });
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const create = useMutation({
    mutationFn: async () => await api.createInstitution({ ...form }),
    onSuccess: (r) => {
      setCreated(r.slug);
      void queryClient.invalidateQueries({ queryKey: ["onboarded-all"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Creation failed."),
  });
  const setStatus = useMutation({
    mutationFn: async (v: { id: number; status: "Sandbox" | "Pending approval" | "Approved" | "Live"; note?: string }) =>
      await api.setInstitutionStatus(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["onboarded-all"] }),
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Status change failed."),
  });
  const [svcInst, setSvcInst] = useState(0);
  const [svc, setSvc] = useState({ name: "", blurb: "", fee: "0", time: "" });
  const [items, setItems] = useState<BuilderChecklistItem[]>([
    { label: "", required: true, greenRule: "" },
  ]);
  const addService = useMutation({
    mutationFn: async () =>
      await api.addBuilderService({
        institutionId: svcInst,
        name: svc.name,
        blurb: svc.blurb,
        feeUsd: Number(svc.fee) || 0,
        processingTime: svc.time,
        checklist: items.filter((i) => i.label.trim().length >= 2),
      }),
    onSuccess: () => {
      setSvc({ name: "", blurb: "", fee: "0", time: "" });
      setItems([{ label: "", required: true, greenRule: "" }]);
      void queryClient.invalidateQueries({ queryKey: ["onboarded-all"] });
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Service could not be added."),
  });
  const list = institutions.data?.institutions ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">
        Institution onboarding studio
      </h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-[var(--dim)]">
        A new institution joins PortaGov with one form: name, logo mark,
        contact, services, fees, documents and times. PortaGov creates
        their own portal automatically, in minutes, with their branding.
        No code, no rebuild, no downtime for anyone else. Every portal
        starts in Sandbox, is previewed and tested there, and goes Live
        only after PortaGov verifies the institution and its officers.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-xl font-bold text-[var(--text)]">
          Step 1: the institution
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError("");
            if (form.name.trim().length < 3) {
              setError("The institution's full official name is required, exactly as it is registered.");
              return;
            }
            create.mutate();
          }}
        >
          <div>
            <FieldLabel htmlFor="ob-name">Institution name (required)</FieldLabel>
            <input id="ob-name" {...FIELDS.createInstitution.name} className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="The full official name, exactly as registered" />
            <p className="mt-1 text-xs text-[var(--dim)]">This name is what citizens see everywhere. Write it exactly; it cannot be quietly changed later, every change is versioned.</p>
          </div>
          <div>
            <FieldLabel htmlFor="ob-contact">Contact person (required for verification)</FieldLabel>
            <input id="ob-contact" {...FIELDS.createInstitution.contactName} className={inputCls} value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder="The officer PortaGov will verify" />
          </div>
          <div>
            <FieldLabel htmlFor="ob-email">Official email</FieldLabel>
            <input id="ob-email" {...FIELDS.createInstitution.contactEmail} type="email" className={inputCls} value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="An official address, not a personal one" />
          </div>
          <div>
            <FieldLabel htmlFor="ob-phone">Official phone</FieldLabel>
            <input id="ob-phone" {...FIELDS.createInstitution.contactPhone} className={inputCls} value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="Office number citizens can call" />
          </div>
          <div>
            <FieldLabel htmlFor="ob-color">Brand colour</FieldLabel>
            <input id="ob-color" type="color" className="h-11 w-full rounded-lg border border-[var(--border)]"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <p className="mt-1 text-xs text-[var(--dim)]">The colour of the portal's header band. PortaGov gold stays as the shared accent.</p>
          </div>
          <div>
            <FieldLabel htmlFor="ob-mono">Logo letters (monogram)</FieldLabel>
            <input id="ob-mono" {...FIELDS.createInstitution.monogram} className={inputCls} value={form.monogram}
              onChange={(e) => setForm({ ...form, monogram: e.target.value })}
              placeholder="Two or three letters, for example MF for a ministry. Blank makes them from the name." />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="ob-about">About the institution</FieldLabel>
            <textarea id="ob-about" {...FIELDS.createInstitution.about} className={inputCls} rows={2} value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              placeholder="One or two plain sentences citizens will read on the portal" />
          </div>
          <div>
            <PrimaryButton type="submit" disabled={create.isPending}>
              Create the portal in Sandbox
            </PrimaryButton>
          </div>
        </form>
        {created ? (
          <p className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
            Portal created. Preview it exactly as citizens will see it:{" "}
            <a href={`#/institution/${created}`} className="underline">
              open the portal preview
            </a>
            . It is in Sandbox: build its services below, test, then request
            approval.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-xl font-bold text-[var(--text)]">
          Step 2: build services, no code
        </h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Add a service with its fee, time, and checklist. Checklist items
          are required or optional, and each one says what turns it green.
          The rule is enforced the same way for every institution: required
          items must all be green before a citizen can submit.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="ob-svc-inst">Institution</FieldLabel>
            <select id="ob-svc-inst" className={inputCls} value={svcInst}
              onChange={(e) => setSvcInst(Number(e.target.value))}>
              <option value={0}>Choose the institution</option>
              {list.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.status})</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="ob-svc-name">Service name (required)</FieldLabel>
            <input id="ob-svc-name" {...FIELDS.addBuilderService.name} className={inputCls} value={svc.name}
              onChange={(e) => setSvc({ ...svc, name: e.target.value })}
              placeholder="For example: Market stall permit" />
          </div>
          <div>
            <FieldLabel htmlFor="ob-svc-fee">Fee in USD (required, 0 means free)</FieldLabel>
            <input id="ob-svc-fee" {...FIELDS.addBuilderService.feeUsd} type="number" className={inputCls} value={svc.fee}
              onChange={(e) => setSvc({ ...svc, fee: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="ob-svc-time">Processing time</FieldLabel>
            <input id="ob-svc-time" {...FIELDS.addBuilderService.processingTime} className={inputCls} value={svc.time}
              onChange={(e) => setSvc({ ...svc, time: e.target.value })}
              placeholder="For example: 3 to 5 working days" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="ob-svc-blurb">Short description for citizens</FieldLabel>
            <input id="ob-svc-blurb" {...FIELDS.addBuilderService.blurb} className={inputCls} value={svc.blurb}
              onChange={(e) => setSvc({ ...svc, blurb: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <p className="font-display font-bold text-[var(--text)]">Checklist and documents builder</p>
          {items.map((it, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg bg-[var(--surface-alt)] p-3 sm:grid-cols-[1fr_auto_1fr]">
              <input
                aria-label={`Checklist item ${idx + 1}`}
                {...FIELDS.addBuilderService.checklist.label}
                className={inputCls}
                value={it.label}
                onChange={(e) =>
                  setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                }
                placeholder="For example: National ID card in your wallet"
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  aria-label={`Item ${idx + 1} is required`}
                  checked={it.required}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))
                  }
                />
                Required
              </label>
              <input
                aria-label={`What turns item ${idx + 1} green`}
                {...FIELDS.addBuilderService.checklist.greenRule}
                className={inputCls}
                value={it.greenRule}
                onChange={(e) =>
                  setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, greenRule: e.target.value } : x)))
                }
                placeholder="Turns green when the card is valid and in date"
              />
            </div>
          ))}
          <GhostButton onClick={() => setItems((prev) => [...prev, { label: "", required: true, greenRule: "" }])}>
            Add another checklist item
          </GhostButton>
        </div>
        <div className="mt-4">
          <PrimaryButton
            onClick={() => {
              setError("");
              if (!svcInst) {
                setError("Choose the institution first.");
                return;
              }
              if (svc.name.trim().length < 3) {
                setError("The service name is required.");
                return;
              }
              addService.mutate();
            }}
            disabled={addService.isPending}
          >
            Add the service
          </PrimaryButton>
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle sub="Each institution gets its own space, inbox, and queue: a new joiner never slows the others, and one institution can never see another's applications. Sandbox work never touches live data.">
          Institutions and their portals
        </SectionTitle>
        <div className="space-y-3">
          {list.map((i) => (
            <div key={i.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-bold text-[var(--text)]">
                  <span aria-hidden className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-white" style={{ backgroundColor: i.color }}>
                    {i.monogram}
                  </span>
                  {i.name}
                </p>
                <Chip tone={i.status === "Live" ? "gold" : "plain"}>{i.status}</Chip>
              </div>
              <p className="mt-1 text-sm text-[var(--dim)]">
                {i.services_count} services built. Contact: {i.contact_name || "not set"}
                {i.contact_email ? `, ${i.contact_email}` : ""}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`#/institution/${i.slug}`} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text)]">
                  Preview the portal
                </a>
                {i.status === "Sandbox" ? (
                  <GhostButton onClick={() => setStatus.mutate({ id: i.id, status: "Pending approval", note: "Institution requests PortaGov verification" })}>
                    Request PortaGov approval
                  </GhostButton>
                ) : null}
                {i.status === "Approved" ? (
                  <PrimaryButton onClick={() => setStatus.mutate({ id: i.id, status: "Live", note: "Flipped to Live from the studio" })}>
                    Flip to Live
                  </PrimaryButton>
                ) : null}
                {i.status === "Live" ? (
                  <GhostButton onClick={() => setStatus.mutate({ id: i.id, status: "Sandbox", note: "Returned to Sandbox for changes" })}>
                    Back to Sandbox
                  </GhostButton>
                ) : null}
              </div>
              <InstitutionVersions institutionId={i.id} />
            </div>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-[var(--dim)]">No onboarded institutions yet. Create the first one above.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InstitutionVersions({ institutionId }: { institutionId: number }) {
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: ["inst-versions", institutionId],
    queryFn: () => api.listInstitutionVersions({ institutionId }),
  });
  const rollback = useMutation({
    mutationFn: async (versionId: number) =>
      await api.rollbackInstitution({ institutionId, versionId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["onboarded-all"] });
      void queryClient.invalidateQueries({ queryKey: ["inst-versions"] });
    },
  });
  const list = versions.data?.versions ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-alt)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">
        Version and change log
      </p>
      <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
        {list.slice(0, 6).map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {v.label}, {fmtDateTime(v.created_at)}
            </span>
            <button type="button" className="font-bold underline" style={{ color: "#0a2a5e" }}
              onClick={() => rollback.mutate(v.id)}>
              Roll back to this version
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-[var(--dim)]">
        Rolling back restores the portal settings recorded in that version.
        Citizens' applications are never touched by a rollback.
      </p>
    </div>
  );
}

function OnboardingApprovals() {
  const queryClient = useQueryClient();
  const institutions = useQuery({
    queryKey: ["onboarded-all"],
    queryFn: () => api.listOnboardedInstitutions({ includeAll: true }),
  });
  const setStatus = useMutation({
    mutationFn: async (v: { id: number; status: "Sandbox" | "Pending approval" | "Approved" | "Live"; note?: string }) =>
      await api.setInstitutionStatus(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["onboarded-all"] }),
  });
  const pending = (institutions.data?.institutions ?? []).filter(
    (i) => i.status === "Pending approval",
  );
  const others = (institutions.data?.institutions ?? []).filter(
    (i) => i.status !== "Pending approval",
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Institution onboarding approvals
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Secure approval flow: an institution builds in Sandbox, previews,
        and requests approval. PortaGov verifies the institution is real
        and verifies its named officers before approving. Only an approved
        institution can go Live, and approval is recorded in its version
        log.
      </p>
      <div className="mt-3 space-y-2">
        {pending.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm">
            <span className="font-semibold text-[var(--text)]">
              {i.name}, waiting for verification. Contact: {i.contact_name}
              {i.contact_email ? `, ${i.contact_email}` : ""}
              {i.contact_phone ? `, ${i.contact_phone}` : ""}
            </span>
            <PrimaryButton
              onClick={() =>
                setStatus.mutate({
                  id: i.id,
                  status: "Approved",
                  note: "Verified by PortaGov: institution and officers checked",
                })
              }
              disabled={setStatus.isPending}
            >
              Verify and approve
            </PrimaryButton>
          </div>
        ))}
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No institutions are waiting for approval.</p>
        ) : null}
        {others.map((i) => (
          <p key={i.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
            {i.name}: {i.status}, {i.services_count} services.{" "}
            <a href={`#/institution/${i.slug}`} className="font-semibold underline">Open portal</a>
          </p>
        ))}
      </div>
      <p className="mt-3 text-sm text-[var(--dim)]">
        New institutions are created in the{" "}
        <a href="#/onboarding" className="font-semibold underline">onboarding studio</a>.
      </p>
    </div>
  );
}

/* ---------- per-page Help button: plain words about this page, then a real person ---------- */

const PAGE_HELP: Record<string, { title: string; lines: string[] }> = {
  home: {
    title: "Home",
    lines: [
      "This is the front page. Pick a ministry or a service to start, or sign in to see your own applications.",
      "You apply to PortaGov first. PortaGov checks your documents, you pay a billing number, and only then is your application sent to the institution.",
      "PortaGov never asks you to pay to a personal number. Pay only to the billing number on your application.",
    ],
  },
  ministry: {
    title: "Ministry",
    lines: [
      "This page lists one ministry and the services it offers.",
      "Pick a service to see its fee, the time it takes, and the documents you need.",
      "You sign in before you start an application.",
    ],
  },
  service: {
    title: "Service",
    lines: [
      "This page explains one service: its fee, the time it takes, and what you need.",
      "Read the documents list first. Every document must be green before you can submit.",
      "Press Start application when you are ready. You sign in first if you have not already.",
    ],
  },
  signin: {
    title: "Sign in",
    lines: [
      "Sign in with your phone number. PortaGov sends you a code, and you type it here.",
      "New here? Choose I am new here and fill in your details once. PortaGov saves them, so you never type them again.",
      "Returning? Choose I am not new here and your saved details come back.",
    ],
  },
  account: {
    title: "My account",
    lines: [
      "Your saved details live here: your name, phone, address, and documents.",
      "Change anything that is wrong. Every application you start after that uses the new details.",
      "Your profile is saved on your account, so you only give your details once.",
    ],
  },
  apply: {
    title: "Apply",
    lines: [
      "Fill in this form step by step. The checklist at the top must be all green before you can submit.",
      "You can save a draft and finish later. Drafts are listed under Drafts in My applications, on this device.",
      "After you submit, PortaGov gives you a billing number and a tracking number. Pay the billing number, and PortaGov releases your application to the institution.",
    ],
  },
  applications: {
    title: "My applications",
    lines: [
      "Every application you have sent, with its live status.",
      "Drafts you have not finished yet are listed at the top. Press Resume draft to pick one up where you left off.",
      "Press an application to see its timeline, its billing number, and its payments.",
    ],
  },
  application: {
    title: "Application",
    lines: [
      "This is one application. The top card shows where it is: with PortaGov or with the institution.",
      "Your tracking number and billing number are on this page. Keep the tracking number, you need it to follow up.",
      "Pay the billing number with MTN MoMo or Orange Money, then book a visit here if the service needs you in person.",
    ],
  },
  wallet: {
    title: "Wallet",
    lines: [
      "Your document wallet holds your documents, so you never upload the same one twice.",
      "Add a document once, and attach it to any application from here.",
      "Payment receipts from every confirmed payment are kept here too, with the billing number, amount, date, service and method.",
    ],
  },
  appointments: {
    title: "Appointments",
    lines: [
      "Your booked visits, soonest first.",
      "Book a visit from an application page when the service needs you in person.",
      "Bring your ID and your ticket number to the visit.",
    ],
  },
  payments: {
    title: "Payments",
    lines: [
      "Every payment, receipt, and refund of yours, in one list.",
      "A receipt appears here only after PortaGov confirms the payment against your billing number.",
      "Press a payment to open its application, or download the receipt to print it.",
    ],
  },
  family: {
    title: "My family",
    lines: [
      "The people you apply for most, saved once with their consent.",
      "Only family members with consent saved here can be chosen on an application.",
      "PortaGov never applies for someone without their consent.",
    ],
  },
  track: {
    title: "Track",
    lines: [
      "Type your tracking number and phone to see where your application is.",
      "You do not need to be signed in to track.",
      "If the number is not found, check the letters and try again, or ask the help desk.",
    ],
  },
  access: {
    title: "Ways to apply",
    lines: [
      "Ways to apply: by yourself, with a PortaGov agent, or from abroad.",
      "No smartphone of your own? An agent at a service centre can sit with you and apply in your name.",
      "Living abroad? Apply from any country and choose embassy delivery or collection in Monrovia.",
    ],
  },
  how: {
    title: "How it works",
    lines: [
      "How PortaGov works, step by step: apply, documents checked, pay the billing number, then release to the institution.",
      "The institution only sees your application after PortaGov releases it.",
      "PortaGov tracks your payment, tracking number and updates at every step.",
    ],
  },
  help: {
    title: "Help",
    lines: [
      "Ask the help team anything, in plain words.",
      "Leave your name and number, and the help team will call you back.",
      "If the assistant cannot answer, your question becomes a ticket for a real person, on the same tracking number where it applies.",
    ],
  },
  centre: {
    title: "Service centre",
    lines: [
      "County service centres: walk in, and an officer helps you apply on the spot.",
      "Bring your documents and your phone number.",
      "The officer applies with you, and your application still goes through PortaGov the same way.",
    ],
  },
  business: {
    title: "Business",
    lines: [
      "For businesses: file applications for your people from one company wallet.",
      "Pay a billing from the company balance, and the receipt belongs to that person's application.",
      "Your business details are saved once and reused on every application.",
    ],
  },
  verify: {
    title: "Verify",
    lines: [
      "Check that a PortaGov certificate is real.",
      "Type the certificate number, and PortaGov tells you if it is valid and who it belongs to.",
      "A certificate that does not verify should not be trusted.",
    ],
  },
  embassies: {
    title: "Embassies",
    lines: [
      "Every Liberian embassy, with its hours, contacts, and what it can collect or deliver.",
      "Living abroad, choose the embassy in your country when you apply.",
      "The embassy is updated about your service, so it can help you locally.",
    ],
  },
  privacy: {
    title: "Privacy",
    lines: [
      "Your details belong to you. PortaGov uses them only to run your applications.",
      "PortaGov never sells your details and never asks for your password or code by phone.",
      "Read this page for the full promise, in plain words.",
    ],
  },
  certificate: {
    title: "Certificate",
    lines: [
      "Your digital certificate for a finished service.",
      "Check the number, the name, and the service. Keep it safe, and share it only where you need to.",
      "Anyone can verify it on the Verify page.",
    ],
  },
  near: {
    title: "Near me",
    lines: [
      "Services and help near you, by county.",
      "Find the closest service centre or agent.",
      "If nothing is near you, apply from home, that is what PortaGov is for.",
    ],
  },
  dashboard: {
    title: "Dashboard",
    lines: [
      "A public view of how PortaGov is doing.",
      "Counts of applications and services, with no personal details.",
      "Your own applications are under My applications, not here.",
    ],
  },
  training: {
    title: "Training",
    lines: [
      "Short guides that teach you how to use PortaGov.",
      "Start with the basics, then learn one thing at a time.",
      "Stuck? Ask a question below, or open the help page.",
    ],
  },
  status: {
    title: "Status",
    lines: [
      "The live state of PortaGov: whether services are running normally.",
      "If something is down, this page says what is affected.",
      "Your applications and drafts are safe on your device while PortaGov is checked.",
    ],
  },
  shared: {
    title: "Shared application",
    lines: [
      "Someone shared an application with you through a secure link.",
      "You see only what was shared with you, nothing else.",
      "If the link does not open, ask the person who sent it to send it again.",
    ],
  },
  onboarding: {
    title: "Join PortaGov",
    lines: [
      "Joining a new institution to PortaGov.",
      "Fill in the form, preview how your services will look, and test in the sandbox.",
      "PortaGov approves you before you go live, with no rebuild and no code change.",
    ],
  },
};

function pageHelpFor(route: Route): { title: string; lines: string[] } {
  return (
    PAGE_HELP[route.name] ?? {
      title: "This page",
      lines: [
        "This page is part of PortaGov, where you apply for government services from home.",
        "If anything here is unclear, ask below in plain words. If the assistant cannot answer, it passes your question to a real person.",
      ],
    }
  );
}

/* ---------- PortaGov AI assistant (floating, on citizen pages) ---------- */

type ChatMsg = { from: "ai" | "citizen" | "system"; text: string };

type KbArticle = { id: number; topic: string; question: string; answer: string; added_by: string };

function assistantContext(question: string, profile: ProfileT | null, apps: ApplicationT[], kb: KbArticle[] = []): string {
  const qWords = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const kbHits = kb
    .filter((a) => qWords.some((w) => a.question.toLowerCase().includes(w) || a.topic.toLowerCase().includes(w)))
    .slice(0, 3);
  const q = question.toLowerCase();
  const hits = SERVICES.filter(
    (s) =>
      s.name.toLowerCase().split(/\W+/).some((w) => w.length > 3 && q.includes(w)) ||
      ministryById(s.ministryId).name.toLowerCase().split(/\W+/).some((w) => w.length > 3 && q.includes(w)),
  ).slice(0, 4);
  const serviceText = hits
    .map((s) => {
      const d = serviceDetails(s.id);
      return `Service: ${s.name} at ${ministryById(s.ministryId).name}. Fee $${d.feeUsd}. Time: ${d.processingTime}. Collection: ${d.collectionPoint}. Needs: ${s.requirements.join("; ")}. Visit: ${s.visitNote}`;
    })
    .join("\n");
  const myApps = profile
    ? apps
        .slice(0, 5)
        .map(
          (a) =>
            `Application ${a.reference}: ${a.service_name} at ${a.institution}, status ${a.status}, billing ${a.billing_number} is ${a.billing_status}, amount paid $${a.amount_paid} of $${a.total_due}.`,
        )
        .join("\n")
    : "The citizen is not signed in, so no personal application data is available. For personal status questions, they must sign in or use Track with their reference and phone.";
  return [
    "How PortaGov works: the citizen applies to PortaGov first with a checklist that must be all green. PortaGov checks documents. The citizen pays the billing number with MTN MoMo or Orange Money. Only when the billing number is confirmed paid does PortaGov release the application to the institution. After release the institution messages the citizen directly about the way forward and pickup. PortaGov tracks the amount paid and the tracking number at every step. PortaGov will never ask for payment to a personal number, only to the official billing number on the application. Documents live in the citizen's wallet and are reused, never asked twice. National ID is never a blocker: birth certificate, passport, voter card, or photo plus witness also work. Liberians abroad apply from any country and can choose delivery to the Liberian embassy in their country for a $15 fee. Fast-track costs an extra $10, emergency $25, shown before paying, no hidden fees.",
    serviceText ? `Services that may match the question:\n${serviceText}` : "No specific service matched the question.",
    `The citizen's own applications:\n${myApps}`,
    "Responsible teams: Help desk (accounts, sign-in, general help, tickets), Payments desk (billing numbers, MoMo and Orange Money, refunds, reconciliation), Release team (applications held by PortaGov, release questions), or the named institution (a service it renders, its documents, its processing, pickup).",
    kbHits.length > 0
      ? `Approved answers from the PortaGov knowledge base, written by staff. Prefer these when they fit:\n${kbHits.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n")}`
      : "The knowledge base has no entry matching this question.",
  ].join("\n\n");
}

function AssistantPanel({ profile, route }: { profile: ProfileT | null; route: Route }) {
  const help = pageHelpFor(route);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      from: "ai",
      text: "Hello, I am the PortaGov assistant. Ask me about any service, its documents, fee, or time, or about your own application. If I cannot answer, I will pass your question to the right person and make a ticket for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingRoute, setPendingRoute] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [ticketMsg, setTicketMsg] = useState("");
  const apps = useQuery({
    queryKey: ["applications", profile?.id ?? 0],
    queryFn: () => api.listApplications({ profileId: profile?.id ?? 0 }),
    enabled: !!profile && open,
  });
  const kb = useQuery({
    queryKey: ["kb-articles"],
    queryFn: () => api.listKbArticles({ limit: 50 }),
    enabled: open,
  });
  const ask = useMutation({
    mutationFn: async (question: string) =>
      await api.askAssistant({
        question,
        context: [
          `The citizen is on this page: ${help.title}. ${help.lines.join(" ")}`,
          assistantContext(question, profile, apps.data?.applications ?? [], kb.data?.articles ?? []),
        ].join("\n\n"),
      }),
    onSuccess: (r, question) => {
      setMessages((prev) => [...prev, { from: "ai", text: r.answer }]);
      if (r.needs_ticket) {
        setPendingRoute(r.route && r.route !== "None" ? r.route : "Help desk");
        setPendingQuestion(question);
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          from: "ai",
          text: "I could not reach my knowledge just now. I can still pass your question to the Help desk as a ticket, so a real person answers you.",
        },
      ]);
      setPendingRoute("Help desk");
    },
  });
  const relatedApp = () => {
    const myApps = apps.data?.applications ?? [];
    return (
      myApps.find((a) =>
        pendingQuestion.toUpperCase().includes(a.reference.toUpperCase()),
      ) ?? myApps[0]
    );
  };
  const createTicket = useMutation({
    mutationFn: async () => {
      const related = relatedApp();
      const syncNote = related
        ? `\n\n[Synced to application ${related.reference} (${related.service_name} at ${related.institution}, status ${related.status}). Keep every reply on this same application and tracking number, ${related.reference}.]`
        : "";
      return await api.submitHelpRequest({
        profileId: profile?.id ?? null,
        name: profile?.full_name ?? guestName,
        phone: profile?.phone ?? guestPhone,
        topic: pendingRoute,
        message: `${pendingQuestion}\n\n[Passed by the PortaGov assistant to: ${pendingRoute}. The assistant could not answer this fully. Citizen is signed in as ${profile?.full_name ?? "a guest"}.]${syncNote}`,
      });
    },
    onSuccess: (r) => {
      const related = relatedApp();
      setTicketMsg(
        `Done. Your ticket is ${ticketNumber(r.id, new Date().toISOString())}, routed to ${pendingRoute}.${related ? ` It is synced to your application ${related.reference}, so the reply stays on that same tracking number.` : ""} A real person will answer, promised within one working day, and the reply lands in your messages and on the Help page, under the same history. Nobody will ask you the same thing twice.`,
      );
      setPendingRoute("");
      setPendingQuestion("");
    },
  });
  const simplify = useMutation({
    mutationFn: async (text: string) =>
      await api.simplifyText({ text: text.slice(0, 3900) }),
    onSuccess: (r) => {
      setMessages((prev) => [
        ...prev,
        { from: "ai", text: `In Liberian English: ${r.simple}` },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          from: "ai",
          text: "I could not write that in Liberian English just now. Please tap the button again.",
        },
      ]);
    },
  });
  const send = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setMessages((prev) => [...prev, { from: "citizen", text: question }]);
    setInput("");
    setTicketMsg("");
    ask.mutate(question);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages, ask.isPending, pendingRoute, ticketMsg]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Open the PortaGov assistant"
        title="Open the PortaGov assistant"
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg md:bottom-6"
        style={{ backgroundColor: "#0a2a5e", border: "2px solid #d9a821" }}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>
      {open ? (
        <div className="fixed bottom-36 right-4 z-50 flex max-h-[85vh] w-[min(92vw,380px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:bottom-24" role="dialog" aria-label="PortaGov assistant chat">
          <div className="flex items-center justify-between rounded-t-2xl px-4 py-3 text-white" style={{ backgroundColor: "#0a2a5e" }}>
            <p className="font-display font-extrabold">PortaGov assistant</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the assistant" className="rounded-full px-2 py-1 font-bold">
              Close
            </button>
          </div>
          <div ref={scrollRef} className="min-h-[30vh] flex-1 space-y-2 overflow-y-auto p-3">
            <div className="rounded-xl bg-[var(--surface-alt)] p-3">
              <p className="text-sm font-bold text-[var(--text)]">Help with this page: {help.title}</p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
                {help.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--dim)]">
                Ask below in plain words. If the assistant cannot answer, it passes your question to a real person.
              </p>
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.from === "citizen"
                    ? "ml-8 rounded-xl p-3 text-sm text-white"
                    : "mr-8 rounded-xl bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]"
                }
                style={m.from === "citizen" ? { backgroundColor: "#0a2a5e" } : undefined}
              >
                {m.text}
              </div>
            ))}
            {ask.isPending ? (
              <p className="text-sm text-[var(--dim)]">Thinking...</p>
            ) : null}
            {pendingRoute ? (
              <div className="rounded-xl bg-[var(--gold-soft)] p-3 text-sm">
                <p className="font-semibold text-[var(--warn)]">
                  This one needs a person. The right team is: {pendingRoute}.
                </p>
                {!profile ? (
                  <div className="mt-2 space-y-2">
                    <input aria-label="Your name for the ticket" {...FIELDS.submitHelpRequest.name} className={inputCls} value={guestName}
                      onChange={(e) => setGuestName(e.target.value)} placeholder="Your full name" />
                    <input aria-label="Your phone for the ticket" {...FIELDS.submitHelpRequest.phone} className={inputCls} value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)} placeholder="Your phone number" />
                  </div>
                ) : null}
                <div className="mt-2">
                  <PrimaryButton
                    onClick={() => {
                      if (!profile && (guestName.trim().length < 2 || guestPhone.trim().length < 7)) return;
                      createTicket.mutate();
                    }}
                    disabled={createTicket.isPending}
                  >
                    Pass it to {pendingRoute} and make my ticket
                  </PrimaryButton>
                </div>
              </div>
            ) : null}
            {ticketMsg ? (
              <p className="rounded-xl bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
                {ticketMsg}
              </p>
            ) : null}
          </div>
          {messages.some((m) => m.from === "citizen") ? (
            <div className="px-3 pb-2">
              <button
                type="button"
                disabled={simplify.isPending}
                onClick={() => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.from === "ai" && !m.text.startsWith("In Liberian English:"));
                  if (last && last.text.length >= 10) simplify.mutate(last.text);
                }}
                className="rounded-full border-2 px-3 py-1.5 text-xs font-bold text-[var(--text)]"
                style={{ borderColor: "#0a2a5e" }}
              >
                {simplify.isPending
                  ? "Writing it in Liberian English..."
                  : "Tell me in Liberian English"}
              </button>
            </div>
          ) : null}
          <div className="px-3 pb-2">
            <p className="pb-1 text-xs font-bold text-[var(--dim)]">
              Ready questions, tap one, or type your own below
            </p>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {[
                "How do I apply?",
                "What does a birth certificate cost?",
                "What documents do I need for a police clearance?",
                "What does a passport cost?",
                "How do I track my application?",
                "Where do I collect my document?",
                "How does payment work?",
                "I live abroad, can I apply?",
              ].map((chip) => (
                <button key={chip} type="button" onClick={() => send(chip)}
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text)]">
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <form
            className="flex gap-2 border-t border-[var(--border)] p-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              aria-label="Ask the PortaGov assistant"
              {...FIELDS.askAssistant.question}
              className={inputCls}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a service, fee, document, status..."
            />
            <PrimaryButton type="submit" disabled={ask.isPending}>
              Ask
            </PrimaryButton>
          </form>
        </div>
      ) : null}
    </>
  );
}

/* ---------- staff portals: manager (platform) and help desk queue ---------- */

const ROLE_PERMISSIONS: Record<string, string> = {
  "Help desk": "Answers support tickets and live chat, assigns tickets, requests call-backs. Cannot release applications or confirm payments.",
  "Release officer": "Reviews held applications and releases or recalls them. Cannot confirm payments.",
  "Payments desk": "Confirms payments against billing numbers, runs reconciliation, handles refunds. Cannot release applications.",
  "Support supervisor": "Sees every queue, response times, the audit trail and health screen. Can do help desk and release work.",
  "Platform admin": "Everything, plus creating staff accounts, onboarding approvals, and the release mode switch.",
};

function StaffPortalManager() {
  const queryClient = useQueryClient();
  const staff = useQuery({
    queryKey: ["staff-accounts"],
    queryFn: () => api.listStaffAccounts({}),
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"Help desk" | "Release officer" | "Payments desk" | "Support supervisor" | "Platform admin">("Help desk");
  const [scope, setScope] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const create = useMutation({
    mutationFn: async () =>
      await api.createStaffAccount({ name, phone, role, scope, password: staffPassword }),
    onSuccess: () => {
      setName("");
      setPhone("");
      setScope("");
      setStaffPassword("");
      void queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
    },
  });
  const toggle = useMutation({
    mutationFn: async (v: { id: number; active: boolean }) =>
      await api.setStaffActive(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Staff portals and accounts
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        PortaGov runs on people, not on one person. Create staff accounts
        here, each with a role, clear permissions, and their own sign-in
        password, and each person signs in to the{" "}
        <a href="#/staff" className="font-semibold underline">staff portal</a>{" "}
        with their name, phone, and that password. More hands, in the right
        queues, means no glitches, hindrances, or delays from PortaGov's
        side.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim().length >= 2 && phone.trim().length >= 7 && staffPassword.length >= 8) create.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="st-name">Staff full name (required)</FieldLabel>
          <input id="st-name" {...FIELDS.createStaffAccount.name} className={inputCls} value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The person's real name, it appears on their work" />
        </div>
        <div>
          <FieldLabel htmlFor="st-phone">Staff phone number (required, their sign-in)</FieldLabel>
          <input id="st-phone" {...FIELDS.createStaffAccount.phone} className={inputCls} value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="The phone they will sign in with" />
        </div>
        <div>
          <FieldLabel htmlFor="st-role">Role (sets their permissions)</FieldLabel>
          <select id="st-role" {...FIELDS.createStaffAccount.role} className={inputCls} value={role}
            onChange={(e) => setRole(e.target.value as "Help desk" | "Release officer" | "Payments desk" | "Support supervisor" | "Platform admin")}>
            {Object.keys(ROLE_PERMISSIONS).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--dim)]">{ROLE_PERMISSIONS[role]}</p>
        </div>
        <div>
          <FieldLabel htmlFor="st-scope">Scope (optional, for example an institution or county)</FieldLabel>
          <input id="st-scope" {...FIELDS.createStaffAccount.scope} className={inputCls} value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Blank means the whole platform" />
        </div>
        <div>
          <FieldLabel htmlFor="st-password">Sign-in password (required, at least 8 characters)</FieldLabel>
          <input id="st-password" type="password" {...FIELDS.createStaffAccount.password} className={inputCls} value={staffPassword}
            onChange={(e) => setStaffPassword(e.target.value)}
            placeholder="Give it to the person privately, never post it"
            autoComplete="new-password" />
        </div>
        <div>
          <PrimaryButton type="submit" disabled={create.isPending}>
            Create staff account
          </PrimaryButton>
        </div>
      </form>
      <ul className="mt-4 space-y-2">
        {(staff.data?.staff ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <span className="text-[var(--text)]">
              <strong>{s.name}</strong>, {s.role}
              {s.scope ? `, scope: ${s.scope}` : ""}, {s.phone},{" "}
              {s.active ? "active" : "suspended"}
            </span>
            <button type="button" className="font-bold underline" style={{ color: "#0a2a5e" }}
              onClick={() => toggle.mutate({ id: s.id, active: !s.active })}>
              {s.active ? "Suspend" : "Reactivate"}
            </button>
          </li>
        ))}
        {(staff.data?.staff ?? []).length === 0 ? (
          <li className="text-sm text-[var(--dim)]">No staff accounts yet. Create the first one above.</li>
        ) : null}
      </ul>
    </div>
  );
}

function HelpDeskPanel({ staffName }: { staffName?: string }) {
  const queryClient = useQueryClient();
  const flag = useFlags();
  const [summaries, setSummaries] = useState<Record<number, string>>({});
  const summarize = useMutation({
    mutationFn: async (id: number) => await api.summarizeTicket({ id }),
    onSuccess: (r, id) =>
      setSummaries((prev) => ({ ...prev, [id]: r.summary })),
  });
  const tickets = useQuery({
    queryKey: ["help-requests"],
    queryFn: () => api.listHelpRequests({ limit: 50 }),
  });
  const staff = useQuery({
    queryKey: ["staff-accounts"],
    queryFn: () => api.listStaffAccounts({}),
  });
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [assigns, setAssigns] = useState<Record<number, string>>({});
  const assign = useMutation({
    mutationFn: async (v: { id: number; officerName: string }) =>
      await api.assignHelpRequest(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["help-requests"] }),
  });
  const reply = useMutation({
    mutationFn: async (v: { id: number; reply: string }) =>
      await api.replyHelpRequest(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["help-requests"] }),
  });
  const list = tickets.data?.requests ?? [];
  const open = list.filter((t) => t.status !== "Answered");
  const tooLong = open.filter(
    (t) => Date.now() - new Date(t.created_at).getTime() > 24 * 3600 * 1000,
  );
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Help desk: support ticket queue ({open.length} open)
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every Ask us anything and every assistant hand-off lands here as a
        ticket with a number. Assign it, answer it, and the citizen sees
        the reply in their inbox and on the Help page, in the same history
        as their applications. PortaGov promises an answer within one
        working day.
      </p>
      {tooLong.length > 0 ? (
        <div className="mt-3 rounded-lg p-3 text-sm font-bold text-white" style={{ backgroundColor: "#b3261e" }} role="alert">
          {tooLong.length} ticket{tooLong.length === 1 ? " has" : "s have"} waited more than
          24 hours with no answer: {tooLong.map((t) => `${t.name} (${ticketNumber(t.id, t.created_at)})`).join(", ")}.
          Nobody should be forgotten. Answer or assign {tooLong.length === 1 ? "it" : "them"} now.
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        {list.map((t) => {
          const waitHrs = Math.max(
            0,
            Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000),
          );
          const answerHrs =
            t.answered_at && t.created_at
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(t.answered_at).getTime() - new Date(t.created_at).getTime()) / 3600000,
                  ),
                )
              : null;
          const isLate = t.status !== "Answered" && waitHrs >= 24;
          return (
            <div key={t.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm" style={isLate ? { border: "2px solid #b3261e" } : undefined}>
              <p className="font-bold text-[var(--text)]">
                {ticketNumber(t.id, t.created_at)}: {t.topic}, from {t.name} ({t.phone})
                {isLate ? <span className="ml-2 rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: "#b3261e" }}>WAITING TOO LONG</span> : null}
              </p>
              <p className="text-[var(--dim)]">{t.message}</p>
              <p className="mt-1 text-[var(--dim)]">
                Status: {t.status}
                {t.assigned_to ? `, assigned to ${t.assigned_to}` : ", unassigned"}
                {answerHrs !== null
                  ? `, answered in about ${answerHrs} hour${answerHrs === 1 ? "" : "s"}`
                  : `, waiting about ${waitHrs} hour${waitHrs === 1 ? "" : "s"}`}
              </p>
              {flag("ticket_timer") && t.status !== "Answered" ? (
                <span
                  className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      waitHrs >= 24 ? "#b3261e" : waitHrs >= 4 ? "#b97d10" : "#1e7d46",
                  }}
                >
                  {waitHrs >= 24
                    ? `Waiting ${waitHrs} hours, too long, answer now`
                    : waitHrs >= 4
                      ? `Waiting ${waitHrs} hours, keep it moving`
                      : waitHrs >= 1
                        ? `Waiting ${waitHrs} hour, on time`
                        : "Just arrived, on time"}
                </span>
              ) : null}
              {flag("ai_summary") ? (
                <span className="mt-1 block">
                  {summaries[t.id] ? (
                    <span className="text-sm font-semibold text-[var(--text)]">
                      One line: {summaries[t.id]}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-bold underline"
                      style={{ color: "#0a2a5e" }}
                      disabled={summarize.isPending}
                      onClick={() => summarize.mutate(t.id)}
                    >
                      One-line summary for staff
                    </button>
                  )}
                </span>
              ) : null}
              {t.reply ? (
                <p className="mt-1 rounded bg-[var(--surface)] p-2 text-[var(--text)]">
                  <strong>Reply sent:</strong> {t.reply}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    aria-label={`Assign ticket ${t.id}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2"
                    value={assigns[t.id] ?? t.assigned_to ?? staffName ?? ""}
                    onChange={(e) =>
                      setAssigns((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                  >
                    <option value="">Assign to...</option>
                    {(staff.data?.staff ?? [])
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                      ))}
                  </select>
                  <GhostButton
                    onClick={() => {
                      const who = assigns[t.id] ?? staffName ?? "";
                      if (who) assign.mutate({ id: t.id, officerName: who });
                    }}
                  >
                    Assign
                  </GhostButton>
                  <input
                    aria-label={`Reply to ticket ${t.id}`}
                    {...FIELDS.replyHelpRequest.reply}
                    className={`${inputCls} min-w-52 flex-1`}
                    value={replies[t.id] ?? ""}
                    onChange={(e) =>
                      setReplies((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    placeholder="Write the answer in plain words"
                  />
                  <PrimaryButton
                    onClick={() => {
                      const text = (replies[t.id] ?? "").trim();
                      if (text.length >= 2) reply.mutate({ id: t.id, reply: text });
                    }}
                    disabled={reply.isPending}
                  >
                    Send reply
                  </PrimaryButton>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No tickets yet.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- staff portal page (own sign-in, role-based queues) ---------- */

type StaffSession = { id: number; name: string; role: string; scope: string };

function StaffPortalPage() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    try {
      const raw = storage.get("portagov-staff");
      return raw ? (JSON.parse(raw) as StaffSession) : null;
    } catch {
      return null;
    }
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [error, setError] = useState("");
  /* Two-step sign-in: step 1 checks the password and issues a code,
     step 2 checks the code. The staff session only starts after step 2. */
  const [step, setStep] = useState<"password" | "code">("password");
  const [staffId, setStaffId] = useState(0);
  const [staffCode, setStaffCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const signIn = useMutation({
    mutationFn: async () => await api.findStaff({ name: name.trim(), phone: phone.trim(), password: staffPassword }),
    onSuccess: (r) => {
      if (r.locked) {
        setError(lockMessage(r.minutes_left));
        return;
      }
      if (!r.need_code) {
        setError("No active staff account matches that name, phone, and password. Staff accounts are created in the platform portal, with a password set there. Five wrong passwords lock the account for 15 minutes.");
        return;
      }
      setStaffId(r.staff_id);
      setDemoCode(r.demo_code);
      setStaffCode("");
      setStep("code");
    },
  });
  const verifyCode = useMutation({
    mutationFn: async () => await api.verifyStaffCode({ staffId, code: staffCode.trim() }),
    onSuccess: (r) => {
      if (r.locked) {
        setError(`${lockMessage(r.minutes_left)} Go back and sign in again for a fresh code after that time.`);
        return;
      }
      if (!r.ok || !r.staff) {
        setError(
          r.attempts_left > 0 && r.attempts_left < 5
            ? `That code is not correct, or it has expired. You have ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left before the account locks for 15 minutes.`
            : "That code is not correct, or it has expired. Go back and sign in again for a fresh code.",
        );
        return;
      }
      setSession(r.staff);
      storage.set("portagov-staff", JSON.stringify(r.staff));
      storage.set("portagov-officer", r.staff.name);
    },
  });
  const apps = useQuery({
    queryKey: ["all-apps"],
    queryFn: () => api.listAllApplications({ limit: 100 }),
    enabled: !!session,
  });
  const held = (apps.data?.applications ?? []).filter((a: ApplicationT) => !a.released);
  const role = session?.role ?? "";
  const canHelp = ["Help desk", "Support supervisor", "Platform admin"].includes(role);
  const canRelease = ["Release officer", "Support supervisor", "Platform admin"].includes(role);
  const canPay = ["Payments desk", "Platform admin"].includes(role);
  const canSuper = ["Support supervisor", "Platform admin"].includes(role);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#92580a" }}>
        PortaGov staff portal
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--text)]">
        {session ? `Welcome, ${session.name}` : "Staff sign-in"}
      </h1>
      {!session ? (
        <div className="mt-5 max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--dim)]">
            Staff accounts are created by the platform portal, with a role,
            permissions, and a password. Sign-in has two steps: your
            password, then a one-time code. Your name appears on the work
            you do, in the audit trail.
          </p>
          {step === "code" ? (
            <div className="mt-4 space-y-3">
              <h2 className="font-display text-xl font-bold text-[var(--text)]">
                Step 2: enter your code
              </h2>
              <p className="text-sm text-[var(--dim)]">
                We sent a 6 number code to your staff phone. In this build
                the code is shown here:{" "}
                <strong className="text-[var(--text)]">{demoCode}</strong>
              </p>
              <div>
                <FieldLabel htmlFor="staff-code">Staff sign-in code</FieldLabel>
                <input id="staff-code" {...FIELDS.verifyStaffCode.code} className={inputCls} value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value)}
                  placeholder="6 numbers" inputMode="numeric" />
              </div>
              {error ? (
                <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  onClick={() => {
                    setError("");
                    verifyCode.mutate();
                  }}
                  disabled={verifyCode.isPending}
                >
                  Finish sign-in
                </PrimaryButton>
                <GhostButton onClick={() => { setStep("password"); setError(""); }}>
                  Back
                </GhostButton>
              </div>
              <p className="text-sm text-[var(--dim)]">
                Five wrong codes lock the account for 15 minutes.
              </p>
            </div>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                setError("");
                signIn.mutate();
              }}
            >
              <div>
                <FieldLabel htmlFor="staff-name">Your full name (required)</FieldLabel>
                <input id="staff-name" {...FIELDS.findStaff.name} className={inputCls} value={name}
                  onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <FieldLabel htmlFor="staff-phone">Your phone number (required)</FieldLabel>
                <input id="staff-phone" {...FIELDS.findStaff.phone} className={inputCls} value={phone}
                  onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
              <div>
                <FieldLabel htmlFor="staff-password">Your password (required)</FieldLabel>
                <input id="staff-password" type="password" {...FIELDS.findStaff.password} className={inputCls} value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error ? (
                <p role="alert" className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-semibold text-[var(--warn)]">
                  {error}
                </p>
              ) : null}
              <PrimaryButton type="submit" disabled={signIn.isPending}>
                Continue to the code step
              </PrimaryButton>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
            <div>
              <p className="font-display text-lg font-bold">
                {session.role}
                {session.scope ? `, scope: ${session.scope}` : ""}
              </p>
              <p className="text-sm text-white/85">{ROLE_PERMISSIONS[session.role] ?? ""}</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/50 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setSession(null);
                storage.remove("portagov-staff");
              }}
            >
              Sign out
            </button>
          </div>
          {canHelp ? <HelpDeskPanel staffName={session.name} /> : null}
          {canRelease ? (
            <div>
              <SectionTitle sub="Applications PortaGov is holding. Release each one when its billing number is confirmed paid and its documents check out.">
                Release queue ({held.length} held)
              </SectionTitle>
              <div className="space-y-3">
                {held.length > 0 ? (
                  held.map((a: ApplicationT) => <PlatformRow key={a.id} app={a} />)
                ) : (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
                    Nothing is held right now.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          {canPay ? (
            <div className="space-y-5">
              <ReconciliationPanel />
              <FraudPanel />
            </div>
          ) : null}
          {canSuper ? (
            <div className="space-y-5">
              <PlatformHealth />
              <AuditPanel />
            </div>
          ) : null}
          {!canHelp && !canRelease && !canPay && !canSuper ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--dim)]">
              Your role has no queues yet. Ask a platform admin to check
              your role in the platform portal.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ---------- batch ten and eleven panels ---------- */

function AgentPermissionsPanel({ profile }: { profile: ProfileT }) {
  const queryClient = useQueryClient();
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });
  const perms = useQuery({
    queryKey: ["agent-perms", profile.id],
    queryFn: () => api.listAgentPermissions({ profileId: profile.id }),
  });
  const [agentId, setAgentId] = useState(0);
  const [view, setView] = useState(true);
  const [apply, setApply] = useState(false);
  const [pay, setPay] = useState(false);
  const [docs, setDocs] = useState(false);
  const save = useMutation({
    mutationFn: async () =>
      await api.setAgentPermission({
        profileId: profile.id,
        agentId,
        canViewStatus: view,
        canApply: apply,
        canPay: pay,
        canDocuments: docs,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["agent-perms", profile.id] }),
  });
  const revoke = useMutation({
    mutationFn: async (id: number) => await api.revokeAgentPermission({ id }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["agent-perms", profile.id] }),
  });
  const active = (agents.data?.agents ?? []).filter((a) => a.active);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Share with my agent
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Choose one approved agent and exactly what they can see and do for
        you. Nothing more. You can take it away at any time, and it stops
        at once.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="ap-agent">Approved agent</FieldLabel>
          <select id="ap-agent" {...FIELDS.setAgentPermission.agentId} className={inputCls} value={agentId}
            onChange={(e) => setAgentId(Number(e.target.value))}>
            <option value={0}>Choose an agent</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}, {a.county}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 text-sm text-[var(--text)]">
          {[
            ["See my application status", view, setView],
            ["Apply for services for me", apply, setApply],
            ["Pay billing numbers for me", pay, setPay],
            ["See my documents", docs, setDocs],
          ].map(([label, val, set]) => (
            <label key={label as string} className="flex min-h-9 items-center gap-2">
              <input type="checkbox" checked={val as boolean}
                onChange={(e) => (set as (b: boolean) => void)(e.target.checked)} />
              {label as string}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <PrimaryButton
          onClick={() => {
            if (agentId > 0) save.mutate();
          }}
          disabled={save.isPending || agentId === 0}
        >
          Save this permission
        </PrimaryButton>
      </div>
      <ul className="mt-3 space-y-2">
        {(perms.data?.permissions ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <span className="text-[var(--text)]">
              <strong>{p.agent_name}</strong>:{" "}
              {[
                p.can_view_status ? "see status" : null,
                p.can_apply ? "apply" : null,
                p.can_pay ? "pay" : null,
                p.can_documents ? "see documents" : null,
              ].filter(Boolean).join(", ") || "nothing"}
              {p.active ? "" : " (taken away)"}
            </span>
            {p.active ? (
              <button type="button" className="font-bold underline" style={{ color: "#b3261e" }}
                onClick={() => revoke.mutate(p.id)}>
                Take it away
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShiftBoard() {
  const queryClient = useQueryClient();
  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => api.listShifts({ limit: 50 }),
  });
  const staff = useQuery({
    queryKey: ["staff-accounts"],
    queryFn: () => api.listStaffAccounts({}),
  });
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [duty, setDuty] = useState("Help desk");
  const [status, setStatus] = useState<"On duty" | "Off" | "Covering">("On duty");
  const [covers, setCovers] = useState("");
  const add = useMutation({
    mutationFn: async () =>
      await api.addShift({ staffName: name, date, duty, status, coversFor: covers }),
    onSuccess: () => {
      setCovers("");
      void queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => await api.deleteShift({ id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });
  const today = new Date().toISOString().slice(0, 10);
  const todays = (shifts.data?.shifts ?? []).filter((s) => s.date === today);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Shift and cover board
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Who is on duty today, who is off, and who covers a ticket when
        someone is away, so no queue ever waits on one person.
        {todays.length > 0
          ? ` Today: ${todays.map((s) => `${s.staff_name} (${s.duty}, ${s.status.toLowerCase()}${s.covers_for ? `, covering ${s.covers_for}` : ""})`).join("; ")}.`
          : " No shifts recorded for today yet."}
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name && date) add.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="sh-name">Staff member</FieldLabel>
          <select id="sh-name" {...FIELDS.addShift.staffName} className={inputCls} value={name}
            onChange={(e) => setName(e.target.value)}>
            <option value="">Choose staff</option>
            {(staff.data?.staff ?? []).filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="sh-date">Date</FieldLabel>
          <input id="sh-date" {...FIELDS.addShift.date} type="date" className={inputCls} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="sh-duty">Duty</FieldLabel>
          <select id="sh-duty" {...FIELDS.addShift.duty} className={inputCls} value={duty}
            onChange={(e) => setDuty(e.target.value)}>
            {["Help desk", "Release queue", "Payments desk", "Live chat", "Call-backs"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="sh-status">Status</FieldLabel>
          <select id="sh-status" {...FIELDS.addShift.status} className={inputCls} value={status}
            onChange={(e) => setStatus(e.target.value as "On duty" | "Off" | "Covering")}>
            <option value="On duty">On duty</option>
            <option value="Off">Off</option>
            <option value="Covering">Covering</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="sh-covers">Covering for (when covering)</FieldLabel>
          <input id="sh-covers" {...FIELDS.addShift.coversFor} className={inputCls} value={covers}
            onChange={(e) => setCovers(e.target.value)}
            placeholder="Name of the person away" />
        </div>
        <div className="flex items-end">
          <PrimaryButton type="submit" disabled={add.isPending}>Add to the board</PrimaryButton>
        </div>
      </form>
      <ul className="mt-3 space-y-1 text-sm">
        {(shifts.data?.shifts ?? []).slice(0, 12).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--surface-alt)] px-3 py-2">
            <span className="text-[var(--text)]">
              {s.date}: <strong>{s.staff_name}</strong>, {s.duty}, {s.status}
              {s.covers_for ? `, covering ${s.covers_for}` : ""}
            </span>
            <button type="button" className="font-semibold underline" onClick={() => del.mutate(s.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KnowledgeBasePanel({ addedBy }: { addedBy: string }) {
  const queryClient = useQueryClient();
  const kb = useQuery({
    queryKey: ["kb-articles"],
    queryFn: () => api.listKbArticles({ limit: 50 }),
  });
  const [topic, setTopic] = useState("General");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const add = useMutation({
    mutationFn: async () => await api.addKbArticle({ topic, question, answer, addedBy }),
    onSuccess: () => {
      setQuestion("");
      setAnswer("");
      void queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
  const del = useMutation({
    mutationFn: async (id: number) => await api.deleteKbArticle({ id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["kb-articles"] }),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Knowledge base the assistant learns from
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Add an approved answer once, and the PortaGov assistant uses it
        for every citizen after that. Keep answers short, plain, and true.
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (question.trim().length >= 5 && answer.trim().length >= 5) add.mutate();
        }}
      >
        <div>
          <FieldLabel htmlFor="kb-topic">Topic</FieldLabel>
          <input id="kb-topic" {...FIELDS.addKbArticle.topic} className={inputCls} value={topic}
            onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="kb-q">Question citizens ask</FieldLabel>
          <input id="kb-q" {...FIELDS.addKbArticle.question} className={inputCls} value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="For example: How long does a passport take?" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="kb-a">The approved answer</FieldLabel>
          <textarea id="kb-a" {...FIELDS.addKbArticle.answer} className={inputCls} rows={3} value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="The exact answer the assistant may give" />
        </div>
        <div>
          <PrimaryButton type="submit" disabled={add.isPending}>Add to the knowledge base</PrimaryButton>
        </div>
      </form>
      <ul className="mt-3 space-y-2">
        {(kb.data?.articles ?? []).map((a) => (
          <li key={a.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="font-bold text-[var(--text)]">{a.topic}: {a.question}</p>
            <p className="text-[var(--dim)]">{a.answer}</p>
            <button type="button" className="mt-1 font-semibold underline" onClick={() => del.mutate(a.id)}>
              Remove
            </button>
          </li>
        ))}
        {(kb.data?.articles ?? []).length === 0 ? (
          <li className="text-sm text-[var(--dim)]">No knowledge base answers yet.</li>
        ) : null}
      </ul>
    </div>
  );
}

function QualityPanel({ reviewer }: { reviewer: string }) {
  const queryClient = useQueryClient();
  const tickets = useQuery({
    queryKey: ["help-requests"],
    queryFn: () => api.listHelpRequests({ limit: 50 }),
  });
  const reviews = useQuery({
    queryKey: ["quality-reviews"],
    queryFn: () => api.listQualityReviews({ limit: 20 }),
  });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const mark = useMutation({
    mutationFn: async (v: { targetLabel: string; sample: string; mark: "Good" | "Needs help"; note: string }) =>
      await api.recordQualityReview({ ...v, reviewer }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["quality-reviews"] }),
  });
  const answered = (tickets.data?.requests ?? []).filter((t) => t.reply);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Quality check
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        A senior officer reads a sample of staff and assistant replies
        and marks each one good, or needing help, so help stays kind and
        correct.
      </p>
      <div className="mt-3 space-y-3">
        {answered.slice(0, 6).map((t) => (
          <div key={t.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="font-bold text-[var(--text)]">
              {ticketNumber(t.id, t.created_at)}, {t.topic}
              {t.assigned_to ? `, answered by ${t.assigned_to}` : ""}
            </p>
            <p className="text-[var(--dim)]">Citizen asked: {t.message}</p>
            <p className="mt-1 text-[var(--text)]">Reply: {t.reply}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                aria-label={`Quality note for ticket ${t.id}`}
                {...FIELDS.recordQualityReview.note}
                className={`${inputCls} min-w-44 flex-1`}
                value={notes[t.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                placeholder="Note for the officer (optional)"
              />
              <GhostButton onClick={() => mark.mutate({ targetLabel: `Staff reply, ${ticketNumber(t.id, t.created_at)}`, sample: t.reply, mark: "Good", note: notes[t.id] ?? "" })}>
                Mark good
              </GhostButton>
              <GhostButton onClick={() => mark.mutate({ targetLabel: `Staff reply, ${ticketNumber(t.id, t.created_at)}`, sample: t.reply, mark: "Needs help", note: notes[t.id] ?? "" })}>
                Needs help
              </GhostButton>
            </div>
          </div>
        ))}
        {answered.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">No answered tickets to sample yet.</p>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {(reviews.data?.reviews ?? []).map((r) => (
          <li key={r.id} className="rounded bg-[var(--surface-alt)] px-3 py-2 text-[var(--text)]">
            <strong>{r.mark}</strong>: {r.target_label}
            {r.reviewer ? `, checked by ${r.reviewer}` : ""}
            {r.note ? `, note: ${r.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DailySummaryPanel() {
  const s = useQuery({
    queryKey: ["daily-summary"],
    queryFn: () => api.getDailySummary({}),
  });
  const d = s.data;
  return (
    <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
      <h2 className="font-display text-lg font-bold">Morning summary</h2>
      <p className="text-sm text-white/85">{d?.date_label ?? "Loading..."}</p>
      {d ? (
        <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            [`${d.applications_today}`, "applications today"],
            [`${d.released_total}`, "released in total"],
            [`${d.stuck_over_24h}`, "stuck over 24 hours"],
            [`${d.open_tickets}`, "open tickets"],
            [`${d.payments_today}`, "payments today"],
            [`${d.held_total}`, "held with PortaGov"],
            [`${d.completed_total}`, "completed in total"],
          ].map(([n, label]) => (
            <div key={label} className="rounded-lg bg-white/10 p-3">
              <p className="font-display text-2xl font-extrabold" style={{ color: "#d9a821" }}>{n}</p>
              <p className="text-xs text-white/85">{label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InstitutionPipelinePanel() {
  const list = useQuery({
    queryKey: ["onboarded-institutions"],
    queryFn: () => api.listOnboardedInstitutions({}),
  });
  const rows = list.data?.institutions ?? [];
  const stageOf = (i: (typeof rows)[number]) =>
    i.status === "Live" ? "Live"
    : i.status === "Approved" ? "Approved, ready to go live"
    : i.status === "Suspended" ? "Suspended"
    : i.status === "Sandbox" ? "In review"
    : "Setting up";
  const leftOf = (i: (typeof rows)[number]) => {
    const left: string[] = [];
    if (!i.monogram) left.push("logo or monogram");
    if (!i.contact_email && !i.contact_phone) left.push("a contact email or phone");
    if (i.services_count === 0) left.push("at least one service in the builder");
    if (i.status === "Sandbox" || i.status === "Draft") left.push("PortaGov approval");
    if (i.status === "Approved") left.push("flip the live switch");
    return left;
  };
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        New institution pipeline
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every agency that asked to join, what stage it is at, and what is
        left before it goes live.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((i) => (
          <div key={i.id} className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm">
            <p className="font-bold text-[var(--text)]">
              {i.name}: {stageOf(i)}
            </p>
            <p className="text-[var(--dim)]">
              {leftOf(i).length > 0
                ? `Still needed: ${leftOf(i).join(", ")}.`
                : "Nothing left, this institution is fully live."}
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">
            No institution has started onboarding yet. The studio is on the{" "}
            <a href="#/onboarding" className="font-semibold underline">onboarding page</a>.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusPage() {
  const health = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.getSystemHealth({}),
  });
  const h = health.data;
  const rows: { label: string; ok: boolean | null; slowNote: string }[] = [
    { label: `Applications and tracking${h ? `, ${h.applications} on the platform` : ""}`, ok: h ? true : null, slowNote: "" },
    { label: `Payments (MTN MoMo and Orange Money)${h ? `, ${h.payments_confirmed} confirmed` : ""}`, ok: h ? true : null, slowNote: "Payments are being checked by hand today, so confirmation may take longer than usual." },
    { label: `SMS updates${h ? `, ${h.sms_count} sent` : ""}`, ok: h ? true : null, slowNote: "SMS is slow today. Your updates are safe inside PortaGov, open your application to see them." },
    { label: `WhatsApp updates${h ? `, ${h.whatsapp_count} sent` : ""}`, ok: h ? true : null, slowNote: "WhatsApp is slow today. Your updates are safe inside PortaGov." },
    { label: `Email updates${h ? `, ${h.email_count} sent` : ""}`, ok: h ? true : null, slowNote: "Email is slow today. Your updates are safe inside PortaGov." },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SectionTitle sub="Plain words, checked from the live platform counters. If something is slow, we say it here first.">
        Is PortaGov working?
      </SectionTitle>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span
              aria-hidden
              className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.ok === null ? "#96989a" : r.ok ? "#1e7d46" : "#b3261e" }}
            />
            <div>
              <p className="font-display font-bold text-[var(--text)]">
                {r.label}: {r.ok === null ? "checking..." : r.ok ? "working well" : "slow today"}
              </p>
              {!r.ok && r.slowNote ? (
                <p className="text-sm text-[var(--dim)]">{r.slowNote}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--dim)]">
        Nothing here shows any citizen's private information. For your own
        application, use <a href="#/track" className="font-semibold underline">Track</a>.
      </p>
    </div>
  );
}

function ComplaintsLearningPanel({ canAdd }: { canAdd: boolean }) {
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ["complaint-insights"],
    queryFn: () => api.getComplaintInsights({}),
  });
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: async () => await api.addImprovementNote({ note }),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["complaint-insights"] });
    },
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Learning from complaints
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        The top complaints this month, and what PortaGov changed because
        of them. Complaints are lessons, not noise.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
        {(data.data?.top ?? []).map((t) => (
          <li key={t.kind}>
            {t.kind}: {t.count} complaint{t.count === 1 ? "" : "s"} this month
          </li>
        ))}
        {(data.data?.top ?? []).length === 0 ? (
          <li>No complaints recorded this month.</li>
        ) : null}
      </ol>
      <h3 className="mt-4 font-display font-bold text-[var(--text)]">What we changed</h3>
      <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
        {(data.data?.improvements ?? []).map((n) => (
          <li key={n.id}>
            {new Date(n.created_at).toLocaleDateString("en-GB")}: {n.note}
          </li>
        ))}
        {(data.data?.improvements ?? []).length === 0 ? (
          <li>No changes recorded yet.</li>
        ) : null}
      </ul>
      {canAdd ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (note.trim().length >= 5) add.mutate();
          }}
        >
          <input aria-label="What PortaGov changed because of complaints" {...FIELDS.addImprovementNote.note} className={`${inputCls} min-w-52 flex-1`}
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What did PortaGov change because of a complaint?" />
          <PrimaryButton type="submit" disabled={add.isPending}>Record the change</PrimaryButton>
        </form>
      ) : null}
    </div>
  );
}

function GovReportsPanel() {
  const monthly = useMutation({
    mutationFn: async () => await api.generateMonthlyReport({}),
  });
  const [exportMsg, setExportMsg] = useState("");
  const doExport = async (includePrivate: boolean) => {
    const name =
      storage.get("portagov-officer") ?? "Platform officer";
    const r = await api.exportGovernmentData({ includePrivate, exportedBy: name });
    const blob = new Blob([r.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = includePrivate
      ? "portagov-government-export-with-private-data.csv"
      : "portagov-government-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg(
      `Exported ${r.rows} applications. This export was written in the audit log under ${name}, private data ${includePrivate ? "included with permission" : "excluded"}.`,
    );
  };
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Monthly government report and data export
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        The monthly report is built automatically from live records, per
        ministry, with counts, times, and trust scores, and saved for
        government. Exports are clean, and every export is logged.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton onClick={() => monthly.mutate()} disabled={monthly.isPending}>
          Build this month's government report
        </PrimaryButton>
        <GhostButton onClick={() => void doExport(false)}>
          Export data (no private data)
        </GhostButton>
        <GhostButton onClick={() => void doExport(true)}>
          Export with names and phones (permission)
        </GhostButton>
      </div>
      {monthly.data ? (
        <p className="mt-2 rounded-lg bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          Report saved: {monthly.data.summary}
        </p>
      ) : null}
      {exportMsg ? <p className="mt-2 text-sm font-semibold text-[var(--text)]">{exportMsg}</p> : null}
    </div>
  );
}

/* ---------- Liberian English: global button + staff canned replies ---------- */

const LIBERIAN_TEMPLATES = [
  {
    label: "Kind greeting",
    text: "Hello, thank you for writing to us. We are happy to help you today. Your matter is important to us, and we will stay with you until it is finished.",
  },
  {
    label: "We received it",
    text: "We have received your application, and everything is in order from our side. You do not need to come to the office for this step. We will message you right here when there is news.",
  },
  {
    label: "Please wait small",
    text: "Please wait small, your application is moving. The office is working on it now. When it is ready, we will tell you the day and the place to collect it, with your pickup code.",
  },
  {
    label: "Something is missing",
    text: "Your application is almost complete. One thing is missing, and we have listed it clearly on your application page. Send that one thing, and we will continue at once. No need to start again.",
  },
  {
    label: "Ready to collect",
    text: "Good news, your document is ready. Bring your pickup code and your ID to the collection point on your application page. If another person will collect it for you, give them your consent code first, for your own safety.",
  },
];

function LiberianReplyChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-[var(--dim)]">Liberian English, one tap:</span>
      {LIBERIAN_TEMPLATES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onPick(t.text)}
          className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text)]"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LiberianEnglishButton() {
  const [open, setOpen] = useState(false);
  const [simple, setSimple] = useState("");
  const run = useMutation({
    mutationFn: async () => {
      const main = document.querySelector("main");
      const text = (main?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 3500);
      return await api.simplifyText({ text });
    },
    onSuccess: (r) => setSimple(r.simple),
  });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSimple("");
        }}
        aria-expanded={open}
        aria-label="Tell me in Liberian English"
        title="Tell me in Liberian English"
        className="fixed bottom-36 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg md:bottom-24"
        style={{ borderColor: "#0a2a5e", backgroundColor: "#ffffff", color: "#0a2a5e" }}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>
      {open ? (
        <div className="fixed bottom-48 right-4 z-50 w-[min(92vw,380px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl md:bottom-36" role="dialog" aria-label="This page in Liberian English">
          <div className="flex items-center justify-between">
            <p className="font-display font-extrabold text-[var(--text)]">This page, in Liberian English</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Liberian English panel" className="px-2 py-1 font-bold">
              Close
            </button>
          </div>
          {!simple && !run.isPending ? (
            <>
              <p className="mt-2 text-sm text-[var(--dim)]">
                Press the button and this page's words will be written
                again in simple Liberian English. Fees, dates, and names
                stay exactly the same.
              </p>
              <div className="mt-3">
                <PrimaryButton onClick={() => run.mutate()} disabled={run.isPending}>
                  Read this page simply
                </PrimaryButton>
              </div>
            </>
          ) : null}
          {run.isPending ? <p className="mt-2 text-sm text-[var(--dim)]">Writing it simply...</p> : null}
          {simple ? (
            <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
              {simple}
            </p>
          ) : null}
          {run.isError ? (
            <p className="mt-2 text-sm font-semibold text-[var(--warn)]">
              The simple version could not be made just now. Please try again, or ask the assistant below.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CollectionSlip({ app, holderName }: { app: ApplicationT; holderName: string }) {
  if (!app.pickup_code) return null;
  const download = () => {
    const html = `<!doctype html><html><head><title>PortaGov collection slip ${app.reference}</title></head><body style="font-family: Arial, sans-serif; padding: 32px; color: #0a2a5e;">
<h1 style="margin:0;">portagov collection slip</h1>
<p>Citizens. Services. Connected.</p>
<hr/>
<p><strong>Tracking number:</strong> ${app.reference}</p>
<p><strong>Name:</strong> ${holderName}</p>
<p><strong>Service:</strong> ${app.service_name}</p>
<p><strong>Institution:</strong> ${app.institution}</p>
<p><strong>Collection:</strong> ${app.collection_choice}</p>
<p><strong>Date printed:</strong> ${new Date().toLocaleDateString("en-GB")}</p>
<p style="font-size: 28px;"><strong>Pickup code: ${app.pickup_code}</strong></p>
<p>Show this slip and your ID at collection. If another person collects for you, they must also bring your consent code and their own ID.</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portagov-collection-slip-${app.reference}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: "#0a2a5e" }}>
      <p className="font-display font-extrabold text-[var(--text)]">Your collection slip</p>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Tracking {app.reference}, {app.service_name}. Pickup code{" "}
        <strong className="text-[var(--text)]">{app.pickup_code}</strong>.
        Download the slip, print it or keep it on your phone, and bring
        your ID.
      </p>
      <div className="mt-2">
        <GhostButton onClick={download}>Download collection slip</GhostButton>
      </div>
    </div>
  );
}

function HelperNearMe() {
  const [county, setCounty] = useState("");
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents({}),
  });
  const list = (agents.data?.agents ?? []).filter(
    (a) => a.active && (!county || a.county === county),
  );
  const counties = [...new Set((agents.data?.agents ?? []).map((a) => a.county))];
  return (
    <div>
      <SectionTitle sub="Approved PortaGov agents in your county. An agent helps you apply, and their name shows on your application. A good agent never charges you outside the official billing number.">
        Find a helper near me
      </SectionTitle>
      <div className="mb-4 max-w-xs">
        <FieldLabel htmlFor="hm-county">Your county</FieldLabel>
        <select id="hm-county" className={inputCls} value={county}
          onChange={(e) => setCounty(e.target.value)}>
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold text-white" style={{ backgroundColor: "#0a2a5e" }}>
              {monogramOf(a.full_name)}
            </span>
            <div className="text-sm">
              <p className="font-display font-bold text-[var(--text)]">{a.full_name}</p>
              <p className="text-[var(--dim)]">
                {a.county}
                {a.service_centre ? `, ${a.service_centre}` : ""}
              </p>
              <p className="text-[var(--dim)]">
                {a.rating > 0 ? `Citizen rating: ${a.rating} of 5` : "New agent, no ratings yet"} | {a.phone}
              </p>
            </div>
          </div>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">
            No approved agent is listed for this county yet. You can still
            apply on your own, or at any County Service Centre.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- institution portal directory and row extras ---------- */

function InstitutionDirectoryPage() {
  const onboarded = useQuery({
    queryKey: ["onboarded-institutions"],
    queryFn: () => api.listOnboardedInstitutions({}),
  });
  const live = (onboarded.data?.institutions ?? []).filter((i) => i.status === "Live");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#92580a" }}>
        Institution portal
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--text)]">
        Every institution has its own portal
      </h1>
      <p className="mt-2 max-w-3xl text-[var(--dim)]">
        Choose your institution. Inside its own portal you will find its
        inbox, embassy space, appointment calendar, payments, services and
        fees, officers, announcements, and reports, separate from every
        other institution. An institution only ever sees applications
        PortaGov has released to it.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MINISTRIES.map((m) => (
          <a
            key={m.id}
            href={`#/institution/${m.id}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white" style={{ backgroundColor: ministryColor(m.id) }}>
              {monogramOf(m.name)}
            </span>
            <span>
              <span className="block font-display font-bold text-[var(--text)]">{m.name}</span>
              <span className="block text-sm font-semibold" style={{ color: "#0a2a5e" }}>
                Open its portal
              </span>
            </span>
          </a>
        ))}
        {live.map((i) => (
          <a
            key={i.slug}
            href={`#/institution/${i.slug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white" style={{ backgroundColor: i.color }}>
              {i.monogram}
            </span>
            <span>
              <span className="block font-display font-bold text-[var(--text)]">{i.name}</span>
              <span className="block text-sm font-semibold" style={{ color: "#0a2a5e" }}>
                Open its portal
              </span>
            </span>
          </a>
        ))}
      </div>
      <details className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer p-4 font-display font-bold text-[var(--text)]">
          Combined desk: every released application in one list
        </summary>
        <div className="border-t border-[var(--border)]">
          <InstitutionPage />
        </div>
      </details>
    </div>
  );
}

function InstitutionRowExtras({ app }: { app: ApplicationT }) {
  const queryClient = useQueryClient();
  const officerName =
    typeof window !== "undefined"
      ? storage.get("portagov-officer") ?? ""
      : "";
  const [missing, setMissing] = useState("");
  const [deadline, setDeadline] = useState("");
  const [directMsg, setDirectMsg] = useState("");
  const [done, setDone] = useState("");
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["institution-apps"] });
    void queryClient.invalidateQueries({ queryKey: ["all-apps"] });
  };
  const confirm = useMutation({
    mutationFn: async () => await api.confirmReceipt({ id: app.id, officerName }),
    onSuccess: () => {
      setDone("Receipt confirmed. The citizen can see it now.");
      invalidate();
    },
  });
  const moreInfo = useMutation({
    mutationFn: async () =>
      await api.requestMoreInfo({ id: app.id, missing, deadline, officerName }),
    onSuccess: () => {
      setDone("Sent. The citizen has the exact list of what is missing, and the deadline.");
      setMissing("");
      setDeadline("");
      invalidate();
    },
  });
  const direct = useMutation({
    mutationFn: async () =>
      await api.sendInstitutionMessage({ applicationId: app.id, body: directMsg }),
    onSuccess: () => {
      setDone("Message sent directly to the citizen, by email and SMS, under this tracking number.");
      setDirectMsg("");
    },
  });
  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
      {app.status === "Released to institution" ? (
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={() => confirm.mutate()} disabled={confirm.isPending}>
            Confirm receipt
          </PrimaryButton>
          <span className="text-sm text-[var(--dim)]">
            One tap tells the citizen instantly that {app.institution} has
            their application.
          </span>
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm font-bold text-[var(--text)]">
          Message the citizen directly, ask for more information, check documents, video call
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <FieldLabel htmlFor={`dm-${app.id}`}>Direct message to the citizen (way forward, pickup day)</FieldLabel>
            <textarea id={`dm-${app.id}`} {...FIELDS.sendInstitutionMessage.body} className={inputCls} rows={2} value={directMsg}
              onChange={(e) => setDirectMsg(e.target.value)}
              placeholder="For example: Your passport is being printed. Come for biometrics on Tuesday at 10 AM with your old passport." />
            <div className="mt-2">
              <LiberianReplyChips onPick={setDirectMsg} />
            </div>
            <div className="mt-2">
              <GhostButton
                onClick={() => {
                  if (directMsg.trim().length >= 3) direct.mutate();
                }}
                disabled={direct.isPending}
              >
                Send direct message
              </GhostButton>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`mi-${app.id}`}>We need more information: exactly what is missing</FieldLabel>
              <input id={`mi-${app.id}`} {...FIELDS.requestMoreInfo.missing} className={inputCls} value={missing}
                onChange={(e) => setMissing(e.target.value)}
                placeholder="For example: a clearer copy of your birth certificate" />
            </div>
            <div>
              <FieldLabel htmlFor={`md-${app.id}`}>Deadline</FieldLabel>
              <input id={`md-${app.id}`} {...FIELDS.requestMoreInfo.deadline} className={inputCls} value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="For example: Friday 5 December" />
            </div>
          </div>
          <GhostButton
            onClick={() => {
              if (missing.trim().length >= 5 && deadline.trim().length >= 4) moreInfo.mutate();
            }}
            disabled={moreInfo.isPending}
          >
            Send the missing list with deadline
          </GhostButton>
          <DocumentVerification app={app} />
          <VideoCallPanel app={app} asInstitution />
        </div>
      </details>
      {done ? (
        <p className="rounded-lg bg-[var(--surface-alt)] p-3 text-sm font-semibold text-[var(--text)]">
          {done}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- batch twelve: feature switches and the features they control ---------- */

const FEATURE_DEFS: { key: string; label: string; what: string }[] = [
  { key: "qr_card", label: "My QR code card", what: "Citizens show a QR card at a centre or embassy instead of paper." },
  { key: "queue_join", label: "Save my place in the queue", what: "Walk-ins join the queue from home and come when it is almost their turn." },
  { key: "fee_explainer", label: "What did I pay for explainer", what: "Plain words on every fee: what it covers and why it costs that much." },
  { key: "ticket_timer", label: "Citizen waiting timer", what: "Green, amber, red waiting times on support tickets, so help stays quick." },
  { key: "ai_summary", label: "AI summary for staff", what: "One short line per ticket so staff see the point at once." },
  { key: "service_closed", label: "Service closed for today switch", what: "Institutions close a service for a day and citizens see it instantly." },
  { key: "duplicate_warning", label: "Duplicate application warning", what: "Officers see a warning when the same citizen applies twice for the same service." },
  { key: "money_screen", label: "Money in, money out screen", what: "Totals paid and refunded, per ministry and per payment method." },
  { key: "slowest_alert", label: "Slowest service alert", what: "Flags any service taking longer than the time it promised." },
  { key: "feature_announcements", label: "New feature announcements", what: "A short clear note in the app when PortaGov adds something new." },
  { key: "assistant", label: "PortaGov AI assistant", what: "The floating assistant button on citizen pages." },
  { key: "liberian_english", label: "Liberian English button", what: "The button that rewrites any page in simple Liberian English." },
];

function useFlags() {
  const q = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => api.getFeatureFlags({}),
  });
  const flags = q.data?.flags ?? {};
  return (key: string) => flags[key] !== false;
}

function FeatureTogglesPanel() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => api.getFeatureFlags({}),
  });
  const flags = q.data?.flags ?? {};
  const set = useMutation({
    mutationFn: async (v: { key: string; enabled: boolean }) =>
      await api.setFeatureFlag(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] }),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Feature switches
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every feature on PortaGov can be turned off here, from the
        platform, without rebuilding and without breaking anything else.
        If a feature does not feel right later, switch it off and it
        disappears everywhere at once.
      </p>
      <div className="mt-3 space-y-2">
        {FEATURE_DEFS.map((f) => {
          const on = flags[f.key] !== false;
          return (
            <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-alt)] p-3">
              <div className="min-w-52 flex-1">
                <p className="text-sm font-bold text-[var(--text)]">{f.label}</p>
                <p className="text-sm text-[var(--dim)]">{f.what}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${f.label} on or off`}
                disabled={set.isPending}
                onClick={() => set.mutate({ key: f.key, enabled: !on })}
                className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-bold"
                style={on ? { backgroundColor: "#0a2a5e", color: "#fff" } : { color: "var(--dim)" }}
              >
                <span
                  className="relative inline-block h-5 w-9 rounded-full"
                  style={{ backgroundColor: on ? "#d9a821" : "var(--border)" }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: on ? 18 : 2 }}
                  />
                </span>
                {on ? "On" : "Off"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureNoteStrip() {
  const flag = useFlags();
  const posts = useQuery({
    queryKey: ["announcements", "PortaGov"],
    queryFn: () => api.listAnnouncements({ ministry: "PortaGov", limit: 3 }),
  });
  if (!flag("feature_announcements")) return null;
  const latest = (posts.data?.announcements ?? [])[0];
  if (!latest) return null;
  return (
    <div style={{ backgroundColor: "#d9a821" }} className="text-[#0a2a5e]">
      <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
        <strong>New on PortaGov:</strong> {latest.title}. {latest.body}
      </p>
    </div>
  );
}

function QrCard({ profile }: { profile: ProfileT }) {
  const flag = useFlags();
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(
      `PORTAGOV CITIZEN\nName: ${profile.full_name}\nPhone: ${profile.phone}\nCounty: ${profile.county}\nProfile: PG-CITIZEN-${profile.id}\nShow this card at any County Service Centre or Liberian embassy. Staff scan it to open your applications.`,
      { width: 220, margin: 1 },
    )
      .then((url: string) => {
        if (live) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [profile]);
  if (!flag("qr_card")) return null;
  return (
    <div className="rounded-xl p-5 text-white" style={{ backgroundColor: "#0a2a5e" }}>
      <div className="flex flex-wrap items-center gap-4">
        {dataUrl ? (
          <img src={dataUrl} alt="Your PortaGov QR code card" className="h-28 w-28 rounded-lg bg-white p-1" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-white/15 text-sm">
            Making your card...
          </div>
        )}
        <div className="min-w-52 flex-1">
          <h2 className="font-display text-lg font-bold">My QR code card</h2>
          <p className="mt-1 text-sm text-white/85">
            {profile.full_name}, {profile.county}. Show this card at any
            County Service Centre or Liberian embassy. Staff scan it and
            see your applications at once. No paper needed.
          </p>
        </div>
      </div>
    </div>
  );
}

function QueueJoinPanel({ profile }: { profile: ProfileT | null }) {
  const flag = useFlags();
  const queryClient = useQueryClient();
  const [office, setOffice] = useState(OFFICES[0] ?? "");
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [joined, setJoined] = useState<{ number: number; ahead: number } | null>(null);
  const tickets = useQuery({
    queryKey: ["queue-tickets", office],
    queryFn: () => api.listQueueTickets({ office }),
  });
  const join = useMutation({
    mutationFn: async () =>
      await api.joinQueue({
        profileId: profile?.id ?? null,
        name,
        phone,
        office,
      }),
    onSuccess: (r) => {
      setJoined({ number: r.number, ahead: r.ahead });
      void queryClient.invalidateQueries({ queryKey: ["queue-tickets"] });
    },
  });
  const update = useMutation({
    mutationFn: async (v: { id: number; status: "Waiting" | "Called" | "Done" | "Missed" }) =>
      await api.updateQueueTicket(v),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["queue-tickets"] }),
  });
  if (!flag("queue_join")) return null;
  const list = tickets.data?.tickets ?? [];
  const serving = list.find((t) => t.status === "Called");
  const waiting = list.filter((t) => t.status === "Waiting");
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Save my place in the queue
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Walking in today? Join from home, get your number, and come when
        it is almost your turn. No standing in line for hours.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor="qj-office">Office</FieldLabel>
          <select id="qj-office" {...FIELDS.joinQueue.office} className={inputCls} value={office}
            onChange={(e) => {
              setOffice(e.target.value);
              setJoined(null);
            }}>
            {OFFICES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="qj-name">Your name</FieldLabel>
          <input id="qj-name" {...FIELDS.joinQueue.name} className={inputCls} value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="qj-phone">Your phone</FieldLabel>
          <input id="qj-phone" {...FIELDS.joinQueue.phone} className={inputCls} value={phone}
            onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PrimaryButton
          onClick={() => {
            if (name.trim().length >= 2) join.mutate();
          }}
          disabled={join.isPending}
        >
          Join today's queue
        </PrimaryButton>
        <span className="text-sm text-[var(--dim)]">
          {serving
            ? `Now serving number ${serving.number}. `
            : "No number is being served yet. "}
          {waiting.length} waiting at this office.
        </span>
      </div>
      {joined ? (
        <p className="mt-3 rounded-lg p-3 text-sm font-bold text-white" style={{ backgroundColor: "#0a2a5e" }}>
          Your number is {joined.number}. {joined.ahead} people are ahead
          of you. Come when the board is close to your number, and show
          this page or your QR card.
        </p>
      ) : null}
      {list.length > 0 ? (
        <div className="mt-3 space-y-1">
          {list.slice(0, 10).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--surface-alt)] px-3 py-2 text-sm">
              <span className="text-[var(--text)]">
                <strong>Number {t.number}</strong>, {t.name}, {t.status}
              </span>
              <span className="flex gap-2">
                {t.status === "Waiting" ? (
                  <button type="button" className="font-bold underline" onClick={() => update.mutate({ id: t.id, status: "Called" })}>
                    Call
                  </button>
                ) : null}
                {t.status === "Called" ? (
                  <button type="button" className="font-bold underline" onClick={() => update.mutate({ id: t.id, status: "Done" })}>
                    Done
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function feeExplainerText(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("embassy") || l.includes("delivery"))
    return "This pays for your finished document to travel safely from Monrovia to the Liberian embassy in your country, and for the embassy to hold it for you until you collect it. It is charged once, only when you choose embassy delivery.";
  if (l.includes("fast"))
    return "This pays for your application to jump the ordinary line and be handled first at PortaGov and at the institution. The service fee itself does not change.";
  if (l.includes("emergency"))
    return "This pays for same-day urgent handling: officers drop other work to move your application now. Use it only when the need is truly urgent.";
  if (l.includes("passport"))
    return "This covers making your passport booklet, printing your photo and details into it, and the checks the ministry runs before it is issued.";
  if (l.includes("birth"))
    return "This covers searching the register, preparing your certificate, and printing it on secure certificate paper.";
  if (l.includes("police") || l.includes("clearance"))
    return "This covers the record checks the police run in their systems and printing your clearance certificate.";
  if (l.includes("tax"))
    return "This covers the revenue authority checking your tax record and issuing your clearance.";
  if (l.includes("business") || l.includes("registration") || l.includes("licence") || l.includes("license"))
    return "This covers entering your business in the national register, checking the name is free, and issuing your registration or licence document.";
  return "This is the institution's own fee for this service: the work of checking your documents, processing your application, and preparing what you collect. PortaGov adds nothing on top of it.";
}

function FeeExplainer({ label, amount }: { label: string; amount: number }) {
  const flag = useFlags();
  if (!flag("fee_explainer")) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs font-bold" style={{ color: "#0a2a5e" }}>
        What does this ${amount} cover?
      </summary>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        {feeExplainerText(label)}
      </p>
    </details>
  );
}

function MoneyPanel() {
  const flag = useFlags();
  const m = useQuery({
    queryKey: ["money-summary"],
    queryFn: () => api.getMoneySummary({}),
  });
  if (!flag("money_screen")) return null;
  const d = m.data;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Money in, money out
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Live from confirmed payments and refunds. Only confirmed money
        counts as in; only completed refunds count as out.
      </p>
      {d ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[
              [`$${d.today_in}`, "confirmed in today"],
              [`$${d.today_out}`, "refunded today"],
              [`$${d.total_in}`, "confirmed in, all time"],
              [`$${d.total_refunded}`, "refunded, all time"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-lg bg-[var(--surface-alt)] p-3">
                <p className="font-display text-2xl font-extrabold text-[var(--text)]">{n}</p>
                <p className="text-xs text-[var(--dim)]">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-display font-bold text-[var(--text)]">Per payment method</h3>
              <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
                {d.by_method.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span>{r.label}</span>
                    <strong className="text-[var(--text)]">in ${r.in_amount}, out ${r.out_amount}</strong>
                  </li>
                ))}
                {d.by_method.length === 0 ? <li>No payments yet.</li> : null}
              </ul>
            </div>
            <div>
              <h3 className="font-display font-bold text-[var(--text)]">Per ministry</h3>
              <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
                {d.by_ministry.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span>{r.label}</span>
                    <strong className="text-[var(--text)]">in ${r.in_amount}, out ${r.out_amount}</strong>
                  </li>
                ))}
                {d.by_ministry.length === 0 ? <li>No payments yet.</li> : null}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--dim)]">Loading money...</p>
      )}
    </div>
  );
}

function promisedDays(processingTime: string): number {
  const nums = processingTime.match(/\d+/g)?.map(Number) ?? [];
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  if (/hour/i.test(processingTime)) return Math.max(1, Math.ceil(max / 24));
  return max;
}

function SlowestAlertsPanel() {
  const flag = useFlags();
  const limits = SERVICES.map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    maxDays: Math.max(1, promisedDays(serviceDetails(s.id).processingTime)),
  })).filter((l) => l.maxDays > 0);
  const alerts = useQuery({
    queryKey: ["slowest-alerts"],
    queryFn: () => api.getSlowestAlerts({ limits }),
  });
  if (!flag("slowest_alert")) return null;
  const list = alerts.data?.alerts ?? [];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        Slowest service alert
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Any service whose finished applications took longer on average
        than the time it promises citizens is flagged here, for the
        platform and for that ministry.
      </p>
      <div className="mt-3 space-y-2">
        {list.map((a) => (
          <p key={a.service_name} className="rounded-lg p-3 text-sm font-semibold text-white" style={{ backgroundColor: "#b3261e" }} role="alert">
            {a.service_name} at {a.institution}: averaging {a.avg_days} days
            against a promise of {a.promised_days} days, across {a.completed}{" "}
            completed applications. This ministry has been flagged.
          </p>
        ))}
        {!alerts.isPending && list.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">
            No service is over its promised time right now.
          </p>
        ) : null}
        {alerts.isPending ? <p className="text-sm text-[var(--dim)]">Checking service times...</p> : null}
      </div>
    </div>
  );
}

function ServiceClosedBanner({ serviceId }: { serviceId: string }) {
  const flag = useFlags();
  const closures = useQuery({
    queryKey: ["service-closures"],
    queryFn: () => api.listServiceClosures({}),
  });
  if (!flag("service_closed")) return null;
  const c = (closures.data?.closures ?? []).find((x) => x.service_id === serviceId);
  if (!c) return null;
  const tomorrow = new Date(Date.now() + 86400000);
  const nextOpen =
    tomorrow.getDay() === 0
      ? "Monday"
      : tomorrow.toLocaleDateString("en-GB", { weekday: "long" });
  return (
    <div className="mt-4 rounded-xl p-4 text-white" style={{ backgroundColor: "#b3261e" }} role="alert">
      <p className="font-display font-bold">Closed today at {c.institution}</p>
      <p className="mt-1 text-sm text-white/90">
        {c.note || "This service is closed for today."} It opens again{" "}
        {nextOpen}. You can still prepare your documents in your wallet
        and start the moment it opens.
      </p>
    </div>
  );
}

function ServiceClosedToggle({
  institution,
  serviceId,
  serviceName,
}: {
  institution: string;
  serviceId: string;
  serviceName: string;
}) {
  const queryClient = useQueryClient();
  const flag = useFlags();
  const closures = useQuery({
    queryKey: ["service-closures"],
    queryFn: () => api.listServiceClosures({}),
  });
  const [note, setNote] = useState("");
  const closed = (closures.data?.closures ?? []).find(
    (c) => c.institution === institution && c.service_id === serviceId,
  );
  const set = useMutation({
    mutationFn: async (closedNow: boolean) =>
      await api.setServiceClosed({
        institution,
        serviceId,
        serviceName,
        closed: closedNow,
        note: note || closed?.note || "",
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["service-closures"] }),
  });
  if (!flag("service_closed")) return null;
  return (
    <span className="flex items-center gap-2">
      {closed ? (
        <input
          aria-label={`Closure note for ${serviceName}`}
          {...FIELDS.setServiceClosed.note}
          className="w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={closed.note || "Why closed today?"}
        />
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={!!closed}
        aria-label={`Closed today switch for ${serviceName}`}
        disabled={set.isPending}
        onClick={() => set.mutate(!closed)}
        className="rounded-full border px-3 py-1.5 text-xs font-bold"
        style={
          closed
            ? { backgroundColor: "#b3261e", color: "#fff", borderColor: "#b3261e" }
            : { color: "var(--dim)", borderColor: "var(--border)" }
        }
      >
        {closed ? "Closed today" : "Open today"}
      </button>
    </span>
  );
}
