// PortaGov live backend adapter.
//
// The app used to run entirely in the browser (localStorage, see db.ts).
// This module talks to the real Flask backend on Render instead, for the
// core citizen flow: sign-up / sign-in, profile, applications, documents,
// payments, appointments, tracking, certificates and public stats.
//
// How it works:
// - On the live site the browser calls the same-origin proxy /pg-api/*
//   (see rewrites in next.config.mjs), so the browser never hits Render
//   CORS directly. Anywhere else it calls the backend URL directly.
// - The backend fee is the source of truth. The frontend catalogue fees
//   in services.ts were reconciled to the backend seed fees; the adapter
//   still uses the fee the backend returns when it creates an application.
// - The backend flow is: create a draft, upload the required documents,
//   pay, then submit. The app's flow is: submit first, then pay on the
//   application page. The adapter bridges that: submitApplication creates
//   the backend draft and uploads the picked wallet documents, and
//   recordPayment pays (mock MoMo while no live provider is wired),
//   confirms it, and then submits the backend application, which is what
//   releases it to the institution.
// - Extra profile fields the backend has no columns for (sex, place of
//   birth, district, community, emergency contact, witness, photo) are
//   kept in the cached profile on this device and sent to the backend
//   only where it has a field for them. The wallet stays device-local;
//   picked wallet documents are uploaded to the backend at submit time.
// - The staff, institution and platform desks are wired here too:
//   the institution queue from GET /api/staff/applications, status
//   changes through POST /api/staff/applications/<id>/action, direct
//   messages through /api/applications/<id>/messages, and platform
//   release/recall through /api/admin/applications/<id>/release and
//   /recall, with the release mode read from the admin settings.
//   Desk calls use a SEPARATE staff token (portagov-staff-token-v1),
//   never the citizen token: a citizen token is refused for staff
//   routes, and signing in as an officer never signs the citizen out.
//   Everything else still runs against the local actions, including
//   family, business, help desk and the assistant. Those are not yet
//   wired.
//
// Fallback rule for the desks, stated once so every function below
// follows it: the backend is always tried first, and the local store
// is used ONLY when the backend call fails. A 401 or 403 (not signed
// in as an officer, or the session expired) is never papered over
// with local data: it surfaces, so the desk asks the officer to sign
// in again instead of showing stale local rows as if they were live.
// A network failure or a 5xx, or a 404 for an endpoint the backend
// has not deployed yet (the release endpoints are still landing),
// falls back to the local action, and the code says so where it does.

import { Actions } from "./actions";

const DIRECT_API =
  (process.env.NEXT_PUBLIC_API_URL || "https://eliberia-backend.onrender.com").replace(/\/$/, "");

/** Same-origin proxy on the live site, direct backend URL elsewhere. */
function apiBase(): string {
  if (typeof window === "undefined") return DIRECT_API;
  const host = window.location.hostname || "";
  if (host.endsWith(".vercel.app") || host.endsWith(".giin.co.rw")) return "/pg-api";
  return DIRECT_API;
}

const TOKEN_KEY = "portagov-token";
const PROFILE_KEY = "portagov-remote-profile-v1";
const APPS_KEY = "portagov-remote-apps-v1";

const memoryStore = new Map<string, string>();

function storeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function storeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function storeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

function getToken(): string {
  return storeGet(TOKEN_KEY) || "";
}

function setToken(token: string): void {
  if (token) storeSet(TOKEN_KEY, token);
  else storeRemove(TOKEN_KEY);
}

type Json = Record<string, any>;

