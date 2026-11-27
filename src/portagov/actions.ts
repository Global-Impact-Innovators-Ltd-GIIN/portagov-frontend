// PortaGov actions: citizen profiles, applications, document wallet,
// appointments, mobile money payments, family members, institution desk,
// and government reporting.
import { defineAction, z, type ActionsModule } from "./sdk";
import { asc, desc, eq } from "./db";
import * as schema from "./schema";
import { serviceById } from "./services";

const profileShape = z.object({
  id: z.number(),
  full_name: z.string(),
  date_of_birth: z.string(),
  place_of_birth: z.string(),
  sex: z.string(),
  address: z.string(),
  county: z.string(),
  phone: z.string(),
  email: z.string(),
  photo: z.string(),
  emergency_name: z.string(),
  emergency_phone: z.string(),
  national_id: z.string(),
  has_national_id: z.boolean(),
  alt_id_type: z.string(),
  alt_id_number: z.string(),
  witness_name: z.string(),
  witness_phone: z.string(),
  country: z.string(),
  nationality: z.string(),
  timezone: z.string(),
  language: z.string(),
  phone_verified: z.boolean(),
  email_verified: z.boolean(),
  two_factor: z.boolean(),
  id_checked_by_officer: z.boolean(),
  has_password: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const profileInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.string().trim().min(4).max(10),
  placeOfBirth: z.string().trim().min(2).max(120),
  sex: z.enum(["Female", "Male"]),
  address: z.string().trim().min(3).max(200),
  county: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().max(120).default(""),
  emergencyName: z.string().trim().min(2).max(120),
  emergencyPhone: z.string().trim().min(7).max(20),
  nationalId: z.string().trim().max(40).default(""),
  hasNationalId: z.boolean().default(true),
  altIdType: z.string().trim().max(60).default(""),
  altIdNumber: z.string().trim().max(60).default(""),
  witnessName: z.string().trim().max(120).default(""),
  witnessPhone: z.string().trim().max(20).default(""),
  country: z.string().trim().max(80).default("Liberia"),
  nationality: z.string().trim().max(80).default("Liberia"),
  timezone: z.string().trim().max(60).default(""),
  language: z
    .enum(["English", "Liberian English", "Simple English"])
    .default("English"),
});

type ProfileRow = typeof schema.profiles.$inferSelect;

function toProfile(row: ProfileRow): z.infer<typeof profileShape> {
  return {
    id: row.id,
    full_name: row.fullName,
    date_of_birth: row.dateOfBirth,
    place_of_birth: row.placeOfBirth,
    sex: row.sex,
    address: row.address,
    county: row.county,
    phone: row.phone,
    email: row.email,
    photo: typeof row.photo === "string" ? row.photo : "",
    emergency_name: row.emergencyName,
    emergency_phone: row.emergencyPhone,
    national_id: row.nationalId,
    has_national_id: row.hasNationalId,
    alt_id_type: row.altIdType,
    alt_id_number: row.altIdNumber,
    witness_name: row.witnessName,
    witness_phone: row.witnessPhone,
    country: row.country,
    nationality: row.nationality,
    timezone: row.timezone,
    language: row.language,
    phone_verified: row.phoneVerified,
    email_verified: row.emailVerified,
    two_factor: row.twoFactor,
    id_checked_by_officer: row.idCheckedByOfficer,
    has_password: row.passwordHash.length > 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const applicationShape = z.object({
  id: z.number(),
  reference: z.string(),
  profile_id: z.number(),
  applicant_name: z.string(),
  service_id: z.string(),
  service_name: z.string(),
  institution: z.string(),
  status: z.string(),
  released: z.boolean(),
  on_behalf_of: z.string(),
  priority: z.string(),
  priority_fee: z.number(),
  service_fee: z.number(),
  collection_choice: z.string(),
  embassy: z.string(),
  delivery_fee: z.number(),
  billing_number: z.string(),
  billing_status: z.string(),
  amount_paid: z.number(),
  business_id: z.number(),
  payment_plan: z.boolean(),
  total_due: z.number(),
  pickup_code: z.string(),
  proxy_name: z.string(),
  proxy_id: z.string(),
  proxy_code: z.string(),
  channel: z.string(),
  diaspora_country: z.string(),
  agent_name: z.string(),
  notes: z.string(),
  details: z.string(),
  document_ids: z.string(),
  status_note: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

type ApplicationRow = typeof schema.applications.$inferSelect;

function toApplication(row: ApplicationRow): z.infer<typeof applicationShape> {
  return {
    id: row.id,
    reference: row.reference,
    profile_id: row.profileId,
    applicant_name: row.applicantName,
    service_id: row.serviceId,
    service_name: row.serviceName,
    institution: row.institution,
    status: row.status,
    released: row.released,
    on_behalf_of: row.onBehalfOf,
    priority: row.priority,
    priority_fee: row.priorityFee,
    service_fee: row.serviceFee,
    collection_choice: row.collectionChoice,
    embassy: row.embassy,
    delivery_fee: row.deliveryFee,
    billing_number: row.billingNumber,
    billing_status: row.billingStatus,
    amount_paid: row.amountPaid,
    business_id: row.businessId ?? 0,
    payment_plan: row.paymentPlan,
    total_due: row.serviceFee + row.priorityFee + row.deliveryFee,
    pickup_code: row.pickupCode,
    proxy_name: row.proxyName,
    proxy_id: row.proxyId,
    proxy_code: row.proxyCode,
    channel: row.channel,
    diaspora_country: row.diasporaCountry,
    agent_name: row.agentName,
    notes: row.notes,
    details: row.details,
    document_ids: row.documentIds,
    status_note: row.statusNote,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function docValidity(expiresOn: string): string {
  if (!expiresOn) return "No expiry date";
  const t = new Date(`${expiresOn}T00:00:00`).getTime();
  if (Number.isNaN(t)) return "No expiry date";
  const now = Date.now();
  if (t < now) return "Expired";
  if (t - now <= 30 * 86400000) return "Expiring soon";
  return "Valid";
}

async function logAudit(
  ctx: Ctx,
  institution: string,
  actor: string,
  action: string,
  applicationRef: string,
) {
  const db = ctx.db<typeof schema>();
  await db.insert(schema.auditLog).values({
    institution,
    actor: actor || "Unknown officer",
    action,
    applicationRef,
  });
}

const documentShape = z.object({
  id: z.number(),
  profile_id: z.number(),
  doc_type: z.string(),
  title: z.string(),
  doc_number: z.string(),
  issued_on: z.string(),
  expires_on: z.string(),
  file_name: z.string(),
  content_type: z.string(),
  has_file: z.boolean(),
  file_url: z.string(),
  status: z.string(),
  validity: z.string(),
  created_at: z.string(),
});

const appointmentShape = z.object({
  id: z.number(),
  profile_id: z.number(),
  application_id: z.number().nullable(),
  application_ref: z.string(),
  kind: z.string(),
  group_size: z.number(),
  ticket: z.string(),
  office: z.string(),
  date: z.string(),
  time_slot: z.string(),
  status: z.string(),
  created_at: z.string(),
});

const paymentShape = z.object({
  id: z.number(),
  application_id: z.number(),
  application_ref: z.string(),
  billing_number: z.string(),
  service_name: z.string(),
  method: z.string(),
  amount: z.number(),
  payer_phone: z.string(),
  transaction_ref: z.string(),
  status: z.string(),
  refund_reason: z.string(),
  created_at: z.string(),
});

const familyShape = z.object({
  id: z.number(),
  profile_id: z.number(),
  full_name: z.string(),
  relationship: z.string(),
  date_of_birth: z.string(),
  national_id: z.string(),
  consent: z.boolean(),
  created_at: z.string(),
});

const okResponse = z.object({ ok: z.literal(true) });

import type { Ctx } from "./sdk";

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  let data: Uint8Array = enc.encode(`${salt}:${password}`);
  for (let i = 0; i < 2000; i++) {
    data = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  }
  return [...data].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeSalt(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function makeCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function issueCode(
  ctx: Ctx,
  profileId: number,
  purpose: string,
): Promise<string> {
  const db = ctx.db<typeof schema>();
  const code = makeCode();
  await db.insert(schema.authCodes).values({
    profileId,
    purpose,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return code;
}

async function checkCode(
  ctx: Ctx,
  profileId: number,
  purpose: string,
  code: string,
): Promise<boolean> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.authCodes)
    .where(eq(schema.authCodes.profileId, profileId))
    .orderBy(desc(schema.authCodes.id))
    .limit(10);
  const match = rows.find(
    (r) => r.purpose === purpose && !r.used && r.code === code.trim(),
  );
  if (!match) return false;
  if (match.expiresAt < Date.now()) return false;
  await db
    .update(schema.authCodes)
    .set({ used: true })
    .where(eq(schema.authCodes.id, match.id));
  return true;
}

/* Wrong-code lockout: 5 wrong codes lock sign-in for 15 minutes,
   the same limit as wrong passwords. The lock is shared through
   lockedUntil, so a code lock also blocks a password sign-in until
   it expires, and loginStart already reports the minutes left. */
const CODE_LOCKOUT_ATTEMPTS = 5;
const CODE_LOCKOUT_MINUTES = 15;

function minutesLeft(until: Date | null | undefined): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until.getTime() - Date.now()) / 60000));
}

async function recordSignInEvent(
  ctx: Ctx,
  profileId: number,
  deviceId: string,
  label: string,
  isNewDevice: boolean,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  await db.insert(schema.signInEvents).values({
    profileId,
    deviceId,
    label,
    isNewDevice,
  });
}

/** Checks a citizen code and counts wrong tries. A correct code clears
    the count. Five wrong codes lock the account for 15 minutes. */
async function checkCitizenCode(
  ctx: Ctx,
  profileId: number,
  purpose: string,
  code: string,
): Promise<{
  ok: boolean;
  locked: boolean;
  minutesLeft: number;
  attemptsLeft: number;
}> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, locked: false, minutesLeft: 0, attemptsLeft: 0 };
  }
  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      locked: true,
      minutesLeft: minutesLeft(row.lockedUntil),
      attemptsLeft: 0,
    };
  }
  const ok = await checkCode(ctx, profileId, purpose, code);
  if (ok) {
    await db
      .update(schema.profiles)
      .set({ codeFailedAttempts: 0 })
      .where(eq(schema.profiles.id, profileId));
    return {
      ok: true,
      locked: false,
      minutesLeft: 0,
      attemptsLeft: CODE_LOCKOUT_ATTEMPTS,
    };
  }
  const attempts = (row.codeFailedAttempts ?? 0) + 1;
  if (attempts >= CODE_LOCKOUT_ATTEMPTS) {
    await db
      .update(schema.profiles)
      .set({
        codeFailedAttempts: 0,
        lockedUntil: new Date(Date.now() + CODE_LOCKOUT_MINUTES * 60 * 1000),
      })
      .where(eq(schema.profiles.id, profileId));
    return {
      ok: false,
      locked: true,
      minutesLeft: CODE_LOCKOUT_MINUTES,
      attemptsLeft: 0,
    };
  }
  await db
    .update(schema.profiles)
    .set({ codeFailedAttempts: attempts })
    .where(eq(schema.profiles.id, profileId));
  return {
    ok: false,
    locked: false,
    minutesLeft: 0,
    attemptsLeft: CODE_LOCKOUT_ATTEMPTS - attempts,
  };
}

async function issueStaffCode(ctx: Ctx, staffId: number): Promise<string> {
  const db = ctx.db<typeof schema>();
  const code = makeCode();
  await db.insert(schema.staffAuthCodes).values({
    staffId,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return code;
}

async function checkStaffCode(
  ctx: Ctx,
  staffId: number,
  code: string,
): Promise<boolean> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.staffAuthCodes)
    .where(eq(schema.staffAuthCodes.staffId, staffId))
    .orderBy(desc(schema.staffAuthCodes.id))
    .limit(10);
  const match = rows.find(
    (r) => !r.used && r.code === code.trim(),
  );
  if (!match) return false;
  if (match.expiresAt < Date.now()) return false;
  await db
    .update(schema.staffAuthCodes)
    .set({ used: true })
    .where(eq(schema.staffAuthCodes.id, match.id));
  return true;
}

function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "Your password must be at least 12 characters long.";
  if (!/[A-Z]/.test(pw)) return "Your password needs at least one capital letter.";
  if (!/[a-z]/.test(pw)) return "Your password needs at least one small letter.";
  if (!/[0-9]/.test(pw)) return "Your password needs at least one number.";
  if (!/[^A-Za-z0-9]/.test(pw))
    return "Your password needs at least one symbol, like !, #, or %.";
  return null;
}

/* Liberian identity document formats. National ID: the NIR card carries a
   10 digit National Identification Number; the card number is 2 letters
   plus 7 digits on the current biometric card (LR1234567) and 3 letters
   plus 7 digits on the older card (LIB1234567). Passport: one or two letters
   followed by 6 to 8 digits (L123456 in the published bank identifier
   list, L12345678 and PP1234567 on the current e-passport series). National ID stays
   optional: a passport or another document is always accepted instead. */
function identityProblem(args: z.infer<typeof profileInput>): string | null {
  if (args.hasNationalId) {
    const v = args.nationalId.replace(/[\s-]/g, "").toUpperCase();
    if (!v)
      return "Type your national ID number, or choose a passport or another document instead. A national ID is never required on PortaGov.";
    if (!/^(\d{10}|[A-Z]{2}\d{7}|[A-Z]{3}\d{7})$/.test(v))
      return "That does not match a Liberian national ID. It is either the 10 digit number on your card, or the card number: 2 letters plus 7 digits, like LR1234567 (older cards: 3 letters plus 7 digits). Check the card and type it again.";
    return null;
  }
  if (args.altIdType === "Passport") {
    const v = args.altIdNumber.replace(/[\s-]/g, "").toUpperCase();
    if (!v)
      return "Type your passport number, or choose another document instead.";
    if (!/^[A-Z]{1,2}\d{6,8}$/.test(v))
      return "That does not match a Liberian passport number. It is one or two letters followed by digits, like PP1234567 or L12345678, printed at the top of the passport's photo page. Check it and type it again.";
  }
  return null;
}

