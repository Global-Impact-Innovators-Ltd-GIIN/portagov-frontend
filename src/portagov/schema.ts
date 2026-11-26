// PortaGov schema: citizen profiles, applications, document wallet,
// appointments, payments, and family members.
import { integer, sqliteTable, text } from "./db";

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  placeOfBirth: text("place_of_birth").notNull(),
  sex: text("sex", { enum: ["Female", "Male"] }).notNull(),
  address: text("address").notNull(),
  county: text("county").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email").notNull().default(""),
  photo: text("photo").notNull().default(""),
  emergencyName: text("emergency_name").notNull(),
  emergencyPhone: text("emergency_phone").notNull(),
  nationalId: text("national_id").notNull().default(""),
  hasNationalId: integer("has_national_id", { mode: "boolean" })
    .notNull()
    .default(true),
  altIdType: text("alt_id_type").notNull().default(""),
  altIdNumber: text("alt_id_number").notNull().default(""),
  witnessName: text("witness_name").notNull().default(""),
  witnessPhone: text("witness_phone").notNull().default(""),
  country: text("country").notNull().default("Liberia"),
  nationality: text("nationality").notNull().default("Liberia"),
  timezone: text("timezone").notNull().default(""),
  language: text("language").notNull().default("English"),
  passwordHash: text("password_hash").notNull().default(""),
  passwordSalt: text("password_salt").notNull().default(""),
  phoneVerified: integer("phone_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  twoFactor: integer("two_factor", { mode: "boolean" })
    .notNull()
    .default(false),
  idCheckedByOfficer: integer("id_checked_by_officer", { mode: "boolean" })
    .notNull()
    .default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  codeFailedAttempts: integer("code_failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  sessionsRevokedAt: integer("sessions_revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  applicantName: text("applicant_name").notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  institution: text("institution").notNull(),
  status: text("status", {
    enum: [
      "Submitted to PortaGov",
      "Under review by PortaGov",
      "Released to institution",
      "Received by institution",
      "In review at institution",
      "Appointment set",
      "Ready for collection",
      "Completed",
      "More information needed",
    ],
  })
    .notNull()
    .default("Submitted to PortaGov"),
  released: integer("released", { mode: "boolean" }).notNull().default(false),
  channel: text("channel", {
    enum: ["Self service", "Agent assisted", "Diaspora"],
  })
    .notNull()
    .default("Self service"),
  onBehalfOf: text("on_behalf_of").notNull().default(""),
  priority: text("priority", {
    enum: ["Standard", "Fast-track", "Emergency"],
  })
    .notNull()
    .default("Standard"),
  priorityFee: integer("priority_fee").notNull().default(0),
  serviceFee: integer("service_fee").notNull().default(0),
  collectionChoice: text("collection_choice").notNull().default(""),
  embassy: text("embassy").notNull().default(""),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  billingNumber: text("billing_number").notNull().default(""),
  billingStatus: text("billing_status", { enum: ["Unpaid", "Paid", "Part paid"] })
    .notNull()
    .default("Unpaid"),
  amountPaid: integer("amount_paid").notNull().default(0),
  pickupCode: text("pickup_code").notNull().default(""),
  businessId: integer("business_id"),
  paymentPlan: integer("payment_plan", { mode: "boolean" })
    .notNull()
    .default(false),
  proxyName: text("proxy_name").notNull().default(""),
  proxyId: text("proxy_id").notNull().default(""),
  proxyCode: text("proxy_code").notNull().default(""),
  diasporaCountry: text("diaspora_country").notNull().default(""),
  agentName: text("agent_name").notNull().default(""),
  notes: text("notes").notNull().default(""),
  details: text("details").notNull().default("{}"),
  documentIds: text("document_ids").notNull().default("[]"),
  statusNote: text("status_note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  docType: text("doc_type").notNull(),
  title: text("title").notNull(),
  docNumber: text("doc_number").notNull().default(""),
  issuedOn: text("issued_on").notNull().default(""),
  expiresOn: text("expires_on").notNull().default(""),
  blobKey: text("blob_key"),
  fileName: text("file_name").notNull().default(""),
  contentType: text("content_type").notNull().default(""),
  status: text("status", { enum: ["Active", "Superseded"] })
    .notNull()
    .default("Active"),
  validityNotified: text("validity_notified").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  applicationId: integer("application_id").references(() => applications.id),
  kind: text("kind", { enum: ["Biometrics", "Collection", "Interview"] })
    .notNull()
    .default("Biometrics"),
  groupSize: integer("group_size").notNull().default(1),
  ticket: text("ticket").notNull().default(""),
  office: text("office").notNull(),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  status: text("status", { enum: ["Booked", "Attended", "Missed", "Cancelled"] })
    .notNull()
    .default("Booked"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  method: text("method", { enum: ["MTN MoMo", "Orange Money"] }).notNull(),
  amount: integer("amount").notNull().default(0),
  payerPhone: text("payer_phone").notNull(),
  transactionRef: text("transaction_ref").notNull(),
  status: text("status", {
    enum: ["Recorded", "Confirmed", "Refund requested", "Refunded"],
  })
    .notNull()
    .default("Recorded"),
  refundReason: text("refund_reason").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const familyMembers = sqliteTable("family_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  fullName: text("full_name").notNull(),
  relationship: text("relationship").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nationalId: text("national_id").notNull().default(""),
  consent: integer("consent", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const statusEvents = sqliteTable("status_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  /* Who did it: the applicant, a named officer, the agent who helped, or
     PortaGov itself. Empty on events recorded before actors were stored. */
  actor: text("actor").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  applicationId: integer("application_id").references(() => applications.id),
  channel: text("channel", { enum: ["SMS", "WhatsApp", "Email"] }).notNull(),
  kind: text("kind").notNull().default("Status update"),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  certNumber: text("cert_number").notNull().unique(),
  serviceName: text("service_name").notNull(),
  institution: text("institution").notNull(),
  holderName: text("holder_name").notNull(),
  reference: text("reference").notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  county: text("county").notNull(),
  phone: text("phone").notNull(),
  rating: integer("rating").notNull().default(0),
  serviceCentre: text("service_centre").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const helpRequests = sqliteTable("help_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").references(() => profiles.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["New", "Answered"] })
    .notNull()
    .default("New"),
  reply: text("reply").notNull().default(""),
  assignedTo: text("assigned_to").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
});

export const videoCalls = sqliteTable("video_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  requestedBy: text("requested_by", {
    enum: ["Institution", "Citizen"],
  }).notNull(),
  scheduledAt: text("scheduled_at").notNull().default(""),
  status: text("status", {
    enum: ["Requested", "Scheduled", "Done", "Missed"],
  })
    .notNull()
    .default("Requested"),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const embassyUpdates = sqliteTable("embassy_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  embassy: text("embassy").notNull(),
  sender: text("sender", {
    enum: ["Institution", "Embassy", "PortaGov"],
  }).notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institution: text("institution").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  applicationRef: text("application_ref").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const documentChecks = sqliteTable("document_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id),
  officer: text("officer").notNull().default(""),
  isReal: integer("is_real", { mode: "boolean" }).notNull().default(false),
  isClear: integer("is_clear", { mode: "boolean" }).notNull().default(false),
  isValid: integer("is_valid", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const businessWalletTxns = sqliteTable("business_wallet_txns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  kind: text("kind", { enum: ["Deposit", "Payment"] }).notNull(),
  amount: integer("amount").notNull(),
  note: text("note").notNull().default(""),
  applicationRef: text("application_ref").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const staffAccounts = sqliteTable("staff_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  codeFailedAttempts: integer("code_failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  role: text("role", {
    enum: [
      "Help desk",
      "Release officer",
      "Payments desk",
      "Support supervisor",
      "Platform admin",
    ],
  }).notNull(),
  scope: text("scope").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
  passwordSalt: text("password_salt").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const onboardedInstitutions = sqliteTable("onboarded_institutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  color: text("color").notNull().default("#0A2A5E"),
  monogram: text("monogram").notNull().default(""),
  about: text("about").notNull().default(""),
  status: text("status", {
    enum: ["Sandbox", "Pending approval", "Approved", "Live"],
  })
    .notNull()
    .default("Sandbox"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const builderServices = sqliteTable("builder_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id")
    .notNull()
    .references(() => onboardedInstitutions.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  blurb: text("blurb").notNull().default(""),
  feeUsd: integer("fee_usd").notNull().default(0),
  processingTime: text("processing_time").notNull().default(""),
  checklist: text("checklist").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const institutionVersions = sqliteTable("institution_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id")
    .notNull()
    .references(() => onboardedInstitutions.id),
  label: text("label").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const institutionServiceSettings = sqliteTable(
  "institution_service_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    institution: text("institution").notNull(),
    serviceId: text("service_id").notNull(),
    feeUsd: integer("fee_usd"),
    processingTime: text("processing_time").notNull().default(""),
    note: text("note").notNull().default(""),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

export const replyTemplates = sqliteTable("reply_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institution: text("institution").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const printRequests = sqliteTable("print_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  office: text("office").notNull(),
  printCode: text("print_code").notNull(),
  status: text("status", { enum: ["Requested", "Printed", "Collected"] })
    .notNull()
    .default("Requested"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lostReports = sqliteTable("lost_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  reference: text("reference").notNull(),
  docType: text("doc_type").notNull(),
  docNumber: text("doc_number").notNull().default(""),
  details: text("details").notNull().default(""),
  status: text("status", {
    enum: ["Reported", "In replacement", "Closed"],
  })
    .notNull()
    .default("Reported"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shareLinks = sqliteTable("share_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  token: text("token").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const businessTeam = sqliteTable("business_team", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const institutionStaff = sqliteTable("institution_staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institution: text("institution").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const authCodes = sqliteTable("auth_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  purpose: text("purpose").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at").notNull(),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  deviceId: text("device_id").notNull(),
  label: text("label").notNull().default(""),
  signedOut: integer("signed_out", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSeen: integer("last_seen", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* Sign-in history: one row per successful citizen sign-in, so the
   person can see when and from which device their account was used,
   including sign-ins from a device seen for the first time. */
export const signInEvents = sqliteTable("sign_in_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  deviceId: text("device_id").notNull().default(""),
  label: text("label").notNull().default(""),
  isNewDevice: integer("is_new_device", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* One-time codes for the second step of staff sign-in. Kept apart
   from citizen auth codes because staff accounts are not profiles. */
export const staffAuthCodes = sqliteTable("staff_auth_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staffAccounts.id),
  code: text("code").notNull(),
  expiresAt: integer("expires_at").notNull(),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ministry: text("ministry").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  name: text("name").notNull().default(""),
  sender: text("sender", { enum: ["Citizen", "Officer"] }).notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const complaints = sqliteTable("complaints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  kind: text("kind", { enum: ["Complaint", "Appeal"] }).notNull(),
  reason: text("reason").notNull(),
  status: text("status", {
    enum: ["New", "Under review by PortaGov", "Resolved"],
  })
    .notNull()
    .default("New"),
  reply: text("reply").notNull().default(""),
  /* When PortaGov answered, so the answer shows in the application
     activity record on the right date. Empty until answered. */
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ratings = sqliteTable("ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  institution: text("institution").notNull(),
  speed: integer("speed").notNull(),
  clarity: integer("clarity").notNull(),
  feedback: text("feedback").notNull().default(""),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const businesses = sqliteTable("businesses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  balance: integer("balance").notNull().default(0),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  businessName: text("business_name").notNull(),
  registrationNumber: text("registration_number").notNull().default(""),
  tin: text("tin").notNull().default(""),
  county: text("county").notNull(),
  activity: text("activity").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const callbackRequests = sqliteTable("callback_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  topic: text("topic").notNull(),
  status: text("status", { enum: ["Waiting", "Called back"] })
    .notNull()
    .default("Waiting"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reportSnapshots = sqliteTable("report_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  periodLabel: text("period_label").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const agentPermissions = sqliteTable("agent_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agents.id),
  agentName: text("agent_name").notNull().default(""),
  canViewStatus: integer("can_view_status", { mode: "boolean" }).notNull().default(true),
  canApply: integer("can_apply", { mode: "boolean" }).notNull().default(false),
  canPay: integer("can_pay", { mode: "boolean" }).notNull().default(false),
  canDocuments: integer("can_documents", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const staffShifts = sqliteTable("staff_shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffName: text("staff_name").notNull(),
  date: text("date").notNull(),
  duty: text("duty").notNull().default("Help desk"),
  status: text("status", { enum: ["On duty", "Off", "Covering"] }).notNull().default("On duty"),
  coversFor: text("covers_for").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const kbArticles = sqliteTable("kb_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topic: text("topic").notNull().default("General"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  addedBy: text("added_by").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const qualityReviews = sqliteTable("quality_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetLabel: text("target_label").notNull(),
  sample: text("sample").notNull(),
  mark: text("mark", { enum: ["Good", "Needs help"] }).notNull(),
  note: text("note").notNull().default(""),
  reviewer: text("reviewer").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const improvementNotes = sqliteTable("improvement_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note: text("note").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const queueTickets = sqliteTable("queue_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  office: text("office").notNull(),
  number: integer("number").notNull(),
  status: text("status", { enum: ["Waiting", "Called", "Done", "Missed"] })
    .notNull()
    .default("Waiting"),
  date: text("date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const serviceClosures = sqliteTable("service_closures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institution: text("institution").notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull().default(""),
  date: text("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
