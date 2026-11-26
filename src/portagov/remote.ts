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
// - Everything not listed in `remote` below still runs against the local
//   actions, including staff / institution / platform desks, family,
//   business, help desk and the assistant. Those are not yet wired.

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

function saveProfile(p: any): void {
  storeSet(PROFILE_KEY, JSON.stringify(p));
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
  const base = fallback || cachedProfile() || emptyProfile(u.id, u.phone || "");
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

const STATUS_MAP: Record<string, string> = {
  draft: "Under review by PortaGov",
  submitted: "Released to institution",
  in_review: "In review at institution",
  info_requested: "More information needed",
  biometric_pending: "Appointment set",
  approved: "Ready for collection",
  ready_for_collection: "Ready for collection",
  completed: "Completed",
  rejected: "Rejected",
};

function mapStatus(s: string): string {
  return STATUS_MAP[s] || s;
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
  const status = mapStatus(b.status);
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
    institution: b.service?.institution?.name || saved.institution || "",
    status,
    released: b.status !== "draft",
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

/* ---------- remote overrides: same names and shapes as Actions ---------- */

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
    const empty = { profile_id: 0, demo_code: "", new_device: false, minutes_left: 0, profile: null };
    let res: any;
    try {
      res = await apiCall("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { phone: args.phone, password: args.password },
      });
    } catch (e: any) {
      if (e?.status === 401) return { result: "bad_credentials", ...empty };
      if (e?.status === 423) return { result: "locked", ...empty, minutes_left: 15 };
      if (e?.status === 403) return { result: "bad_credentials", ...empty };
      throw e;
    }
    if (res.two_factor) {
      const profile = cachedProfile();
      return {
        result: "need_code",
        ...empty,
        profile_id: profile?.id || 0,
        demo_code: res.dev_otp || "",
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
    const phone = profile?.phone || "";
    const res = await apiCall("/api/auth/login/verify", {
      method: "POST",
      auth: false,
      body: { phone, otp: args.code },
    });
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
    return { ok: true, devices_signed_out: 1 };
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
      saved.status_note = "Paid and released to the institution.";
      saveAppCache(cache);
    }
    // Submit now that the fee is paid: this is the release to the
    // institution in the backend flow.
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
      if (res && res.answer) return { answer: res.answer, route: "None", needs_ticket: false };
      return { answer: "", route: "Help desk", needs_ticket: true };
    } catch {
      return (Actions as any).askAssistant(args);
    }
  },
};