function signupProblem(args: z.infer<typeof profileInput>): string | null {
  const idProblem = identityProblem(args);
  if (idProblem) return idProblem;
  if (args.fullName.trim().split(/\s+/).length < 2)
    return "Write your full name: first name and family name. Short or fake names cannot proceed.";
  const dob = new Date(`${args.dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now())
    return "Your date of birth is not a real past date. Check it and try again.";
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 1 || age > 120)
    return "Your date of birth does not look right. Check it and try again.";
  if (!/^\+?[0-9][0-9 ]{6,19}$/.test(args.phone.trim()))
    return "Your phone number is not in a correct format. For Liberia it starts 077, 088, or 055; from abroad, start with your country code, like +1 for the United States.";
  if (args.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email.trim()))
    return "Your email address is not in a correct format. Check it, or leave it empty.";
  if (!args.placeOfBirth.trim() || !args.address.trim() || !args.county.trim())
    return "Place of birth, address, and county or country are all required. Incomplete profiles cannot proceed.";
  return null;
}

async function logEvent(
  ctx: Ctx,
  applicationId: number,
  status: string,
  note: string,
  actor = "",
) {
  const db = ctx.db<typeof schema>();
  await db
    .insert(schema.statusEvents)
    .values({ applicationId, status, note, actor });
}

async function notify(
  ctx: Ctx,
  profileId: number,
  applicationId: number | null,
  kind: string,
  body: string,
) {
  const db = ctx.db<typeof schema>();
  await db.insert(schema.messages).values([
    { profileId, applicationId, channel: "SMS" as const, kind, body },
    { profileId, applicationId, channel: "WhatsApp" as const, kind, body },
  ]);
}

export const Actions = {
  findProfileByPhone: defineAction({
    description:
      "Looks up a returning citizen profile by phone number for the I'm not new here sign-in.",
    request: z.object({ phone: z.string().trim().min(7).max(20) }),
    response: z.object({ profile: profileShape.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const row = rows[0];
      return { profile: row ? toProfile(row) : null };
    },
  }),

  createProfile: defineAction({
    description:
      "Creates the one-time citizen profile from the first-time setup form.",
    request: profileInput.extend({
      officerVerified: z.boolean().default(false),
    }),
    response: z.object({ profile: profileShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idProblem = identityProblem(args);
      if (idProblem) throw new Error(idProblem);
      const existing = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      if (existing[0]) {
        throw new Error(
          "A profile already exists for this phone number. Use I'm not new here to sign in.",
        );
      }
      const inserted = await db
        .insert(schema.profiles)
        .values({
          fullName: args.fullName,
          dateOfBirth: args.dateOfBirth,
          placeOfBirth: args.placeOfBirth,
          sex: args.sex,
          address: args.address,
          county: args.county,
          phone: args.phone,
          email: args.email,
          emergencyName: args.emergencyName,
          emergencyPhone: args.emergencyPhone,
          nationalId: args.hasNationalId ? args.nationalId : "",
          hasNationalId: args.hasNationalId,
          altIdType: args.hasNationalId ? "" : args.altIdType,
          altIdNumber: args.hasNationalId ? "" : args.altIdNumber,
          witnessName: args.hasNationalId ? "" : args.witnessName,
          witnessPhone: args.hasNationalId ? "" : args.witnessPhone,
          country: args.country,
          nationality: args.nationality,
          timezone: args.timezone,
          language: args.language,
          idCheckedByOfficer: args.officerVerified,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Profile could not be saved. Try again.");
      ctx.invalidateQueries();
      return { profile: toProfile(row) };
    },
  }),

  updateProfile: defineAction({
    description: "Updates any field of a saved citizen profile.",
    request: profileInput.extend({ id: z.number().int().positive() }),
    response: z.object({ profile: profileShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idProblem = identityProblem(args);
      if (idProblem) throw new Error(idProblem);
      const clash = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const clashRow = clash[0];
      if (clashRow && clashRow.id !== args.id) {
        throw new Error("That phone number belongs to another profile.");
      }
      const updated = await db
        .update(schema.profiles)
        .set({
          fullName: args.fullName,
          dateOfBirth: args.dateOfBirth,
          placeOfBirth: args.placeOfBirth,
          sex: args.sex,
          address: args.address,
          county: args.county,
          phone: args.phone,
          email: args.email,
          emergencyName: args.emergencyName,
          emergencyPhone: args.emergencyPhone,
          nationalId: args.hasNationalId ? args.nationalId : "",
          hasNationalId: args.hasNationalId,
          altIdType: args.hasNationalId ? "" : args.altIdType,
          altIdNumber: args.hasNationalId ? "" : args.altIdNumber,
          witnessName: args.hasNationalId ? "" : args.witnessName,
          witnessPhone: args.hasNationalId ? "" : args.witnessPhone,
          country: args.country,
          nationality: args.nationality,
          timezone: args.timezone,
          language: args.language,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, args.id))
        .returning();
      const row = updated[0];
      if (!row) throw new Error("Profile not found.");
      ctx.invalidateQueries();
      return { profile: toProfile(row) };
    },
  }),

  updateProfilePhoto: defineAction({
    description:
      "Saves or removes a citizen profile photo. The photo is a small square JPEG data URL, cropped in the browser, stored with the profile in the browser store, so it is still there after sign out and sign in on the same device.",
    request: z.object({
      id: z.number().int().positive(),
      photo: z.string().max(500000).default(""),
    }),
    response: z.object({ profile: profileShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const updated = await db
        .update(schema.profiles)
        .set({ photo: args.photo, updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.id))
        .returning();
      const row = updated[0];
      if (!row) throw new Error("Profile not found.");
      ctx.invalidateQueries();
      return { profile: toProfile(row) };
    },
  }),

  submitApplication: defineAction({
    description:
      "Submits a service application for a signed-in citizen and returns its tracking reference.",
    request: z.object({
      profileId: z.number().int().positive(),
      serviceId: z.string().trim().min(1).max(60),
      serviceName: z.string().trim().min(2).max(120),
      institution: z.string().trim().min(2).max(120),
      channel: z
        .enum(["Self service", "Agent assisted", "Diaspora"])
        .default("Self service"),
      onBehalfOf: z.string().trim().max(120).default(""),
      priority: z
        .enum(["Standard", "Fast-track", "Emergency"])
        .default("Standard"),
      priorityFee: z.number().int().min(0).max(100).default(0),
      serviceFee: z.number().int().min(0).max(1000).default(0),
      collectionChoice: z.string().trim().max(60).default(""),
      embassy: z.string().trim().max(120).default(""),
      deliveryFee: z.number().int().min(0).max(100).default(0),
      diasporaCountry: z.string().trim().max(80).default(""),
      agentName: z.string().trim().max(120).default(""),
      businessId: z.number().int().min(0).default(0),
      paymentPlan: z.boolean().default(false),
      notes: z.string().trim().max(1000).default(""),
      details: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(80),
            value: z.string().trim().min(1).max(300),
          }),
        )
        .max(12)
        .default([]),
      documentIds: z.array(z.number().int().positive()).max(20).default([]),
    }),
    response: z.object({ application: applicationShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const profiles = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const profile = profiles[0];
      if (!profile) throw new Error("Sign in before starting an application.");
      if (!profile.phoneVerified && !profile.idCheckedByOfficer) {
        throw new Error(
          "Your account is not verified yet. PortaGov only accepts applications from verified accounts: finish the phone code check from sign-in first, so the data on your application can be trusted.",
        );
      }
      if (
        !profile.fullName.trim() ||
        !profile.dateOfBirth.trim() ||
        !profile.placeOfBirth.trim() ||
        !profile.address.trim() ||
        !profile.county.trim()
      ) {
        throw new Error(
          "Your profile is incomplete. PortaGov cannot send an application with missing details: complete your full name, date of birth, place of birth, address, and county or country in My account first.",
        );
      }
      const openApps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.profileId, args.profileId));
      const duplicate = openApps.find(
        (a) =>
          a.serviceId === args.serviceId &&
          a.status !== "Completed" &&
          a.applicantName ===
            (args.onBehalfOf ? args.onBehalfOf : profile.fullName),
      );
      if (duplicate) {
        throw new Error(
          `Duplicate check: you already have an open application for ${args.serviceName} with tracking number ${duplicate.reference}. PortaGov will not open a second one for the same person. Follow that application instead, or finish it first.`,
        );
      }
      const countRows = await db.select().from(schema.applications);
      const reference = `PG-${new Date().getFullYear()}-${String(countRows.length + 1).padStart(5, "0")}`;
      const modeRows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "release_mode"))
        .limit(1);
      const automatic = modeRows[0]?.value === "automatic";
      const totalDue = args.serviceFee + args.priorityFee + args.deliveryFee;
      const billingNumber = `BILL-${new Date().getFullYear()}-${String(countRows.length + 1).padStart(5, "0")}`;
      const freeService = totalDue === 0;
      const releaseNow = automatic && freeService;
      const inserted = await db
        .insert(schema.applications)
        .values({
          reference,
          profileId: profile.id,
          applicantName: args.onBehalfOf
            ? args.onBehalfOf
            : profile.fullName,
          serviceId: args.serviceId,
          serviceName: args.serviceName,
          institution: args.institution,
          status: releaseNow
            ? "Released to institution"
            : "Under review by PortaGov",
          released: releaseNow,
          billingNumber,
          billingStatus: freeService ? "Paid" : "Unpaid",
          onBehalfOf: args.onBehalfOf,
          priority: args.priority,
          priorityFee: args.priorityFee,
          serviceFee: args.serviceFee,
          collectionChoice: args.collectionChoice,
          embassy: args.embassy,
          deliveryFee: args.deliveryFee,
          statusNote: releaseNow
            ? "Automatic release is on and no payment was needed: PortaGov sent this application straight to the institution."
            : freeService
              ? "No payment is needed for this service. PortaGov is checking your documents before release."
              : `Billing number ${billingNumber}: $${totalDue} to pay with MTN MoMo or Orange Money. PortaGov releases your application only when this billing number is confirmed paid.`,
          businessId: args.businessId > 0 ? args.businessId : null,
          paymentPlan: args.paymentPlan && totalDue > 0,
          channel: args.channel,
          diasporaCountry:
            args.channel === "Diaspora" ? args.diasporaCountry : "",
          agentName: args.channel === "Agent assisted" ? args.agentName : "",
          notes: args.notes,
          details: JSON.stringify(args.details),
          documentIds: JSON.stringify(args.documentIds),
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Application could not be submitted.");
      await logEvent(
        ctx,
        row.id,
        "Submitted to PortaGov",
        "Application and documents received by PortaGov. PortaGov is checking the documents.",
        args.channel === "Agent assisted" && args.agentName
          ? `${args.agentName}, agent for ${profile.fullName}`
          : profile.fullName,
      );
      await notify(
        ctx,
        profile.id,
        row.id,
        "Status update",
        freeService
          ? `PortaGov: We got your application for ${row.serviceName}. Your tracking number is ${row.reference}. No payment is needed for this service. PortaGov is checking your documents now.`
          : `PortaGov: We got your application for ${row.serviceName}. Your tracking number is ${row.reference}. Your billing number is ${billingNumber}. Please pay $${totalDue} with MTN MoMo or Orange Money and quote the billing number. We release your application when the billing number is confirmed paid.`,
      );
      if (releaseNow) {
        await logEvent(
          ctx,
          row.id,
          "Released to institution",
          "Automatic release is on.",
          "PortaGov (automatic release)",
        );
        await notify(
          ctx,
          profile.id,
          row.id,
          "Status update",
          `PortaGov: Good news. Your application ${row.reference} for ${row.serviceName} has gone to ${row.institution}. They are working on it now.`,
        );
      }
      ctx.invalidateQueries();
      return { application: toApplication(row) };
    },
  }),

  listApplications: defineAction({
    description: "Lists one citizen's applications, newest first.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ applications: z.array(applicationShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.profileId, args.profileId))
        .orderBy(desc(schema.applications.id));
      return { applications: rows.map(toApplication) };
    },
  }),

  listAllApplications: defineAction({
    description:
      "Lists every application for the institution desk and government reports, newest first.",
    request: z.object({ limit: z.number().int().positive().max(200).default(100) }),
    response: z.object({ applications: z.array(applicationShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .orderBy(desc(schema.applications.id))
        .limit(args.limit);
      return { applications: rows.map(toApplication) };
    },
  }),

  updateApplicationStatus: defineAction({
    description:
      "Moves an application along its status timeline from the institution desk, with an optional note to the citizen.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum([
        "Submitted to PortaGov",
        "Under review by PortaGov",
        "Released to institution",
        "Received by institution",
        "In review at institution",
        "Appointment set",
        "Ready for collection",
        "Completed",
        "More information needed",
      ]),
      statusNote: z.string().trim().max(500).default(""),
      officerName: z.string().trim().max(120).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      if (args.status === "Ready for collection") {
        const pre = await db
          .select()
          .from(schema.applications)
          .where(eq(schema.applications.id, args.id))
          .limit(1);
        if (pre[0] && pre[0].billingStatus !== "Paid") {
          throw new Error(
            `Billing number ${pre[0].billingNumber} is not fully paid yet (status: ${pre[0].billingStatus}). On a payment plan the second part must be paid before collection.`,
          );
        }
      }
      await db
        .update(schema.applications)
        .set({
          status: args.status,
          statusNote: args.statusNote,
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, args.id));
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id))
        .limit(1);
      const app = rows[0];
      if (app) {
        await logAudit(
          ctx,
          app.institution,
          args.officerName,
          `Set status to ${args.status}`,
          app.reference,
        );
        await logEvent(
          ctx,
          app.id,
          args.status,
          args.statusNote,
          args.officerName || app.institution,
        );
        if (args.status === "Ready for collection" && !app.pickupCode) {
          const code = String(
            100000 + ((app.id * 7919 + Date.now()) % 900000),
          );
          await db
            .update(schema.applications)
            .set({ pickupCode: code })
            .where(eq(schema.applications.id, app.id));
          await notify(
            ctx,
            app.profileId,
            app.id,
            "Pickup ready",
            `PortaGov: Your ${app.serviceName} is ready to collect. Tracking number ${app.reference}. Your pickup code is ${code}. Show this code when you collect. Do not share it with anyone you do not trust.`,
          );
        } else {
        await notify(
          ctx,
          app.profileId,
          app.id,
          "Status update",
          args.status === "More information needed"
            ? `PortaGov: We need one more thing for your application ${app.reference} (${app.serviceName}). ${args.statusNote || "Please check your application page on PortaGov."}`
            : `PortaGov: Your application ${app.reference} for ${app.serviceName} is now: ${args.status}.${args.statusNote ? ` ${args.statusNote}` : ""}`,
        );
        }
        if (args.status === "Completed") {
          const existing = await db
            .select()
            .from(schema.certificates)
            .where(eq(schema.certificates.applicationId, app.id))
            .limit(1);
          if (!existing[0]) {
            const all = await db.select().from(schema.certificates);
            const certNumber = `PGC-${new Date().getFullYear()}-${String(all.length + 1).padStart(5, "0")}`;
            await db.insert(schema.certificates).values({
              applicationId: app.id,
              profileId: app.profileId,
              certNumber,
              serviceName: app.serviceName,
              institution: app.institution,
              holderName: app.applicantName,
              reference: app.reference,
            });
            await notify(
              ctx,
              app.profileId,
              app.id,
              "Status update",
              `PortaGov: Your work is done. Your digital certificate for ${app.serviceName} is ready. Certificate number ${certNumber}. You can open and check it on PortaGov any time.`,
            );
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addDocument: defineAction({
    description:
      "Adds a document to a citizen's document wallet, with an optional uploaded file kept at full quality.",
    request: z.object({
      profileId: z.number().int().positive(),
      docType: z.string().trim().min(2).max(60),
      title: z.string().trim().min(2).max(120),
      docNumber: z.string().trim().max(60).default(""),
      issuedOn: z.string().trim().max(10).default(""),
      expiresOn: z.string().trim().max(10).default(""),
      file: z
        .object({
          dataBase64: z.string().min(1).max(14_000_000),
          fileName: z.string().trim().min(1).max(160),
          contentType: z.string().trim().min(1).max(80),
        })
        .optional(),
      replacesDocumentId: z.number().int().min(0).default(0),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      let blobKey: string | null = null;
      if (args.file) {
        blobKey = `wallet/${args.profileId}/${Date.now()}-${args.file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const bytes = Uint8Array.from(atob(args.file.dataBase64), (c) => c.charCodeAt(0));
        await ctx.blobs.put(blobKey, bytes, {
          contentType: args.file.contentType,
        });
      }
      const inserted = await db
        .insert(schema.documents)
        .values({
          profileId: args.profileId,
          docType: args.docType,
          title: args.title,
          docNumber: args.docNumber,
          issuedOn: args.issuedOn,
          expiresOn: args.expiresOn,
          blobKey,
          fileName: args.file?.fileName ?? "",
          contentType: args.file?.contentType ?? "",
        })
        .returning({ id: schema.documents.id });
      const row = inserted[0];
      if (!row) throw new Error("Document could not be saved.");
      if (args.replacesDocumentId > 0) {
        await db
          .update(schema.documents)
          .set({ status: "Superseded" })
          .where(eq(schema.documents.id, args.replacesDocumentId));
        await notify(
          ctx,
          args.profileId,
          null,
          "Document updated",
          `PortaGov: Your document ${args.title} was updated. The new version replaces the old one in your wallet, and every service that needs this document will use the new version from now on.`,
        );
      }
      if (docValidity(args.expiresOn) === "Expired") {
        await notify(
          ctx,
          args.profileId,
          null,
          "Document expired",
          `PortaGov: Careful: the document you just saved, ${args.title}, shows an expiry date that has already passed (${args.expiresOn}). An expired document can be refused. Renew it and update it in your wallet: open My account, then Document wallet, then Update on the document.`,
        );
      }
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listDocuments: defineAction({
    description: "Lists a citizen's document wallet with file links.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ documents: z.array(documentShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.profileId, args.profileId))
        .orderBy(asc(schema.documents.id));
      const documents: z.infer<typeof documentShape>[] = [];
      for (const row of rows) {
        documents.push({
          id: row.id,
          profile_id: row.profileId,
          doc_type: row.docType,
          title: row.title,
          doc_number: row.docNumber,
          issued_on: row.issuedOn,
          expires_on: row.expiresOn,
          file_name: row.fileName,
          content_type: row.contentType,
          has_file: row.blobKey != null,
          file_url: row.blobKey ? await ctx.blobs.getUrl(row.blobKey) : "",
          status: row.status,
          validity: docValidity(row.expiresOn),
          created_at: row.createdAt.toISOString(),
        });
      }
      return { documents };
    },
  }),

  deleteDocument: defineAction({
    description: "Removes one document from a citizen's wallet.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, args.id))
        .limit(1);
      const row = rows[0];
      if (row?.blobKey) await ctx.blobs.delete(row.blobKey);
      await db
        .delete(schema.documents)
        .where(eq(schema.documents.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  bookAppointment: defineAction({
    description:
      "Books a biometrics, collection, or interview appointment at a service office.",
    request: z.object({
      profileId: z.number().int().positive(),
      applicationId: z.number().int().positive().nullable().default(null),
      kind: z.enum(["Biometrics", "Collection", "Interview"]),
      groupSize: z.number().int().min(1).max(30).default(1),
      office: z.string().trim().min(2).max(120),
      date: z.string().trim().min(8).max(10),
      timeSlot: z.string().trim().min(3).max(30),
    }),
    response: z.object({ id: z.number(), ticket: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const countRows = await db.select().from(schema.appointments);
      const ticket = `TKT-${String(countRows.length + 1).padStart(5, "0")}`;
      const inserted = await db
        .insert(schema.appointments)
        .values({
          profileId: args.profileId,
          applicationId: args.applicationId,
          kind: args.kind,
          groupSize: args.groupSize,
          ticket,
          office: args.office,
          date: args.date,
          timeSlot: args.timeSlot,
        })
        .returning({ id: schema.appointments.id });
      const row = inserted[0];
      if (!row) throw new Error("Appointment could not be booked.");
      /* The reminder is recorded for the day before the visit, with
         what to bring from the real requirements of the service this
         appointment is for. It is saved in the app and shown on the
         appointment. The SMS itself will be sent once the SMS sender
         is live, so the message says so plainly. */
      const reminderDate = (() => {
        const d = new Date(`${args.date}T12:00:00Z`);
        if (Number.isNaN(d.getTime())) return args.date;
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      let bring: string[] = [];
      if (args.applicationId != null) {
        const appRows = await db
          .select()
          .from(schema.applications)
          .where(eq(schema.applications.id, args.applicationId))
          .limit(1);
        const svc = appRows[0] ? serviceById(appRows[0].serviceId) : undefined;
        if (svc) bring = svc.requirements;
      }
      const bringText =
        bring.length > 0
          ? ` Bring: ${bring.join("; ")}. Also bring your ticket number ${ticket} and the ID on your profile.`
          : ` Please bring your ID and your ticket number ${ticket}.`;
      await notify(
        ctx,
        args.profileId,
        args.applicationId,
        "Appointment reminder",
        `PortaGov reminder for ${reminderDate}, the day before your visit: you have a ${args.kind} visit on ${args.date}, ${args.timeSlot}, at ${args.office}.${bringText} This reminder is saved in the app. The SMS itself will be sent once the SMS sender is live.`,
      );
      ctx.invalidateQueries();
      return { id: row.id, ticket };
    },
  }),

  listAppointments: defineAction({
    description: "Lists a citizen's appointments, soonest first.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ appointments: z.array(appointmentShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.profileId, args.profileId))
        .orderBy(asc(schema.appointments.date));
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.profileId, args.profileId));
      const refById = new Map(apps.map((a) => [a.id, a.reference]));
      return {
        appointments: rows.map((row) => ({
          id: row.id,
          profile_id: row.profileId,
          application_id: row.applicationId,
          application_ref:
            row.applicationId != null
              ? (refById.get(row.applicationId) ?? "")
              : "",
          kind: row.kind,
          group_size: row.groupSize,
          ticket: row.ticket,
          office: row.office,
          date: row.date,
          time_slot: row.timeSlot,
          status: row.status,
          created_at: row.createdAt.toISOString(),
        })),
      };
    },
  }),

  updateAppointmentStatus: defineAction({
    description: "Marks an appointment attended, missed, or cancelled.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Booked", "Attended", "Missed", "Cancelled"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.appointments)
        .set({ status: args.status })
        .where(eq(schema.appointments.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  recordPayment: defineAction({
    description:
      "Records a mobile money payment (MTN MoMo or Orange Money) against an application using the citizen's transaction reference.",
    request: z.object({
      applicationId: z.number().int().positive(),
      method: z.enum(["MTN MoMo", "Orange Money"]),
      amount: z.number().int().min(0).max(2000).default(0),
      payerPhone: z.string().trim().min(7).max(20),
      /* Optional: the reference the citizen's phone already gave them.
         It must never block a payment when empty, so it is optional
         with no minimum length. */
      transactionRef: z.string().trim().max(60).optional().default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.payments)
        .values({
          applicationId: args.applicationId,
          method: args.method,
          amount: args.amount,
          payerPhone: args.payerPhone,
          transactionRef: args.transactionRef,
        })
        .returning({ id: schema.payments.id });
      const row = inserted[0];
      if (!row) throw new Error("Payment could not be recorded.");
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (app) {
        await notify(
          ctx,
          app.profileId,
          app.id,
          "Payment update",
          `PortaGov: We recorded your ${args.method} payment of $${args.amount} for billing number ${app.billingNumber}, transaction ${args.transactionRef}. PortaGov is confirming it now. When the billing number is confirmed paid, we release your application.`,
        );
      }
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listPayments: defineAction({
    description: "Lists all recorded payments with their application references.",
    request: z.object({ limit: z.number().int().positive().max(200).default(100) }),
    response: z.object({ payments: z.array(paymentShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.payments)
        .orderBy(desc(schema.payments.id))
        .limit(args.limit);
      const apps = await db.select().from(schema.applications);
      const appById = new Map(apps.map((a) => [a.id, a]));
      return {
        payments: rows.map((row) => ({
          id: row.id,
          application_id: row.applicationId,
          application_ref: appById.get(row.applicationId)?.reference ?? "",
          billing_number: appById.get(row.applicationId)?.billingNumber ?? "",
          service_name: appById.get(row.applicationId)?.serviceName ?? "",
          method: row.method,
          amount: row.amount,
          payer_phone: row.payerPhone,
          transaction_ref: row.transactionRef,
          status: row.status,
          refund_reason: row.refundReason,
          created_at: row.createdAt.toISOString(),
        })),
      };
    },
  }),

  addFamilyMember: defineAction({
    description: "Adds a family member to a citizen's saved household.",
    request: z.object({
      profileId: z.number().int().positive(),
      fullName: z.string().trim().min(2).max(120),
      relationship: z.string().trim().min(2).max(60),
      dateOfBirth: z.string().trim().min(4).max(10),
      nationalId: z.string().trim().max(40).default(""),
      consent: z.boolean(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      if (!args.consent) {
        throw new Error(
          "Family applications need consent. The person must agree before you save them or apply for them.",
        );
      }
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.familyMembers)
        .values({
          profileId: args.profileId,
          fullName: args.fullName,
          relationship: args.relationship,
          dateOfBirth: args.dateOfBirth,
          nationalId: args.nationalId,
          consent: true,
        })
        .returning({ id: schema.familyMembers.id });
      const row = inserted[0];
      if (!row) throw new Error("Family member could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listFamily: defineAction({
    description: "Lists a citizen's saved family members.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ members: z.array(familyShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.familyMembers)
        .where(eq(schema.familyMembers.profileId, args.profileId))
        .orderBy(asc(schema.familyMembers.id));
      return {
        members: rows.map((row) => ({
          id: row.id,
          profile_id: row.profileId,
          full_name: row.fullName,
          relationship: row.relationship,
          date_of_birth: row.dateOfBirth,
          national_id: row.nationalId,
          consent: row.consent,
          created_at: row.createdAt.toISOString(),
        })),
      };
    },
  }),

  deleteFamilyMember: defineAction({
    description: "Removes one family member from a citizen's household.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.familyMembers)
        .where(eq(schema.familyMembers.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  sendInstitutionMessage: defineAction({
    description:
      "Institution portal action: after release, the institution messages the citizen directly about the way forward, under the same tracking number.",
    request: z.object({
      applicationId: z.number().int().positive(),
      body: z.string().trim().min(3).max(1000),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) throw new Error("Application not found.");
      if (!app.released) {
        throw new Error(
          "This application has not been released to the institution yet.",
        );
      }
      await db.insert(schema.messages).values([
        {
          profileId: app.profileId,
          applicationId: app.id,
          channel: "Email" as const,
          kind: `Direct from ${app.institution}`,
          body: `${app.institution} (tracking number ${app.reference}): ${args.body}`,
        },
        {
          profileId: app.profileId,
          applicationId: app.id,
          channel: "SMS" as const,
          kind: `Direct from ${app.institution}`,
          body: `${app.institution} (tracking number ${app.reference}): ${args.body}`,
        },
      ]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  replyToInstitution: defineAction({
    description:
      "Citizen replies inside the application message thread after release; the institution sees it in its portal under the same tracking number.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      body: z.string().trim().min(1).max(1000),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.profileId !== args.profileId) {
        throw new Error("You can only write on your own applications.");
      }
      if (!app.released) {
        throw new Error(
          "The thread opens when PortaGov releases your application to the institution.",
        );
      }
      await db.insert(schema.messages).values({
        profileId: app.profileId,
        applicationId: app.id,
        channel: "Email" as const,
        kind: `Citizen to ${app.institution}`,
        body: `${app.applicantName} (tracking number ${app.reference}): ${args.body}`,
      });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setProxy: defineAction({
    description:
      "Records a proxy who may collect for the citizen: proxy name, their ID, and a consent code the citizen gives them. Recorded on the application.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      proxyName: z.string().trim().min(2).max(120),
      proxyId: z.string().trim().min(3).max(60),
    }),
    response: z.object({ proxy_code: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.profileId !== args.profileId) {
        throw new Error("You can only set a proxy on your own applications.");
      }
      const code = String(100000 + ((app.id * 31337 + Date.now()) % 900000));
      await db
        .update(schema.applications)
        .set({
          proxyName: args.proxyName,
          proxyId: args.proxyId,
          proxyCode: code,
        })
        .where(eq(schema.applications.id, app.id));
      await logEvent(
        ctx,
        app.id,
        app.status,
        `Proxy consent recorded: ${args.proxyName} may collect with their own ID and consent code ${code}.`,
        app.applicantName,
      );
      await notify(
        ctx,
        app.profileId,
        app.id,
        "Proxy consent",
        `PortaGov: You gave ${args.proxyName} your consent to collect for application ${app.reference}. Their consent code is ${code}. They must bring their own ID and this code. Nobody else can collect for you.`,
      );
      ctx.invalidateQueries();
      return { proxy_code: code };
    },
  }),

  getOfficeQueues: defineAction({
    description:
      "County queue view: how many appointments are booked at each service centre office, by day.",
    request: z.object({}),
    response: z.object({
      rows: z.array(
        z.object({ office: z.string(), date: z.string(), booked: z.number() }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.status, "Booked"));
      const map = new Map<string, number>();
      for (const r of rows) {
        const key = `${r.office}|${r.date}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return {
        rows: [...map.entries()]
          .map(([key, booked]) => {
            const [office = "", date = ""] = key.split("|");
            return { office, date, booked };
          })
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  }),

  listInstitutionApplications: defineAction({
    description:
      "Lists only the applications PortaGov has released to institutions. Held applications under PortaGov review never appear here.",
    request: z.object({ limit: z.number().int().positive().max(200).default(100) }),
    response: z.object({ applications: z.array(applicationShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.released, true))
        .orderBy(desc(schema.applications.id))
        .limit(args.limit);
      return { applications: rows.map(toApplication) };
    },
  }),

  releaseApplication: defineAction({
    description:
      "Platform portal action: releases a held application to its institution after PortaGov review, or holds it back for more information.",
    request: z.object({
      id: z.number().int().positive(),
      statusNote: z.string().trim().max(500).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const pre = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id))
        .limit(1);
      if (
        pre[0] &&
        pre[0].billingStatus !== "Paid" &&
        !(pre[0].paymentPlan && pre[0].billingStatus === "Part paid")
      ) {
        throw new Error(
          `Billing number ${pre[0].billingNumber} is not confirmed paid yet. PortaGov releases an application only when its billing number is confirmed paid.`,
        );
      }
      await db
        .update(schema.applications)
        .set({
          released: true,
          status: "Released to institution",
          statusNote: args.statusNote,
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, args.id));
      const relRows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id))
        .limit(1);
      const relApp = relRows[0];
      if (relApp) {
        await logEvent(
          ctx,
          relApp.id,
          "Released to institution",
          args.statusNote,
          "PortaGov",
        );
        await notify(
          ctx,
          relApp.profileId,
          relApp.id,
          "Status update",
          `PortaGov: Your application ${relApp.reference} for ${relApp.serviceName} has been submitted to ${relApp.institution}. From here, ${relApp.institution} will message you directly about the way forward and when to pick up your service. PortaGov keeps tracking it with you.`,
        );
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getReleaseMode: defineAction({
    description:
      "Reads the platform release mode: automatic (applications go straight to the institution) or manual (PortaGov approves each one first).",
    request: z.object({}),
    response: z.object({ mode: z.enum(["automatic", "manual"]) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "release_mode"))
        .limit(1);
      return { mode: rows[0]?.value === "automatic" ? "automatic" : "manual" } as {
        mode: "automatic" | "manual";
      };
    },
  }),

  setReleaseMode: defineAction({
    description:
      "Sets the global release mode in the platform console: automatic or manual approval by PortaGov.",
    request: z.object({ mode: z.enum(["automatic", "manual"]) }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.settings)
        .values({ key: "release_mode", value: args.mode })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: args.mode },
        });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  recallApplication: defineAction({
    description:
      "Platform portal action: recalls a released application back to PortaGov, so the institution no longer sees it until it is released again.",
    request: z.object({
      id: z.number().int().positive(),
      statusNote: z.string().trim().max(500).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.applications)
        .set({
          released: false,
          status: "Under review by PortaGov",
          statusNote:
            args.statusNote ||
            "PortaGov recalled this application for another look before the institution continues.",
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, args.id));
      const recallRows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id))
        .limit(1);
      const recalled = recallRows[0];
      if (recalled) {
        await logEvent(
          ctx,
          recalled.id,
          "Under review by PortaGov",
          "Recalled by PortaGov for another look.",
          "PortaGov",
        );
        await notify(
          ctx,
          recalled.profileId,
          recalled.id,
          "Status update",
          `PortaGov: Your application ${recalled.reference} for ${recalled.serviceName} is back with PortaGov for one more check. Nothing is wrong. We will tell you when it goes again.`,
        );
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
  trackApplication: defineAction({
    description:
      "Tracks one application for a signed-in PortaGov member: the reference number and phone must match an application that belongs to that member's own profile. Non-members get nothing.",
    request: z.object({
      profileId: z.number().int().positive(),
      reference: z.string().trim().min(4).max(30),
      phone: z.string().trim().min(7).max(20),
    }),
    response: z.object({ application: applicationShape.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const memberRows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const member = memberRows[0];
      if (!member || member.phone !== args.phone) {
        return { application: null };
      }
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.reference, args.reference.toUpperCase()))
        .limit(1);
      const app = rows[0];
      if (!app || app.profileId !== member.id) return { application: null };
      return { application: toApplication(app) };
    },
  }),

  listStatusEvents: defineAction({
    description: "Lists the dated timeline events for one application.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      events: z.array(
        z.object({
          id: z.number(),
          status: z.string(),
          note: z.string(),
          actor: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.statusEvents)
        .where(eq(schema.statusEvents.applicationId, args.applicationId))
        .orderBy(asc(schema.statusEvents.id));
      return {
        events: rows.map((r) => ({
          id: r.id,
          status: r.status,
          note: r.note,
          actor: r.actor ?? "",
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  listApplicationActivity: defineAction({
    description:
      "Full activity record for one application: every touch in date order, with who did it and when. Built only from real stored events: status changes, the PortaGov audit trail, updates sent to the citizen, payments, and complaints or appeals. Nothing is invented.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      reference: z.string(),
      entries: z.array(
        z.object({
          kind: z.string(),
          actor: z.string(),
          title: z.string(),
          detail: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) throw new Error("Application not found.");
      type Entry = {
        kind: string;
        actor: string;
        title: string;
        detail: string;
        at: Date;
        seq: number;
      };
      const entries: Entry[] = [];
      const events = await db
        .select()
        .from(schema.statusEvents)
        .where(eq(schema.statusEvents.applicationId, args.applicationId))
        .orderBy(asc(schema.statusEvents.id));
      for (const e of events) {
        /* Events recorded before actors were stored carry no actor.
           Only then fall back to what the application itself proves:
           the submission was the applicant's own act, and a release
           was PortaGov's act. Never guess a person's name. */
        const actor =
          e.actor ||
          (e.status === "Submitted to PortaGov"
            ? app.applicantName
            : e.status === "Released to institution"
              ? "PortaGov"
              : app.institution);
        entries.push({
          kind: "Status",
          actor,
          title: e.status,
          detail: e.note,
          at: e.createdAt,
          seq: e.id,
        });
      }
      const auditRows = await db.select().from(schema.auditLog);
      for (const a of auditRows.filter(
        (r) => r.applicationRef === app.reference,
      )) {
        entries.push({
          kind: "PortaGov record",
          actor: a.actor,
          title: a.action,
          detail: `${a.institution} record.`,
          at: a.createdAt,
          seq: a.id,
        });
      }
      /* One notify() writes the same update twice, once for SMS and
         once for WhatsApp. Show it once, naming both channels. */
      const msgRows = await db.select().from(schema.messages);
      const byBody = new Map<string, { channels: Set<string>; row: (typeof msgRows)[number] }>();
      for (const m of msgRows.filter(
        (r) => r.applicationId === args.applicationId,
      )) {
        const key = `${m.kind}|${m.body}`;
        const found = byBody.get(key);
        if (found) {
          found.channels.add(m.channel);
          if (m.createdAt < found.row.createdAt) found.row = m;
        } else {
          byBody.set(key, { channels: new Set([m.channel]), row: m });
        }
      }
      for (const { channels, row } of byBody.values()) {
        entries.push({
          kind: "Update sent",
          actor: "PortaGov",
          title: row.kind,
          detail: `${row.body} (Sent by ${[...channels].join(" and ")}.)`,
          at: row.createdAt,
          seq: row.id,
        });
      }
      const payRows = await db.select().from(schema.payments);
      for (const p of payRows.filter(
        (r) => r.applicationId === args.applicationId,
      )) {
        entries.push({
          kind: "Payment",
          actor: p.payerPhone,
          title: `${p.method} payment ${p.status.toLowerCase()}: $${p.amount}`,
          detail: `Transaction reference ${p.transactionRef}, billing number ${app.billingNumber}.`,
          at: p.createdAt,
          seq: p.id,
        });
      }
      const caseRows = await db.select().from(schema.complaints);
      for (const c of caseRows.filter(
        (r) => r.applicationId === args.applicationId,
      )) {
        entries.push({
          kind: c.kind,
          actor: app.applicantName,
          title: `${c.kind} filed`,
          detail: c.reason,
          at: c.createdAt,
          seq: c.id,
        });
        if (c.reply && c.answeredAt) {
          entries.push({
            kind: c.kind,
            actor: "PortaGov",
            title: `PortaGov answered the ${c.kind.toLowerCase()}`,
            detail: c.reply,
            at: c.answeredAt,
            seq: c.id,
          });
        }
      }
      entries.sort(
        (a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq,
      );
      return {
        reference: app.reference,
        entries: entries.map((e) => ({
          kind: e.kind,
          actor: e.actor,
          title: e.title,
          detail: e.detail,
          created_at: e.at.toISOString(),
        })),
      };
    },
  }),

  listMessages: defineAction({
    description:
      "Lists the SMS and WhatsApp update messages PortaGov has sent to one citizen, newest first.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      messages: z.array(
        z.object({
          id: z.number(),
          application_id: z.number().nullable(),
          channel: z.string(),
          kind: z.string(),
          body: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.profileId, args.profileId))
        .orderBy(desc(schema.messages.id))
        .limit(100);
      return {
        messages: rows.map((r) => ({
          id: r.id,
          application_id: r.applicationId,
          channel: r.channel,
          kind: r.kind,
          body: r.body,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  getCertificate: defineAction({
    description: "Gets the digital certificate issued for a completed application.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      certificate: z
        .object({
          cert_number: z.string(),
          service_name: z.string(),
          institution: z.string(),
          holder_name: z.string(),
          reference: z.string(),
          issued_at: z.string(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.certificates)
        .where(eq(schema.certificates.applicationId, args.applicationId))
        .limit(1);
      const r = rows[0];
      return {
        certificate: r
          ? {
              cert_number: r.certNumber,
              service_name: r.serviceName,
              institution: r.institution,
              holder_name: r.holderName,
              reference: r.reference,
              issued_at: r.issuedAt.toISOString(),
            }
          : null,
      };
    },
  }),

  verifyCertificate: defineAction({
    description:
      "Public check: verifies a PortaGov digital certificate by its certificate number.",
    request: z.object({ certNumber: z.string().trim().min(4).max(30) }),
    response: z.object({
      valid: z.boolean(),
      certificate: z
        .object({
          cert_number: z.string(),
          service_name: z.string(),
          institution: z.string(),
          holder_name: z.string(),
          reference: z.string(),
          issued_at: z.string(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.certificates)
        .where(
          eq(schema.certificates.certNumber, args.certNumber.toUpperCase()),
        )
        .limit(1);
      const r = rows[0];
      return {
        valid: r != null,
        certificate: r
          ? {
              cert_number: r.certNumber,
              service_name: r.serviceName,
              institution: r.institution,
              holder_name: r.holderName,
              reference: r.reference,
              issued_at: r.issuedAt.toISOString(),
            }
          : null,
      };
    },
  }),

  requestRefund: defineAction({
    description:
      "Starts the refund path for a recorded mobile money payment, with the citizen's reason.",
    request: z.object({
      paymentId: z.number().int().positive(),
      reason: z.string().trim().min(3).max(500),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.payments)
        .set({ status: "Refund requested", refundReason: args.reason })
        .where(eq(schema.payments.id, args.paymentId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updatePaymentStatus: defineAction({
    description:
      "Platform action: confirms a payment (which marks the billing number paid and releases the application when automatic release is on) or completes a refund.",
    request: z.object({
      paymentId: z.number().int().positive(),
      status: z.enum(["Recorded", "Confirmed", "Refund requested", "Refunded"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.payments)
        .set({ status: args.status })
        .where(eq(schema.payments.id, args.paymentId));
      if (args.status === "Confirmed") {
        const pays = await db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.id, args.paymentId))
          .limit(1);
        const pay = pays[0];
        if (pay) {
          const apps = await db
            .select()
            .from(schema.applications)
            .where(eq(schema.applications.id, pay.applicationId))
            .limit(1);
          const app = apps[0];
          if (app) {
            /* Every confirmed payment gets its own receipt in the wallet,
               for that payment alone: its own amount, method and
               transaction reference, with the billing number, service and
               tracking number. Saved once per payment, never twice, and
               never the running total, so a payment plan with two parts
               gets two correct receipts. */
            const receiptTitle = `Receipt for ${app.serviceName}, billing ${app.billingNumber}, $${pay.amount} via ${pay.method}, transaction ${pay.transactionRef}, tracking ${app.reference}`;
            const savedDocs = await db
              .select()
              .from(schema.documents)
              .where(eq(schema.documents.profileId, app.profileId));
            const receiptExists = savedDocs.some(
              (d) => d.docType === "Payment receipt" && d.title === receiptTitle,
            );
            if (!receiptExists) {
              await db.insert(schema.documents).values({
                profileId: app.profileId,
                docType: "Payment receipt",
                title: receiptTitle,
                docNumber: app.billingNumber,
                issuedOn: new Date().toISOString().slice(0, 10),
              });
            }
          }
          if (app && app.billingStatus !== "Paid") {
            const confirmed = await db
              .select()
              .from(schema.payments)
              .where(eq(schema.payments.applicationId, app.id));
            const amountPaid = confirmed
              .filter((p) => p.status === "Confirmed")
              .reduce((s, p) => s + p.amount, 0);
            const totalDue =
              app.serviceFee + app.priorityFee + app.deliveryFee;
            const fullyPaid = amountPaid >= totalDue;
            const partPaid = !fullyPaid && app.paymentPlan && amountPaid > 0;
            await db
              .update(schema.applications)
              .set({
                billingStatus: fullyPaid ? "Paid" : "Part paid",
                amountPaid,
              })
              .where(eq(schema.applications.id, app.id));
            await logEvent(
              ctx,
              app.id,
              "Payment confirmed",
              fullyPaid
                ? `Billing number ${app.billingNumber} confirmed paid: $${amountPaid} received.`
                : `Payment plan: first part confirmed for billing number ${app.billingNumber}: $${amountPaid} of $${totalDue} received. The second part is due before collection.`,
              "PortaGov",
            );
            await notify(
              ctx,
              app.profileId,
              app.id,
              "Payment received",
              fullyPaid
                ? `PortaGov: Payment received. Your billing number ${app.billingNumber} is confirmed paid. Amount received: $${amountPaid} for ${app.serviceName}. Tracking number: ${app.reference}. Your receipt is saved in your document wallet forever.`
                : `PortaGov: Payment received, first part. Billing number ${app.billingNumber}: $${amountPaid} of $${totalDue} paid for ${app.serviceName}. Tracking number: ${app.reference}. The second part, $${totalDue - amountPaid}, is due before you collect. Your receipt for this part is saved in your document wallet.`,
            );
            const modeRows = await db
              .select()
              .from(schema.settings)
              .where(eq(schema.settings.key, "release_mode"))
              .limit(1);
            if (
              modeRows[0]?.value === "automatic" &&
              !app.released &&
              (fullyPaid || partPaid)
            ) {
              await db
                .update(schema.applications)
                .set({
                  released: true,
                  status: "Released to institution",
                  statusNote:
                    "Billing confirmed paid and automatic release is on: your application has been submitted to the institution.",
                  updatedAt: new Date(),
                })
                .where(eq(schema.applications.id, app.id));
              await logEvent(
                ctx,
                app.id,
                "Released to institution",
                "Released after billing number was confirmed paid.",
                "PortaGov (automatic release)",
              );
              await notify(
                ctx,
                app.profileId,
                app.id,
                "Status update",
                `PortaGov: Your application ${app.reference} for ${app.serviceName} has been submitted to ${app.institution}. From here, ${app.institution} will message you directly about the way forward and when to pick up your service. PortaGov keeps tracking it with you.`,
              );
            }
          }
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listAgents: defineAction({
    description: "Lists the PortaGov agent network, by county.",
    request: z.object({}),
    response: z.object({
      agents: z.array(
        z.object({
          id: z.number(),
          full_name: z.string(),
          county: z.string(),
          phone: z.string(),
          service_centre: z.string(),
          active: z.boolean(),
          rating: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.agents)
        .orderBy(asc(schema.agents.county));
      return {
        agents: rows.map((r) => ({
          id: r.id,
          full_name: r.fullName,
          county: r.county,
          phone: r.phone,
          service_centre: r.serviceCentre,
          active: r.active,
          rating: r.rating,
        })),
      };
    },
  }),

  addAgent: defineAction({
    description: "Platform action: registers an agent in the county agent network.",
    request: z.object({
      fullName: z.string().trim().min(2).max(120),
      county: z.string().trim().min(2).max(60),
      phone: z.string().trim().min(7).max(20),
      serviceCentre: z.string().trim().max(120).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.agents)
        .values({
          fullName: args.fullName,
          county: args.county,
          phone: args.phone,
          serviceCentre: args.serviceCentre,
        })
        .returning({ id: schema.agents.id });
      const row = inserted[0];
      if (!row) throw new Error("Agent could not be registered.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  setAgentActive: defineAction({
    description: "Platform action: activates or deactivates an agent.",
    request: z.object({
      id: z.number().int().positive(),
      active: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.agents)
        .set({ active: args.active })
        .where(eq(schema.agents.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  agentSignIn: defineAction({
    description:
      "County agent sign-in for the agent desk: checks the agent against the registered agent network by name and phone, so only a registered, active agent can apply on someone's behalf.",
    request: z.object({
      agentId: z.number().int().positive(),
      phone: z.string().trim().min(7).max(20),
    }),
    response: z.object({
      agent: z.object({
        id: z.number(),
        full_name: z.string(),
        county: z.string(),
        phone: z.string(),
        service_centre: z.string(),
        active: z.boolean(),
        rating: z.number(),
      }),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, args.agentId))
        .limit(1);
      const agent = rows[0];
      if (!agent || !agent.active) {
        throw new Error(
          "That agent is not registered with PortaGov, or is not active. Only a registered agent can use the agent desk.",
        );
      }
      const digits = (s: string) => s.replace(/\D/g, "");
      const given = digits(args.phone);
      const stored = digits(agent.phone);
      const match =
        given.length > 0 &&
        stored.length > 0 &&
        (given === stored ||
          (given.length >= 9 &&
            stored.length >= 9 &&
            given.slice(-9) === stored.slice(-9)));
      if (!match) {
        throw new Error(
          "That phone number does not match the number PortaGov has for this agent. Check it and try again.",
        );
      }
      return {
        agent: {
          id: agent.id,
          full_name: agent.fullName,
          county: agent.county,
          phone: agent.phone,
          service_centre: agent.serviceCentre,
          active: agent.active,
          rating: agent.rating,
        },
      };
    },
  }),

  submitHelpRequest: defineAction({
    description:
      "Sends an Ask us anything question to a real PortaGov support person.",
    request: z.object({
      profileId: z.number().int().positive().nullable().default(null),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(20),
      topic: z.string().trim().min(2).max(80),
      message: z.string().trim().min(5).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.helpRequests)
        .values({
          profileId: args.profileId,
          name: args.name,
          phone: args.phone,
          topic: args.topic,
          message: args.message,
        })
        .returning({ id: schema.helpRequests.id });
      const row = inserted[0];
      if (!row) throw new Error("Your question could not be sent.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listHelpRequests: defineAction({
    description: "Platform action: lists Ask us anything questions, newest first.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      requests: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          phone: z.string(),
          topic: z.string(),
          message: z.string(),
          status: z.string(),
          reply: z.string(),
          assigned_to: z.string(),
          answered_at: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.helpRequests)
        .orderBy(desc(schema.helpRequests.id))
        .limit(args.limit);
      return {
        requests: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          topic: r.topic,
          message: r.message,
          status: r.status,
          reply: r.reply,
          assigned_to: r.assignedTo,
          answered_at: r.answeredAt ? r.answeredAt.toISOString() : "",
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  listHelpRequestsByPhone: defineAction({
    description: "Lists a citizen's own help questions and the replies, by phone number.",
    request: z.object({ phone: z.string().trim().min(7).max(20) }),
    response: z.object({
      requests: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          phone: z.string(),
          topic: z.string(),
          message: z.string(),
          status: z.string(),
          reply: z.string(),
          assigned_to: z.string(),
          answered_at: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.helpRequests)
        .where(eq(schema.helpRequests.phone, args.phone))
        .orderBy(desc(schema.helpRequests.id));
      return {
        requests: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          topic: r.topic,
          message: r.message,
          status: r.status,
          reply: r.reply,
          assigned_to: r.assignedTo,
          answered_at: r.answeredAt ? r.answeredAt.toISOString() : "",
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  replyHelpRequest: defineAction({
    description: "Platform action: a support person replies to a help question.",
    request: z.object({
      id: z.number().int().positive(),
      reply: z.string().trim().min(2).max(1000),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.helpRequests)
        .set({ reply: args.reply, status: "Answered", answeredAt: new Date() })
        .where(eq(schema.helpRequests.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  requestCallback: defineAction({
    description: "Requests a call-back from the PortaGov help team.",
    request: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(20),
      topic: z.string().trim().min(2).max(80),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.callbackRequests)
        .values({ name: args.name, phone: args.phone, topic: args.topic })
        .returning({ id: schema.callbackRequests.id });
      const row = inserted[0];
      if (!row) throw new Error("Call-back request could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listCallbacks: defineAction({
    description: "Platform action: lists call-back requests.",
    request: z.object({}),
    response: z.object({
      callbacks: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          phone: z.string(),
          topic: z.string(),
          status: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.callbackRequests)
        .orderBy(desc(schema.callbackRequests.id));
      return {
        callbacks: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          topic: r.topic,
          status: r.status,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  markCallbackDone: defineAction({
    description: "Platform action: marks a call-back as done.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.callbackRequests)
        .set({ status: "Called back" })
        .where(eq(schema.callbackRequests.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  submitComplaint: defineAction({
    description:
      "Files a complaint or an appeal on an application. It goes to PortaGov, not only to the institution.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      kind: z.enum(["Complaint", "Appeal"]),
      reason: z.string().trim().min(5).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.complaints)
        .values({
          applicationId: args.applicationId,
          profileId: args.profileId,
          kind: args.kind,
          reason: args.reason,
        })
        .returning({ id: schema.complaints.id });
      const row = inserted[0];
      if (!row) throw new Error("Your complaint could not be sent.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listComplaints: defineAction({
    description: "Platform action: lists complaints and appeals for PortaGov to review.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      complaints: z.array(
        z.object({
          id: z.number(),
          application_id: z.number(),
          application_ref: z.string(),
          kind: z.string(),
          reason: z.string(),
          status: z.string(),
          reply: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.complaints)
        .orderBy(desc(schema.complaints.id))
        .limit(args.limit);
      const apps = await db.select().from(schema.applications);
      const refById = new Map(apps.map((a) => [a.id, a.reference]));
      return {
        complaints: rows.map((r) => ({
          id: r.id,
          application_id: r.applicationId,
          application_ref: refById.get(r.applicationId) ?? "",
          kind: r.kind,
          reason: r.reason,
          status: r.status,
          reply: r.reply,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  listMyComplaints: defineAction({
    description: "Lists one citizen's complaints and appeals with PortaGov's answers.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      complaints: z.array(
        z.object({
          id: z.number(),
          application_id: z.number(),
          application_ref: z.string(),
          kind: z.string(),
          reason: z.string(),
          status: z.string(),
          reply: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.complaints)
        .where(eq(schema.complaints.profileId, args.profileId))
        .orderBy(desc(schema.complaints.id));
      const apps = await db.select().from(schema.applications);
      const refById = new Map(apps.map((a) => [a.id, a.reference]));
      return {
        complaints: rows.map((r) => ({
          id: r.id,
          application_id: r.applicationId,
          application_ref: refById.get(r.applicationId) ?? "",
          kind: r.kind,
          reason: r.reason,
          status: r.status,
          reply: r.reply,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  resolveComplaint: defineAction({
    description: "Platform action: PortaGov answers or resolves a complaint or appeal.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Under review by PortaGov", "Resolved"]),
      reply: z.string().trim().max(1000).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.complaints)
        .where(eq(schema.complaints.id, args.id))
        .limit(1);
      const complaint = rows[0];
      if (!complaint) throw new Error("That complaint or appeal was not found.");
      await db
        .update(schema.complaints)
        .set({ status: args.status, reply: args.reply, answeredAt: new Date() })
        .where(eq(schema.complaints.id, args.id));
      /* The citizen must hear about the answer, not only find it by
         revisiting the page: send it to their own phone and email
         updates on the same tracking number. */
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, complaint.applicationId))
        .limit(1);
      const app = apps[0];
      await notify(
        ctx,
        complaint.profileId,
        complaint.applicationId,
        `${complaint.kind} answer`,
        app
          ? `PortaGov: Your ${complaint.kind.toLowerCase()} on application ${app.reference} has an answer from PortaGov${args.reply ? `: ${args.reply}` : ". Open the application to read it."}`
          : `PortaGov: Your ${complaint.kind.toLowerCase()} has an answer from PortaGov${args.reply ? `: ${args.reply}` : "."}`,
      );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rateInstitution: defineAction({
    description:
      "Rates an institution's speed and clarity for one of the citizen's applications, feeding its trust score.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      speed: z.number().int().min(1).max(5),
      clarity: z.number().int().min(1).max(5),
      comment: z.string().trim().max(500).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.profileId !== args.profileId) {
        throw new Error("You can only rate your own applications.");
      }
      const existing = await db
        .select()
        .from(schema.ratings)
        .where(eq(schema.ratings.applicationId, args.applicationId))
        .limit(1);
      if (existing[0]) throw new Error("You have already rated this application.");
      const inserted = await db
        .insert(schema.ratings)
        .values({
          applicationId: args.applicationId,
          profileId: args.profileId,
          institution: app.institution,
          speed: args.speed,
          clarity: args.clarity,
          comment: args.comment,
          feedback: args.comment,
        })
        .returning({ id: schema.ratings.id });
      const row = inserted[0];
      if (!row) throw new Error("Rating could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  getTrustScores: defineAction({
    description:
      "Computes institution trust scores from citizen ratings: average speed, clarity, and an overall score, slowest first.",
    request: z.object({}),
    response: z.object({
      scores: z.array(
        z.object({
          institution: z.string(),
          ratings_count: z.number(),
          avg_speed: z.number(),
          avg_clarity: z.number(),
          score: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.ratings);
      const byInst = new Map<
        string,
        { speed: number; clarity: number; count: number }
      >();
      for (const r of rows) {
        const cur = byInst.get(r.institution) ?? { speed: 0, clarity: 0, count: 0 };
        cur.speed += r.speed;
        cur.clarity += r.clarity;
        cur.count += 1;
        byInst.set(r.institution, cur);
      }
      const scores = [...byInst.entries()]
        .map(([institution, v]) => {
          const avgSpeed = v.speed / v.count;
          const avgClarity = v.clarity / v.count;
          return {
            institution,
            ratings_count: v.count,
            avg_speed: Math.round(avgSpeed * 10) / 10,
            avg_clarity: Math.round(avgClarity * 10) / 10,
            score: Math.round(((avgSpeed + avgClarity) / 2 / 5) * 100),
          };
        })
        .sort((a, b) => a.score - b.score);
      return { scores };
    },
  }),

  getPublicStats: defineAction({
    description:
      "Public dashboard numbers with no private data: applications this month, completions, and speed per ministry.",
    request: z.object({}),
    response: z.object({
      month_label: z.string(),
      applications_this_month: z.number(),
      completions: z.number(),
      total_applications: z.number(),
      institutions: z.array(
        z.object({
          institution: z.string(),
          applications: z.number(),
          completed: z.number(),
          avg_days: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.applications);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthLabel = now.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
      const byInst = new Map<
        string,
        { applications: number; completed: number; days: number }
      >();
      let thisMonth = 0;
      let completions = 0;
      for (const r of rows) {
        if (r.createdAt.getTime() >= monthStart) thisMonth += 1;
        const cur = byInst.get(r.institution) ?? {
          applications: 0,
          completed: 0,
          days: 0,
        };
        cur.applications += 1;
        if (r.status === "Completed") {
          completions += 1;
          cur.completed += 1;
          cur.days += Math.max(
            0,
            (r.updatedAt.getTime() - r.createdAt.getTime()) / 86400000,
          );
        }
        byInst.set(r.institution, cur);
      }
      return {
        month_label: monthLabel,
        applications_this_month: thisMonth,
        completions,
        total_applications: rows.length,
        institutions: [...byInst.entries()]
          .map(([institution, v]) => ({
            institution,
            applications: v.applications,
            completed: v.completed,
            avg_days:
              v.completed > 0 ? Math.round((v.days / v.completed) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.applications - a.applications),
      };
    },
  }),

  requestVideoCall: defineAction({
    description:
      "Requests or schedules an in-platform video verification call for an application, so document checks never happen on a personal number.",
    request: z.object({
      applicationId: z.number().int().positive(),
      requestedBy: z.enum(["Institution", "Citizen"]),
      scheduledAt: z.string().trim().max(60).default(""),
      note: z.string().trim().max(500).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) throw new Error("Application not found.");
      const inserted = await db
        .insert(schema.videoCalls)
        .values({
          applicationId: app.id,
          requestedBy: args.requestedBy,
          scheduledAt: args.scheduledAt,
          status: args.scheduledAt ? "Scheduled" : "Requested",
          note: args.note,
        })
        .returning({ id: schema.videoCalls.id });
      const row = inserted[0];
      if (!row) throw new Error("Video call could not be saved.");
      await notify(
        ctx,
        app.profileId,
        app.id,
        "Video verification call",
        args.requestedBy === "Institution"
          ? `PortaGov: ${app.institution} wants to check a document with you on a video call inside PortaGov for application ${app.reference}${args.scheduledAt ? `, at ${args.scheduledAt}` : ""}. The call happens inside PortaGov, never on a personal number. Open your application to see it.`
          : `PortaGov: You asked for a video call about application ${app.reference}. The institution will set a time inside PortaGov.`,
      );
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listVideoCalls: defineAction({
    description: "Lists video verification calls for one application.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      calls: z.array(
        z.object({
          id: z.number(),
          requested_by: z.string(),
          scheduled_at: z.string(),
          status: z.string(),
          note: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.videoCalls)
        .where(eq(schema.videoCalls.applicationId, args.applicationId))
        .orderBy(desc(schema.videoCalls.id));
      return {
        calls: rows.map((r) => ({
          id: r.id,
          requested_by: r.requestedBy,
          scheduled_at: r.scheduledAt,
          status: r.status,
          note: r.note,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  updateVideoCall: defineAction({
    description: "Sets a video call's time or marks it done or missed.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Requested", "Scheduled", "Done", "Missed"]),
      scheduledAt: z.string().trim().max(60).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.videoCalls)
        .where(eq(schema.videoCalls.id, args.id))
        .limit(1);
      const call = rows[0];
      if (!call) throw new Error("Video call not found.");
      await db
        .update(schema.videoCalls)
        .set({
          status: args.status,
          scheduledAt: args.scheduledAt || call.scheduledAt,
        })
        .where(eq(schema.videoCalls.id, args.id));
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, call.applicationId))
        .limit(1);
      const app = apps[0];
      if (app) {
        await notify(
          ctx,
          app.profileId,
          app.id,
          "Video call update",
          `PortaGov: Your video verification call for application ${app.reference} is now ${args.status}${args.scheduledAt ? `, at ${args.scheduledAt}` : ""}. Join from your application page inside PortaGov.`,
        );
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addBusiness: defineAction({
    description: "Saves a business to a citizen's business wallet.",
    request: z.object({
      profileId: z.number().int().positive(),
      businessName: z.string().trim().min(2).max(120),
      registrationNumber: z.string().trim().max(60).default(""),
      tin: z.string().trim().max(60).default(""),
      county: z.string().trim().min(2).max(60),
      activity: z.string().trim().max(120).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.businesses)
        .values({
          profileId: args.profileId,
          businessName: args.businessName,
          registrationNumber: args.registrationNumber,
          tin: args.tin,
          county: args.county,
          activity: args.activity,
        })
        .returning({ id: schema.businesses.id });
      const row = inserted[0];
      if (!row) throw new Error("Business could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listBusinesses: defineAction({
    description: "Lists a citizen's saved businesses.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      businesses: z.array(
        z.object({
          id: z.number(),
          business_name: z.string(),
          registration_number: z.string(),
          tin: z.string(),
          county: z.string(),
          activity: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.profileId, args.profileId))
        .orderBy(asc(schema.businesses.id));
      return {
        businesses: rows.map((r) => ({
          id: r.id,
          business_name: r.businessName,
          registration_number: r.registrationNumber,
          tin: r.tin,
          county: r.county,
          activity: r.activity,
        })),
      };
    },
  }),

  getWeeklyReport: defineAction({
    description:
      "Weekly government report per ministry: applications this week, completions, and average processing time.",
    request: z.object({}),
    response: z.object({
      rows: z.array(
        z.object({
          institution: z.string(),
          submitted_week: z.number(),
          completed_week: z.number(),
          total: z.number(),
          avg_hours: z.number().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const byInst = new Map<
        string,
        { submitted: number; completed: number; total: number; hours: number[] }
      >();
      for (const a of apps) {
        const cur =
          byInst.get(a.institution) ??
          { submitted: 0, completed: 0, total: 0, hours: [] };
        cur.total += 1;
        if (a.createdAt.getTime() >= weekAgo) cur.submitted += 1;
        if (a.status === "Completed") {
          if (a.updatedAt.getTime() >= weekAgo) cur.completed += 1;
          cur.hours.push(
            (a.updatedAt.getTime() - a.createdAt.getTime()) / 3600000,
          );
        }
        byInst.set(a.institution, cur);
      }
      return {
        rows: [...byInst.entries()]
          .map(([institution, v]) => ({
            institution,
            submitted_week: v.submitted,
            completed_week: v.completed,
            total: v.total,
            avg_hours:
              v.hours.length > 0
                ? Math.round(
                    (v.hours.reduce((s, h) => s + h, 0) / v.hours.length) * 10,
                  ) / 10
                : null,
          }))
          .sort((a, b) => b.total - a.total),
      };
    },
  }),

  generateWeeklyReport: defineAction({
    description:
      "Generates and stores the weekly government report snapshot for every ministry. Runs automatically each week and can be run by hand.",
    request: z.object({}),
    response: z.object({ id: z.number(), period_label: z.string() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const byInst = new Map<
        string,
        { submitted: number; completed: number; total: number; hours: number[] }
      >();
      for (const a of apps) {
        const cur =
          byInst.get(a.institution) ??
          { submitted: 0, completed: 0, total: 0, hours: [] };
        cur.total += 1;
        if (a.createdAt.getTime() >= weekAgo) cur.submitted += 1;
        if (a.status === "Completed") {
          if (a.updatedAt.getTime() >= weekAgo) cur.completed += 1;
          cur.hours.push(
            (a.updatedAt.getTime() - a.createdAt.getTime()) / 3600000,
          );
        }
        byInst.set(a.institution, cur);
      }
      const rows = [...byInst.entries()].map(([institution, v]) => ({
        institution,
        submitted_week: v.submitted,
        completed_week: v.completed,
        total: v.total,
        avg_hours:
          v.hours.length > 0
            ? Math.round(
                (v.hours.reduce((s, h) => s + h, 0) / v.hours.length) * 10,
              ) / 10
            : null,
      }));
      const periodLabel = `Week ending ${new Date().toISOString().slice(0, 10)}`;
      const inserted = await db
        .insert(schema.reportSnapshots)
        .values({ periodLabel, body: JSON.stringify(rows) })
        .returning({ id: schema.reportSnapshots.id });
      const row = inserted[0];
      if (!row) throw new Error("Report could not be generated.");
      ctx.invalidateQueries();
      return { id: row.id, period_label: periodLabel };
    },
  }),

  listReportSnapshots: defineAction({
    description: "Lists stored weekly government report snapshots, newest first.",
    request: z.object({ limit: z.number().int().positive().max(52).default(12) }),
    response: z.object({
      snapshots: z.array(
        z.object({
          id: z.number(),
          period_label: z.string(),
          body: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.reportSnapshots)
        .orderBy(desc(schema.reportSnapshots.id))
        .limit(args.limit);
      return {
        snapshots: rows.map((r) => ({
          id: r.id,
          period_label: r.periodLabel,
          body: r.body,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  verifyProfileAccess: defineAction({
    description:
      "Security check on sign-in: returns the profile only when the phone number and the date of birth both match.",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      dateOfBirth: z.string().trim().min(4).max(10),
    }),
    response: z.object({ profile: profileShape.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const row = rows[0];
      if (!row || row.dateOfBirth !== args.dateOfBirth) {
        return { profile: null };
      }
      return { profile: toProfile(row) };
    },
  }),

  postAnnouncement: defineAction({
    description:
      "Platform action: posts a notice on a ministry announcement board.",
    request: z.object({
      ministry: z.string().trim().min(2).max(120),
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(5).max(1000),
      urgent: z.boolean().default(false),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.announcements)
        .values({
          ministry: args.ministry,
          title: args.title,
          body: args.body,
          urgent: args.urgent,
        })
        .returning({ id: schema.announcements.id });
      const row = inserted[0];
      if (!row) throw new Error("Announcement could not be posted.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listAnnouncements: defineAction({
    description: "Lists ministry announcement board posts, newest first.",
    request: z.object({
      ministry: z.string().trim().max(120).default(""),
      limit: z.number().int().positive().max(50).default(20),
    }),
    response: z.object({
      announcements: z.array(
        z.object({
          id: z.number(),
          ministry: z.string(),
          title: z.string(),
          body: z.string(),
          urgent: z.boolean(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.announcements)
        .orderBy(desc(schema.announcements.id))
        .limit(args.limit);
      return {
        announcements: rows
          .filter((r) => !args.ministry || r.ministry === args.ministry)
          .map((r) => ({
            id: r.id,
            ministry: r.ministry,
            title: r.title,
            body: r.body,
            urgent: r.urgent,
            created_at: r.createdAt.toISOString(),
          })),
      };
    },
  }),

  sendChatMessage: defineAction({
    description:
      "Citizen sends a live chat message to a PortaGov officer from the Help page.",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      name: z.string().trim().max(120).default(""),
      body: z.string().trim().min(1).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.chatMessages)
        .values({
          phone: args.phone,
          name: args.name,
          sender: "Citizen",
          body: args.body,
        })
        .returning({ id: schema.chatMessages.id });
      const row = inserted[0];
      if (!row) throw new Error("Message could not be sent.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  officerReplyChat: defineAction({
    description:
      "Platform action: a PortaGov officer replies in a citizen's live chat.",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      body: z.string().trim().min(1).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.chatMessages)
        .values({
          phone: args.phone,
          name: "PortaGov officer",
          sender: "Officer",
          body: args.body,
        })
        .returning({ id: schema.chatMessages.id });
      const row = inserted[0];
      if (!row) throw new Error("Reply could not be sent.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listChatThread: defineAction({
    description: "Lists one live chat thread by phone number, oldest first.",
    request: z.object({ phone: z.string().trim().min(7).max(20) }),
    response: z.object({
      messages: z.array(
        z.object({
          id: z.number(),
          sender: z.string(),
          name: z.string(),
          body: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.phone, args.phone))
        .orderBy(asc(schema.chatMessages.id))
        .limit(100);
      return {
        messages: rows.map((r) => ({
          id: r.id,
          sender: r.sender,
          name: r.name,
          body: r.body,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  listChatThreads: defineAction({
    description:
      "Platform action: lists live chat threads (one per citizen phone) with their latest message.",
    request: z.object({}),
    response: z.object({
      threads: z.array(
        z.object({
          phone: z.string(),
          name: z.string(),
          last_body: z.string(),
          last_at: z.string(),
          count: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .orderBy(asc(schema.chatMessages.id));
      const byPhone = new Map<
        string,
        { phone: string; name: string; last_body: string; last_at: string; count: number }
      >();
      for (const r of rows) {
        const cur = byPhone.get(r.phone) ?? {
          phone: r.phone,
          name: r.name,
          last_body: "",
          last_at: "",
          count: 0,
        };
        cur.count += 1;
        cur.last_body = r.body;
        cur.last_at = r.createdAt.toISOString();
        if (r.name) cur.name = r.name;
        byPhone.set(r.phone, cur);
      }
      return { threads: [...byPhone.values()] };
    },
  }),

  listDiasporaApplications: defineAction({
    description:
      "Embassy desk: lists released diaspora applications so institutions and embassies can coordinate per country.",
    request: z.object({ limit: z.number().int().positive().max(200).default(100) }),
    response: z.object({ applications: z.array(applicationShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.released, true))
        .orderBy(desc(schema.applications.id))
        .limit(args.limit);
      return {
        applications: rows
          .filter((r) => r.channel === "Diaspora")
          .map(toApplication),
      };
    },
  }),

  postEmbassyUpdate: defineAction({
    description:
      "Embassy space: the institution, the embassy, or PortaGov posts an update on a diaspora application. The citizen sees it in their application thread.",
    request: z.object({
      applicationId: z.number().int().positive(),
      sender: z.enum(["Institution", "Embassy", "PortaGov"]),
      body: z.string().trim().min(3).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) throw new Error("Application not found.");
      const embassy =
        app.embassy ||
        (app.diasporaCountry
          ? `Embassy of Liberia, ${app.diasporaCountry}`
          : "Embassy of Liberia");
      const inserted = await db
        .insert(schema.embassyUpdates)
        .values({
          applicationId: app.id,
          embassy,
          sender: args.sender,
          body: args.body,
        })
        .returning({ id: schema.embassyUpdates.id });
      const row = inserted[0];
      if (!row) throw new Error("Update could not be posted.");
      await notify(
        ctx,
        app.profileId,
        app.id,
        "Embassy update",
        `PortaGov: Update on your application ${app.reference} from ${args.sender === "Embassy" ? embassy : args.sender}: ${args.body}`,
      );
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listEmbassyUpdates: defineAction({
    description: "Lists the embassy space updates for one diaspora application.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      updates: z.array(
        z.object({
          id: z.number(),
          embassy: z.string(),
          sender: z.string(),
          body: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.embassyUpdates)
        .where(eq(schema.embassyUpdates.applicationId, args.applicationId))
        .orderBy(asc(schema.embassyUpdates.id));
      return {
        updates: rows.map((r) => ({
          id: r.id,
          embassy: r.embassy,
          sender: r.sender,
          body: r.body,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  registerAccount: defineAction({
    description:
      "Strong sign-up: validates every field, sets a strong password, and starts phone verification with a code. No unverified or incomplete profile can proceed.",
    request: profileInput.extend({
      password: z.string().min(12).max(100),
    }),
    response: z.object({
      profile_id: z.number(),
      demo_code: z.string(),
      needs_email: z.boolean(),
    }),
    async handler(ctx, args) {
      const problem = signupProblem(args) ?? passwordProblem(args.password);
      if (problem) throw new Error(problem);
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      if (existing[0]) {
        throw new Error(
          "An account already exists for this phone number. Use I'm not new here to sign in.",
        );
      }
      const salt = makeSalt();
      const passwordHash = await hashPassword(args.password, salt);
      const inserted = await db
        .insert(schema.profiles)
        .values({
          fullName: args.fullName,
          dateOfBirth: args.dateOfBirth,
          placeOfBirth: args.placeOfBirth,
          sex: args.sex,
          address: args.address,
          county: args.county,
          phone: args.phone,
          email: args.email,
          emergencyName: args.emergencyName,
          emergencyPhone: args.emergencyPhone,
          nationalId: args.hasNationalId ? args.nationalId : "",
          hasNationalId: args.hasNationalId,
          altIdType: args.hasNationalId ? "" : args.altIdType,
          altIdNumber: args.hasNationalId ? "" : args.altIdNumber,
          witnessName: args.hasNationalId ? "" : args.witnessName,
          witnessPhone: args.hasNationalId ? "" : args.witnessPhone,
          country: args.country,
          nationality: args.nationality,
          timezone: args.timezone,
          language: args.language,
          passwordHash,
          passwordSalt: salt,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Account could not be created.");
      const code = await issueCode(ctx, row.id, "signup");
      ctx.invalidateQueries();
      return {
        profile_id: row.id,
        demo_code: code,
        needs_email: row.email.length > 0,
      };
    },
  }),

  verifyPhoneCode: defineAction({
    description:
      "Checks the sign-up phone code. When an email is on the account, an email code follows.",
    request: z.object({
      profileId: z.number().int().positive(),
      code: z.string().trim().min(6).max(6),
    }),
    response: z.object({
      ok: z.boolean(),
      email_code: z.string(),
      profile: profileShape.nullable(),
      locked: z.boolean(),
      minutes_left: z.number(),
      attempts_left: z.number(),
    }),
    async handler(ctx, args) {
      const checked = await checkCitizenCode(ctx, args.profileId, "signup", args.code);
      if (!checked.ok) {
        return {
          ok: false,
          email_code: "",
          profile: null,
          locked: checked.locked,
          minutes_left: checked.minutesLeft,
          attempts_left: checked.attemptsLeft,
        };
      }
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ phoneVerified: true })
        .where(eq(schema.profiles.id, args.profileId));
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return {
          ok: false,
          email_code: "",
          profile: null,
          locked: false,
          minutes_left: 0,
          attempts_left: CODE_LOCKOUT_ATTEMPTS,
        };
      }
      let emailCode = "";
      if (row.email && !row.emailVerified) {
        emailCode = await issueCode(ctx, row.id, "email");
      }
      ctx.invalidateQueries();
      return {
        ok: true,
        email_code: emailCode,
        profile: toProfile(row),
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
    },
  }),

  verifyEmailCode: defineAction({
    description: "Checks the email verification code and marks the email verified.",
    request: z.object({
      profileId: z.number().int().positive(),
      code: z.string().trim().min(6).max(6),
    }),
    response: z.object({
      ok: z.boolean(),
      profile: profileShape.nullable(),
      locked: z.boolean(),
      minutes_left: z.number(),
      attempts_left: z.number(),
    }),
    async handler(ctx, args) {
      const checked = await checkCitizenCode(ctx, args.profileId, "email", args.code);
      if (!checked.ok) {
        return {
          ok: false,
          profile: null,
          locked: checked.locked,
          minutes_left: checked.minutesLeft,
          attempts_left: checked.attemptsLeft,
        };
      }
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ emailVerified: true })
        .where(eq(schema.profiles.id, args.profileId));
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      ctx.invalidateQueries();
      return {
        ok: true,
        profile: rows[0] ? toProfile(rows[0]) : null,
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
    },
  }),

  loginStart: defineAction({
    description:
      "Starts sign-in: checks lockout and password, then decides whether a code is needed (new device, two-factor on, or a password still to set).",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      password: z.string().max(100).default(""),
      deviceId: z.string().trim().min(4).max(80),
      deviceLabel: z.string().trim().max(120).default(""),
    }),
    response: z.object({
      result: z.enum(["ok", "need_code", "bad_credentials", "locked", "not_found"]),
      profile_id: z.number(),
      demo_code: z.string(),
      new_device: z.boolean(),
      minutes_left: z.number(),
      profile: profileShape.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const row = rows[0];
      const empty = {
        profile_id: 0,
        demo_code: "",
        new_device: false,
        minutes_left: 0,
        profile: null,
      };
      if (!row) return { result: "not_found" as const, ...empty };
      if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
        return {
          result: "locked" as const,
          ...empty,
          profile_id: row.id,
          minutes_left: Math.ceil(
            (row.lockedUntil.getTime() - Date.now()) / 60000,
          ),
        };
      }
      const devices = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.profileId, row.id));
      const knownDevice = devices.some((d) => d.deviceId === args.deviceId);
      if (row.passwordHash) {
        const attempt = await hashPassword(args.password, row.passwordSalt);
        if (attempt !== row.passwordHash) {
          const attempts = row.failedAttempts + 1;
          await db
            .update(schema.profiles)
            .set({
              failedAttempts: attempts,
              lockedUntil:
                attempts >= 5
                  ? new Date(Date.now() + 15 * 60 * 1000)
                  : row.lockedUntil,
            })
            .where(eq(schema.profiles.id, row.id));
          return {
            result: (attempts >= 5 ? "locked" : "bad_credentials") as
              | "locked"
              | "bad_credentials",
            ...empty,
            profile_id: row.id,
            minutes_left: attempts >= 5 ? 15 : 0,
          };
        }
        await db
          .update(schema.profiles)
          .set({ failedAttempts: 0, lockedUntil: null })
          .where(eq(schema.profiles.id, row.id));
      }
      const needsCode = !row.passwordHash || row.twoFactor || !knownDevice;
      if (needsCode) {
        const code = await issueCode(ctx, row.id, "login");
        return {
          result: "need_code" as const,
          ...empty,
          profile_id: row.id,
          demo_code: code,
          new_device: !knownDevice,
        };
      }
      const dev = devices.find((d) => d.deviceId === args.deviceId);
      if (dev) {
        await db
          .update(schema.devices)
          .set({ lastSeen: new Date(), signedOut: false })
          .where(eq(schema.devices.id, dev.id));
      }
      await recordSignInEvent(
        ctx,
        row.id,
        args.deviceId,
        args.deviceLabel,
        false,
      );
      return {
        result: "ok" as const,
        ...empty,
        profile_id: row.id,
        profile: toProfile(row),
      };
    },
  }),

  verifyLoginCode: defineAction({
    description:
      "Finishes sign-in with the code: registers the device, warns when the device is new, and lets a password be set for accounts that do not have one yet.",
    request: z.object({
      profileId: z.number().int().positive(),
      phone: z.string().trim().max(30).default(""),
      code: z.string().trim().min(6).max(6),
      deviceId: z.string().trim().min(4).max(80),
      deviceLabel: z.string().trim().max(120).default(""),
      newPassword: z.string().max(100).default(""),
    }),
    response: z.object({
      ok: z.boolean(),
      new_device_warning: z.boolean(),
      profile: profileShape.nullable(),
      locked: z.boolean(),
      minutes_left: z.number(),
      attempts_left: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const row = rows[0];
      const failed = {
        ok: false,
        new_device_warning: false,
        profile: null,
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
      if (!row) return failed;
      const checked = await checkCitizenCode(ctx, row.id, "login", args.code);
      if (!checked.ok) {
        return {
          ...failed,
          locked: checked.locked,
          minutes_left: checked.minutesLeft,
          attempts_left: checked.attemptsLeft,
        };
      }
      if (!row.passwordHash) {
        const problem = passwordProblem(args.newPassword);
        if (problem) throw new Error(problem);
        const salt = makeSalt();
        await db
          .update(schema.profiles)
          .set({
            passwordHash: await hashPassword(args.newPassword, salt),
            passwordSalt: salt,
            phoneVerified: true,
          })
          .where(eq(schema.profiles.id, row.id));
      }
      const devices = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.profileId, row.id));
      const known = devices.some((d) => d.deviceId === args.deviceId);
      if (!known) {
        await db.insert(schema.devices).values({
          profileId: row.id,
          deviceId: args.deviceId,
          label: args.deviceLabel,
        });
      } else {
        const dev = devices.find((d) => d.deviceId === args.deviceId);
        if (dev) {
          await db
            .update(schema.devices)
            .set({ lastSeen: new Date(), signedOut: false })
            .where(eq(schema.devices.id, dev.id));
        }
      }
      await recordSignInEvent(
        ctx,
        row.id,
        args.deviceId,
        args.deviceLabel,
        !known,
      );
      const fresh = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, row.id))
        .limit(1);
      ctx.invalidateQueries();
      return {
        ok: true,
        new_device_warning: !known && devices.length > 0,
        profile: fresh[0] ? toProfile(fresh[0]) : null,
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
    },
  }),

  setTwoFactor: defineAction({
    description: "Turns optional two-factor sign-in codes on or off for an account.",
    request: z.object({
      profileId: z.number().int().positive(),
      enabled: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ twoFactor: args.enabled })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listDevices: defineAction({
    description: "Lists the devices signed in to an account.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      devices: z.array(
        z.object({
          id: z.number(),
          label: z.string(),
          first_seen: z.string(),
          last_seen: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.profileId, args.profileId))
        .orderBy(desc(schema.devices.id));
      return {
        devices: rows.map((r) => ({
          id: r.id,
          label: r.label,
          first_seen: r.createdAt.toISOString(),
          last_seen: r.lastSeen.toISOString(),
        })),
      };
    },
  }),

  listSignInEvents: defineAction({
    description:
      "Sign-in history for an account: when each sign-in happened, from which device, and whether the device was new.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      events: z.array(
        z.object({
          id: z.number(),
          device_label: z.string(),
          is_new_device: z.boolean(),
          signed_in_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.signInEvents)
        .where(eq(schema.signInEvents.profileId, args.profileId))
        .orderBy(desc(schema.signInEvents.id))
        .limit(20);
      return {
        events: rows.map((r) => ({
          id: r.id,
          device_label: r.label,
          is_new_device: r.isNewDevice,
          signed_in_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  signOutAll: defineAction({
    description:
      "Signs out everywhere: marks every device on the account signed out and records the time, so a saved session on any device stops working until the person signs in again. In this browser-only build it signs out this device and the sessions recorded here; on the shared backend the same record will sign out every device at once.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      ok: z.boolean(),
      devices_signed_out: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const devices = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.profileId, args.profileId));
      for (const d of devices) {
        await db
          .update(schema.devices)
          .set({ signedOut: true })
          .where(eq(schema.devices.id, d.id));
      }
      await db
        .update(schema.profiles)
        .set({ sessionsRevokedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true, devices_signed_out: devices.length };
    },
  }),

  checkCitizenSession: defineAction({
    description:
      "Checks whether a saved citizen session is still valid on this device: it is not valid when the account was signed out everywhere after this device last signed in.",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      deviceId: z.string().trim().min(4).max(80),
    }),
    response: z.object({
      valid: z.boolean(),
      profile: profileShape.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const row = rows[0];
      if (!row) return { valid: false, profile: null };
      if (!row.sessionsRevokedAt) {
        return { valid: true, profile: toProfile(row) };
      }
      const devices = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.profileId, row.id));
      const dev = devices.find((d) => d.deviceId === args.deviceId);
      const valid = Boolean(
        dev &&
          !dev.signedOut &&
          dev.lastSeen &&
          dev.lastSeen.getTime() >= row.sessionsRevokedAt.getTime(),
      );
      return { valid, profile: valid ? toProfile(row) : null };
    },
  }),

  changePassword: defineAction({
    description: "Changes an account password after checking the current one and the strong password rules.",
    request: z.object({
      profileId: z.number().int().positive(),
      currentPassword: z.string().min(1).max(100),
      newPassword: z.string().min(12).max(100),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const problem = passwordProblem(args.newPassword);
      if (problem) throw new Error(problem);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const row = rows[0];
      if (!row || !row.passwordHash) {
        throw new Error("This account has no password yet. Sign in with a code to set one.");
      }
      const attempt = await hashPassword(args.currentPassword, row.passwordSalt);
      if (attempt !== row.passwordHash) {
        throw new Error("Your current password is not correct.");
      }
      const salt = makeSalt();
      await db
        .update(schema.profiles)
        .set({
          passwordHash: await hashPassword(args.newPassword, salt),
          passwordSalt: salt,
        })
        .where(eq(schema.profiles.id, row.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  requestPrint: defineAction({
    description:
      "Print-at-centre: the citizen asks for their application documents to be printed at a chosen service centre, and gets a print code.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      office: z.string().trim().min(3).max(160),
    }),
    response: z.object({ id: z.number(), print_code: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.profileId !== args.profileId) {
        throw new Error("You can only print your own applications.");
      }
      const count = await db.select().from(schema.printRequests);
      const printCode = `PRT-${String(count.length + 1).padStart(5, "0")}`;
      const inserted = await db
        .insert(schema.printRequests)
        .values({
          applicationId: app.id,
          profileId: args.profileId,
          office: args.office,
          printCode,
        })
        .returning({ id: schema.printRequests.id });
      const row = inserted[0];
      if (!row) throw new Error("Print request could not be saved.");
      await notify(
        ctx,
        args.profileId,
        app.id,
        "Print at centre",
        `PortaGov: Your print request for application ${app.reference} is saved. Go to ${args.office} and give print code ${printCode}. The centre prints your documents there.`,
      );
      ctx.invalidateQueries();
      return { id: row.id, print_code: printCode };
    },
  }),

  listPrintRequests: defineAction({
    description: "Lists print-at-centre requests for the platform and centre desks.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      requests: z.array(
        z.object({
          id: z.number(),
          application_ref: z.string(),
          office: z.string(),
          print_code: z.string(),
          status: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.printRequests)
        .orderBy(desc(schema.printRequests.id))
        .limit(args.limit);
      const out = [];
      for (const r of rows) {
        const apps = await db
          .select()
          .from(schema.applications)
          .where(eq(schema.applications.id, r.applicationId))
          .limit(1);
        out.push({
          id: r.id,
          application_ref: apps[0]?.reference ?? "",
          office: r.office,
          print_code: r.printCode,
          status: r.status,
          created_at: r.createdAt.toISOString(),
        });
      }
      return { requests: out };
    },
  }),

  updatePrintRequest: defineAction({
    description: "Marks a print-at-centre request printed or collected.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Requested", "Printed", "Collected"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.printRequests)
        .set({ status: args.status })
        .where(eq(schema.printRequests.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  reportLostDocument: defineAction({
    description:
      "Reports a lost document and issues a lost-document reference number the replacement flow uses.",
    request: z.object({
      profileId: z.number().int().positive(),
      docType: z.string().trim().min(2).max(80),
      docNumber: z.string().trim().max(60).default(""),
      details: z.string().trim().max(500).default(""),
    }),
    response: z.object({ id: z.number(), reference: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const count = await db.select().from(schema.lostReports);
      const reference = `LOST-${new Date().getFullYear()}-${String(count.length + 1).padStart(5, "0")}`;
      const inserted = await db
        .insert(schema.lostReports)
        .values({
          profileId: args.profileId,
          reference,
          docType: args.docType,
          docNumber: args.docNumber,
          details: args.details,
        })
        .returning({ id: schema.lostReports.id });
      const row = inserted[0];
      if (!row) throw new Error("Lost report could not be saved.");
      await notify(
        ctx,
        args.profileId,
        null,
        "Lost document reported",
        `PortaGov: Your lost ${args.docType} is reported. Your lost-document reference is ${reference}. Keep it: the replacement application uses this reference, and it protects you if someone tries to use your document.`,
      );
      ctx.invalidateQueries();
      return { id: row.id, reference };
    },
  }),

  listLostReports: defineAction({
    description: "Lists a citizen's lost-document reports.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      reports: z.array(
        z.object({
          id: z.number(),
          reference: z.string(),
          doc_type: z.string(),
          doc_number: z.string(),
          details: z.string(),
          status: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.lostReports)
        .where(eq(schema.lostReports.profileId, args.profileId))
        .orderBy(desc(schema.lostReports.id));
      return {
        reports: rows.map((r) => ({
          id: r.id,
          reference: r.reference,
          doc_type: r.docType,
          doc_number: r.docNumber,
          details: r.details,
          status: r.status,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  updateLostReport: defineAction({
    description: "Platform action: moves a lost-document report through replacement or closes it.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Reported", "In replacement", "Closed"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.lostReports)
        .set({ status: args.status })
        .where(eq(schema.lostReports.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  createShareLink: defineAction({
    description:
      "Creates a secure view-only share link for an application: the holder sees status only and can change nothing.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
    }),
    response: z.object({ token: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.profileId !== args.profileId) {
        throw new Error("You can only share your own applications.");
      }
      const existing = await db
        .select()
        .from(schema.shareLinks)
        .where(eq(schema.shareLinks.applicationId, app.id));
      const live = existing.find((l) => !l.revoked);
      if (live) return { token: live.token };
      const token = `pg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${app.id.toString(36)}`;
      await db.insert(schema.shareLinks).values({
        applicationId: app.id,
        token,
      });
      ctx.invalidateQueries();
      return { token };
    },
  }),

  revokeShareLink: defineAction({
    description: "Revokes every share link for an application.",
    request: z.object({
      applicationId: z.number().int().positive(),
      profileId: z.number().int().positive(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      if (!apps[0] || apps[0].profileId !== args.profileId) {
        throw new Error("You can only manage your own applications.");
      }
      await db
        .update(schema.shareLinks)
        .set({ revoked: true })
        .where(eq(schema.shareLinks.applicationId, args.applicationId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getSharedApplication: defineAction({
    description:
      "Public view-only lookup by share token: service, status and timeline only, no documents, no payments, no personal details beyond a first name.",
    request: z.object({ token: z.string().trim().min(6).max(60) }),
    response: z.object({
      found: z.boolean(),
      reference: z.string(),
      service_name: z.string(),
      institution: z.string(),
      status: z.string(),
      first_name: z.string(),
      events: z.array(
        z.object({ status: z.string(), created_at: z.string() }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const empty = {
        found: false,
        reference: "",
        service_name: "",
        institution: "",
        status: "",
        first_name: "",
        events: [] as { status: string; created_at: string }[],
      };
      const links = await db
        .select()
        .from(schema.shareLinks)
        .where(eq(schema.shareLinks.token, args.token))
        .limit(1);
      const link = links[0];
      if (!link || link.revoked) return empty;
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, link.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) return empty;
      const evs = await db
        .select()
        .from(schema.statusEvents)
        .where(eq(schema.statusEvents.applicationId, app.id))
        .orderBy(asc(schema.statusEvents.id));
      return {
        found: true,
        reference: app.reference,
        service_name: app.serviceName,
        institution: app.institution,
        status: app.status,
        first_name: app.applicantName.split(" ")[0] ?? "",
        events: evs.map((e) => ({
          status: e.status,
          created_at: e.createdAt.toISOString(),
        })),
      };
    },
  }),

  addTeamMember: defineAction({
    description: "Adds a team member to a business in the business portal.",
    request: z.object({
      businessId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      name: z.string().trim().min(2).max(120),
      role: z.string().trim().max(80).default(""),
      phone: z.string().trim().max(20).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const biz = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, args.businessId))
        .limit(1);
      if (!biz[0] || biz[0].profileId !== args.profileId) {
        throw new Error("That business is not on your account.");
      }
      const inserted = await db
        .insert(schema.businessTeam)
        .values({
          businessId: args.businessId,
          name: args.name,
          role: args.role,
          phone: args.phone,
        })
        .returning({ id: schema.businessTeam.id });
      const row = inserted[0];
      if (!row) throw new Error("Team member could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listTeamMembers: defineAction({
    description: "Lists a business's team members.",
    request: z.object({ businessId: z.number().int().positive() }),
    response: z.object({
      members: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          role: z.string(),
          phone: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.businessTeam)
        .where(eq(schema.businessTeam.businessId, args.businessId))
        .orderBy(asc(schema.businessTeam.id));
      return {
        members: rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          phone: r.phone,
        })),
      };
    },
  }),

  removeTeamMember: defineAction({
    description: "Removes a team member from a business.",
    request: z.object({
      id: z.number().int().positive(),
      profileId: z.number().int().positive(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.businessTeam)
        .where(eq(schema.businessTeam.id, args.id))
        .limit(1);
      const member = rows[0];
      if (member) {
        const biz = await db
          .select()
          .from(schema.businesses)
          .where(eq(schema.businesses.id, member.businessId))
          .limit(1);
        if (!biz[0] || biz[0].profileId !== args.profileId) {
          throw new Error("That business is not on your account.");
        }
        await db
          .delete(schema.businessTeam)
          .where(eq(schema.businessTeam.id, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listBusinessApplications: defineAction({
    description: "Lists every application filed under one business, for the business portal dashboard.",
    request: z.object({ businessId: z.number().int().positive() }),
    response: z.object({ applications: z.array(applicationShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.businessId, args.businessId))
        .orderBy(desc(schema.applications.id));
      return { applications: rows.map(toApplication) };
    },
  }),

  addStaff: defineAction({
    description: "Adds a staff member with a role to an institution's portal roster.",
    request: z.object({
      institution: z.string().trim().min(2).max(120),
      name: z.string().trim().min(2).max(120),
      role: z.string().trim().max(80).default(""),
      phone: z.string().trim().max(20).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.institutionStaff)
        .values({
          institution: args.institution,
          name: args.name,
          role: args.role,
          phone: args.phone,
        })
        .returning({ id: schema.institutionStaff.id });
      const row = inserted[0];
      if (!row) throw new Error("Staff member could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listStaff: defineAction({
    description: "Lists an institution's staff roster.",
    request: z.object({ institution: z.string().trim().max(120).default("") }),
    response: z.object({
      staff: z.array(
        z.object({
          id: z.number(),
          institution: z.string(),
          name: z.string(),
          role: z.string(),
          phone: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.institutionStaff)
        .orderBy(asc(schema.institutionStaff.id));
      return {
        staff: rows
          .filter((r) => !args.institution || r.institution === args.institution)
          .map((r) => ({
            id: r.id,
            institution: r.institution,
            name: r.name,
            role: r.role,
            phone: r.phone,
          })),
      };
    },
  }),

  getYearlySummary: defineAction({
    description:
      "My government year summary: services used, amounts paid, completions, and documents expiring soon, for one citizen and year.",
    request: z.object({
      profileId: z.number().int().positive(),
      year: z.number().int().min(2020).max(2100),
    }),
    response: z.object({
      year: z.number(),
      applications_count: z.number(),
      completed: z.number(),
      total_paid: z.number(),
      by_service: z.array(
        z.object({ service: z.string(), count: z.number() }),
      ),
      expiring_soon: z.array(
        z.object({
          title: z.string(),
          doc_type: z.string(),
          expires_on: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.profileId, args.profileId));
      const inYear = apps.filter(
        (a) => a.createdAt.getFullYear() === args.year,
      );
      const byService = new Map<string, number>();
      for (const a of inYear) {
        byService.set(a.serviceName, (byService.get(a.serviceName) ?? 0) + 1);
      }
      const allPays = await db.select().from(schema.payments);
      const myAppIds = new Set(apps.map((a) => a.id));
      const pays = allPays.filter((p) => myAppIds.has(p.applicationId));
      const totalPaid = pays
        .filter(
          (p) =>
            p.status === "Confirmed" &&
            p.createdAt.getFullYear() === args.year,
        )
        .reduce((s, p) => s + p.amount, 0);
      const docs = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.profileId, args.profileId));
      const soon = Date.now() + 90 * 86400000;
      return {
        year: args.year,
        applications_count: inYear.length,
        completed: inYear.filter((a) => a.status === "Completed").length,
        total_paid: totalPaid,
        by_service: [...byService.entries()].map(([service, count]) => ({
          service,
          count,
        })),
        expiring_soon: docs
          .filter((d) => {
            if (!d.expiresOn) return false;
            const t = new Date(`${d.expiresOn}T00:00:00`).getTime();
            return t >= Date.now() - 86400000 && t <= soon;
          })
          .map((d) => ({
            title: d.title,
            doc_type: d.docType,
            expires_on: d.expiresOn,
          })),
      };
    },
  }),

  createInstitution: defineAction({
    description:
      "Institution onboarding studio: one form creates a new institution's own portal in Sandbox with its branding. No code, no rebuild.",
    request: z.object({
      name: z.string().trim().min(3).max(120),
      contactName: z.string().trim().max(120).default(""),
      contactEmail: z.string().trim().max(120).default(""),
      contactPhone: z.string().trim().max(20).default(""),
      color: z.string().trim().max(9).default("#0A2A5E"),
      monogram: z.string().trim().max(3).default(""),
      about: z.string().trim().max(600).default(""),
    }),
    response: z.object({ id: z.number(), slug: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const slug =
        args.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || `institution-${Date.now()}`;
      const existing = await db
        .select()
        .from(schema.onboardedInstitutions)
        .where(eq(schema.onboardedInstitutions.slug, slug));
      if (existing[0]) {
        throw new Error(
          "An institution portal with this name already exists. Change the name a little.",
        );
      }
      const inserted = await db
        .insert(schema.onboardedInstitutions)
        .values({
          slug,
          name: args.name,
          contactName: args.contactName,
          contactEmail: args.contactEmail,
          contactPhone: args.contactPhone,
          color: args.color || "#0A2A5E",
          monogram:
            args.monogram ||
            args.name
              .split(" ")
              .map((w) => w[0] ?? "")
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          about: args.about,
          status: "Sandbox",
        })
        .returning({ id: schema.onboardedInstitutions.id });
      const row = inserted[0];
      if (!row) throw new Error("Institution could not be created.");
      await db.insert(schema.institutionVersions).values({
        institutionId: row.id,
        label: "Portal created in the onboarding studio",
        snapshot: JSON.stringify({ ...args, slug, status: "Sandbox" }),
      });
      ctx.invalidateQueries();
      return { id: row.id, slug };
    },
  }),

  listOnboardedInstitutions: defineAction({
    description:
      "Lists onboarded institutions. Public callers see Live ones; the studio and platform can include Sandbox and pending ones.",
    request: z.object({ includeAll: z.boolean().default(false) }),
    response: z.object({
      institutions: z.array(
        z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
          contact_name: z.string(),
          contact_email: z.string(),
          contact_phone: z.string(),
          color: z.string(),
          monogram: z.string(),
          about: z.string(),
          status: z.string(),
          services_count: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.onboardedInstitutions)
        .orderBy(asc(schema.onboardedInstitutions.id));
      const services = await db.select().from(schema.builderServices);
      return {
        institutions: rows
          .filter((r) => args.includeAll || r.status === "Live")
          .map((r) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            contact_name: r.contactName,
            contact_email: r.contactEmail,
            contact_phone: r.contactPhone,
            color: r.color,
            monogram: r.monogram,
            about: r.about,
            status: r.status,
            services_count: services.filter((s) => s.institutionId === r.id)
              .length,
          })),
      };
    },
  }),

  getOnboardedInstitution: defineAction({
    description: "Loads one onboarded institution portal with its builder services.",
    request: z.object({ slug: z.string().trim().min(1).max(80) }),
    response: z.object({
      institution: z
        .object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
          contact_name: z.string(),
          contact_email: z.string(),
          contact_phone: z.string(),
          color: z.string(),
          monogram: z.string(),
          about: z.string(),
          status: z.string(),
        })
        .nullable(),
      services: z.array(
        z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
          blurb: z.string(),
          fee_usd: z.number(),
          processing_time: z.string(),
          checklist: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.onboardedInstitutions)
        .where(eq(schema.onboardedInstitutions.slug, args.slug))
        .limit(1);
      const row = rows[0];
      if (!row) return { institution: null, services: [] };
      const services = await db
        .select()
        .from(schema.builderServices)
        .where(eq(schema.builderServices.institutionId, row.id))
        .orderBy(asc(schema.builderServices.id));
      return {
        institution: {
          id: row.id,
          slug: row.slug,
          name: row.name,
          contact_name: row.contactName,
          contact_email: row.contactEmail,
          contact_phone: row.contactPhone,
          color: row.color,
          monogram: row.monogram,
          about: row.about,
          status: row.status,
        },
        services: services.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          blurb: s.blurb,
          fee_usd: s.feeUsd,
          processing_time: s.processingTime,
          checklist: s.checklist,
        })),
      };
    },
  }),

  addBuilderService: defineAction({
    description:
      "Service builder: adds a service to an onboarded institution with its fee, time, and checklist. Checklist items say whether they are required, and what turns them green, enforced the same way for every institution.",
    request: z.object({
      institutionId: z.number().int().positive(),
      name: z.string().trim().min(3).max(120),
      blurb: z.string().trim().max(300).default(""),
      feeUsd: z.number().int().min(0).max(1000).default(0),
      processingTime: z.string().trim().max(80).default(""),
      checklist: z
        .array(
          z.object({
            label: z.string().trim().min(2).max(200),
            required: z.boolean().default(true),
            greenRule: z.string().trim().max(300).default(""),
          }),
        )
        .max(15)
        .default([]),
    }),
    response: z.object({ id: z.number(), slug: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inst = await db
        .select()
        .from(schema.onboardedInstitutions)
        .where(eq(schema.onboardedInstitutions.id, args.institutionId))
        .limit(1);
      if (!inst[0]) throw new Error("Institution not found.");
      const slug =
        args.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || `service-${Date.now()}`;
      const inserted = await db
        .insert(schema.builderServices)
        .values({
          institutionId: args.institutionId,
          slug,
          name: args.name,
          blurb: args.blurb,
          feeUsd: args.feeUsd,
          processingTime: args.processingTime,
          checklist: JSON.stringify(args.checklist),
        })
        .returning({ id: schema.builderServices.id });
      const row = inserted[0];
      if (!row) throw new Error("Service could not be saved.");
      await db.insert(schema.institutionVersions).values({
        institutionId: args.institutionId,
        label: `Service added: ${args.name}`,
        snapshot: JSON.stringify({
          service: args.name,
          feeUsd: args.feeUsd,
          checklist: args.checklist,
        }),
      });
      ctx.invalidateQueries();
      return { id: row.id, slug };
    },
  }),

  setInstitutionStatus: defineAction({
    description:
      "Onboarding flow control: an institution requests approval, PortaGov approves it after verifying the institution and its officers, and only an approved institution can flip from Sandbox to Live. Every change is versioned.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Sandbox", "Pending approval", "Approved", "Live"]),
      note: z.string().trim().max(300).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.onboardedInstitutions)
        .where(eq(schema.onboardedInstitutions.id, args.id))
        .limit(1);
      const inst = rows[0];
      if (!inst) throw new Error("Institution not found.");
      if (args.status === "Live" && inst.status !== "Approved" && inst.status !== "Live") {
        throw new Error(
          "This institution is not approved yet. PortaGov must verify the institution and its officers before it can go live.",
        );
      }
      await db
        .update(schema.onboardedInstitutions)
        .set({ status: args.status })
        .where(eq(schema.onboardedInstitutions.id, args.id));
      await db.insert(schema.institutionVersions).values({
        institutionId: args.id,
        label: `Status changed to ${args.status}${args.note ? `: ${args.note}` : ""}`,
        snapshot: JSON.stringify({
          name: inst.name,
          color: inst.color,
          monogram: inst.monogram,
          about: inst.about,
          status: args.status,
        }),
      });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listInstitutionVersions: defineAction({
    description: "Version and change log for an onboarded institution.",
    request: z.object({ institutionId: z.number().int().positive() }),
    response: z.object({
      versions: z.array(
        z.object({
          id: z.number(),
          label: z.string(),
          snapshot: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.institutionVersions)
        .where(eq(schema.institutionVersions.institutionId, args.institutionId))
        .orderBy(desc(schema.institutionVersions.id));
      return {
        versions: rows.map((r) => ({
          id: r.id,
          label: r.label,
          snapshot: r.snapshot,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  rollbackInstitution: defineAction({
    description:
      "Rolls an institution portal back to the branding and status recorded in a chosen version, so a bad change never breaks the platform.",
    request: z.object({
      institutionId: z.number().int().positive(),
      versionId: z.number().int().positive(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const versions = await db
        .select()
        .from(schema.institutionVersions)
        .where(eq(schema.institutionVersions.id, args.versionId))
        .limit(1);
      const version = versions[0];
      if (!version || version.institutionId !== args.institutionId) {
        throw new Error("Version not found for this institution.");
      }
      let snap: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(version.snapshot);
        if (typeof parsed === "object" && parsed !== null) {
          snap = parsed as Record<string, unknown>;
        }
      } catch {
        throw new Error("That version's record is damaged and cannot be restored.");
      }
      const patch: {
        color?: string;
        monogram?: string;
        about?: string;
        status?: "Sandbox" | "Pending approval" | "Approved" | "Live";
      } = {};
      if (typeof snap.color === "string") patch.color = snap.color;
      if (typeof snap.monogram === "string") patch.monogram = snap.monogram;
      if (typeof snap.about === "string") patch.about = snap.about;
      if (
        snap.status === "Sandbox" ||
        snap.status === "Pending approval" ||
        snap.status === "Approved" ||
        snap.status === "Live"
      ) {
        patch.status = snap.status;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("That version holds no portal settings to restore.");
      }
      await db
        .update(schema.onboardedInstitutions)
        .set(patch)
        .where(eq(schema.onboardedInstitutions.id, args.institutionId));
      await db.insert(schema.institutionVersions).values({
        institutionId: args.institutionId,
        label: `Rolled back to version ${version.id} (${version.label})`,
        snapshot: version.snapshot,
      });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  assignHelpRequest: defineAction({
    description:
      "Support tickets: assigns a help ticket to a named support person, shown to the citizen with the reply time promise.",
    request: z.object({
      id: z.number().int().positive(),
      officerName: z.string().trim().min(2).max(120),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.helpRequests)
        .set({ assignedTo: args.officerName })
        .where(eq(schema.helpRequests.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listApplicationDocuments: defineAction({
    description:
      "Document verification: lists the documents attached to one released application so an officer can check each one.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      documents: z.array(
        z.object({
          id: z.number(),
          doc_type: z.string(),
          title: z.string(),
          doc_number: z.string(),
          expires_on: z.string(),
          validity: z.string(),
          has_file: z.boolean(),
          file_url: z.string(),
          content_type: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app) return { documents: [] };
      let ids: number[] = [];
      try {
        const parsed: unknown = JSON.parse(app.documentIds);
        if (Array.isArray(parsed)) {
          ids = parsed.filter((x): x is number => typeof x === "number");
        }
      } catch {
        ids = [];
      }
      const out = [];
      for (const id of ids) {
        const rows = await db
          .select()
          .from(schema.documents)
          .where(eq(schema.documents.id, id))
          .limit(1);
        const d = rows[0];
        if (!d) continue;
        out.push({
          id: d.id,
          doc_type: d.docType,
          title: d.title,
          doc_number: d.docNumber,
          expires_on: d.expiresOn,
          validity: docValidity(d.expiresOn),
          has_file: d.blobKey != null,
          file_url: d.blobKey ? await ctx.blobs.getUrl(d.blobKey) : "",
          content_type: d.contentType,
        });
      }
      return { documents: out };
    },
  }),

  setDocumentCheck: defineAction({
    description:
      "Document verification checklist: an officer ticks a document as real, clear, and valid. All three must be ticked before the application moves forward.",
    request: z.object({
      applicationId: z.number().int().positive(),
      documentId: z.number().int().positive(),
      officerName: z.string().trim().max(120).default(""),
      isReal: z.boolean(),
      isClear: z.boolean(),
      isValid: z.boolean(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.documentChecks)
        .where(eq(schema.documentChecks.applicationId, args.applicationId));
      const match = existing.find((c) => c.documentId === args.documentId);
      if (match) {
        await db
          .update(schema.documentChecks)
          .set({
            officer: args.officerName,
            isReal: args.isReal,
            isClear: args.isClear,
            isValid: args.isValid,
          })
          .where(eq(schema.documentChecks.id, match.id));
        ctx.invalidateQueries();
        return { id: match.id };
      }
      const inserted = await db
        .insert(schema.documentChecks)
        .values({
          applicationId: args.applicationId,
          documentId: args.documentId,
          officer: args.officerName,
          isReal: args.isReal,
          isClear: args.isClear,
          isValid: args.isValid,
        })
        .returning({ id: schema.documentChecks.id });
      const row = inserted[0];
      if (!row) throw new Error("Check could not be saved.");
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      if (apps[0] && args.isReal && args.isClear && args.isValid) {
        await logAudit(
          ctx,
          apps[0].institution,
          args.officerName,
          "Verified a document as real, clear and valid",
          apps[0].reference,
        );
      }
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listDocumentChecks: defineAction({
    description: "Lists document verification ticks for one application.",
    request: z.object({ applicationId: z.number().int().positive() }),
    response: z.object({
      checks: z.array(
        z.object({
          document_id: z.number(),
          officer: z.string(),
          is_real: z.boolean(),
          is_clear: z.boolean(),
          is_valid: z.boolean(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.documentChecks)
        .where(eq(schema.documentChecks.applicationId, args.applicationId));
      return {
        checks: rows.map((r) => ({
          document_id: r.documentId,
          officer: r.officer,
          is_real: r.isReal,
          is_clear: r.isClear,
          is_valid: r.isValid,
        })),
      };
    },
  }),

  getReconciliation: defineAction({
    description:
      "Payment reconciliation: matches every mobile money payment to its billing number automatically and flags mismatches for the platform.",
    request: z.object({}),
    response: z.object({
      rows: z.array(
        z.object({
          reference: z.string(),
          billing_number: z.string(),
          service_name: z.string(),
          total_due: z.number(),
          confirmed: z.number(),
          recorded_waiting: z.number(),
          billing_status: z.string(),
          flag: z.string(),
        }),
      ),
      total_flags: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const pays = await db.select().from(schema.payments);
      const rows = apps.map((a) => {
        const mine = pays.filter((p) => p.applicationId === a.id);
        const confirmed = mine
          .filter((p) => p.status === "Confirmed")
          .reduce((s, p) => s + p.amount, 0);
        const waiting = mine
          .filter((p) => p.status === "Recorded")
          .reduce((s, p) => s + p.amount, 0);
        const totalDue = a.serviceFee + a.priorityFee + a.deliveryFee;
        let flag = "";
        if (a.billingStatus === "Paid" && confirmed < totalDue) {
          flag = `Billing marked Paid but confirmed payments are $${confirmed} of $${totalDue}. Check this before anything is collected.`;
        } else if (confirmed > totalDue && totalDue > 0) {
          flag = `Overpaid: confirmed $${confirmed} against $${totalDue} due. Arrange the refund of the difference.`;
        } else if (waiting > 0 && a.billingStatus === "Unpaid") {
          flag = `$${waiting} recorded against this billing number and waiting for confirmation.`;
        } else if (
          a.billingStatus === "Part paid" &&
          confirmed >= totalDue &&
          totalDue > 0
        ) {
          flag = "Both plan parts look paid but the billing still says Part paid. Confirm the second payment.";
        }
        return {
          reference: a.reference,
          billing_number: a.billingNumber,
          service_name: a.serviceName,
          total_due: totalDue,
          confirmed,
          recorded_waiting: waiting,
          billing_status: a.billingStatus,
          flag,
        };
      });
      const withActivity = rows.filter(
        (r) => r.total_due > 0 || r.confirmed > 0 || r.flag,
      );
      return {
        rows: withActivity,
        total_flags: withActivity.filter((r) => r.flag).length,
      };
    },
  }),

  bulkMessageInstitution: defineAction({
    description:
      "Bulk message tool: an institution sends one update to every citizen waiting on its applications, or on one of its services, in a single action. Each citizen gets it on SMS, WhatsApp and in their application thread.",
    request: z.object({
      institution: z.string().trim().min(2).max(120),
      serviceName: z.string().trim().max(120).default(""),
      body: z.string().trim().min(5).max(1000),
    }),
    response: z.object({ notified: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.institution, args.institution));
      const targets = apps.filter(
        (a) =>
          a.released &&
          a.status !== "Completed" &&
          (!args.serviceName || a.serviceName === args.serviceName),
      );
      let notified = 0;
      for (const a of targets) {
        await notify(
          ctx,
          a.profileId,
          a.id,
          `Direct from ${a.institution}`,
          `${a.institution} (tracking number ${a.reference}): ${args.body}`,
        );
        notified += 1;
      }
      ctx.invalidateQueries();
      return { notified };
    },
  }),

  getBusinessWallet: defineAction({
    description: "Company wallet: one balance for a business, with its deposit and payment history.",
    request: z.object({ businessId: z.number().int().positive() }),
    response: z.object({
      balance: z.number(),
      transactions: z.array(
        z.object({
          id: z.number(),
          kind: z.string(),
          amount: z.number(),
          note: z.string(),
          application_ref: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const biz = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, args.businessId))
        .limit(1);
      const txns = await db
        .select()
        .from(schema.businessWalletTxns)
        .where(eq(schema.businessWalletTxns.businessId, args.businessId))
        .orderBy(desc(schema.businessWalletTxns.id));
      return {
        balance: biz[0]?.balance ?? 0,
        transactions: txns.map((t) => ({
          id: t.id,
          kind: t.kind,
          amount: t.amount,
          note: t.note,
          application_ref: t.applicationRef,
          created_at: t.createdAt.toISOString(),
        })),
      };
    },
  }),

  depositBusinessFunds: defineAction({
    description:
      "Company wallet: records a mobile money deposit into a business wallet, with its transaction reference.",
    request: z.object({
      businessId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      amount: z.number().int().min(1).max(100000),
      method: z.enum(["MTN MoMo", "Orange Money"]),
      transactionRef: z.string().trim().min(3).max(60),
    }),
    response: z.object({ balance: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const biz = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, args.businessId))
        .limit(1);
      if (!biz[0] || biz[0].profileId !== args.profileId) {
        throw new Error("That business is not on your account.");
      }
      const balance = biz[0].balance + args.amount;
      await db
        .update(schema.businesses)
        .set({ balance })
        .where(eq(schema.businesses.id, args.businessId));
      await db.insert(schema.businessWalletTxns).values({
        businessId: args.businessId,
        kind: "Deposit",
        amount: args.amount,
        note: `${args.method} deposit, transaction ${args.transactionRef}`,
      });
      ctx.invalidateQueries();
      return { balance };
    },
  }),

  payFromBusinessWallet: defineAction({
    description:
      "Company wallet: pays an employee's application billing from the business balance. The payment is recorded against the billing number like any mobile money payment, and the receipt belongs to that person's application.",
    request: z.object({
      businessId: z.number().int().positive(),
      profileId: z.number().int().positive(),
      applicationId: z.number().int().positive(),
    }),
    response: z.object({ balance: z.number(), amount: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const biz = await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, args.businessId))
        .limit(1);
      if (!biz[0] || biz[0].profileId !== args.profileId) {
        throw new Error("That business is not on your account.");
      }
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = apps[0];
      if (!app || app.businessId !== args.businessId) {
        throw new Error("That application is not filed under this business.");
      }
      const due =
        app.serviceFee + app.priorityFee + app.deliveryFee - app.amountPaid;
      if (due <= 0) throw new Error("This billing number is already fully paid.");
      if (biz[0].balance < due) {
        throw new Error(
          `The company wallet holds $${biz[0].balance} and this billing needs $${due}. Deposit the difference first.`,
        );
      }
      const balance = biz[0].balance - due;
      await db
        .update(schema.businesses)
        .set({ balance })
        .where(eq(schema.businesses.id, args.businessId));
      await db.insert(schema.payments).values({
        applicationId: app.id,
        method: "MTN MoMo",
        amount: due,
        payerPhone: biz[0].businessName,
        transactionRef: `WALLET-${app.billingNumber}`,
      });
      await db.insert(schema.businessWalletTxns).values({
        businessId: args.businessId,
        kind: "Payment",
        amount: due,
        note: `Paid billing ${app.billingNumber} for ${app.applicantName} (${app.serviceName}) from the company wallet`,
        applicationRef: app.reference,
      });
      await notify(
        ctx,
        app.profileId,
        app.id,
        "Payment recorded",
        `PortaGov: ${biz[0].businessName} paid $${due} from its company wallet against your billing number ${app.billingNumber} for ${app.serviceName}. Tracking number: ${app.reference}. PortaGov confirms company wallet payments like mobile money payments before release.`,
      );
      ctx.invalidateQueries();
      return { balance, amount: due };
    },
  }),

  createStaffAccount: defineAction({
    description:
      "Staff portals: the platform portal creates a PortaGov staff account with a role, permissions, and a sign-in password, so many people can help services run smoothly. The password is stored only as a salted hash.",
    request: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(20),
      role: z.enum([
        "Help desk",
        "Release officer",
        "Payments desk",
        "Support supervisor",
        "Platform admin",
      ]),
      scope: z.string().trim().max(120).default(""),
      password: z.string().min(8).max(200),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const salt = makeSalt();
      const inserted = await db
        .insert(schema.staffAccounts)
        .values({
          name: args.name,
          phone: args.phone,
          role: args.role,
          scope: args.scope,
          passwordHash: await hashPassword(args.password, salt),
          passwordSalt: salt,
        })
        .returning({ id: schema.staffAccounts.id });
      const row = inserted[0];
      if (!row) throw new Error("Staff account could not be created.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listStaffAccounts: defineAction({
    description: "Lists PortaGov staff accounts with roles, for the platform console and staff sign-in.",
    request: z.object({}),
    response: z.object({
      staff: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          phone: z.string(),
          role: z.string(),
          scope: z.string(),
          active: z.boolean(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.staffAccounts)
        .orderBy(asc(schema.staffAccounts.id));
      return {
        staff: rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          role: r.role,
          scope: r.scope,
          active: r.active,
        })),
      };
    },
  }),

  setStaffActive: defineAction({
    description: "Activates or suspends a staff account.",
    request: z.object({
      id: z.number().int().positive(),
      active: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.staffAccounts)
        .set({ active: args.active })
        .where(eq(schema.staffAccounts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  findStaff: defineAction({
    description:
      "Staff portal sign-in, step 1 of 2: finds an active staff account by name and phone and checks the account password. A correct password never signs anyone in on its own: it issues a one-time code that must be checked with verifyStaffCode before the staff session starts. Name and phone alone never sign anyone in.",
    request: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(20),
      password: z.string().min(1).max(200),
    }),
    response: z.object({
      staff: z
        .object({
          id: z.number(),
          name: z.string(),
          role: z.string(),
          scope: z.string(),
        })
        .nullable(),
      need_code: z.boolean(),
      staff_id: z.number(),
      demo_code: z.string(),
      locked: z.boolean(),
      minutes_left: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.staffAccounts)
        .where(eq(schema.staffAccounts.phone, args.phone));
      const match = rows.find(
        (r) => r.active && r.name.toLowerCase() === args.name.toLowerCase(),
      );
      const empty = {
        staff: null,
        need_code: false,
        staff_id: 0,
        demo_code: "",
        locked: false,
        minutes_left: 0,
      };
      if (!match) return empty;
      if (match.lockedUntil && match.lockedUntil.getTime() > Date.now()) {
        return {
          ...empty,
          locked: true,
          minutes_left: minutesLeft(match.lockedUntil),
        };
      }
      let verified = false;
      if (match.passwordHash) {
        const attempt = await hashPassword(args.password, match.passwordSalt);
        verified = attempt === match.passwordHash;
      }
      if (!verified) {
        const attempts = (match.failedAttempts ?? 0) + 1;
        if (attempts >= 5) {
          await db
            .update(schema.staffAccounts)
            .set({
              failedAttempts: 0,
              lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            })
            .where(eq(schema.staffAccounts.id, match.id));
          return { ...empty, locked: true, minutes_left: 15 };
        }
        await db
          .update(schema.staffAccounts)
          .set({ failedAttempts: attempts })
          .where(eq(schema.staffAccounts.id, match.id));
        return empty;
      }
      await db
        .update(schema.staffAccounts)
        .set({ failedAttempts: 0 })
        .where(eq(schema.staffAccounts.id, match.id));
      const code = await issueStaffCode(ctx, match.id);
      return {
        ...empty,
        need_code: true,
        staff_id: match.id,
        demo_code: code,
      };
    },
  }),

  verifyStaffCode: defineAction({
    description:
      "Staff portal sign-in, step 2 of 2: checks the one-time code issued by findStaff. Only a correct code starts the staff session. Five wrong codes lock the staff account for 15 minutes.",
    request: z.object({
      staffId: z.number().int().positive(),
      code: z.string().trim().min(6).max(6),
    }),
    response: z.object({
      ok: z.boolean(),
      staff: z
        .object({
          id: z.number(),
          name: z.string(),
          role: z.string(),
          scope: z.string(),
        })
        .nullable(),
      locked: z.boolean(),
      minutes_left: z.number(),
      attempts_left: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.staffAccounts)
        .where(eq(schema.staffAccounts.id, args.staffId))
        .limit(1);
      const row = rows[0];
      const failed = {
        ok: false,
        staff: null,
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
      if (!row || !row.active) return failed;
      if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
        return {
          ...failed,
          locked: true,
          minutes_left: minutesLeft(row.lockedUntil),
          attempts_left: 0,
        };
      }
      const ok = await checkStaffCode(ctx, row.id, args.code);
      if (!ok) {
        const attempts = (row.codeFailedAttempts ?? 0) + 1;
        if (attempts >= CODE_LOCKOUT_ATTEMPTS) {
          await db
            .update(schema.staffAccounts)
            .set({
              codeFailedAttempts: 0,
              lockedUntil: new Date(
                Date.now() + CODE_LOCKOUT_MINUTES * 60 * 1000,
              ),
            })
            .where(eq(schema.staffAccounts.id, row.id));
          return {
            ...failed,
            locked: true,
            minutes_left: CODE_LOCKOUT_MINUTES,
            attempts_left: 0,
          };
        }
        await db
          .update(schema.staffAccounts)
          .set({ codeFailedAttempts: attempts })
          .where(eq(schema.staffAccounts.id, row.id));
        return { ...failed, attempts_left: CODE_LOCKOUT_ATTEMPTS - attempts };
      }
      await db
        .update(schema.staffAccounts)
        .set({ codeFailedAttempts: 0 })
        .where(eq(schema.staffAccounts.id, row.id));
      return {
        ok: true,
        staff: {
          id: row.id,
          name: row.name,
          role: row.role,
          scope: row.scope,
        },
        locked: false,
        minutes_left: 0,
        attempts_left: CODE_LOCKOUT_ATTEMPTS,
      };
    },
  }),


  setAgentPermission: defineAction({
    description:
      "Share with my agent: the citizen chooses exactly what an approved agent can see and do for them, and can take it away at any time.",
    request: z.object({
      profileId: z.number().int().positive(),
      agentId: z.number().int().positive(),
      canViewStatus: z.boolean().default(true),
      canApply: z.boolean().default(false),
      canPay: z.boolean().default(false),
      canDocuments: z.boolean().default(false),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const agentRows = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, args.agentId));
      const agent = agentRows[0];
      if (!agent) throw new Error("That agent was not found.");
      const existing = await db
        .select()
        .from(schema.agentPermissions)
        .where(eq(schema.agentPermissions.profileId, args.profileId));
      const mine = existing.find((r) => r.agentId === args.agentId);
      if (mine) {
        await db
          .update(schema.agentPermissions)
          .set({
            canViewStatus: args.canViewStatus,
            canApply: args.canApply,
            canPay: args.canPay,
            canDocuments: args.canDocuments,
            active: true,
          })
          .where(eq(schema.agentPermissions.id, mine.id));
        ctx.invalidateQueries();
        return { id: mine.id };
      }
      const inserted = await db
        .insert(schema.agentPermissions)
        .values({
          profileId: args.profileId,
          agentId: args.agentId,
          agentName: agent.fullName,
          canViewStatus: args.canViewStatus,
          canApply: args.canApply,
          canPay: args.canPay,
          canDocuments: args.canDocuments,
        })
        .returning({ id: schema.agentPermissions.id });
      const row = inserted[0];
      if (!row) throw new Error("Permission could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listAgentPermissions: defineAction({
    description: "Lists the agent permissions a citizen has granted.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      permissions: z.array(
        z.object({
          id: z.number(),
          agent_id: z.number(),
          agent_name: z.string(),
          can_view_status: z.boolean(),
          can_apply: z.boolean(),
          can_pay: z.boolean(),
          can_documents: z.boolean(),
          active: z.boolean(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.agentPermissions)
        .where(eq(schema.agentPermissions.profileId, args.profileId));
      return {
        permissions: rows.map((r) => ({
          id: r.id,
          agent_id: r.agentId,
          agent_name: r.agentName,
          can_view_status: r.canViewStatus,
          can_apply: r.canApply,
          can_pay: r.canPay,
          can_documents: r.canDocuments,
          active: r.active,
        })),
      };
    },
  }),

  revokeAgentPermission: defineAction({
    description: "Takes an agent permission away at once.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.agentPermissions)
        .set({ active: false })
        .where(eq(schema.agentPermissions.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addShift: defineAction({
    description:
      "Shift and cover board: records who is on duty, who is off, and who covers when someone is away.",
    request: z.object({
      staffName: z.string().trim().min(2).max(120),
      date: z.string().trim().min(4).max(20),
      duty: z.string().trim().min(2).max(80).default("Help desk"),
      status: z.enum(["On duty", "Off", "Covering"]).default("On duty"),
      coversFor: z.string().trim().max(120).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.staffShifts)
        .values({
          staffName: args.staffName,
          date: args.date,
          duty: args.duty,
          status: args.status,
          coversFor: args.coversFor,
        })
        .returning({ id: schema.staffShifts.id });
      const row = inserted[0];
      if (!row) throw new Error("Shift could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listShifts: defineAction({
    description: "Lists the shift and cover board, newest dates first.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      shifts: z.array(
        z.object({
          id: z.number(),
          staff_name: z.string(),
          date: z.string(),
          duty: z.string(),
          status: z.string(),
          covers_for: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.staffShifts)
        .orderBy(desc(schema.staffShifts.id))
        .limit(args.limit);
      return {
        shifts: rows.map((r) => ({
          id: r.id,
          staff_name: r.staffName,
          date: r.date,
          duty: r.duty,
          status: r.status,
          covers_for: r.coversFor,
        })),
      };
    },
  }),

  deleteShift: defineAction({
    description: "Removes a shift entry.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.staffShifts)
        .where(eq(schema.staffShifts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addKbArticle: defineAction({
    description:
      "Knowledge base: staff add an approved answer once, and the PortaGov assistant uses it for every citizen after that.",
    request: z.object({
      topic: z.string().trim().min(2).max(80).default("General"),
      question: z.string().trim().min(5).max(300),
      answer: z.string().trim().min(5).max(1500),
      addedBy: z.string().trim().max(120).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.kbArticles)
        .values({
          topic: args.topic,
          question: args.question,
          answer: args.answer,
          addedBy: args.addedBy,
        })
        .returning({ id: schema.kbArticles.id });
      const row = inserted[0];
      if (!row) throw new Error("Knowledge base answer could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listKbArticles: defineAction({
    description: "Lists knowledge base answers the assistant learns from.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      articles: z.array(
        z.object({
          id: z.number(),
          topic: z.string(),
          question: z.string(),
          answer: z.string(),
          added_by: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.kbArticles)
        .orderBy(desc(schema.kbArticles.id))
        .limit(args.limit);
      return {
        articles: rows.map((r) => ({
          id: r.id,
          topic: r.topic,
          question: r.question,
          answer: r.answer,
          added_by: r.addedBy,
        })),
      };
    },
  }),

  deleteKbArticle: defineAction({
    description: "Removes a knowledge base answer.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.kbArticles)
        .where(eq(schema.kbArticles.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  recordQualityReview: defineAction({
    description:
      "Quality check: a senior officer marks a sample of an AI or staff reply as good or needing help, with a note.",
    request: z.object({
      targetLabel: z.string().trim().min(2).max(200),
      sample: z.string().trim().min(2).max(2000),
      mark: z.enum(["Good", "Needs help"]),
      note: z.string().trim().max(500).default(""),
      reviewer: z.string().trim().max(120).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.qualityReviews)
        .values({
          targetLabel: args.targetLabel,
          sample: args.sample,
          mark: args.mark,
          note: args.note,
          reviewer: args.reviewer,
        })
        .returning({ id: schema.qualityReviews.id });
      const row = inserted[0];
      if (!row) throw new Error("Quality review could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listQualityReviews: defineAction({
    description: "Lists quality check marks, newest first.",
    request: z.object({ limit: z.number().int().positive().max(100).default(50) }),
    response: z.object({
      reviews: z.array(
        z.object({
          id: z.number(),
          target_label: z.string(),
          sample: z.string(),
          mark: z.string(),
          note: z.string(),
          reviewer: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.qualityReviews)
        .orderBy(desc(schema.qualityReviews.id))
        .limit(args.limit);
      return {
        reviews: rows.map((r) => ({
          id: r.id,
          target_label: r.targetLabel,
          sample: r.sample,
          mark: r.mark,
          note: r.note,
          reviewer: r.reviewer,
          created_at: r.createdAt.toISOString(),
        })),
      };
    },
  }),

  requestMoreInfo: defineAction({
    description:
      "We need more information: an institution tells the citizen exactly what is missing, with a deadline, in their timeline and messages.",
    request: z.object({
      id: z.number().int().positive(),
      missing: z.string().trim().min(5).max(800),
      deadline: z.string().trim().min(4).max(60),
      officerName: z.string().trim().max(120).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id));
      const app = rows[0];
      if (!app) throw new Error("Application not found.");
      if (!app.released) {
        throw new Error("This application has not been released to the institution yet.");
      }
      const note = `${app.institution} needs more information for ${app.reference}. Missing: ${args.missing}. Please send it by ${args.deadline}. Open your application in PortaGov and add what is missing, or reply in the message thread on the application.`;
      await logEvent(
        ctx,
        app.id,
        "More information requested",
        note,
        args.officerName || app.institution,
      );
      await notify(ctx, app.profileId, app.id, "More information needed", note);
      if (args.officerName) {
        await logAudit(
          ctx,
          app.institution,
          args.officerName,
          `Requested more information: ${args.missing}. Deadline: ${args.deadline}.`,
          app.reference,
        );
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  confirmReceipt: defineAction({
    description:
      "Confirm receipt: the institution confirms it received the application, and the citizen sees it instantly in their timeline.",
    request: z.object({
      id: z.number().int().positive(),
      officerName: z.string().trim().max(120).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.id));
      const app = rows[0];
      if (!app) throw new Error("Application not found.");
      if (!app.released) {
        throw new Error("This application has not been released yet.");
      }
      if (app.status !== "Released to institution") {
        throw new Error(
          `Receipt can only be confirmed right after release. This application is already at: ${app.status}.`,
        );
      }
      await db
        .update(schema.applications)
        .set({ status: "Received by institution", updatedAt: new Date() })
        .where(eq(schema.applications.id, args.id));
      await logEvent(
        ctx,
        app.id,
        "Received by institution",
        `${app.institution} confirmed receipt of ${app.reference}. The citizen can see this confirmation now.`,
        args.officerName || app.institution,
      );
      await notify(
        ctx,
        app.profileId,
        app.id,
        "Status update",
        `${app.institution} confirmed they received your application ${app.reference}. They are working on it now and will update you here.`,
      );
      if (args.officerName) {
        await logAudit(ctx, app.institution, args.officerName, "Confirmed receipt", app.reference);
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getDailySummary: defineAction({
    description:
      "Daily morning summary: applications today, released, stuck, open tickets and payments, in one short view.",
    request: z.object({}),
    response: z.object({
      date_label: z.string(),
      applications_today: z.number(),
      released_total: z.number(),
      held_total: z.number(),
      stuck_over_24h: z.number(),
      open_tickets: z.number(),
      payments_today: z.number(),
      completed_total: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const payments = await db.select().from(schema.payments);
      const help = await db.select().from(schema.helpRequests);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const dayMs = 24 * 3600 * 1000;
      return {
        date_label: start.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        applications_today: apps.filter((a) => a.createdAt >= start).length,
        released_total: apps.filter((a) => a.released).length,
        held_total: apps.filter((a) => !a.released).length,
        stuck_over_24h: apps.filter(
          (a) => !a.released && Date.now() - a.createdAt.getTime() > dayMs,
        ).length,
        open_tickets: help.filter((h) => h.status !== "Answered").length,
        payments_today: payments.filter((p) => p.createdAt >= start).length,
        completed_total: apps.filter((a) => a.status === "Completed").length,
      };
    },
  }),

  getInstitutionDailySummary: defineAction({
    description:
      "Daily summary for one institution: how many applications came in today, how many were finished today, and how many are still waiting, all counted from the real applications for that day.",
    request: z.object({
      institution: z.string().trim().min(2).max(120),
    }),
    response: z.object({
      date_label: z.string(),
      date: z.string(),
      institution: z.string(),
      came_in_today: z.number(),
      finished_today: z.number(),
      still_waiting: z.number(),
      ready_for_collection: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const mine = apps.filter((a) => a.institution === args.institution);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const waitingStatuses = [
        "Received by institution",
        "In review at institution",
        "Appointment set",
        "More information needed",
      ];
      return {
        date_label: start.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        date: start.toISOString().slice(0, 10),
        institution: args.institution,
        came_in_today: mine.filter((a) => a.createdAt >= start).length,
        finished_today: mine.filter(
          (a) => a.status === "Completed" && a.updatedAt >= start,
        ).length,
        still_waiting: mine.filter(
          (a) => a.released && waitingStatuses.includes(a.status),
        ).length,
        ready_for_collection: mine.filter(
          (a) => a.status === "Ready for collection",
        ).length,
      };
    },
  }),

  generateMonthlyReport: defineAction({
    description:
      "Builds the monthly government report: per ministry counts, average processing times and trust scores, saved as a snapshot for government.",
    request: z.object({}),
    response: z.object({ id: z.number(), summary: z.string() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const ratingsRows = await db.select().from(schema.ratings);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthApps = apps.filter((a) => a.createdAt >= monthStart);
      const byInst = new Map<string, typeof monthApps>();
      for (const a of monthApps) {
        const list = byInst.get(a.institution) ?? [];
        list.push(a);
        byInst.set(a.institution, list);
      }
      const lines: string[] = [];
      for (const [inst, list] of byInst) {
        const done = list.filter((a) => a.status === "Completed");
        let avg = "n/a";
        if (done.length > 0) {
          const days =
            done.reduce(
              (sum, a) => sum + (a.updatedAt.getTime() - a.createdAt.getTime()) / 86400000,
              0,
            ) / done.length;
          avg = `${Math.max(0, Math.round(days * 10) / 10)} days`;
        }
        const instRatings = ratingsRows.filter((r) => r.institution === inst);
        const trust =
          instRatings.length > 0
            ? `${Math.round((instRatings.reduce((sum, r) => sum + (r.speed + r.clarity) / 2, 0) / instRatings.length / 5) * 100)} percent`
            : "no ratings yet";
        lines.push(
          `${inst}: ${list.length} applications, ${done.length} completed, average completion ${avg}, trust score ${trust}.`,
        );
      }
      const summary =
        lines.length > 0
          ? lines.join(" ")
          : "No applications were recorded this month.";
      const inserted = await db
        .insert(schema.reportSnapshots)
        .values({
          periodLabel: `Monthly government report, ${monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
          body: summary,
        })
        .returning({ id: schema.reportSnapshots.id });
      const row = inserted[0];
      if (!row) throw new Error("Monthly report could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id, summary };
    },
  }),

  exportGovernmentData: defineAction({
    description:
      "Data export for government: application data as CSV. Private names and phones are included only when allowed, and every export is written in the audit log.",
    request: z.object({
      includePrivate: z.boolean().default(false),
      exportedBy: z.string().trim().min(2).max(120),
    }),
    response: z.object({ csv: z.string(), rows: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .orderBy(asc(schema.applications.id));
      const profiles = await db.select().from(schema.profiles);
      const byId = new Map(profiles.map((p) => [p.id, p]));
      const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
      const header = args.includePrivate
        ? "reference,service,institution,status,county,applicant,phone,total_due,amount_paid,billing_status,created"
        : "reference,service,institution,status,county,total_due,amount_paid,billing_status,created";
      const lines = apps.map((a) => {
        const prof = byId.get(a.profileId);
        const base = [
          a.reference,
          a.serviceName,
          a.institution,
          a.status,
          prof?.county ?? "",
        ];
        const priv = args.includePrivate
          ? [prof?.fullName ?? "", prof?.phone ?? ""]
          : [];
        return [
          ...base,
          ...priv,
          a.serviceFee + a.priorityFee + a.deliveryFee,
          a.amountPaid,
          a.billingStatus,
          a.createdAt.toISOString().slice(0, 10),
        ]
          .map(esc)
          .join(",");
      });
      await logAudit(
        ctx,
        "PortaGov platform",
        args.exportedBy,
        `Exported government data: ${apps.length} applications, private data ${args.includePrivate ? "included with permission" : "excluded"}.`,
        "",
      );
      ctx.invalidateQueries();
      return { csv: [header, ...lines].join("\n"), rows: apps.length };
    },
  }),

  getComplaintInsights: defineAction({
    description:
      "Learn from complaints: the top complaint kinds this month, and the improvement notes PortaGov recorded because of them.",
    request: z.object({}),
    response: z.object({
      top: z.array(z.object({ kind: z.string(), count: z.number() })),
      improvements: z.array(
        z.object({ id: z.number(), note: z.string(), created_at: z.string() }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.complaints);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const counts = new Map<string, number>();
      for (const c of rows) {
        if (c.createdAt >= monthStart) {
          counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
        }
      }
      const top = [...counts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const notes = await db
        .select()
        .from(schema.improvementNotes)
        .orderBy(desc(schema.improvementNotes.id))
        .limit(20);
      return {
        top,
        improvements: notes.map((n) => ({
          id: n.id,
          note: n.note,
          created_at: n.createdAt.toISOString(),
        })),
      };
    },
  }),

  addImprovementNote: defineAction({
    description: "Records what PortaGov changed because of complaints, shown on the learn from complaints view.",
    request: z.object({ note: z.string().trim().min(5).max(500) }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.improvementNotes)
        .values({ note: args.note })
        .returning({ id: schema.improvementNotes.id });
      const row = inserted[0];
      if (!row) throw new Error("Note could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  simplifyText: defineAction({
    description:
      "Tell me in Liberian English: rewrites page text in simple Liberian English, keeping every fact, fee, date and name the same.",
    request: z.object({ text: z.string().trim().min(10).max(4000) }),
    response: z.object({ simple: z.string() }),
    async handler(ctx, args) {
      const simple = await ctx.inference.complete(
        `Rewrite the text below in simple Liberian English, the way people speak it every day in Liberia: short sentences, common words, warm and clear. Keep every fact exactly the same: names, fees, dates, times, places, phone numbers and steps must not change. Do not add anything new. If a word has no simple form, keep it and explain it shortly in brackets.

Text:
${args.text}`,
        { schema: z.string() },
      );
      return { simple };
    },
  }),


  getFeatureFlags: defineAction({
    description:
      "Feature switches: every PortaGov feature can be turned on or off from the platform console, without rebuilding. Unset features default to on.",
    request: z.object({}),
    response: z.object({ flags: z.record(z.string(), z.boolean()) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "feature_flags"));
      let flags: Record<string, boolean> = {};
      try {
        const raw = rows[0]?.value;
        if (raw) flags = JSON.parse(raw) as Record<string, boolean>;
      } catch {
        flags = {};
      }
      return { flags };
    },
  }),

  setFeatureFlag: defineAction({
    description: "Turns one feature on or off from the platform console.",
    request: z.object({
      key: z.string().trim().min(2).max(60),
      enabled: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "feature_flags"));
      let flags: Record<string, boolean> = {};
      try {
        const raw = rows[0]?.value;
        if (raw) flags = JSON.parse(raw) as Record<string, boolean>;
      } catch {
        flags = {};
      }
      flags[args.key] = args.enabled;
      const value = JSON.stringify(flags);
      if (rows[0]) {
        await db
          .update(schema.settings)
          .set({ value })
          .where(eq(schema.settings.key, "feature_flags"));
      } else {
        await db
          .insert(schema.settings)
          .values({ key: "feature_flags", value });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  joinQueue: defineAction({
    description:
      "Save my place in the queue: a walk-in citizen joins from home, gets a number for today at one office, and comes when it is almost their turn.",
    request: z.object({
      profileId: z.number().int().positive().nullable().default(null),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(20).default(""),
      office: z.string().trim().min(2).max(120),
    }),
    response: z.object({ id: z.number(), number: z.number(), ahead: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const today = new Date().toISOString().slice(0, 10);
      const todays = await db
        .select()
        .from(schema.queueTickets)
        .where(eq(schema.queueTickets.date, today));
      const mine = todays.filter((t) => t.office === args.office);
      const number = mine.length + 1;
      const ahead = mine.filter((t) => t.status === "Waiting").length;
      const inserted = await db
        .insert(schema.queueTickets)
        .values({
          profileId: args.profileId,
          name: args.name,
          phone: args.phone,
          office: args.office,
          number,
          date: today,
        })
        .returning({ id: schema.queueTickets.id });
      const row = inserted[0];
      if (!row) throw new Error("Could not join the queue.");
      ctx.invalidateQueries();
      return { id: row.id, number, ahead };
    },
  }),

  listQueueTickets: defineAction({
    description: "Lists today's queue tickets, optionally for one office.",
    request: z.object({ office: z.string().trim().max(120).default("") }),
    response: z.object({
      tickets: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          office: z.string(),
          number: z.number(),
          status: z.string(),
          date: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const today = new Date().toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(schema.queueTickets)
        .where(eq(schema.queueTickets.date, today))
        .orderBy(asc(schema.queueTickets.number));
      return {
        tickets: rows
          .filter((t) => !args.office || t.office === args.office)
          .map((t) => ({
            id: t.id,
            name: t.name,
            office: t.office,
            number: t.number,
            status: t.status,
            date: t.date,
          })),
      };
    },
  }),

  updateQueueTicket: defineAction({
    description: "Centre staff call the next number, or mark a queue ticket done or missed.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["Waiting", "Called", "Done", "Missed"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.queueTickets)
        .set({ status: args.status })
        .where(eq(schema.queueTickets.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setServiceClosed: defineAction({
    description:
      "Service closed for today switch: an institution closes one service for today with a note, and citizens see it instantly. Turning it off removes today's closure.",
    request: z.object({
      institution: z.string().trim().min(2).max(160),
      serviceId: z.string().trim().min(2).max(80),
      serviceName: z.string().trim().max(160).default(""),
      closed: z.boolean(),
      note: z.string().trim().max(300).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const today = new Date().toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(schema.serviceClosures)
        .where(eq(schema.serviceClosures.date, today));
      const existing = rows.find(
        (r) => r.institution === args.institution && r.serviceId === args.serviceId,
      );
      if (args.closed && !existing) {
        await db.insert(schema.serviceClosures).values({
          institution: args.institution,
          serviceId: args.serviceId,
          serviceName: args.serviceName,
          date: today,
          note: args.note,
        });
      }
      if (!args.closed && existing) {
        await db
          .delete(schema.serviceClosures)
          .where(eq(schema.serviceClosures.id, existing.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listServiceClosures: defineAction({
    description: "Lists today's service closures, so citizens see instantly what is closed and why.",
    request: z.object({}),
    response: z.object({
      closures: z.array(
        z.object({
          id: z.number(),
          institution: z.string(),
          service_id: z.string(),
          service_name: z.string(),
          date: z.string(),
          note: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const today = new Date().toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(schema.serviceClosures)
        .where(eq(schema.serviceClosures.date, today));
      return {
        closures: rows.map((r) => ({
          id: r.id,
          institution: r.institution,
          service_id: r.serviceId,
          service_name: r.serviceName,
          date: r.date,
          note: r.note,
        })),
      };
    },
  }),

  summarizeTicket: defineAction({
    description:
      "AI summary for staff: one short line per support ticket, service, payment state, and stage, so staff see the point before reading everything.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ summary: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.helpRequests)
        .where(eq(schema.helpRequests.id, args.id));
      const t = rows[0];
      if (!t) throw new Error("Ticket not found.");
      const profiles = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, t.phone));
      const prof = profiles[0];
      let appInfo = "The citizen has no application on file under this phone.";
      if (prof) {
        const apps = await db
          .select()
          .from(schema.applications)
          .where(eq(schema.applications.profileId, prof.id))
          .orderBy(desc(schema.applications.id))
          .limit(1);
        const a = apps[0];
        if (a) {
          appInfo = `Latest application: ${a.serviceName} (${a.reference}), status ${a.status}, ${a.released ? "released to the institution" : "still held by PortaGov"}, billing ${a.billingStatus}, paid $${a.amountPaid} of $${a.serviceFee + a.priorityFee + a.deliveryFee}.`;
        }
      }
      const summary = await ctx.inference.complete(
        `Write ONE short line for a PortaGov help desk officer summarizing this support ticket: the service involved, whether it is paid, and what stage it is at, in plain words, maximum 25 words. No greeting, no extra sentences.\n\nTicket topic: ${t.topic}\nCitizen message: ${t.message}\nCitizen record: ${appInfo}`,
        { schema: z.string() },
      );
      return { summary };
    },
  }),

  getMoneySummary: defineAction({
    description:
      "Money in, money out: total confirmed in today, total refunded, per ministry and per payment method, from live payment records.",
    request: z.object({}),
    response: z.object({
      today_in: z.number(),
      today_out: z.number(),
      total_in: z.number(),
      total_refunded: z.number(),
      by_method: z.array(z.object({ label: z.string(), in_amount: z.number(), out_amount: z.number() })),
      by_ministry: z.array(z.object({ label: z.string(), in_amount: z.number(), out_amount: z.number() })),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const pays = await db.select().from(schema.payments);
      const apps = await db.select().from(schema.applications);
      const instById = new Map(apps.map((a) => [a.id, a.institution]));
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const isIn = (p: (typeof pays)[number]) => p.status === "Confirmed";
      const isOut = (p: (typeof pays)[number]) => p.status === "Refunded";
      const sum = (list: typeof pays, f: (p: (typeof pays)[number]) => boolean) =>
        list.filter(f).reduce((acc, p) => acc + p.amount, 0);
      const group = (keyOf: (p: (typeof pays)[number]) => string) => {
        const map = new Map<string, { in_amount: number; out_amount: number }>();
        for (const p of pays) {
          const k = keyOf(p);
          const cur = map.get(k) ?? { in_amount: 0, out_amount: 0 };
          if (isIn(p)) cur.in_amount += p.amount;
          if (isOut(p)) cur.out_amount += p.amount;
          map.set(k, cur);
        }
        return [...map.entries()]
          .map(([label, v]) => ({ label, ...v }))
          .sort((a, b) => b.in_amount - a.in_amount);
      };
      return {
        today_in: sum(pays.filter((p) => p.createdAt >= start), isIn),
        today_out: sum(pays.filter((p) => p.createdAt >= start), isOut),
        total_in: sum(pays, isIn),
        total_refunded: sum(pays, isOut),
        by_method: group((p) => p.method),
        by_ministry: group((p) => instById.get(p.applicationId) ?? "Unknown"),
      };
    },
  }),

  getSlowestAlerts: defineAction({
    description:
      "Slowest service alert: compares average completion time per service against the promised days the citizen passes in, and flags every service running over its promise.",
    request: z.object({
      limits: z
        .array(
          z.object({
            serviceId: z.string().trim().min(1).max(80),
            serviceName: z.string().trim().min(1).max(160),
            maxDays: z.number().positive().max(365),
          }),
        )
        .max(60),
    }),
    response: z.object({
      alerts: z.array(
        z.object({
          service_name: z.string(),
          institution: z.string(),
          avg_days: z.number(),
          promised_days: z.number(),
          completed: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const alerts: {
        service_name: string;
        institution: string;
        avg_days: number;
        promised_days: number;
        completed: number;
      }[] = [];
      for (const lim of args.limits) {
        const done = apps.filter(
          (a) => a.serviceId === lim.serviceId && a.status === "Completed",
        );
        if (done.length === 0) continue;
        const avg =
          done.reduce(
            (acc, a) => acc + (a.updatedAt.getTime() - a.createdAt.getTime()) / 86400000,
            0,
          ) / done.length;
        if (avg > lim.maxDays) {
          alerts.push({
            service_name: lim.serviceName,
            institution: done[0]?.institution ?? "",
            avg_days: Math.round(avg * 10) / 10,
            promised_days: lim.maxDays,
            completed: done.length,
          });
        }
      }
      return { alerts: alerts.sort((a, b) => b.avg_days - a.avg_days) };
    },
  }),

  askAssistant: defineAction({
    description:
      "PortaGov AI assistant: answers a citizen's question from the service information the page provides, and says which responsible team or institution must take it when it cannot answer, so the question can be routed into a ticket.",
    request: z.object({
      question: z.string().trim().min(3).max(600),
      context: z.string().trim().max(6000).default(""),
    }),
    response: z.object({
      answer: z.string(),
      route: z.string(),
      needs_ticket: z.boolean(),
    }),
    async handler(ctx, args) {
      const result = await ctx.inference.complete(
        `You are the PortaGov assistant, helping a citizen in Liberia use government services on PortaGov. Answer in plain, simple English, short and clear. Use ONLY the information in the context below. If the context does not hold the answer, do not guess: set needs_ticket to true and name the responsible team or institution in route, choosing from: Help desk, Payments desk, Release team, or the institution named in the context. When you can answer fully, set needs_ticket to false and route to "None".\n\nContext:\n${args.context || "No context was provided."}\n\nCitizen question: ${args.question}`,
        {
          schema: z.object({
            answer: z.string(),
            route: z.string(),
            needs_ticket: z.boolean(),
          }),
        },
      );
      return result;
    },
  }),

  listInstitutionServices: defineAction({
    description:
      "Personal institution portal: the institution's own fee and time settings for its services, which override the PortaGov catalogue where set.",
    request: z.object({ institution: z.string().trim().max(120).default("") }),
    response: z.object({
      settings: z.array(
        z.object({
          id: z.number(),
          institution: z.string(),
          service_id: z.string(),
          fee_usd: z.number().nullable(),
          processing_time: z.string(),
          note: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.institutionServiceSettings)
        .orderBy(asc(schema.institutionServiceSettings.id));
      return {
        settings: rows
          .filter((r) => !args.institution || r.institution === args.institution)
          .map((r) => ({
            id: r.id,
            institution: r.institution,
            service_id: r.serviceId,
            fee_usd: r.feeUsd,
            processing_time: r.processingTime,
            note: r.note,
          })),
      };
    },
  }),

  setInstitutionService: defineAction({
    description:
      "Personal institution portal: sets an institution's own fee or processing time for one of its services.",
    request: z.object({
      institution: z.string().trim().min(2).max(120),
      serviceId: z.string().trim().min(1).max(60),
      feeUsd: z.number().int().min(0).max(1000).nullable().default(null),
      processingTime: z.string().trim().max(80).default(""),
      note: z.string().trim().max(300).default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.institutionServiceSettings)
        .where(
          eq(schema.institutionServiceSettings.institution, args.institution),
        );
      const match = existing.find((r) => r.serviceId === args.serviceId);
      if (match) {
        await db
          .update(schema.institutionServiceSettings)
          .set({
            feeUsd: args.feeUsd,
            processingTime: args.processingTime,
            note: args.note,
            updatedAt: new Date(),
          })
          .where(eq(schema.institutionServiceSettings.id, match.id));
        ctx.invalidateQueries();
        return { id: match.id };
      }
      const inserted = await db
        .insert(schema.institutionServiceSettings)
        .values({
          institution: args.institution,
          serviceId: args.serviceId,
          feeUsd: args.feeUsd,
          processingTime: args.processingTime,
          note: args.note,
        })
        .returning({ id: schema.institutionServiceSettings.id });
      const row = inserted[0];
      if (!row) throw new Error("Setting could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  listReplyTemplates: defineAction({
    description: "Template reply library for an institution's officers.",
    request: z.object({ institution: z.string().trim().max(120).default("") }),
    response: z.object({
      templates: z.array(
        z.object({
          id: z.number(),
          institution: z.string(),
          title: z.string(),
          body: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.replyTemplates)
        .orderBy(asc(schema.replyTemplates.id));
      return {
        templates: rows
          .filter((r) => !args.institution || r.institution === args.institution)
          .map((r) => ({
            id: r.id,
            institution: r.institution,
            title: r.title,
            body: r.body,
          })),
      };
    },
  }),

  addReplyTemplate: defineAction({
    description: "Adds a reply template to an institution's library.",
    request: z.object({
      institution: z.string().trim().min(2).max(120),
      title: z.string().trim().min(2).max(80),
      body: z.string().trim().min(5).max(1000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.replyTemplates)
        .values({
          institution: args.institution,
          title: args.title,
          body: args.body,
        })
        .returning({ id: schema.replyTemplates.id });
      const row = inserted[0];
      if (!row) throw new Error("Template could not be saved.");
      ctx.invalidateQueries();
      return { id: row.id };
    },
  }),

  deleteReplyTemplate: defineAction({
    description: "Removes a reply template.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.replyTemplates)
        .where(eq(schema.replyTemplates.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listInstitutionAppointments: defineAction({
    description:
      "Personal institution portal: the institution's own appointment calendar, appointments booked on its released applications.",
    request: z.object({ institution: z.string().trim().min(2).max(120) }),
    response: z.object({
      appointments: z.array(
        appointmentShape.extend({
          service_name: z.string(),
          applicant_name: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.institution, args.institution));
      /* Platform first: an institution only ever sees applications
         PortaGov has released to it. An appointment booked on an
         application the platform is still holding must not leak the
         applicant to the institution through the calendar, so only
         released applications are in the map at all. */
      const byId = new Map(apps.filter((a) => a.released).map((a) => [a.id, a]));
      const rows = await db.select().from(schema.appointments);
      return {
        appointments: rows
          .filter((r) => r.applicationId != null && byId.has(r.applicationId))
          .map((r) => {
            const app = byId.get(r.applicationId ?? 0);
            return {
              id: r.id,
              profile_id: r.profileId,
              application_id: r.applicationId,
              application_ref: app?.reference ?? "",
              kind: r.kind,
              group_size: r.groupSize,
              ticket: r.ticket,
              office: r.office,
              date: r.date,
              time_slot: r.timeSlot,
              status: r.status,
              created_at: r.createdAt.toISOString(),
              service_name: app?.serviceName ?? "",
              applicant_name: app?.applicantName ?? "",
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  }),

  listInstitutionPayments: defineAction({
    description:
      "Personal institution portal: payments recorded against this institution's applications only, kept separate from every other ministry.",
    request: z.object({ institution: z.string().trim().min(2).max(120) }),
    response: z.object({
      payments: z.array(paymentShape),
      total_confirmed: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.institution, args.institution));
      /* Platform first, same rule as the appointment calendar: payment
         happens BEFORE release, so a payment on a held application
         must not leak the applicant to the institution. Only released
         applications are in the map at all. */
      const byId = new Map(apps.filter((a) => a.released).map((a) => [a.id, a]));
      const rows = await db
        .select()
        .from(schema.payments)
        .orderBy(desc(schema.payments.id));
      const mine = rows.filter((r) => byId.has(r.applicationId));
      return {
        payments: mine.map((r) => ({
          id: r.id,
          application_id: r.applicationId,
          application_ref: byId.get(r.applicationId)?.reference ?? "",
          billing_number: byId.get(r.applicationId)?.billingNumber ?? "",
          service_name: byId.get(r.applicationId)?.serviceName ?? "",
          method: r.method,
          amount: r.amount,
          payer_phone: r.payerPhone,
          transaction_ref: r.transactionRef,
          status: r.status,
          refund_reason: r.refundReason,
          created_at: r.createdAt.toISOString(),
        })),
        total_confirmed: mine
          .filter((r) => r.status === "Confirmed")
          .reduce((s, r) => s + r.amount, 0),
      };
    },
  }),

  getServiceTimings: defineAction({
    description:
      "Real how-long-it-takes: average days from application to completion per service, from finished applications only.",
    request: z.object({}),
    response: z.object({
      timings: z.array(
        z.object({
          service_id: z.string(),
          completed: z.number(),
          avg_days: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.status, "Completed"));
      const byService = new Map<string, { days: number; count: number }>();
      for (const r of rows) {
        const cur = byService.get(r.serviceId) ?? { days: 0, count: 0 };
        cur.days += Math.max(
          0,
          (r.updatedAt.getTime() - r.createdAt.getTime()) / 86400000,
        );
        cur.count += 1;
        byService.set(r.serviceId, cur);
      }
      return {
        timings: [...byService.entries()].map(([service_id, v]) => ({
          service_id,
          completed: v.count,
          avg_days: Math.round((v.days / v.count) * 10) / 10,
        })),
      };
    },
  }),

  getSystemHealth: defineAction({
    description:
      "Super-admin health screen data: payments, message channels, queues and platform counts, with a check time.",
    request: z.object({}),
    response: z.object({
      checked_at: z.string(),
      release_mode: z.string(),
      profiles: z.number(),
      applications: z.number(),
      held: z.number(),
      payments_recorded: z.number(),
      payments_confirmed: z.number(),
      payments_refund_requested: z.number(),
      messages_total: z.number(),
      sms_count: z.number(),
      whatsapp_count: z.number(),
      email_count: z.number(),
      certificates: z.number(),
      open_complaints: z.number(),
      open_help: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [profiles, apps, pays, msgs, certs, complaints, help] =
        await Promise.all([
          db.select().from(schema.profiles),
          db.select().from(schema.applications),
          db.select().from(schema.payments),
          db.select().from(schema.messages),
          db.select().from(schema.certificates),
          db.select().from(schema.complaints),
          db.select().from(schema.helpRequests),
        ]);
      const modeRows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "release_mode"))
        .limit(1);
      return {
        checked_at: new Date().toISOString(),
        release_mode: modeRows[0]?.value ?? "manual",
        profiles: profiles.length,
        applications: apps.length,
        held: apps.filter((a) => !a.released).length,
        payments_recorded: pays.filter((p) => p.status === "Recorded").length,
        payments_confirmed: pays.filter((p) => p.status === "Confirmed").length,
        payments_refund_requested: pays.filter(
          (p) => p.status === "Refund requested",
        ).length,
        messages_total: msgs.length,
        sms_count: msgs.filter((m) => m.channel === "SMS").length,
        whatsapp_count: msgs.filter((m) => m.channel === "WhatsApp").length,
        email_count: msgs.filter((m) => m.channel === "Email").length,
        certificates: certs.length,
        open_complaints: complaints.filter((c) => c.status !== "Resolved").length,
        open_help: help.filter((h) => h.status !== "Answered").length,
      };
    },
  }),

  getFraudScan: defineAction({
    description:
      "Fraud and duplicate detector: flags reused transaction references, one payer phone serving many accounts, the same person and service open under different accounts, and payments left unconfirmed.",
    request: z.object({}),
    response: z.object({
      flags: z.array(
        z.object({ kind: z.string(), detail: z.string() }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const flags: { kind: string; detail: string }[] = [];
      const pays = await db.select().from(schema.payments);
      const byRef = new Map<string, number>();
      for (const p of pays) {
        byRef.set(p.transactionRef, (byRef.get(p.transactionRef) ?? 0) + 1);
      }
      for (const [ref, count] of byRef) {
        if (count > 1) {
          flags.push({
            kind: "Duplicate transaction reference",
            detail: `Transaction reference ${ref} was used ${count} times. One mobile money transaction must pay one billing number only. Check before confirming.`,
          });
        }
      }
      const appsForPayer = await db.select().from(schema.applications);
      const profileByApp = new Map(appsForPayer.map((a) => [a.id, a.profileId]));
      const byPayer = new Map<string, Set<number>>();
      for (const p of pays) {
        const set = byPayer.get(p.payerPhone) ?? new Set<number>();
        const pid = profileByApp.get(p.applicationId);
        if (pid) set.add(pid);
        byPayer.set(p.payerPhone, set);
      }
      for (const [phone, set] of byPayer) {
        if (set.size >= 3) {
          flags.push({
            kind: "One payer phone, many accounts",
            detail: `Payments from phone ${phone} were recorded for ${set.size} different citizen accounts. Paying for family is normal, but a long list deserves a look.`,
          });
        }
      }
      const apps = await db.select().from(schema.applications);
      const byPersonService = new Map<string, Set<number>>();
      for (const a of apps) {
        if (a.status === "Completed") continue;
        const key = `${a.applicantName.toLowerCase()}|${a.serviceId}`;
        const set = byPersonService.get(key) ?? new Set<number>();
        set.add(a.profileId);
        byPersonService.set(key, set);
      }
      for (const [key, set] of byPersonService) {
        if (set.size > 1) {
          const [name, service] = key.split("|");
          flags.push({
            kind: "Possible duplicate person",
            detail: `${name} has open applications for ${service} under ${set.size} different accounts. It may be two people with the same name, or one person with two accounts.`,
          });
        }
      }
      const stale = pays.filter(
        (p) =>
          p.status === "Recorded" &&
          Date.now() - p.createdAt.getTime() > 3 * 86400000,
      );
      if (stale.length > 0) {
        flags.push({
          kind: "Payments waiting too long",
          detail: `${stale.length} recorded payment(s) have waited over 3 days for confirmation. Confirm or reject them so citizens are not stuck.`,
        });
      }
      return { flags };
    },
  }),

  runBackupCheck: defineAction({
    description:
      "Daily backup and restore check: counts every table, verifies the data can be read back, and stores the result with its time.",
    request: z.object({}),
    response: z.object({
      checked_at: z.string(),
      total_rows: z.number(),
      tables: z.array(z.object({ name: z.string(), rows: z.number() })),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const counters: [string, () => Promise<unknown[]>][] = [
        ["profiles", async () => await db.select().from(schema.profiles)],
        ["applications", async () => await db.select().from(schema.applications)],
        ["documents", async () => await db.select().from(schema.documents)],
        ["appointments", async () => await db.select().from(schema.appointments)],
        ["payments", async () => await db.select().from(schema.payments)],
        ["messages", async () => await db.select().from(schema.messages)],
        ["certificates", async () => await db.select().from(schema.certificates)],
        ["family_members", async () => await db.select().from(schema.familyMembers)],
        ["businesses", async () => await db.select().from(schema.businesses)],
      ];
      const tables: { name: string; rows: number }[] = [];
      let total = 0;
      for (const [name, count] of counters) {
        const rows = await count();
        tables.push({ name, rows: rows.length });
        total += rows.length;
      }
      const result = {
        checked_at: new Date().toISOString(),
        total_rows: total,
        tables,
      };
      const existing = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "backup_check"))
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.settings)
          .set({ value: JSON.stringify(result) })
          .where(eq(schema.settings.key, "backup_check"));
      } else {
        await db.insert(schema.settings).values({
          key: "backup_check",
          value: JSON.stringify(result),
        });
      }
      ctx.invalidateQueries();
      return result;
    },
  }),

  getBackupStatus: defineAction({
    description: "Reads the last backup and restore check result.",
    request: z.object({}),
    response: z.object({
      checked_at: z.string(),
      total_rows: z.number(),
      tables: z.array(z.object({ name: z.string(), rows: z.number() })),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, "backup_check"))
        .limit(1);
      const raw = rows[0]?.value;
      if (!raw) return { checked_at: "", total_rows: 0, tables: [] };
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "checked_at" in parsed &&
          "total_rows" in parsed &&
          "tables" in parsed
        ) {
          return parsed as {
            checked_at: string;
            total_rows: number;
            tables: { name: string; rows: number }[];
          };
        }
      } catch {
        // A damaged record reads as no check yet.
      }
      return { checked_at: "", total_rows: 0, tables: [] };
    },
  }),

  checkDocumentValidity: defineAction({
    description:
      "Document update rule: checks every wallet document's validity, and when one is expired or close to expiry, messages the citizen on SMS, WhatsApp and email (when they have one) with how to renew and update it. Each state is reported once.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      checked: z.number(),
      problems: z.array(
        z.object({
          document_id: z.number(),
          title: z.string(),
          doc_type: z.string(),
          expires_on: z.string(),
          validity: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const profiles = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.profileId))
        .limit(1);
      const profile = profiles[0];
      const docs = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.profileId, args.profileId));
      const problems: {
        document_id: number;
        title: string;
        doc_type: string;
        expires_on: string;
        validity: string;
      }[] = [];
      for (const d of docs) {
        if (d.status !== "Active") continue;
        const validity = docValidity(d.expiresOn);
        if (validity !== "Expired" && validity !== "Expiring soon") continue;
        problems.push({
          document_id: d.id,
          title: d.title,
          doc_type: d.docType,
          expires_on: d.expiresOn,
          validity,
        });
        if (profile && d.validityNotified !== validity) {
          const body =
            validity === "Expired"
              ? `PortaGov: Your document ${d.title} expired on ${d.expiresOn}. An expired document can be refused, so renew it now, then update it in your wallet so every service uses the new one. Open PortaGov, go to Document wallet, and tap Update on ${d.title}. Your old version stays recorded, replaced by the new one.`
              : `PortaGov: Your document ${d.title} will expire on ${d.expiresOn}, soon. Renew it before that day, then update it in your wallet so your services are never blocked. Open PortaGov, go to Document wallet, and tap Update on ${d.title}.`;
          await notify(ctx, profile.id, null, "Document needs updating", body);
          if (profile.email) {
            await db.insert(schema.messages).values({
              profileId: profile.id,
              applicationId: null,
              channel: "Email" as const,
              kind: "Document needs updating",
              body,
            });
          }
          await db
            .update(schema.documents)
            .set({ validityNotified: validity })
            .where(eq(schema.documents.id, d.id));
        }
      }
      ctx.invalidateQueries();
      return { checked: docs.length, problems };
    },
  }),

  createConsentCode: defineAction({
    description:
      "Help-a-neighbour mode: the citizen makes a one-time consent code to give an agent or trusted person who will apply for them. The help is recorded.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ demo_code: z.string() }),
    async handler(ctx, args) {
      const code = await issueCode(ctx, args.profileId, "agent-consent");
      return { demo_code: code };
    },
  }),

  verifyAgentConsent: defineAction({
    description:
      "Checks a citizen's consent code for help-a-neighbour mode and returns who the agent may help, so the application is filed under the citizen with the help recorded.",
    request: z.object({
      phone: z.string().trim().min(7).max(20),
      code: z.string().trim().min(6).max(6),
    }),
    response: z.object({
      ok: z.boolean(),
      profile_id: z.number(),
      full_name: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.phone, args.phone))
        .limit(1);
      const row = rows[0];
      if (!row) return { ok: false, profile_id: 0, full_name: "" };
      const ok = await checkCode(ctx, row.id, "agent-consent", args.code);
      if (!ok) return { ok: false, profile_id: 0, full_name: "" };
      return { ok: true, profile_id: row.id, full_name: row.fullName };
    },
  }),

  listAuditLog: defineAction({
    description:
      "Staff audit: who did what at an institution, newest first, so every status change and message has a name on it.",
    request: z.object({
      institution: z.string().trim().max(120).default(""),
      limit: z.number().int().positive().max(100).default(50),
    }),
    response: z.object({
      entries: z.array(
        z.object({
          id: z.number(),
          institution: z.string(),
          actor: z.string(),
          action: z.string(),
          application_ref: z.string(),
          created_at: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.auditLog)
        .orderBy(desc(schema.auditLog.id))
        .limit(args.limit);
      return {
        entries: rows
          .filter((r) => !args.institution || r.institution === args.institution)
          .map((r) => ({
            id: r.id,
            institution: r.institution,
            actor: r.actor,
            action: r.action,
            application_ref: r.applicationRef,
            created_at: r.createdAt.toISOString(),
          })),
      };
    },
  }),

  getCountyLeaderboard: defineAction({
    description:
      "Public leaderboard for good work: counties ranked by completed applications and speed, plus the most trusted ministry from citizen ratings. No private data.",
    request: z.object({}),
    response: z.object({
      counties: z.array(
        z.object({
          county: z.string(),
          applications: z.number(),
          completed: z.number(),
          avg_days: z.number(),
        }),
      ),
      fastest_county: z.string(),
      most_trusted_ministry: z.string(),
      most_trusted_score: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const profiles = await db.select().from(schema.profiles);
      const countyByProfile = new Map(profiles.map((p) => [p.id, p.county]));
      const byCounty = new Map<
        string,
        { applications: number; completed: number; days: number }
      >();
      for (const a of apps) {
        const county = countyByProfile.get(a.profileId) ?? "Unknown";
        const cur = byCounty.get(county) ?? {
          applications: 0,
          completed: 0,
          days: 0,
        };
        cur.applications += 1;
        if (a.status === "Completed") {
          cur.completed += 1;
          cur.days += Math.max(
            0,
            (a.updatedAt.getTime() - a.createdAt.getTime()) / 86400000,
          );
        }
        byCounty.set(county, cur);
      }
      const counties = [...byCounty.entries()]
        .map(([county, v]) => ({
          county,
          applications: v.applications,
          completed: v.completed,
          avg_days:
            v.completed > 0 ? Math.round((v.days / v.completed) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.completed - a.completed);
      const fastest = counties
        .filter((c) => c.completed > 0)
        .sort((a, b) => a.avg_days - b.avg_days)[0];
      const ratings = await db.select().from(schema.ratings);
      const byInst = new Map<string, { sum: number; count: number }>();
      for (const r of ratings) {
        const cur = byInst.get(r.institution) ?? { sum: 0, count: 0 };
        cur.sum += (r.speed + r.clarity) / 2;
        cur.count += 1;
        byInst.set(r.institution, cur);
      }
      const trusted = [...byInst.entries()]
        .map(([institution, v]) => ({
          institution,
          score: Math.round((v.sum / v.count / 5) * 100),
        }))
        .sort((a, b) => b.score - a.score)[0];
      return {
        counties,
        fastest_county: fastest?.county ?? "",
        most_trusted_ministry: trusted?.institution ?? "",
        most_trusted_score: trusted?.score ?? 0,
      };
    },
  }),

  getReport: defineAction({
    description:
      "Builds the government report summary: totals by status, institution, service, channel, payments, and appointments.",
    request: z.object({}),
    response: z.object({
      total_applications: z.number(),
      total_profiles: z.number(),
      total_payments: z.number(),
      total_appointments: z.number(),
      by_status: z.array(z.object({ label: z.string(), count: z.number() })),
      by_institution: z.array(
        z.object({ label: z.string(), count: z.number() }),
      ),
      by_service: z.array(z.object({ label: z.string(), count: z.number() })),
      by_channel: z.array(z.object({ label: z.string(), count: z.number() })),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const apps = await db.select().from(schema.applications);
      const profiles = await db.select().from(schema.profiles);
      const payments = await db.select().from(schema.payments);
      const appointments = await db.select().from(schema.appointments);
      const tally = (values: string[]) => {
        const map = new Map<string, number>();
        for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
        return [...map.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);
      };
      return {
        total_applications: apps.length,
        total_profiles: profiles.length,
        total_payments: payments.length,
        total_appointments: appointments.length,
        by_status: tally(apps.map((a) => a.status)),
        by_institution: tally(apps.map((a) => a.institution)),
        by_service: tally(apps.map((a) => a.serviceName)),
        by_channel: tally(apps.map((a) => a.channel)),
      };
    },
  }),
} satisfies ActionsModule;