async function apiCall(path: string, opts: { method?: string; body?: any; form?: FormData; auth?: boolean } = {}): Promise<any> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (opts.auth !== false && token) headers["Authorization"] = `Bearer ${token}`;
  let body: any = undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status}). Try again.`;
    const err = new Error(String(msg)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- cached profile and applications ---------- */

function cachedProfile(): any | null {
  try {
    const raw = storeGet(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* Identifier (email or phone number) of the most recent sign-in attempt
   (loginStart). The code step must verify against THIS identifier, not
   the cached profile: the cached profile can belong to a different
   person signed in earlier on this device (for example an admin signing
   in after a citizen), and the backend issues the code for the attempted
   identifier only. */
let lastLoginIdentifier = "";

function saveProfile(p: any): void {
  storeSet(PROFILE_KEY, JSON.stringify(p));
  // Keep one cached profile per person, keyed by user id, so a
  // returning citizen keeps the details the backend does not store
  // (place of birth, sex, address, emergency contact) even after
  // someone else signed in on this device. userToProfile below only
  // ever reads the entry for the person signing in, so one person's
  // details can never leak onto another person's account page.
  try {
    const map = profilesById();
    map[String(p.id)] = p;
    storeSet(PROFILES_KEY, JSON.stringify(map));
  } catch {
    // The per-person backup is best effort; the current profile
    // above is the source of truth.
  }
}

const PROFILES_KEY = "portagov-remote-profiles-v1";

function profilesById(): Record<string, any> {
  try {
    const raw = storeGet(PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Forget the cached citizen profile on this device (sign-out). The
    per-person backup above is keyed by user id, so clearing the
    current profile never touches another person's saved details,
    and the next sign-in rebuilds the profile from that person's own
    backend record. */
export function clearCachedProfile(): void {
  storeRemove(PROFILE_KEY);
}

function appCache(): Record<string, any> {
  try {
    const raw = storeGet(APPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAppCache(cache: Record<string, any>): void {
  storeSet(APPS_KEY, JSON.stringify(cache));
}

/** Payments started on this device, keyed by transaction reference.
    The backend payment record does not carry the payer's phone number,
    so PortaGov keeps it here with the billing number and any reference
    the citizen typed, and listPayments below reads it back. */
const PAYMENTS_KEY = "portagov-remote-payments-v1";

function pendingPayments(): Record<string, any> {
  try {
    const raw = storeGet(PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingPayments(cache: Record<string, any>): void {
  storeSet(PAYMENTS_KEY, JSON.stringify(cache));
}

function emptyProfile(id: number, phone: string): any {
  return {
    id,
    full_name: "",
    date_of_birth: "",
    place_of_birth: "",
    sex: "",
    address: "",
    county: "",
    phone,
    email: "",
    photo: "",
    emergency_name: "",
    emergency_phone: "",
    national_id: "",
    has_national_id: false,
    alt_id_type: "",
    alt_id_number: "",
    witness_name: "",
    witness_phone: "",
    country: "Liberia",
    nationality: "Liberia",
    timezone: "",
    language: "English",
    phone_verified: false,
    email_verified: false,
    two_factor: false,
    id_checked_by_officer: false,
    has_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function userToProfile(u: any, fallback?: any): any {
  // A cached profile from an earlier sign-in may belong to a
  // different person on this device (for example an admin signing in
  // after a citizen). The backend user object does not carry place
  // of birth, sex, address, or emergency contact, so those fields
  // used to be filled from the cached profile, and the previous
  // person's details leaked onto the new sign-in's account page.
  // Only ever reuse saved details that belong to THIS user id: the
  // fallback, then the current cached profile, then that person's
  // own per-person backup. Anyone else starts from a blank profile.
  let base: any;
  if (fallback && Number(fallback.id) === Number(u.id)) {
    base = fallback;
  } else {
    const cached = cachedProfile();
    base =
      cached && Number(cached.id) === Number(u.id)
        ? cached
        : profilesById()[String(u.id)] || emptyProfile(u.id, u.phone || "");
  }
  return {
    ...base,
    id: u.id,
    full_name: u.full_name || base.full_name || "",
    date_of_birth: u.dob || base.date_of_birth || "",
    place_of_birth: base.place_of_birth || "",
    sex: base.sex || "",
    address: base.address || "",
    county: u.county || base.county || "",
    phone: u.phone || base.phone || "",
    email: u.email || base.email || "",
    national_id: u.nin || base.national_id || "",
    has_national_id: Boolean(u.nin || base.national_id),
    alt_id_type: u.id_doc_type === "Passport" ? "Passport" : base.alt_id_type || "",
    alt_id_number: u.id_number || base.alt_id_number || "",
    nationality: u.nationality || base.nationality || "Liberia",
    phone_verified: Boolean(u.phone_verified),
    email_verified: base.email_verified || false,
    two_factor: base.two_factor || false,
    id_checked_by_officer: base.id_checked_by_officer || false,
    has_password: true,
    updated_at: new Date().toISOString(),
  };
}

/* ---------- service mapping: frontend id -> backend code ---------- */

export const SERVICE_CODE_MAP: Record<string, string> = {
  "passport-new": "PASSPORT_NEW",
  "passport-renewal": "PASSPORT_RENEW",
  "birth-certificate": "BIRTH_CERT",
  "death-certificate": "DEATH_CERT",
  "police-clearance": "POLICE_CLEARANCE",
  "police-report": "LOST_DOC_REPORT",
  "national-id-new": "NATIONAL_ID_NEW",
  "national-id-replacement": "NATIONAL_ID_RENEW",
  "business-registration": "BUSINESS_REG",
  "business-renewal": "BUSINESS_RENEW",
  "tin-registration": "TIN_REG",
  "tax-clearance": "TAX_CLEARANCE",
  "driver-licence-new": "DRIVER_LICENSE_NEW",
  "driver-licence-renewal": "DRIVER_LICENSE_RENEW",
  "vehicle-registration": "VEHICLE_REG",
  "marriage-certificate": "MARRIAGE_CERT",
  "work-permit": "WORK_PERMIT",
  "deed-registration": "LAND_DEED_REG",
};

const CODE_TO_FRONTEND: Record<string, string> = {};
for (const [k, v] of Object.entries(SERVICE_CODE_MAP)) CODE_TO_FRONTEND[v] = k;

/* ---------- shared backend status mapping (one helper, every desk) ----------
   Backend status -> the frontend words the citizen sees. This is the
   ONLY place that translation lives: the citizen flow, the institution
   queue, the platform queue and the daily summary all go through it,
   so no desk invents its own wording.
   Platform first: a submitted application the platform is still
   holding is NOT released, and the citizen sees it as held, never as
   sent to the institution. The backend release gate adds a held /
   awaiting-release state; whichever form it returns, the citizen sees
   "Under review by PortaGov" (or "Awaiting release" when the backend
   says so explicitly), and the institution never sees the row at all:
   the institution queue filters released rows only. */
export const BACKEND_STATUS_MAP: Record<string, string> = {
  draft: "Under review by PortaGov",
  submitted: "Released to institution",
  in_review: "In review at institution",
  info_requested: "More information needed",
  biometric_pending: "Appointment set",
  approved: "Ready for collection",
  ready_for_collection: "Ready for collection",
  completed: "Completed",
  rejected: "Rejected",
  held: "Under review by PortaGov",
  awaiting_release: "Awaiting release",
  pending_release: "Under review by PortaGov",
  under_review: "Under review by PortaGov",
};

export function mapBackendStatus(raw: string, released?: boolean): string {
  const s = String(raw || "").toLowerCase();
  // Submitted but held by the platform: the citizen sees the held
  // state, not "Released to institution".
  if (s === "submitted" && released === false) return "Under review by PortaGov";
  return BACKEND_STATUS_MAP[s] ?? String(raw || "");
}

function mapStatus(s: string): string {
  return mapBackendStatus(s);
}

const serviceCache = new Map<string, any>();

async function getServiceDetail(code: string): Promise<any> {
  const hit = serviceCache.get(code);
  if (hit) return hit;
  const svc = await apiCall(`/api/services/${code}`, { auth: false });
  serviceCache.set(code, svc);
  return svc;
}

function normLabel(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Last guard before a date reaches the backend: the backend rejects
    a bad date of birth at submit (and at payment, after the money
    step), so normalise typed digits here and refuse anything that
    still is not a real YYYY-MM-DD date, naming the field. */
function normalizeRemoteDate(raw: string): string {
  const v = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
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

function isRemoteRealDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    dt.getUTCFullYear() === Number(m[1]) &&
    dt.getUTCMonth() === Number(m[2]) - 1 &&
    dt.getUTCDate() === Number(m[3])
  );
}

/** Build the backend `data` object from the wizard's label/value details
    plus the saved profile, matching backend form fields by label. */
function buildApplicationData(svc: any, details: { label: string; value: string }[], profile: any): Record<string, string> {
  const byLabel = new Map<string, string>();
  for (const d of details || []) byLabel.set(normLabel(d.label), d.value);
  const profileByName: Record<string, string> = {
    full_name: profile?.full_name || "",
    dob: profile?.date_of_birth || "",
    place_of_birth: profile?.place_of_birth || "",
    county: profile?.county || "",
    nin: profile?.national_id || "",
    child_name: profile?.full_name || "",
    deceased_name: profile?.full_name || "",
    spouse_one: profile?.full_name || "",
    business_name: "",
    address: profile?.address || "",
  };
  const data: Record<string, string> = {};
  for (const f of svc.form_fields || []) {
    const label = normLabel(f.label);
    let value = byLabel.get(label) || "";
    if (!value) {
      // Try the detail whose label contains the field name, e.g. a wizard
      // field "Name on the certificate" for backend field child_name.
      for (const [k, v] of byLabel) {
        if (k.includes(normLabel(f.name)) || normLabel(f.name).includes(k)) { value = v; break; }
      }
    }
    if (!value) value = profileByName[f.name] || "";
    if (!value) {
      // Last resort: match by a shared word between the labels.
      const words = label.split(/(?=[A-Z])/).join(" ").toLowerCase().split(/[^a-z]+/).filter(Boolean);
      for (const [k, v] of byLabel) {
        if (words.some((w) => w.length > 3 && k.includes(w))) { value = v; break; }
      }
    }
    if (value) data[f.name] = value;
  }
  return data;
}

function toFrontendApplication(b: any, extra?: any): any {
  const cache = appCache();
  const saved = cache[String(b.id)] || extra || {};
  const details = saved.details || JSON.stringify(
    Object.entries(b.data || {}).map(([k, v]) => ({ label: k, value: String(v ?? "") })),
  );
  const docIds = saved.document_ids || "[]";
  /* Platform first: the backend release gate decides `released`. A
     submitted application the platform is still holding is NOT
     released, whatever its status string says, and the citizen sees
     the held state (see mapBackendStatus). Only fall back to the old
     status-based rule when the backend sends no flag at all. */
  const heldState = ["held", "awaiting_release", "pending_release", "under_review"].includes(
    String(b.status || "").toLowerCase(),
  );
  const released = b.released ?? (b.status !== "draft" && !heldState);
  const status = mapBackendStatus(b.status, released);
  const heldNote =
    !released && (b.status === "submitted" || heldState)
      ? "Paid and received by PortaGov. The platform is reviewing it and will release it to the institution."
      : "";
  const fee = Number(b.fee_usd ?? saved.service_fee ?? 0);
  const priorityFee = Number(saved.priority_fee || 0);
  const deliveryFee = Number(saved.delivery_fee || 0);
  return {
    id: b.id,
    reference: b.reference,
    profile_id: b.applicant?.id || saved.profile_id || cachedProfile()?.id || 0,
    applicant_name: b.applicant?.full_name || saved.applicant_name || "",
    service_id: CODE_TO_FRONTEND[b.service?.code] || b.service?.code || saved.service_id || "",
    service_name: b.service?.name || saved.service_name || "",
    institution: institutionName(b.service?.institution) || saved.institution || "",
    status,
    released,
    on_behalf_of: saved.on_behalf_of || "",
    priority: saved.priority || "Standard",
    priority_fee: priorityFee,
    service_fee: fee,
    collection_choice: saved.collection_choice || "",
    embassy: saved.embassy || "",
    delivery_fee: deliveryFee,
    billing_number: b.bill_id || saved.billing_number || "",
    billing_status: b.paid ? "Paid" : "Unpaid",
    amount_paid: b.paid ? fee : 0,
    business_id: saved.business_id || 0,
    payment_plan: Boolean(saved.payment_plan),
    total_due: fee + priorityFee + deliveryFee,
    pickup_code: saved.pickup_code || "",
    proxy_name: saved.proxy_name || "",
    proxy_id: saved.proxy_id || "",
    proxy_code: saved.proxy_code || "",
    channel: saved.channel || "Self service",
    diaspora_country: saved.diaspora_country || "",
    agent_name: saved.agent_name || "",
    notes: saved.notes || "",
    details,
    document_ids: docIds,
    status_note:
      heldNote ||
      saved.status_note ||
      (b.paid
        ? "Paid and released to the institution."
        : b.status === "draft"
          ? "PortaGov is checking your documents. Pay the billing number to release it to the institution."
          : `Status: ${status}.`),
    created_at: b.created_at || new Date().toISOString(),
    updated_at: b.updated_at || new Date().toISOString(),
  };
}

function dataUrlToFile(dataUrl: string, fileName: string, contentType: string): File | null {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName || "document", { type: contentType || "application/octet-stream" });
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the document."));
    reader.readAsDataURL(blob);
  });
}

/* ---------- staff / officer sessions: a separate token, never the citizen one ----------
   Desk sign-in uses POST /api/auth/login, then a role check: only
   officer, inst_admin or admin may work a desk. A citizen token is
   refused for staff routes, and signing in as an officer never signs
   the citizen out of this browser, because the two tokens live under
   different keys. */
export const STAFF_TOKEN_KEY = "portagov-staff-token-v1";
export const STAFF_SESSION_KEY = "portagov-staff-session-v1";
export const STAFF_ROLES = ["officer", "inst_admin", "admin"] as const;

export type StaffSession = {
  id: number;
  name: string;
  role: string;
  institution: string;
  phone: string;
};

function getStaffToken(): string {
  return storeGet(STAFF_TOKEN_KEY) || "";
}

/** Admin mail calls have no local fallback: without a staff
    session there is nothing to show, so throw plainly. */
function requireStaffToken(): void {
  if (!getStaffToken()) {
    throw new Error("Sign in as an admin to use email.");
  }
}

function setStaffToken(token: string): void {
  if (token) storeSet(STAFF_TOKEN_KEY, token);
  else storeRemove(STAFF_TOKEN_KEY);
}

export function readStaffSession(): StaffSession | null {
  try {
    const raw = storeGet(STAFF_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

function saveStaffSession(s: StaffSession | null): void {
  if (s) storeSet(STAFF_SESSION_KEY, JSON.stringify(s));
  else storeRemove(STAFF_SESSION_KEY);
}

function clearStaffAuth(): void {
  setStaffToken("");
  saveStaffSession(null);
  storeRemove("portagov-officer");
}

function sessionFromUser(u: any): StaffSession {
  return {
    id: Number(u.id ?? 0),
    name: String(u.full_name || u.name || ""),
    role: String(u.role || ""),
    institution: String(u.institution?.name || u.institution || u.institution_name || ""),
    phone: String(u.phone || ""),
  };
}

/** Finish a staff login once the backend has returned a token: read
    the role (from the login reply, or from /api/auth/me with the new
    staff token), refuse anything that is not an officer, inst_admin
    or admin, and store the session. A citizen account is refused
    here, before any desk data is fetched. */
async function finishStaffLogin(res: any, phone: string): Promise<any> {
  if (!res?.token) return { ok: false, error: "Sign-in did not return a session. Try again." };
  setStaffToken(res.token);
  let user = res.user || null;
  if (!user?.role) {
    try {
      user = await staffApiCall("/api/auth/me", {});
    } catch {
      user = null;
    }
  }
  const role = String(user?.role || "");
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    clearStaffAuth();
    return {
      ok: false,
      error: "That account is a citizen account, not an officer account. Officers sign in here with the email or phone number and password the platform gave them.",
    };
  }
  const staff = sessionFromUser({ ...(user || {}), phone: user?.phone || phone });
  saveStaffSession(staff);
  storeSet("portagov-officer", staff.name);
  return { ok: true, staff };
}

/** Same as apiCall, but with the staff token. A 401 clears the staff
    auth and throws: the session is expired, and the desk must ask the
    officer to sign in again, never paper over it with local data. A
    403 is different: the token is valid but the role may not use that
    endpoint (for example an officer asking for the admin list), so it
    throws without signing the officer out. */
async function staffApiCall(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<any> {
  const headers: Record<string, string> = {};
  const token = getStaffToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body: any = undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) clearStaffAuth();
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status}). Try again.`;
    const err = new Error(String(msg)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/** A 401/403 means "not an officer" and is never a reason to show
    local data. Everything else (dropped connection, 5xx, an endpoint
    the backend has not deployed yet) may fall back to the local
    action, and the callers below say so where they do. */
function isAuthError(e: any): boolean {
  return e?.status === 401 || e?.status === 403;
}

/** Backend lists come back in more than one shape: a bare array, or
    {applications: [...]}, or {data: [...]}. Accept all three. */
function staffRows(res: any, key?: string): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res[key || "applications"])) return res[key || "applications"];
  if (res && Array.isArray(res.data)) return res.data;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

/** The backend sends an institution in two shapes: Application.to_dict
    sends service.institution as a plain string ("Ministry of Health"),
    while Service.to_dict sends it as an object ({name, ...}). Read
    both, or every live staff row ends up with institution "" and no
    desk filter ever matches it (verified live 2026-11-27: the MOH
    desk showed 0 waiting for a released application). */
function institutionName(v: any): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return String(v.name || "");
  return "";
}

/** Normalise one backend staff application into the frontend
    ApplicationT shape, using the ONE shared status mapping. The
    backend row may be the citizen shape (service/applicant objects)
    or a flatter one; both are read. */
function toStaffApplication(b: any): any {
  const svc = b.service || {};
  const applicant = b.applicant || {};
  const heldState = ["held", "awaiting_release", "pending_release", "under_review"].includes(
    String(b.status || "").toLowerCase(),
  );
  const released = b.released ?? (b.status !== "draft" && !heldState);
  const status = mapBackendStatus(b.status, released);
  const fee = Number(b.fee_usd ?? b.fee ?? 0);
  const details = JSON.stringify(
    Object.entries(b.data || {}).map(([k, v]) => ({ label: k, value: String(v ?? "") })),
  );
  return {
    id: Number(b.id ?? 0),
    reference: String(b.reference || ""),
    profile_id: Number(applicant.id ?? b.profile_id ?? b.applicant_id ?? 0),
    applicant_name: String(applicant.full_name || b.applicant_name || ""),
    service_id: CODE_TO_FRONTEND[svc.code] || svc.code || String(b.service_id || b.service_code || ""),
    service_name: String(svc.name || b.service_name || ""),
    institution: institutionName(svc.institution) || institutionName(b.institution) || "",
    status,
    /* The raw backend status, so the desk can gate its controls on
       the real state machine (approve only from in_review, ready
       only from approved, complete only from ready_for_collection):
       the frontend words alone cannot tell approved apart from
       ready_for_collection, both read "Ready for collection". */
    backend_status: String(b.status || ""),
    released: Boolean(released),
    on_behalf_of: String(b.beneficiary?.name || b.on_behalf_of || ""),
    priority: String(b.priority || "Standard"),
    priority_fee: 0,
    service_fee: fee,
    collection_choice: String(b.collection_choice || ""),
    embassy: String(b.embassy || ""),
    delivery_fee: 0,
    billing_number: String(b.bill_id || b.billing_number || ""),
    billing_status: b.paid ? "Paid" : "Unpaid",
    amount_paid: b.paid ? fee : 0,
    business_id: 0,
    payment_plan: false,
    total_due: fee,
    pickup_code: String(b.pickup_code || ""),
    proxy_name: "",
    proxy_id: "",
    proxy_code: "",
    channel: String(b.channel || "Self service"),
    diaspora_country: String(b.diaspora_country || ""),
    agent_name: "",
    notes: String(b.notes || ""),
    details,
    document_ids: "[]",
    status_note: String(b.status_note || b.note || ""),
    created_at: String(b.created_at || new Date().toISOString()),
    updated_at: String(b.updated_at || b.created_at || new Date().toISOString()),
  };
}

/** The institution queue: ONLY applications the platform has
    released. A held row is never returned here, even if the backend
    ever sends one: the institution never sees an application before
    the platform releases it. */
async function fetchStaffApplications(): Promise<any[]> {
  const res = await staffApiCall("/api/staff/applications", {});
  return staffRows(res).map(toStaffApplication).filter((a: any) => a.released);
}

/** The platform queue: every application, held and released. The
    backend has no GET /api/admin/applications list (it 404s): held
    applications live at GET /api/admin/applications/held and
    released ones at GET /api/staff/applications, and the two lists
    are merged here. Calling only the staff list hid every held
    application from the console, so nothing could ever be released
    from it (verified live 2026-11-27: the old path 404s, the staff
    list returns only the 7 released rows, the held list returns
    application 14). A 403/404 on the held list means this token may
    not use the admin queue (an officer token), so the released
    staff list alone is the right queue for that officer. Anything
    else (a dropped connection, a 5xx) is thrown: the console must
    show an error and a retry, never silent demo data. */
async function fetchAdminApplications(): Promise<any[]> {
  let held: any[] = [];
  try {
    const res = await staffApiCall("/api/admin/applications/held", {});
    held = staffRows(res).map(toStaffApplication);
  } catch (e: any) {
    if (e?.status === 403 || e?.status === 404) {
      // Not an admin token: the released staff list below is the queue.
    } else {
      throw e;
    }
  }
  const released = await fetchStaffApplications();
  const seen = new Set<number>();
  const merged: any[] = [];
  for (const a of [...held, ...released]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    merged.push(a);
  }
  return merged;
}

/** Normalise one backend thread message into the frontend MessageT
    shape. The backend may call the text body, message or content,
    and the sender may be a role, a name, or a user object. */
function normalizeThreadMessage(m: any, applicationId: number, institution: string, index: number): any {
  const sender = String(m.sender_role || m.role || m.sender?.role || m.sender || m.author || "");
  const fromCitizen = /citizen|applicant|user/i.test(sender) && !/officer|institution|staff|admin|portagov/i.test(sender);
  const numId = Number(m.id);
  return {
    id: Number.isFinite(numId) && numId > 0 ? numId : 1000000 + applicationId * 1000 + index,
    application_id: applicationId,
    channel: String(m.channel || "PortaGov"),
    kind: fromCitizen ? `Citizen to ${institution}` : `Direct from ${institution}`,
    body: String(m.body || m.message || m.content || ""),
    created_at: String(m.created_at || m.createdAt || new Date().toISOString()),
  };
}

async function fetchThreadMessages(applicationId: number, institution: string): Promise<any[]> {
  const res = await staffApiCall(`/api/applications/${applicationId}/messages`, {});
  const rows = staffRows(res, "messages");
  return rows.map((m: any, i: number) => normalizeThreadMessage(m, applicationId, institution, i));
}

/** The release-mode setting lives on the admin side, and the exact
    path is still landing with the backend release gate, so probe the
    two candidate paths: /api/admin/release-mode first, then
    /api/admin/settings. The first path that answers wins and is
    remembered for the session, so the live poll does not probe twice
    every 10 seconds. */
let releaseModePath: string | null = null;

async function readReleaseMode(): Promise<"automatic" | "manual" | null> {
  const paths = releaseModePath ? [releaseModePath] : ["/api/admin/release-mode", "/api/admin/settings"];
  for (const p of paths) {
    try {
      const res = await staffApiCall(p, {});
      const mode = String(res?.mode || res?.release_mode || res?.value || "").toLowerCase();
      if (mode === "automatic" || mode === "manual") {
        releaseModePath = p;
        return mode;
      }
      return null;
    } catch (e: any) {
      if (e?.status === 404) continue;
      throw e;
    }
  }
  return null;
}

async function writeReleaseMode(mode: "automatic" | "manual"): Promise<boolean> {
  const paths = releaseModePath ? [releaseModePath] : ["/api/admin/release-mode", "/api/admin/settings"];
  for (const p of paths) {
    try {
      const body = p.endsWith("/settings") ? { release_mode: mode } : { mode };
      await staffApiCall(p, { method: "POST", body });
      releaseModePath = p;
      return true;
    } catch (e: any) {
      if (e?.status === 404) continue;
      throw e;
    }
  }
  return false;
}

/* ---------- remote overrides: same names and shapes as Actions ---------- */

/** Backend ticket rows carry the linked application and tracking number;
    local rows do not. Normalise both to one shape so the panels can show
    the reference whenever it is there. */
function normalizeTicketRow(t: any): any {
  return {
    ...t,
    application_id: t.application_id ?? null,
    reference: t.reference ?? "",
    source: t.source ?? "help_page",
    replies: t.replies ?? [],
  };
}

/* ---------- questions saved on this device when nothing else worked ----------
   When a ticket cannot be created on the backend or in the local store,
   the question is kept here (at most the last 20) and retried later, so
   it is never silently dropped. */
const PENDING_TICKETS_KEY = "portagov-pending-tickets-v1";

type PendingTicket = {
  name: string;
  phone: string;
  topic: string;
  message: string;
  application_id: number | null;
  source: string;
  saved_at: string;
};

function readPendingTickets(): PendingTicket[] {
  try {
    const raw = storeGet(PENDING_TICKETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function queuePendingTicket(payload: Omit<PendingTicket, "saved_at">): void {
  try {
    const list = readPendingTickets();
    list.push({ ...payload, saved_at: new Date().toISOString() });
    storeSet(PENDING_TICKETS_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    // If even the queue cannot be written, there is nowhere left to keep
    // the question; the caller still tells the citizen it was not sent.
  }
}

export const remote: Record<string, (args: any) => Promise<any>> = {
  async registerAccount(args: any) {
    const res = await apiCall("/api/auth/register", {
      method: "POST",
      auth: false,
      body: {
        full_name: args.fullName,
        phone: args.phone,
        password: args.password,
        email: args.email || undefined,
        nin: args.hasNationalId ? args.nationalId || undefined : undefined,
        dob: args.dateOfBirth || undefined,
        county: args.county || undefined,
        language: "en",
        accept_terms: true,
      },
    });
    const profile = userToProfile(res.user, {
      ...emptyProfile(res.user.id, args.phone),
      full_name: args.fullName,
      date_of_birth: args.dateOfBirth,
      place_of_birth: args.placeOfBirth,
      sex: args.sex,
      address: args.address,
      county: args.county,
      email: args.email || "",
      emergency_name: args.emergencyName,
      emergency_phone: args.emergencyPhone,
      national_id: args.hasNationalId ? args.nationalId : "",
      has_national_id: args.hasNationalId,
      alt_id_type: args.hasNationalId ? "" : args.altIdType,
      alt_id_number: args.hasNationalId ? "" : args.altIdNumber,
      witness_name: args.witnessName,
      witness_phone: args.witnessPhone,
      country: args.country,
      nationality: args.nationality,
      timezone: args.timezone,
      language: args.language,
    });
    saveProfile(profile);
    // The code is returned by the backend only while EXPOSE_OTP is on
    // (Render demo setting). Once real SMS is wired, the code arrives by
    // SMS and this field is empty; the sign-in screen must not invent one.
    return { profile_id: res.user.id, demo_code: res.dev_otp || "", needs_email: Boolean(args.email) };
  },

  async verifyPhoneCode(args: any) {
    const profile = cachedProfile();
    const phone = profile?.phone || "";
    const res = await apiCall("/api/auth/verify-otp", {
      method: "POST",
      auth: false,
      body: { phone, otp: args.code },
    });
    if (res.token) setToken(res.token);
    const updated = userToProfile(res.user, profile);
    updated.phone_verified = true;
    saveProfile(updated);
    return { ok: true, email_code: "", profile: updated, locked: false, minutes_left: 0, attempts_left: 5 };
  },

  async verifyEmailCode(args: any) {
    // The backend has no email verification step; the phone check is the
    // proof. Keep the step a pass-through so sign-up can finish.
    const profile = cachedProfile();
    if (profile) {
      profile.email_verified = true;
      saveProfile(profile);
    }
    return { ok: true, profile, locked: false, minutes_left: 0, attempts_left: 5 };
  },

  async loginStart(args: any) {
    const empty = { profile_id: 0, demo_code: "", code_channels: [] as string[], new_device: false, minutes_left: 0, profile: null };
    // One field takes an email address or a phone number. The backend
    // looks the account up by either one; phone is sent along too so
    // an older backend that only knows phone still works.
    const identifier = String(args.identifier ?? args.phone ?? "").trim();
    let res: any;
    try {
      res = await apiCall("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier, phone: args.phone ?? identifier, password: args.password },
      });
    } catch (e: any) {
      if (e?.status === 401) return { result: "bad_credentials", ...empty };
      if (e?.status === 423) return { result: "locked", ...empty, minutes_left: 15 };
      if (e?.status === 403) return { result: "bad_credentials", ...empty };
      throw e;
    }
    if (res.two_factor) {
      lastLoginIdentifier = identifier;
      const profile = cachedProfile();
      return {
        result: "need_code",
        ...empty,
        profile_id: profile?.id || 0,
        demo_code: res.dev_otp || "",
        code_channels: res.code_channels || ["sms"],
        new_device: true,
      };
    }
    if (res.token) setToken(res.token);
    const profile = userToProfile(res.user);
    saveProfile(profile);
    return { result: "ok", ...empty, profile_id: res.user.id, profile };
  },

  async verifyLoginCode(args: any) {
    const profile = cachedProfile();
    // Prefer the identifier passed in for this attempt, then the
    // identifier of the most recent loginStart that asked for a code,
    // and only then the cached profile phone. The cached profile may
    // belong to a different person signed in earlier on this device.
    // An email sign-in must verify against the email account, not
    // against a phone from an earlier session.
    const identifier = args.identifier || lastLoginIdentifier || profile?.phone || "";
    const phone = args.phone || (identifier.includes("@") ? "" : identifier);
    const res = await apiCall("/api/auth/login/verify", {
      method: "POST",
      auth: false,
      body: { identifier, phone, otp: args.code },
    });
    lastLoginIdentifier = "";
    if (res.token) setToken(res.token);
    const updated = userToProfile(res.user, profile);
    saveProfile(updated);
    return { ok: true, new_device_warning: false, profile: updated, locked: false, minutes_left: 0, attempts_left: 5 };
  },

  async findProfileByPhone(args: any) {
    const profile = cachedProfile();
    if (profile && profile.phone === args.phone) return { profile };
    if (getToken()) {
      try {
        const me = await apiCall("/api/auth/me", {});
        if (me.phone === args.phone) {
          const p = userToProfile(me, profile);
          saveProfile(p);
          return { profile: p };
        }
      } catch {
        // fall through to null
      }
    }
    return { profile: null };
  },

  async checkCitizenSession(args: any) {
    const profile = cachedProfile();
    if (!profile || profile.phone !== args.phone) return { valid: false, profile: null };
    if (!getToken()) return { valid: false, profile: null };
    try {
      const me = await apiCall("/api/auth/me", {});
      const p = userToProfile(me, profile);
      saveProfile(p);
      return { valid: true, profile: p };
    } catch {
      return { valid: false, profile: null };
    }
  },

  async signOutAll(_args: any) {
    try {
      await apiCall("/api/auth/logout-all", { method: "POST", body: {} });
    } catch {
      // Signing out locally is still the right thing when the token is gone.
    }
    setToken("");
    // Forget this device's cached profile too, so the next sign-in
    // never shows the previous person's details on the account page.
    clearCachedProfile();
    return { ok: true, devices_signed_out: 1 };
  },

  /** Forget the cached citizen profile on this device (plain
      sign-out). The next sign-in rebuilds it from that person's own
      backend record. */
  async clearCachedProfile(_args: any) {
    clearCachedProfile();
    return { ok: true };
  },

  async changePassword(args: any) {
    const res = await apiCall("/api/auth/change-password", {
      method: "POST",
      body: { current_password: args.currentPassword, new_password: args.newPassword },
    });
    if (res.token) setToken(res.token);
    return { ok: true };
  },

  async updateProfile(args: any) {
    const profile = cachedProfile();
    const patch: Record<string, any> = {
      full_name: args.fullName,
      email: args.email || undefined,
      dob: args.dateOfBirth || undefined,
      county: args.county || undefined,
      nationality: args.nationality || undefined,
    };
    if (args.hasNationalId && args.nationalId) {
      patch.nin = args.nationalId;
    } else if (args.altIdType === "Passport" && args.altIdNumber) {
      patch.id_doc_type = "Passport";
      patch.id_number = args.altIdNumber;
    }
    try {
      const me = await apiCall("/api/auth/me", { method: "PATCH", body: patch });
      const updated = userToProfile(me, {
        ...(profile || {}),
        full_name: args.fullName,
        date_of_birth: args.dateOfBirth,
        place_of_birth: args.placeOfBirth,
        sex: args.sex,
        address: args.address,
        county: args.county,
        phone: args.phone,
        email: args.email || "",
        emergency_name: args.emergencyName,
        emergency_phone: args.emergencyPhone,
        national_id: args.hasNationalId ? args.nationalId : "",
        has_national_id: args.hasNationalId,
        alt_id_type: args.hasNationalId ? "" : args.altIdType,
        alt_id_number: args.hasNationalId ? "" : args.altIdNumber,
        witness_name: args.witnessName,
        witness_phone: args.witnessPhone,
        country: args.country,
        nationality: args.nationality,
        timezone: args.timezone,
        language: args.language,
      });
      saveProfile(updated);
      return { profile: updated };
    } catch (e) {
      // If the backend rejects the patch, keep the local copy so the
      // person does not lose what they typed, and say so plainly.
      if (profile) {
        const updated = { ...profile, ...patch, updated_at: new Date().toISOString() };
        saveProfile(updated);
      }
      throw e;
    }
  },

  async updateProfilePhoto(args: any) {
    // No profile photo endpoint exists on the backend yet; the photo is
    // kept on this device in the cached profile.
    const profile = cachedProfile();
    if (!profile) throw new Error("Sign in before adding a photo.");
    profile.photo = args.photo || "";
    profile.updated_at = new Date().toISOString();
    saveProfile(profile);
    return { profile };
  },

  async submitApplication(args: any) {
    const code = SERVICE_CODE_MAP[args.serviceId];
    if (!code) return (Actions as any).submitApplication(args);
    const profile = cachedProfile();
    if (!profile) throw new Error("Sign in before starting an application.");
    /* Guard every date detail before it reaches the backend: a value
       like 03141995 typed into a date box must become 1995-03-14, and
       anything that still is not a real date is refused here, with
       the field's label, instead of failing later at payment time. */
    const checkedDetails = (args.details || []).map((d: any) => {
      const label = String(d.label || "");
      if (/date/i.test(label) && String(d.value || "").trim()) {
        const fixed = normalizeRemoteDate(String(d.value));
        if (!isRemoteRealDate(fixed)) {
          throw new Error(
            `${label} must be a valid date. Pick it from the calendar, for example 1995-03-14.`,
          );
        }
        return { ...d, value: fixed };
      }
      return d;
    });
    const svc = await getServiceDetail(code);
    const data = buildApplicationData(svc, checkedDetails, profile);
    const created = await apiCall("/api/applications", {
      method: "POST",
      body: {
        service_code: code,
        data,
        beneficiary: args.onBehalfOf ? { name: args.onBehalfOf, relation: "Family" } : undefined,
      },
    });
    // Upload the wallet documents the person picked, matched to the
    // backend's required document names BY MEANING, not by position.
    // The old code paired picked[i] with required[i], so for a Birth
    // Certificate the passport photograph was sent as "Hospital
    // notification or affidavit", the National ID as "Parent's ID",
    // and the third document, the hospital birth record, was dropped
    // entirely because the backend only requires two documents.
    // The backend only accepts documents whose doc_type is one of
    // the service's required names: anything else is rejected with
    // 400 "Choose which required document this file is" (verified
    // live). So a picked document that does not match a required
    // name, for example the Passport photograph on a Birth
    // Certificate, is NOT uploaded to the backend at all: it stays
    // in the citizen's wallet and is listed on the application page
    // from there, under its own correct name, instead of being
    // mislabelled as a required document or dropped silently.
    const required: any[] = svc.required_documents || [];
    let uploaded = 0;
    let uploadedRequired = 0;
    const missingRequired: string[] = [];
    const docIds: number[] = [];
    const used = new Set<number>();
    const normDoc = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const docText = (d: any) => normDoc(`${d.doc_type || ""} ${d.title || ""} ${d.file_name || ""}`);
    const matchRequired = (reqName: string, docs: any[]) => {
      const req = normDoc(reqName);
      // Hospital notification / affidavit / birth record: the
      // hospital or clinic birth record from the wallet.
      if (/(hospital|clinic|notification|affidavit|birth record)/.test(req)) {
        return (
          docs.find((d) => /(hospital|clinic)/.test(docText(d))) ||
          docs.find((d) => /(birth record|notification|affidavit)/.test(docText(d))) ||
          null
        );
      }
      // Any ID the ministry asks for (Parent's ID, Owner ID, ...):
      // the person's National ID first, then Passport, then Voter card.
      if (/\bid\b/.test(req) || req.endsWith(" id")) {
        return (
          docs.find((d) => normDoc(d.doc_type) === "national id" || normDoc(d.title) === "national id") ||
          docs.find((d) => normDoc(d.doc_type) === "passport" || normDoc(d.title) === "passport") ||
          docs.find((d) => normDoc(d.doc_type) === "voter card" || normDoc(d.title) === "voter card") ||
          docs.find((d) => /\bid\b/.test(docText(d))) ||
          null
        );
      }
      // Generic match: same name, or one name contained in the other.
      return (
        docs.find((d) => normDoc(d.title) === req || normDoc(d.doc_type) === req) ||
        docs.find((d) => docText(d).includes(req) || req.includes(normDoc(d.title)) || req.includes(normDoc(d.doc_type))) ||
        null
      );
    };
    const uploadDoc = async (doc: any, docType: string) => {
      const file = doc.file_url ? dataUrlToFile(doc.file_url, doc.file_name, doc.content_type) : null;
      if (!file) return false;
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", docType);
      await apiCall(`/api/applications/${created.id}/documents`, { method: "POST", form });
      uploaded += 1;
      docIds.push(doc.id);
      used.add(doc.id);
      return true;
    };
    try {
      const wallet = await (Actions as any).listDocuments({ profileId: args.profileId });
      // Keep the citizen's tick order, not the wallet's storage order.
      const picked = (wallet.documents || [])
        .filter((d: any) => (args.documentIds || []).includes(d.id))
        .sort((a: any, b: any) => (args.documentIds || []).indexOf(a.id) - (args.documentIds || []).indexOf(b.id));
      for (const req of required) {
        const doc = matchRequired(req.name, picked.filter((d: any) => !used.has(d.id)));
        if (!doc) {
          missingRequired.push(req.name);
          continue;
        }
        if (await uploadDoc(doc, req.name)) uploadedRequired += 1;
      }
      // Every remaining picked document stays in the wallet and is
      // listed on the application from there, under its own correct
      // name (for example "Passport photograph"). It is not sent to
      // the backend, which would reject it as not a required
      // document for this service.
      for (const doc of picked) {
        if (used.has(doc.id)) continue;
        docIds.push(doc.id);
      }
    } catch (e: any) {
      // A document that will not upload must stop the application with a
      // clear message, not a silent half-submitted draft.
      throw new Error(e?.message || "A document could not be uploaded. Check the file and try again.");
    }
    const cache = appCache();
    cache[String(created.id)] = {
      profile_id: args.profileId,
      applicant_name: profile.full_name,
      service_id: args.serviceId,
      service_name: args.serviceName,
      institution: args.institution,
      on_behalf_of: args.onBehalfOf || "",
      priority: args.priority || "Standard",
      priority_fee: args.priorityFee || 0,
      service_fee: Number(created.fee_usd ?? svc.fee_usd ?? 0),
      collection_choice: args.collectionChoice || "",
      embassy: args.embassy || "",
      delivery_fee: args.deliveryFee || 0,
      business_id: args.businessId || 0,
      payment_plan: Boolean(args.paymentPlan),
      channel: args.channel || "Self service",
      diaspora_country: args.diasporaCountry || "",
      agent_name: args.agentName || "",
      notes: args.notes || "",
      details: JSON.stringify(checkedDetails || []),
      document_ids: JSON.stringify(docIds),
      status_note:
        uploadedRequired < required.length
          ? `Draft saved with PortaGov. ${required.length - uploadedRequired} required document(s) still missing (${missingRequired.join(", ")}): attach them from your wallet before you pay, or the ministry cannot accept it.`
          : `Billing number ${created.bill_id || ""}: pay $${Number(created.fee_usd ?? 0)} with MTN MoMo or Orange Money. PortaGov releases your application only when this billing number is confirmed paid.`,
    };
    saveAppCache(cache);
    const app = toFrontendApplication(created, cache[String(created.id)]);
    app.document_ids = JSON.stringify(docIds);
    return { application: app };
  },

  async listApplications(_args: any) {
    try {
      const rows = await apiCall("/api/applications", {});
      const remoteApps = (rows || []).map((r: any) => toFrontendApplication(r));
      const local = await (Actions as any).listApplications({ profileId: cachedProfile()?.id || 0 }).catch(() => ({ applications: [] }));
      const seen = new Set(remoteApps.map((a: any) => a.reference));
      const merged = [...remoteApps, ...(local.applications || []).filter((a: any) => !seen.has(a.reference))];
      return { applications: merged };
    } catch {
      return (Actions as any).listApplications({ profileId: cachedProfile()?.id || 0 });
    }
  },

  async trackApplication(args: any) {
    const profile = cachedProfile();
    if (!profile || profile.phone !== args.phone) return { application: null };
    let tracked: any;
    try {
      tracked = await apiCall(`/api/applications/track/${encodeURIComponent(args.reference.trim().toUpperCase())}`, { auth: false });
    } catch {
      return { application: null };
    }
    if (!tracked || !tracked.reference) return { application: null };
    const detail = await apiCall(`/api/applications/${tracked.reference ? "" : ""}`, {}).catch(() => null);
    void detail;
    const app = toFrontendApplication(
      {
        id: 0,
        reference: tracked.reference,
        status: tracked.status,
        fee_usd: tracked.fee_usd,
        paid: tracked.paid,
        bill_id: "",
        service: { code: "", name: tracked.service || "", institution: { name: tracked.institution || "" } },
        applicant: { id: profile.id, full_name: profile.full_name, phone: profile.phone },
        data: {},
        created_at: tracked.updated_at,
        updated_at: tracked.updated_at,
      },
      appCache()[String(tracked.reference)] || {},
    );
    // Look up the real numeric id from my applications so the detail
    // page can open.
    try {
      const mine = await apiCall("/api/applications", {});
      const match = (mine || []).find((r: any) => r.reference === tracked.reference);
      if (match) {
        const full = toFrontendApplication(match);
        full.status_note = app.status_note;
        return { application: full };
      }
    } catch {
      // keep the tracked shape
    }
    return { application: app };
  },

  async listStatusEvents(args: any) {
    try {
      const detail = await apiCall(`/api/applications/${args.applicationId}`, {});
      const events = (detail.events || []).map((e: any, i: number) => ({
        id: i + 1,
        status: e.status,
        note: e.message || "",
        actor: e.actor || "",
        created_at: e.created_at || detail.created_at,
      }));
      return { events };
    } catch {
      return (Actions as any).listStatusEvents(args);
    }
  },

  async listApplicationActivity(args: any) {
    try {
      const detail = await apiCall(`/api/applications/${args.applicationId}`, {});
      const entries: any[] = [];
      for (const e of detail.events || []) {
        entries.push({ kind: "Status", actor: e.actor || "", title: e.status, detail: e.message || "", created_at: e.created_at });
      }
      for (const p of detail.payments || []) {
        entries.push({ kind: "Payment", actor: "PortaGov", title: `Payment ${p.status}`, detail: `$${p.amount_usd} by ${p.method}, ${p.txn_ref}.`, created_at: p.created_at });
      }
      for (const d of detail.documents || []) {
        entries.push({ kind: "Document", actor: detail.applicant?.full_name || "", title: `Document: ${d.doc_type}`, detail: d.filename || "", created_at: d.created_at });
      }
      entries.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      return { reference: detail.reference, entries };
    } catch {
      return (Actions as any).listApplicationActivity(args);
    }
  },

  async listApplicationDocuments(args: any) {
    try {
      const detail = await apiCall(`/api/applications/${args.applicationId}`, {});
      const docs: any[] = [];
      for (const d of detail.documents || []) {
        let fileUrl = "";
        try {
          const res = await fetch(`${apiBase()}/api/applications/${args.applicationId}/documents/${d.id}`, {
            headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
          });
          if (res.ok) fileUrl = await blobToDataUrl(await res.blob());
        } catch {
          fileUrl = "";
        }
        docs.push({
          id: d.id,
          doc_type: d.doc_type,
          title: d.doc_type,
          doc_number: "",
          expires_on: "",
          validity: "Valid",
          has_file: true,
          file_url: fileUrl,
          // The backend stores a file name, not a content type, so
          // derive it from the extension. Labelling every document
          // "application/pdf" made a passport photograph open as a PDF
          // instead of as a photo in the viewer.
          content_type: /\.jpe?g$/i.test(d.filename || "")
            ? "image/jpeg"
            : /\.png$/i.test(d.filename || "")
              ? "image/png"
              : /\.gif$/i.test(d.filename || "")
                ? "image/gif"
                : /\.webp$/i.test(d.filename || "")
                  ? "image/webp"
                  : "application/pdf",
        });
      }
      return { documents: docs };
    } catch {
      return (Actions as any).listApplicationDocuments(args);
    }
  },

  async recordPayment(args: any) {
    // Kept for callers that pay in one step: start the payment, then
    // confirm it (the USSD "press 1, then PIN" step on the phone).
    const started: any = await (remote as any).startPayment(args);
    if (!started.txn_ref) return { id: started.id || 0, txn_ref: "", billing_number: started.billing_number || "", amount: started.amount || 0, reference: started.reference || "" };
    const done: any = await (remote as any).confirmPayment({
      applicationId: args.applicationId,
      txn_ref: started.txn_ref,
    });
    return { id: done.id || started.id || 0, txn_ref: done.txn_ref || started.txn_ref, billing_number: done.billing_number || started.billing_number, amount: done.amount ?? started.amount, reference: done.reference || "" };
  },

  /**
   * Start a mobile money payment, the first half of the approved
   * payment flow (Giin, 2026-11-27): the citizen types ANY MoMo
   * number to pay from, pre-filled with their sign-up number but
   * editable, and clicks Make payment. The backend generates the
   * billing number and a transaction reference and, in mock mode,
   * waits for the citizen to confirm on their phone. Nothing is
   * confirmed here: confirmPayment below is the second half, after
   * the person presses 1 and enters their PIN on the phone.
   * The payer number, the billing number and any reference the
   * citizen typed are saved with the payment, never dropped.
   */
  async startPayment(args: any) {
    const cache = appCache();
    const saved = cache[String(args.applicationId)];
    const detail = await apiCall(`/api/applications/${args.applicationId}`, {});
    const fee = Number(detail.fee_usd ?? 0);
    const billing = detail.bill_id || "";
    if (fee <= 0 || detail.paid) {
      // Free service, or already paid: submit straight away.
      if (!detail.paid) {
        await apiCall(`/api/applications/${args.applicationId}/submit`, { method: "POST", body: {} });
      }
      return {
        id: 0,
        txn_ref: "",
        billing_number: billing,
        amount: fee,
        method: args.method,
        payer_phone: args.payerPhone || "",
        user_ref: args.transactionRef || "",
        reference: detail.reference || "",
        confirm_by_user: false,
        already_paid: Boolean(detail.paid),
      };
    }
    const pay = await apiCall(`/api/applications/${args.applicationId}/pay`, {
      method: "POST",
      body: {
        method: args.method === "Orange Money" ? "orange_money" : "mtn_momo",
        msisdn: args.payerPhone,
      },
    });
    const rec = {
      id: pay.id,
      txn_ref: pay.txn_ref,
      billing_number: billing,
      amount: fee,
      method: args.method,
      payer_phone: args.payerPhone || "",
      user_ref: args.transactionRef || "",
      application_id: args.applicationId,
      confirm_by_user: Boolean(pay.confirm_by_user),
    };
    const pending = pendingPayments();
    pending[String(pay.txn_ref)] = rec;
    savePendingPayments(pending);
    void saved;
    return rec;
  },

  /**
   * Second half of the payment flow: the citizen has pressed 1 to
   * confirm the transaction and amount on their phone and entered
   * their MoMo PIN there. In mock mode this call is the stand-in for
   * that USSD confirmation; when a real MoMo/Orange Money provider
   * is live, the same step waits for the provider to settle instead.
   * After confirmation the application is submitted, which releases
   * it to the institution, and the caller must refresh the
   * application and payments lists so the paid amount shows at once.
   */
  async confirmPayment(args: any) {
    const cache = appCache();
    const saved = cache[String(args.applicationId)];
    const pending = pendingPayments()[String(args.txn_ref)] || {};
    const txnRef = args.txn_ref;
    if (pending.confirm_by_user !== false) {
      try {
        await apiCall(`/api/applications/payments/${txnRef}/confirm`, {
          method: "POST",
          body: { success: true },
        });
      } catch {
        // The confirm call did not land: fall through to polling the
        // payment status, so a dropped connection does not lose a
        // payment that the provider already settled.
        let settled = false;
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const st = await apiCall(`/api/applications/payments/${txnRef}/status`, {}).catch(() => null);
          if (st && st.status === "success") { settled = true; break; }
          if (st && st.status === "failed") throw new Error("The payment was not confirmed by the provider. Check your phone and try again.");
        }
        if (!settled) throw new Error("The payment is still pending with the provider. Check your phone, then check the payment status again.");
      }
    } else {
      // Live provider payment: poll until the provider settles it.
      let settled = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await apiCall(`/api/applications/payments/${txnRef}/status`, {});
        if (st.status === "success") { settled = true; break; }
        if (st.status === "failed") throw new Error("The payment was not confirmed by the provider. Check your phone and try again.");
      }
      if (!settled) throw new Error("The payment is still pending with the provider. Check your phone, then check the payment status again.");
    }
    const after = await apiCall(`/api/applications/${args.applicationId}`, {});
    if (!after.paid) throw new Error("PortaGov could not confirm this payment. The money may still arrive; check the payment status before paying again.");
    if (saved) {
      // Platform first: payment does NOT release the application.
      // The platform reviews it and releases it to the institution,
      // at once when automatic release is on. Clear the cached note
      // so the next refetch shows the true live state (held or
      // released) instead of a stale "released" claim.
      delete saved.status_note;
      saveAppCache(cache);
    }
    // Submit now that the fee is paid: this hands the application to
    // the PLATFORM, not to the institution. Release to the
    // institution is the platform's decision, at once when automatic
    // release is on, or by a person on the platform console.
    await apiCall(`/api/applications/${args.applicationId}/submit`, { method: "POST", body: {} });
    return {
      id: pending.id || 0,
      txn_ref: txnRef,
      billing_number: pending.billing_number || after.bill_id || "",
      amount: Number(pending.amount ?? after.fee_usd ?? 0),
      method: pending.method || "",
      payer_phone: pending.payer_phone || "",
      user_ref: pending.user_ref || "",
      reference: after.reference || "",
      status: "Confirmed",
    };
  },

  async listPayments(_args: any) {
    try {
      const rows = await apiCall("/api/applications", {});
      const payments: any[] = [];
      const pending = pendingPayments();
      for (const r of rows || []) {
        const detail = await apiCall(`/api/applications/${r.id}`, {}).catch(() => null);
        if (!detail) continue;
        for (const p of detail.payments || []) {
          const kept = pending[String(p.txn_ref || "")] || {};
          payments.push({
            id: p.id,
            application_id: r.id,
            application_ref: r.reference,
            billing_number: r.bill_id || kept.billing_number || "",
            service_name: r.service?.name || "",
            method: p.method === "mtn_momo" ? "MTN MoMo" : p.method === "orange_money" ? "Orange Money" : p.method,
            amount: Number(p.amount_usd ?? 0),
            // The backend does not return the payer's number, so read
            // back the number the citizen typed when they paid.
            payer_phone: kept.payer_phone || "",
            transaction_ref: p.txn_ref || "",
            status: p.status === "success" ? "Confirmed" : p.status === "refunded" ? "Refunded" : "Recorded",
            refund_reason: p.refund_reason || "",
            created_at: p.created_at || r.created_at,
          });
        }
      }
      return { payments };
    } catch {
      return (Actions as any).listPayments({ limit: 100 });
    }
  },

  /** Platform-wide payments for the console, from the live backend
      reconciliation list. The citizen listPayments above only ever
      shows the signed-in citizen's own payments (and an admin has
      none), so the console showed 0 payments. The backend list
      carries no payer phone (only the paying device knows it), so
      that field stays blank here. Signed in and the live call fails:
      throw, never show seed payments. */
  async listPlatformPayments(_args: any) {
    if (!getStaffToken()) return (Actions as any).listPayments({ limit: 100 });
    const res = await staffApiCall("/api/staff/payments", {});
    const items = staffRows(res, "items");
    return {
      payments: items.map((p: any) => ({
        id: Number(p.id ?? 0),
        application_id: 0,
        application_ref: String(p.reference || ""),
        billing_number: String(p.bill_id || ""),
        service_name: String(p.service || ""),
        method:
          p.method === "mtn_momo"
            ? "MTN MoMo"
            : p.method === "orange_money"
              ? "Orange Money"
              : String(p.method || ""),
        amount: Number(p.amount_usd ?? 0),
        payer_phone: "",
        transaction_ref: String(p.txn_ref || ""),
        status: p.status === "success" ? "Confirmed" : p.status === "refunded" ? "Refunded" : "Recorded",
        refund_reason: String(p.refund_reason || ""),
        created_at: String(p.created_at || ""),
      })),
    };
  },

  async bookAppointment(args: any) {
    const OFFICE_TO_CENTER: Record<string, string> = {
      "PortaGov Service Centre, Capitol Hill, Monrovia": "Monrovia (Capitol Hill) Service Center",
      "County Service Centre, Gbarnga, Bong County": "Gbarnga",
      "County Service Centre, Kakata, Margibi County": "Kakata",
      "County Service Centre, Buchanan, Grand Bassa County": "Buchanan",
      "County Service Centre, Zwedru, Grand Gedeh County": "Zwedru",
    };
    const center = OFFICE_TO_CENTER[args.office];
    if (!center || !args.applicationId) return (Actions as any).bookAppointment(args);
    // PortaGov offices are open on weekdays only. Reject a Saturday or
    // Sunday here with a clear message instead of failing silently.
    if (args.date) {
      const day = new Date(`${String(args.date).slice(0, 10)}T12:00:00`).getDay();
      if (day === 0 || day === 6) {
        throw new Error("PortaGov offices are open on weekdays only, Monday to Friday. Choose a weekday for your visit.");
      }
    }
    const start = String(args.timeSlot || "09:00").slice(0, 5);
    const slot = `${args.date}T${start}:00`;
    let appt: any;
    try {
      appt = await apiCall(`/api/applications/${args.applicationId}/appointments`, {
        method: "POST",
        body: {
          center,
          slot,
          purpose: args.kind === "Collection" ? "collection" : "biometrics",
        },
      });
    } catch (e: any) {
      // A dropped connection can leave the booking saved on the server
      // while the answer never arrives; the retry then says the
      // application already has an appointment. That is the booking,
      // not a failure: read it back instead of failing.
      if (e?.status === 409) {
        const mine = await apiCall("/api/applications/appointments/mine", {}).catch(() => []);
        const found = (mine || []).find((a: any) => a.application_id === args.applicationId && a.status === "booked");
        if (found) return { id: found.id, ticket: `TKT-${String(found.id).padStart(5, "0")}` };
      }
      throw e;
    }
    return { id: appt.id, ticket: `TKT-${String(appt.id).padStart(5, "0")}` };
  },

  async listAppointments(_args: any) {
    try {
      const rows = await apiCall("/api/applications/appointments/mine", {});
      const mine = await apiCall("/api/applications", {}).catch(() => []);
      const refById = new Map((mine || []).map((r: any) => [r.id, r.reference]));
      return {
        appointments: (rows || []).map((a: any) => ({
          id: a.id,
          profile_id: cachedProfile()?.id || 0,
          application_id: a.application_id,
          application_ref: refById.get(a.application_id) || "",
          kind: a.purpose === "collection" ? "Collection" : "Biometrics",
          group_size: 1,
          ticket: `TKT-${String(a.id).padStart(5, "0")}`,
          office: a.center,
          date: String(a.slot || "").slice(0, 10),
          time_slot: String(a.slot || "").slice(11, 16),
          status: a.status === "booked" ? "Booked" : a.status === "attended" ? "Attended" : a.status === "missed" ? "Missed" : "Cancelled",
          created_at: a.created_at || new Date().toISOString(),
        })),
      };
    } catch {
      return (Actions as any).listAppointments({ profileId: cachedProfile()?.id || 0 });
    }
  },

  async updateAppointmentStatus(args: any) {
    if (args.status === "Cancelled") {
      await apiCall(`/api/appointments/${args.id}/cancel`, { method: "POST", body: {} });
      return { ok: true };
    }
    return (Actions as any).updateAppointmentStatus(args);
  },

  async getCertificate(args: any) {
    try {
      const certs = await apiCall("/api/certificates", {});
      const found = (certs || []).find((c: any) => c.application_id === args.applicationId);
      if (!found) return { certificate: null };
      return {
        certificate: {
          cert_number: found.number || found.reference || "",
          service_name: found.service_name || "",
          institution: found.institution_name || "",
          holder_name: found.holder_name || "",
          reference: found.reference || "",
          issued_at: found.issued_at || "",
        },
      };
    } catch {
      return (Actions as any).getCertificate(args);
    }
  },

  async verifyCertificate(args: any) {
    try {
      const res = await apiCall(`/api/verify/${encodeURIComponent(args.certNumber)}`, { auth: false });
      if (!res || res.valid === false) return { valid: false, certificate: null };
      const c = res.certificate || res;
      return {
        valid: true,
        certificate: {
          cert_number: c.number || args.certNumber,
          service_name: c.service_name || "",
          institution: c.institution_name || "",
          holder_name: c.holder_name || "",
          reference: c.reference || "",
          issued_at: c.issued_at || "",
        },
      };
    } catch {
      return (Actions as any).verifyCertificate(args);
    }
  },

  async getPublicStats(_args: any) {
    try {
      const s = await apiCall("/api/public/stats", { auth: false });
      const now = new Date();
      return {
        month_label: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        applications_this_month: Number(s.applications || 0),
        completions: Number(s.certificates || 0),
        total_applications: Number(s.applications || 0),
        institutions: [],
      };
    } catch {
      return (Actions as any).getPublicStats({});
    }
  },

  async askAssistant(args: any) {
    try {
      const res = await apiCall("/api/assistant", { method: "POST", auth: false, body: { q: args.question } });
      if (res && res.answer) {
        // The backend says whether the question matched anything. When it
        // did not match, the question is unanswered and must become a ticket.
        const matched = res.matched !== false;
        return { answer: res.answer, route: "None", needs_ticket: !matched, matched };
      }
      return { answer: "", route: "Help desk", needs_ticket: true, matched: false };
    } catch {
      // The answer path itself failed (the AI is down). The local preset
      // answers still try; when they cannot answer either, the question
      // comes back as a ticket, so it is captured, never lost.
      return (Actions as any).askAssistant(args);
    }
  },

  /* ---------- help desk tickets: backend first, local store only as fallback ----------
     The backend ticket store is the source of truth. A ticket is created on
     the backend whenever it can be reached. The local store is only a
     fallback when the backend cannot be reached at all (dropped connection,
     5xx, or an endpoint the backend has not deployed yet, 404). A 401/403
     is never papered over with local data: it means the sign-in is wrong
     or the role may not use that endpoint, and the caller must see it.
     A 400 is also rethrown: the ticket itself is wrong (short message,
     bad phone), and the citizen must see the reason, not a quiet local copy. */

  async submitHelpRequest(args: any) {
    const payload = {
      name: args.name,
      phone: args.phone,
      topic: args.topic,
      message: args.message,
      application_id: args.applicationId ?? null,
      source: args.source || "help_page",
    };
    try {
      const res = await apiCall("/api/tickets", { method: "POST", body: payload });
      return { id: res.id };
    } catch (e: any) {
      if (isAuthError(e) || e?.status === 400) throw e;
      try {
        return await (Actions as any).submitHelpRequest(args);
      } catch {
        // Even the local save failed: keep the question on this device and
        // retry it later. Never silently drop it.
        queuePendingTicket(payload);
        throw new Error("Your question is saved on this device and will be sent as soon as the connection is back. A real person will still answer you.");
      }
    }
  },

  async listHelpRequestsByPhone(args: any) {
    if (getToken()) {
      try {
        const res = await apiCall("/api/tickets/mine", {});
        return { requests: (res.requests || []).map(normalizeTicketRow) };
      } catch (e: any) {
        if (isAuthError(e)) throw e;
        // Backend unreachable: fall through to the local store below.
      }
    }
    return (Actions as any).listHelpRequestsByPhone(args);
  },

  async listHelpRequests(args: any) {
    const limit = args?.limit || 50;
    const path = `/api/staff/tickets?limit=${limit}`;
    try {
      const res = getStaffToken()
        ? await staffApiCall(path, {})
        : await apiCall(path, {});
      return { requests: (res.requests || []).map(normalizeTicketRow) };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).listHelpRequests(args);
    }
  },

  async replyHelpRequest(args: any) {
    const path = `/api/staff/tickets/${args.id}/reply`;
    try {
      if (getStaffToken()) await staffApiCall(path, { method: "POST", body: { reply: args.reply } });
      else await apiCall(path, { method: "POST", body: { reply: args.reply } });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).replyHelpRequest(args);
    }
  },

  async assignHelpRequest(args: any) {
    const path = `/api/staff/tickets/${args.id}/assign`;
    try {
      if (getStaffToken()) await staffApiCall(path, { method: "POST", body: { officer_name: args.officerName } });
      else await apiCall(path, { method: "POST", body: { officer_name: args.officerName } });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).assignHelpRequest(args);
    }
  },

  /** Retries questions saved on this device when both the backend and the
      local store failed. Anything still unsent stays queued. */
  async flushPendingTickets(_args: any) {
    const pending = readPendingTickets();
    if (pending.length === 0) return { sent: 0, remaining: 0 };
    const remaining: PendingTicket[] = [];
    let sent = 0;
    for (const t of pending) {
      let done = false;
      try {
        await apiCall("/api/tickets", {
          method: "POST",
          body: {
            name: t.name,
            phone: t.phone,
            topic: t.topic,
            message: t.message,
            application_id: t.application_id,
            source: t.source,
          },
        });
        done = true;
      } catch {
        try {
          await (Actions as any).submitHelpRequest({
            profileId: null,
            name: t.name,
            phone: t.phone,
            topic: t.topic,
            message: t.message,
          });
          done = true;
        } catch {
          remaining.push(t);
        }
      }
      if (done) sent += 1;
    }
    if (remaining.length === 0) storeRemove(PENDING_TICKETS_KEY);
    else storeSet(PENDING_TICKETS_KEY, JSON.stringify(remaining));
    return { sent, remaining: remaining.length };
  },

  /* ---------- staff, institution and platform desks (live backend) ----------
     Platform first, the approved intermediary flow: citizen information
     lands with the PLATFORM, the platform holds it and checks payment,
     then the platform releases it to the ministry. The institution
     never sees an application before release: the institution queue
     (fetchStaffApplications) returns released rows only, and the two
     local institution views that could leak a held row (appointments
     and payments) now filter to released applications too.
     Institution onboarding (template form, service studio, preview,
     sandbox test, approval to go live) has NO backend endpoint in the
     API list, so the studio and the approval flow stay on the local
     store for now. What the backend does support is institution team
     management, so the officer roster below (listStaff / addStaff) is
     wired to /api/admin/officers. When the backend adds onboarding
     endpoints, createInstitution / setInstitutionStatus /
     listOnboardedInstitutions are the three functions to wire. */

  async getStaffSession(_args: any) {
    const existing = readStaffSession();
    if (existing) return { staff: existing };
    /* An admin or officer who signed in through the citizen sign-in
       already holds a valid token for their role: the backend issues
       one JWT per login, and the staff endpoints accept it. Adopt
       that session for the desks instead of making them sign in a
       second time on the console's own form (verified live
       2026-11-27: the console stayed on demo data until the second
       sign-in). A citizen token is refused here, exactly like the
       staff sign-in form refuses a citizen account. Adopting is
       safe: staff sign-out only clears the local staff key, and the
       backend has no single-session logout to revoke the token. */
    const citizenToken = getToken();
    if (!citizenToken || getStaffToken()) return { staff: null };
    try {
      const me = await apiCall("/api/auth/me", {});
      const role = String(me?.role || "");
      if (!(STAFF_ROLES as readonly string[]).includes(role)) return { staff: null };
      setStaffToken(citizenToken);
      const staff = sessionFromUser(me);
      saveStaffSession(staff);
      storeSet("portagov-officer", staff.name);
      return { staff };
    } catch {
      return { staff: null };
    }
  },

  async staffSignIn(args: any) {
    // One field takes an email address or a phone number, the same as
    // the citizen sign-in. The backend looks the account up by either
    // one; phone is sent along too so an older backend that only
    // knows phone still works.
    const identifier = String(args.identifier ?? args.phone ?? "").trim();
    let res: any;
    try {
      res = await apiCall("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier, phone: args.phone ?? identifier, password: args.password },
      });
    } catch (e: any) {
      if (e?.status === 401) return { ok: false, error: "No officer account matches that email or phone number and password." };
      if (e?.status === 423) return { ok: false, error: "That account is locked for 15 minutes after too many wrong passwords." };
      throw e;
    }
    if (res.two_factor) {
      return { ok: false, need_code: true, demo_code: res.dev_otp || "", code_channels: res.code_channels || ["sms"], identifier, phone: args.phone ?? identifier };
    }
    return finishStaffLogin(res, identifier);
  },

  async staffVerifyCode(args: any) {
    const identifier = String(args.identifier ?? args.phone ?? "").trim();
    const phone = args.phone || (identifier.includes("@") ? "" : identifier);
    let res: any;
    try {
      res = await apiCall("/api/auth/login/verify", {
        method: "POST",
        auth: false,
        body: { identifier, phone, otp: args.code },
      });
    } catch (e: any) {
      if (e?.status === 401) return { ok: false, error: "That code is not correct, or it has expired. Sign in again for a fresh code." };
      if (e?.status === 423) return { ok: false, error: "That account is locked for 15 minutes after too many wrong codes." };
      throw e;
    }
    return finishStaffLogin(res, identifier);
  },

  async staffSignOut(_args: any) {
    try {
      await staffApiCall("/api/auth/logout", { method: "POST", body: {} });
    } catch {
      // The token is cleared locally either way.
    }
    clearStaffAuth();
    return { ok: true };
  },

  async listInstitutionApplications(args: any) {
    if (!getStaffToken()) return (Actions as any).listInstitutionApplications(args);
    try {
      const applications = await fetchStaffApplications();
      return { applications: applications.slice(0, args?.limit || 100) };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      // Backend unreachable: local desk only, and the local action
      // itself only ever returns released applications.
      return (Actions as any).listInstitutionApplications(args);
    }
  },

  async listDiasporaApplications(args: any) {
    if (!getStaffToken()) return (Actions as any).listDiasporaApplications(args);
    try {
      const apps = await fetchStaffApplications();
      return { applications: apps.filter((a: any) => a.channel === "Diaspora").slice(0, args?.limit || 100) };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).listDiasporaApplications(args);
    }
  },

  async listAllApplications(args: any) {
    if (!getStaffToken()) return (Actions as any).listAllApplications(args);
    // Signed in: the live queue, or a plain error. Never silently
    // substitute the local demo queue: that hid held applications
    // from the console and showed seed rows instead.
    const applications = await fetchAdminApplications();
    return { applications: applications.slice(0, args?.limit || 100) };
  },

  async updateApplicationStatus(args: any) {
    /* Frontend status word -> backend action. The desk picker speaks
       frontend words; the backend speaks actions. "In review" and
       "Received" both start the review: the backend moves a submitted
       application to in_review, and an already in-review one stays
       there. Ready / Completed / More information / Appointment map
       straight onto ready / complete / request_info /
       request_biometrics. */
    const actionMap: Record<string, string> = {
      "Received by institution": "start_review",
      "In review at institution": "start_review",
      "Appointment set": "request_biometrics",
      "Ready for collection": "ready",
      Completed: "complete",
      "More information needed": "request_info",
      "Released to institution": "start_review",
      "Under review by PortaGov": "send_back",
      "Submitted to PortaGov": "send_back",
    };
    const action = actionMap[args.status];
    if (!action || !getStaffToken()) return (Actions as any).updateApplicationStatus(args);
    /* Signed in: a failed live status change is a real failure, and
       the desk shows the backend's reason. A 409 means the backend
       state machine refused the move (for example Ready from
       in_review, which needs Approve first, or Complete from
       in_review, which needs Ready first). Falling back to the local
       store used to show "Saved" and then revert on reload, because
       the queue itself comes from the backend (verified live
       2026-11-27 on LR-2611-3FF42F). Never do that again. */
    await staffApiCall(`/api/staff/applications/${args.id}/action`, {
      method: "POST",
      body: { action, note: args.statusNote || "", message: args.statusNote || "" },
    });
    return { ok: true };
  },

  async approveApplication(args: any) {
    /* The desk Approve button: the backend approve action issues
       the certificate. It only works from in_review at the final
       workflow stage; anything else is a 409 with the reason, shown
       on the desk, never a silent local write. Without a staff
       session this is the local demo desk, so approve there is the
       local status move to Ready for collection. */
    if (!getStaffToken()) {
      return (Actions as any).updateApplicationStatus({
        ...args,
        status: "Ready for collection",
      });
    }
    await staffApiCall(`/api/staff/applications/${args.id}/action`, {
      method: "POST",
      body: { action: "approve", note: args.statusNote || "", message: args.statusNote || "" },
    });
    return { ok: true };
  },

  async confirmReceipt(args: any) {
    if (!getStaffToken()) return (Actions as any).confirmReceipt(args);
    try {
      await staffApiCall(`/api/staff/applications/${args.id}/action`, {
        method: "POST",
        body: {
          action: "start_review",
          note: `Receipt confirmed by ${args.officerName || "the institution"}.`,
          message: `Receipt confirmed by ${args.officerName || "the institution"}.`,
        },
      });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e) || (e?.status >= 400 && e?.status < 500)) throw e;
      return (Actions as any).confirmReceipt(args);
    }
  },

  async requestMoreInfo(args: any) {
    if (!getStaffToken()) return (Actions as any).requestMoreInfo(args);
    try {
      await staffApiCall(`/api/staff/applications/${args.id}/action`, {
        method: "POST",
        body: {
          action: "request_info",
          note: `Missing: ${args.missing}. Deadline: ${args.deadline}.`,
          message: `Missing: ${args.missing}. Deadline: ${args.deadline}.`,
        },
      });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e) || (e?.status >= 400 && e?.status < 500)) throw e;
      return (Actions as any).requestMoreInfo(args);
    }
  },

  async sendInstitutionMessage(args: any) {
    if (!getStaffToken()) return (Actions as any).sendInstitutionMessage(args);
    try {
      await staffApiCall(`/api/applications/${args.applicationId}/messages`, {
        method: "POST",
        body: { body: args.body, message: args.body },
      });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e) || (e?.status >= 400 && e?.status < 500)) throw e;
      return (Actions as any).sendInstitutionMessage(args);
    }
  },

  async replyToInstitution(args: any) {
    try {
      await apiCall(`/api/applications/${args.applicationId}/messages`, {
        method: "POST",
        body: { body: args.body, message: args.body },
      });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e) || e?.status === 400 || e?.status === 422) throw e;
      return (Actions as any).replyToInstitution(args);
    }
  },

  async listApplicationMessages(args: any) {
    // Officer side first when a staff session exists: the desk thread.
    if (getStaffToken()) {
      try {
        const messages = await fetchThreadMessages(args.applicationId, args.institution || "");
        return { messages };
      } catch (e: any) {
        if (isAuthError(e)) throw e;
        // Fall through to the citizen token path below.
      }
    }
    try {
      const res = await apiCall(`/api/applications/${args.applicationId}/messages`, {});
      const rows = staffRows(res, "messages");
      return {
        messages: rows.map((m: any, i: number) =>
          normalizeThreadMessage(m, args.applicationId, args.institution || "", i),
        ),
      };
    } catch (e: any) {
      if (isAuthError(e) || e?.status === 400 || e?.status === 422) throw e;
      // Backend thread not reachable: the local messages for this
      // application, if this browser has any.
      if (args.profileId) {
        const local = await (Actions as any)
          .listMessages({ profileId: args.profileId })
          .catch(() => ({ messages: [] }));
        return { messages: (local.messages || []).filter((m: any) => m.application_id === args.applicationId) };
      }
      return { messages: [] };
    }
  },

  async listMessages(args: any) {
    const local = await (Actions as any).listMessages(args).catch(() => ({ messages: [] }));
    const mine = local.messages || [];
    try {
      // The backend has no "my messages" endpoint, so read the thread
      // of each of the citizen's own backend applications and merge
      // them with the local SMS/WhatsApp updates. Backend ids live in
      // a different space from local ids, so they are offset and can
      // never collide with a local row in the rendered list.
      const rows = await apiCall("/api/applications", {});
      const apps = Array.isArray(rows) ? rows : [];
      const merged = [...mine];
      const seen = new Set(mine.map((m: any) => `${m.application_id}|${m.kind}|${m.body}`));
      for (const r of apps) {
        if (!r?.id || !r?.reference) continue;
        const institution = String(r.service?.institution?.name || r.institution || "");
        let thread: any[] = [];
        try {
          const res = await apiCall(`/api/applications/${r.id}/messages`, {});
          thread = staffRows(res, "messages");
        } catch {
          continue;
        }
        thread.forEach((m: any, i: number) => {
          const norm = normalizeThreadMessage(m, Number(r.id), institution, i);
          norm.id = 1000000000 + Number(r.id) * 100000 + (Number(m.id) || i);
          const key = `${norm.application_id}|${norm.kind}|${norm.body}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(norm);
          }
        });
      }
      merged.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      return { messages: merged };
    } catch {
      return { messages: mine };
    }
  },

  async releaseApplication(args: any) {
    if (!getStaffToken()) return (Actions as any).releaseApplication(args);
    // The release endpoint is live on the backend. A failure here
    // is a real failure: never silently "release" in the local demo
    // store while the live application stays held.
    await staffApiCall(`/api/admin/applications/${args.id}/release`, {
      method: "POST",
      body: { note: args.statusNote || "" },
    });
    return { ok: true };
  },

  async recallApplication(args: any) {
    if (!getStaffToken()) return (Actions as any).recallApplication(args);
    await staffApiCall(`/api/admin/applications/${args.id}/recall`, {
      method: "POST",
      body: { note: args.statusNote || "" },
    });
    return { ok: true };
  },

  async getReleaseMode(_args: any) {
    if (!getStaffToken()) return (Actions as any).getReleaseMode({});
    // Signed in: the live setting, or a plain error. Never show the
    // local demo mode as if it were the platform's real rule.
    const mode = await readReleaseMode();
    if (mode) return { mode };
    throw new Error("The platform could not read the release mode. Try again.");
  },

  async setReleaseMode(args: any) {
    if (!getStaffToken()) return (Actions as any).setReleaseMode(args);
    // Signed in: the live setting, or a plain error. Never flip the
    // local demo mode and show it as the platform's real rule.
    const done = await writeReleaseMode(args.mode);
    if (!done) throw new Error("The platform could not change the release mode. Try again.");
    return { ok: true };
  },

  async getReport(_args: any) {
    if (!getStaffToken()) return (Actions as any).getReport({});
    try {
      const s = await staffApiCall("/api/admin/stats", {});
      const tally = (values: string[]) => {
        const map = new Map<string, number>();
        for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
        return [...map.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);
      };
      const arr = (v: any): { label: string; count: number }[] => {
        if (Array.isArray(v)) {
          return v
            .map((r: any) => ({ label: String(r.label ?? r.name ?? ""), count: Number(r.count ?? r.value ?? 0) }))
            .filter((r: any) => r.label);
        }
        /* /api/admin/stats sends by_status as a dict, not an array:
           {"in_review": 2, "completed": 1}. Turn each key into a row,
           in the frontend words the citizen and the desk see, and
           merge keys that map to the same words (approved and
           ready_for_collection both read "Ready for collection"). */
        if (v && typeof v === "object") {
          const merged = new Map<string, number>();
          for (const [label, count] of Object.entries(v)) {
            const words = mapBackendStatus(label);
            merged.set(words, (merged.get(words) ?? 0) + (Number(count) || 0));
          }
          return [...merged.entries()]
            .map(([label, count]) => ({ label, count }))
            .filter((r) => r.label && r.count > 0)
            .sort((a, b) => b.count - a.count);
        }
        return [];
      };
      let byInstitution = arr(s.by_institution);
      let byStatus = arr(s.by_status);
      let byChannel = arr(s.by_channel);
      let byService = arr(s.by_service);
      let totalApplications = Number(s.total_applications ?? s.applications ?? s.total ?? 0);
      let totalPayments = Number(s.total_payments ?? s.payments ?? 0);
      /* /api/admin/stats reports no payment total at all, so the
         console heading read "0 payments recorded" under a live list
         showing 8 (verified live 2026-11-27). Count the live
         platform payments instead. There is no staff/admin
         appointments list endpoint on the backend, so the
         appointments total still comes from stats (0) until one
         exists; that gap is named in the PR, not papered over. */
      if (!totalPayments) {
        try {
          const res = await staffApiCall("/api/staff/payments", {});
          totalPayments = staffRows(res, "items").length;
        } catch {
          // Keep the stats value rather than failing the report.
        }
      }
      // If the stats reply carries no breakdowns, tally them from the
      // live admin queue instead of showing empty tables.
      if (!byInstitution.length || !byStatus.length || !byChannel.length || !byService.length) {
        try {
          const apps = await fetchAdminApplications();
          if (!byInstitution.length) byInstitution = tally(apps.map((a: any) => a.institution).filter(Boolean));
          if (!byStatus.length) byStatus = tally(apps.map((a: any) => a.status));
          if (!byChannel.length) byChannel = tally(apps.map((a: any) => a.channel).filter(Boolean));
          if (!byService.length) byService = tally(apps.map((a: any) => a.service_name).filter(Boolean));
          if (!totalApplications) totalApplications = apps.length;
        } catch {
          // Keep whatever the stats reply gave.
        }
      }
      return {
        total_applications: totalApplications,
        total_profiles: Number(s.total_profiles ?? s.users ?? s.citizens ?? 0),
        total_payments: totalPayments,
        total_appointments: Number(s.total_appointments ?? s.appointments ?? 0),
        by_status: byStatus,
        by_institution: byInstitution,
        by_service: byService,
        by_channel: byChannel,
      };
    } catch (e: any) {
      // Signed in: a failed live report is an error, not a reason to
      // show the local demo report with seed counts.
      throw e;
    }
  },

  async listAuditLog(args: any) {
    if (!getStaffToken()) return (Actions as any).listAuditLog(args);
    try {
      const q = new URLSearchParams();
      if (args?.institution) q.set("institution", args.institution);
      if (args?.limit) q.set("limit", String(args.limit));
      const qs = q.toString();
      const res = await staffApiCall(`/api/admin/audit${qs ? `?${qs}` : ""}`, {});
      const rows = staffRows(res, "entries");
      const entries = rows
        .map((r: any, i: number) => ({
          id: Number(r.id) || i + 1,
          actor: String(r.actor || r.actor_name || r.user || ""),
          institution: String(r.institution || r.institution_name || ""),
          action: String(r.action || r.event || ""),
          application_ref: String(r.application_ref || r.reference || ""),
          created_at: String(r.created_at || r.createdAt || new Date().toISOString()),
        }))
        .filter((e: any) => !args?.institution || e.institution === args.institution);
      return { entries };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).listAuditLog(args);
    }
  },

  async getDailySummary(_args: any) {
    if (!getStaffToken()) return (Actions as any).getDailySummary({});
    /* Live Morning summary for the console: tallied from the live
       admin queue and the live platform payments, not the local demo
       store, which always read 0 in a fresh browser (verified live
       2026-11-27). Open tickets still live in the local help desk;
       there is no backend ticket count, so that card keeps the local
       count. Signed in and the live queue fails: throw, never show
       seed counts. */
    const apps = await fetchAdminApplications();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const dayMs = 24 * 3600 * 1000;
    let paymentsToday = 0;
    try {
      const res = await staffApiCall("/api/staff/payments", {});
      paymentsToday = staffRows(res, "items").filter(
        (p: any) => new Date(p.created_at || 0) >= start,
      ).length;
    } catch {
      paymentsToday = 0;
    }
    const local = await (Actions as any).getDailySummary({}).catch(() => null);
    return {
      date_label: start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      applications_today: apps.filter((a: any) => new Date(a.created_at) >= start).length,
      released_total: apps.filter((a: any) => a.released).length,
      held_total: apps.filter((a: any) => !a.released).length,
      stuck_over_24h: apps.filter(
        (a: any) => !a.released && Date.now() - new Date(a.created_at).getTime() > dayMs,
      ).length,
      open_tickets: Number(local?.open_tickets ?? 0),
      payments_today: paymentsToday,
      completed_total: apps.filter((a: any) => a.status === "Completed").length,
    };
  },

  async getInstitutionDailySummary(args: any) {
    if (!getStaffToken()) return (Actions as any).getInstitutionDailySummary(args);
    try {
      // Counted from the live released queue, not the local store.
      const apps = await fetchStaffApplications();
      const mine = apps.filter((a: any) => a.institution === args.institution);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return {
        date_label: start.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        date: start.toISOString().slice(0, 10),
        institution: args.institution,
        came_in_today: mine.filter((a: any) => new Date(a.created_at) >= start).length,
        finished_today: mine.filter(
          (a: any) => a.status === "Completed" && new Date(a.updated_at) >= start,
        ).length,
        still_waiting: mine.filter(
          (a: any) => a.released && a.status !== "Completed" && a.status !== "Rejected",
        ).length,
        ready_for_collection: mine.filter((a: any) => a.status === "Ready for collection").length,
      };
    } catch (e: any) {
      if (isAuthError(e)) throw e;
      return (Actions as any).getInstitutionDailySummary(args);
    }
  },

  async listStaff(args: any) {
    if (!getStaffToken()) return (Actions as any).listStaff(args);
    try {
      const res = await staffApiCall("/api/admin/officers", {});
      const rows = staffRows(res, "officers");
      const staff = rows
        .map((r: any, i: number) => ({
          id: Number(r.id) || i + 1,
          institution: String(r.institution?.name || r.institution || r.institution_name || ""),
          name: String(r.full_name || r.name || ""),
          role: String(r.role || ""),
          phone: String(r.phone || ""),
        }))
        .filter((s: any) => !args?.institution || s.institution === args.institution);
      return { staff };
    } catch {
      // The roster is secondary: any backend failure shows the local
      // roster rather than breaking the desk.
      return (Actions as any).listStaff(args);
    }
  },

  async addStaff(args: any) {
    if (!getStaffToken()) return (Actions as any).addStaff(args);
    try {
      await staffApiCall("/api/admin/officers", {
        method: "POST",
        body: {
          full_name: args.name,
          name: args.name,
          phone: args.phone,
          role: args.role,
          institution: args.institution,
        },
      });
      return { ok: true };
    } catch (e: any) {
      if (isAuthError(e) || (e?.status >= 400 && e?.status < 500)) throw e;
      return (Actions as any).addStaff(args);
    }
  },

  /* ---------- platform console email: /api/admin/mail ----------
     Admin-only. There is no local mail store, so every call here
     throws when it fails (including when the backend has not
     deployed the endpoint yet): the console shows a plain error
     with a retry, never invented mail. */
  async getMailStatus(_args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/status", {});
    return {
      imap_configured: Boolean(res?.imap_configured),
      smtp_configured: Boolean(res?.smtp_configured),
      last_run_at: res?.last_run_at ? String(res.last_run_at) : null,
    };
  },

  async listMailInbox(_args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/inbox", {});
    const items = staffRows(res, "items").map((r: any, i: number) => ({
      id: String(r.id ?? i + 1),
      from: String(r.from || r.sender || ""),
      subject: String(r.subject || "(No subject)"),
      snippet: String(r.snippet || r.body || ""),
      body: String(r.body || r.snippet || ""),
      received_at: String(r.received_at || r.created_at || ""),
      read: Boolean(r.read),
      application_ref: String(r.application_ref || r.reference || ""),
    }));
    return {
      configured: res?.configured !== false,
      message: String(res?.message || ""),
      items,
    };
  },

  async markMailRead(args: any) {
    requireStaffToken();
    await staffApiCall(`/api/admin/mail/inbox/${encodeURIComponent(String(args.id))}/read`, {
      method: "POST",
      body: {},
    });
    return { ok: true };
  },

  async listMailSent(_args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/sent", {});
    const items = staffRows(res, "items").map((r: any, i: number) => ({
      id: String(r.id ?? i + 1),
      to: String(r.to || r.recipient || ""),
      subject: String(r.subject || "(No subject)"),
      created_at: String(r.created_at || r.sent_at || ""),
      source: String(r.source || "manual"),
    }));
    return { items };
  },

  async sendMail(args: any) {
    requireStaffToken();
    const body: Record<string, any> = {
      subject: args.subject,
      body: args.body,
    };
    if (args.to) body.to = args.to;
    if (args.application_id) body.application_id = args.application_id;
    if (args.user_id) body.user_id = args.user_id;
    const res = await staffApiCall("/api/admin/mail/send", {
      method: "POST",
      body,
    });
    return { ok: true, id: res?.id ? String(res.id) : null };
  },

  /* The institution registry, so compose can send to an institution's
     contact email on file. The backend send endpoint does NOT resolve
     an institution name, it only accepts a real email address (or an
     application/user id), so the panel resolves the name here. The
     catalog endpoint is public and returns contact_email per
     institution. */
  async listMailInstitutions(_args: any) {
    const res = await apiCall("/api/institutions", {});
    const rows = Array.isArray(res) ? res : [];
    return {
      institutions: rows.map((r: any) => ({
        id: Number(r.id ?? 0),
        code: String(r.code || ""),
        name: String(r.name || ""),
        contact_email: String(r.contact_email || ""),
      })),
    };
  },

  async listMailRules(_args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/rules", {});
    const rules = staffRows(res, "rules").map((r: any, i: number) => ({
      id: String(r.id ?? i + 1),
      name: String(r.name || ""),
      trigger: String(r.trigger || ""),
      hours: Number(r.hours ?? 0),
      subject_template: String(r.subject_template || ""),
      body_template: String(r.body_template || ""),
      enabled: Boolean(r.enabled),
      last_run_at: r?.last_run_at ? String(r.last_run_at) : null,
    }));
    return { rules };
  },

  async createMailRule(args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/rules", {
      method: "POST",
      body: {
        name: args.name,
        trigger: args.trigger,
        hours: args.hours,
        subject_template: args.subject_template,
        body_template: args.body_template,
        enabled: args.enabled !== false,
      },
    });
    return { ok: true, id: res?.id ? String(res.id) : null };
  },

  async updateMailRule(args: any) {
    requireStaffToken();
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.trigger !== undefined) patch.trigger = args.trigger;
    if (args.hours !== undefined) patch.hours = args.hours;
    if (args.subject_template !== undefined) patch.subject_template = args.subject_template;
    if (args.body_template !== undefined) patch.body_template = args.body_template;
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    await staffApiCall(`/api/admin/mail/rules/${encodeURIComponent(String(args.id))}`, {
      method: "PATCH",
      body: patch,
    });
    return { ok: true };
  },

  async deleteMailRule(args: any) {
    requireStaffToken();
    await staffApiCall(`/api/admin/mail/rules/${encodeURIComponent(String(args.id))}`, {
      method: "DELETE",
    });
    return { ok: true };
  },

  async runMailRule(args: any) {
    requireStaffToken();
    const res = await staffApiCall(
      `/api/admin/mail/rules/${encodeURIComponent(String(args.id))}/run`,
      { method: "POST", body: {} },
    );
    return { ok: true, sent: Number(res?.sent ?? res?.count ?? 0) };
  },

  async runAllMailRules(_args: any) {
    requireStaffToken();
    const res = await staffApiCall("/api/admin/mail/run", {
      method: "POST",
      body: {},
    });
    return { ok: true, sent: Number(res?.sent ?? res?.count ?? 0) };
  },

  async listMailRuns(args: any) {
    requireStaffToken();
    const qs = args?.rule_id
      ? `?rule_id=${encodeURIComponent(String(args.rule_id))}`
      : "";
    const res = await staffApiCall(`/api/admin/mail/runs${qs}`, {});
    const runs = staffRows(res, "runs").map((r: any, i: number) => ({
      id: String(r.id ?? i + 1),
      rule_id: String(r.rule_id ?? r.ruleId ?? ""),
      rule_name: String(r.rule_name || r.rule || ""),
      application_ref: String(r.application_ref || r.reference || ""),
      subject: String(r.subject || ""),
      sent_at: String(r.sent_at || r.created_at || ""),
    }));
    return { runs };
  },
};
