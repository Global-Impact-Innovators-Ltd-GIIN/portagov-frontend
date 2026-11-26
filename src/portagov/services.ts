// PortaGov service catalogue: ministries and agencies, and the services each
// one renders. This is the public catalogue of what PortaGov connects.

export interface ServiceField {
  key: string;
  label: string;
  placeholder: string;
}

export interface Service {
  id: string;
  name: string;
  ministryId: string;
  blurb: string;
  about: string;
  requirements: string[];
  visitType: "Collection only" | "Biometrics appointment" | "Fully online";
  visitNote: string;
  fields: ServiceField[];
}

export interface Ministry {
  id: string;
  name: string;
  shortName: string;
  blurb: string;
  about: string;
}

export const MINISTRIES: Ministry[] = [
  {
    id: "foreign-affairs",
    name: "Ministry of Foreign Affairs",
    shortName: "Foreign Affairs",
    blurb: "Passports and travel documents for Liberian citizens, at home and abroad.",
    about:
      "The Ministry of Foreign Affairs issues Liberian passports through its passport offices. On PortaGov you apply and pay from home, and you only travel in for biometrics or to collect your passport when it is ready.",
  },
  {
    id: "health",
    name: "Ministry of Health",
    shortName: "Health",
    blurb: "Birth and death registration, and the certificates that prove them.",
    about:
      "The Ministry of Health keeps Liberia's vital records. Birth and death certificates applied for on PortaGov are prepared by the registry and collected in person, so identity can be checked at hand over.",
  },
  {
    id: "police",
    name: "Liberia National Police",
    shortName: "National Police",
    blurb: "Police clearance certificates and police reports, under the Ministry of Justice.",
    about:
      "The Liberia National Police, under the Ministry of Justice, issues police clearance certificates for work, travel, and visa applications, and records police reports. Apply from home and come in only when your certificate is ready to collect.",
  },
  {
    id: "identification",
    name: "National Identification Registry",
    shortName: "National ID",
    blurb: "The national identity card: first registration and replacement cards.",
    about:
      "The National Identification Registry enrols citizens and residents and issues the national ID card. A national ID helps every other service move faster, but on PortaGov it is never a blocker: you can start with a birth certificate, passport, or voter card and apply for your ID here.",
  },
  {
    id: "commerce",
    name: "Liberia Business Registry",
    shortName: "Business Registry",
    blurb: "Register a business and keep its registration current, with the Ministry of Commerce and Industry.",
    about:
      "The Liberia Business Registry, working with the Ministry of Commerce and Industry, registers businesses and keeps their records. Registration and renewal can be completed on PortaGov without travelling to the registry.",
  },
  {
    id: "revenue",
    name: "Liberia Revenue Authority",
    shortName: "Revenue Authority",
    blurb: "Taxpayer registration and tax clearance certificates.",
    about:
      "The Liberia Revenue Authority registers taxpayers and issues tax clearance certificates needed for contracts, imports, and government business. Apply on PortaGov and receive your clearance without queuing at a tax office.",
  },
  {
    id: "transport",
    name: "Ministry of Transport",
    shortName: "Transport",
    blurb: "Driver licences and vehicle registration.",
    about:
      "The Ministry of Transport issues driver licences and registers vehicles. Renewals are handled online; a first licence includes a short visit for testing and biometrics at a time you choose.",
  },
  {
    id: "internal-affairs",
    name: "Ministry of Internal Affairs",
    shortName: "Internal Affairs",
    blurb: "Marriage registration and certificates.",
    about:
      "The Ministry of Internal Affairs records marriages and issues marriage certificates. Register the details on PortaGov and collect the signed certificate together at the appointed time.",
  },
  {
    id: "labour",
    name: "Ministry of Labour",
    shortName: "Labour",
    blurb: "Work permits for non Liberian workers and their employers.",
    about:
      "The Ministry of Labour issues work permits. Employers apply on PortaGov on behalf of their workers, upload the supporting documents once, and collect the permit when it is ready.",
  },
  {
    id: "land",
    name: "Liberia Land Authority",
    shortName: "Land Authority",
    blurb: "Deed registration and land records.",
    about:
      "The Liberia Land Authority keeps land records and registers deeds. Start a deed registration on PortaGov, submit your documents from home, and follow the case until your registered deed is ready.",
  },
];

export const SERVICES: Service[] = [
  {
    id: "passport-new",
    name: "New passport",
    ministryId: "foreign-affairs",
    blurb: "Apply for your first Liberian passport from home.",
    about:
      "Apply for a first Liberian passport without travelling to the passport office first. Your details come from your saved PortaGov profile, you add one recent passport size photograph kept at full quality, and you book one short visit for biometrics. After that you are told when to come in and collect your passport.",
    requirements: [
      "Birth certificate or national ID in your document wallet",
      "One recent passport size photograph, colour, white background, full quality, not compressed",
      "Your saved PortaGov profile, completed once",
    ],
    visitType: "Biometrics appointment",
    visitNote:
      "One visit for biometrics at the time you book. Collection is a second short visit when your passport is ready.",
    fields: [
      { key: "passportType", label: "Passport type", placeholder: "Ordinary" },
      { key: "deliveryCounty", label: "County for collection", placeholder: "Montserrado" },
    ],
  },
  {
    id: "passport-renewal",
    name: "Passport renewal",
    ministryId: "foreign-affairs",
    blurb: "Renew an expiring or expired Liberian passport.",
    about:
      "Renew your passport from home or from abroad. Enter your current passport number, add a fresh passport size photograph, and PortaGov carries your saved profile into the application. Biometrics already in the system are reused where possible, so many renewals only need a collection visit.",
    requirements: [
      "Current or expired Liberian passport number",
      "One recent passport size photograph, colour, white background, full quality",
      "Old passport presented at collection",
    ],
    visitType: "Collection only",
    visitNote:
      "Come in only to collect, unless the passport office asks for fresh biometrics, in which case PortaGov books you a time.",
    fields: [
      { key: "currentPassportNumber", label: "Current passport number", placeholder: "PP0000000" },
      { key: "expiryDate", label: "Current passport expiry date", placeholder: "2030-05-01" },
    ],
  },
  {
    id: "passport-replacement",
    name: "Replace a lost passport",
    ministryId: "foreign-affairs",
    blurb: "Replace a lost or stolen Liberian passport.",
    about:
      "Report a lost or stolen passport and apply for its replacement in one place. Attach the police report from your document wallet, and PortaGov sends the case to the passport office. You come in once for biometrics and once to collect.",
    requirements: [
      "Police report for the lost passport, in your document wallet",
      "One recent passport size photograph, colour, white background, full quality",
      "Any copy or record of the lost passport number, if you have it",
    ],
    visitType: "Biometrics appointment",
    visitNote: "One biometrics visit, then collection when the replacement is ready.",
    fields: [
      { key: "lostPassportNumber", label: "Lost passport number, if known", placeholder: "PP0000000" },
      { key: "policeReportRef", label: "Police report reference", placeholder: "LNP-2026-0000" },
    ],
  },
  {
    id: "birth-certificate",
    name: "Birth certificate",
    ministryId: "health",
    blurb: "Order a birth certificate for yourself or your child.",
    about:
      "Apply for a birth certificate from home for yourself or for your child. The registry checks the birth record, prepares the certificate, and PortaGov tells you when to come in and collect it. One visit, at the end, only to collect.",
    requirements: [
      "Full name and date of birth of the person on the certificate",
      "Place of birth and parents' names",
      "Hospital or clinic birth record, if you have one, in your document wallet",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the printed certificate.",
    fields: [
      { key: "personName", label: "Name on the certificate", placeholder: "Full name" },
      { key: "relationship", label: "Your relationship to that person", placeholder: "Self, Mother, Father" },
    ],
  },
  {
    id: "death-certificate",
    name: "Death certificate",
    ministryId: "health",
    blurb: "Register a death and order the certificate.",
    about:
      "Register a death and apply for the death certificate from home, so a hard errand takes one trip instead of many. The registry verifies the record and tells you when the certificate is ready to collect.",
    requirements: [
      "Full name of the deceased and date of death",
      "Place of death",
      "Medical death notice, if issued, in your document wallet",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the printed certificate.",
    fields: [
      { key: "deceasedName", label: "Name of the deceased", placeholder: "Full name" },
      { key: "dateOfDeath", label: "Date of death", placeholder: "2026-01-15" },
    ],
  },
  {
    id: "police-clearance",
    name: "Police clearance certificate",
    ministryId: "police",
    blurb: "A clearance certificate for work, travel, or a visa.",
    about:
      "Apply for your police clearance certificate from home. PortaGov forwards your application to the Liberia National Police, the police confirm receipt, and you are told when to come in and collect the signed certificate. No queueing to apply, one short visit to collect.",
    requirements: [
      "National ID, passport, or voter card in your document wallet",
      "The reason for the clearance, for example work, travel, or visa",
      "One passport size photograph, if asked for by the receiving country or employer",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the signed certificate.",
    fields: [
      { key: "purpose", label: "What is the clearance for?", placeholder: "Employment, Visa, Travel" },
      { key: "destination", label: "Country or organisation asking for it", placeholder: "Employer name or country" },
    ],
  },
  {
    id: "police-report",
    name: "File a police report",
    ministryId: "police",
    blurb: "Report a loss or an incident and get a stamped report reference.",
    about:
      "File a police report from home for a lost document, theft, or another incident. You receive a report reference at once, the station confirms receipt, and you are told if and when you need to come in, for example for a statement or a stamp.",
    requirements: [
      "A clear description of what happened, when, and where",
      "Details of any document or item lost, including numbers if known",
    ],
    visitType: "Fully online",
    visitNote:
      "Most reports complete online. If an officer needs a statement, PortaGov books you a time instead of you queueing.",
    fields: [
      { key: "incidentType", label: "Type of incident", placeholder: "Lost passport, Theft, Other" },
      { key: "incidentDate", label: "Date of the incident", placeholder: "2026-01-15" },
      { key: "incidentPlace", label: "Where it happened", placeholder: "Town, county" },
    ],
  },
  {
    id: "national-id-new",
    name: "National ID, first registration",
    ministryId: "identification",
    blurb: "Register for your first national ID card.",
    about:
      "Register for your national ID from home and book your enrolment visit. Your PortaGov profile carries into the registration, so at the enrolment centre you only confirm your details and give biometrics. If you do not have a national ID yet, that never blocks your other PortaGov services.",
    requirements: [
      "Birth certificate, passport, or voter card to prove identity",
      "Your saved PortaGov profile",
      "One enrolment visit for biometrics, booked at a time you choose",
    ],
    visitType: "Biometrics appointment",
    visitNote: "One enrolment visit for biometrics. Your card is collected or delivered as the registry directs.",
    fields: [
      { key: "enrolmentCounty", label: "County for enrolment", placeholder: "Montserrado" },
    ],
  },
  {
    id: "national-id-replacement",
    name: "National ID, replacement card",
    ministryId: "identification",
    blurb: "Replace a lost or damaged national ID card.",
    about:
      "Order a replacement national ID card from home. Your registration is already in the system, so most replacements need no new biometrics, and you are told when the card is ready.",
    requirements: [
      "Your national ID number, if you know it",
      "Police report if the card was stolen, in your document wallet",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the replacement card.",
    fields: [
      { key: "reason", label: "Reason for replacement", placeholder: "Lost, Stolen, Damaged" },
    ],
  },
  {
    id: "name-correction",
    name: "Name correction",
    ministryId: "identification",
    blurb: "Correct the spelling of your name on your national record, with proof.",
    about:
      "If your name is spelled wrong on your national record, apply here to correct it. You state the wrong spelling and the correct spelling exactly as your proof document shows it, and upload the proof: a birth certificate, passport, or court order. The correction is tracked like any application, step by step, and when it is approved your PortaGov profile and documents use the corrected name.",
    requirements: [
      "Proof document showing the correct spelling: birth certificate, passport, or court order, in your document wallet",
      "The wrong spelling and the correct spelling, written exactly",
    ],
    visitType: "Fully online",
    visitNote: "Handled online. If the registry needs to see the original proof, they message you in your application thread.",
    fields: [
      { key: "wrongName", label: "Name as it appears now (wrong)", placeholder: "The wrong spelling on your record" },
      { key: "correctName", label: "Correct name, exactly as on your proof", placeholder: "The correct spelling" },
      { key: "proofType", label: "Proof you are using", placeholder: "Birth certificate, Passport, Court order" },
      { key: "lostReference", label: "Lost-document reference, if this follows a lost report", placeholder: "LOST-2026-00001, if you have one" },
    ],
  },
  {
    id: "business-registration",
    name: "Business registration",
    ministryId: "commerce",
    blurb: "Register a new business name and receive your certificate.",
    about:
      "Register your business from home: business name, owners, and activities in one application. The registry checks the name, and your registration certificate is issued without a trip to the registry.",
    requirements: [
      "Proposed business name and one alternative",
      "Names and ID details of the owners",
      "Business address and main activity",
    ],
    visitType: "Fully online",
    visitNote: "Completed online. Your certificate is issued to your PortaGov account.",
    fields: [
      { key: "businessName", label: "Business name", placeholder: "Name of the business" },
      { key: "businessActivity", label: "Main business activity", placeholder: "Trading, Services, Farming" },
      { key: "businessAddress", label: "Business address", placeholder: "Street, town, county" },
    ],
  },
  {
    id: "business-renewal",
    name: "Business registration renewal",
    ministryId: "commerce",
    blurb: "Renew an existing business registration.",
    about:
      "Renew your business registration before it lapses, from home or from your shop, with your registration number and mobile money payment recorded in one place.",
    requirements: ["Your business registration number"],
    visitType: "Fully online",
    visitNote: "Completed online.",
    fields: [
      { key: "registrationNumber", label: "Business registration number", placeholder: "LBR-000000" },
    ],
  },
  {
    id: "tin-registration",
    name: "Taxpayer registration (TIN)",
    ministryId: "revenue",
    blurb: "Get a taxpayer identification number for yourself or your business.",
    about:
      "Register for a taxpayer identification number from home. Your TIN is needed for business, banking, and government contracts, and on PortaGov it is issued without a visit to a tax office.",
    requirements: [
      "National ID or passport for individuals",
      "Business registration details for businesses",
    ],
    visitType: "Fully online",
    visitNote: "Completed online. Your TIN is issued to your PortaGov account.",
    fields: [
      { key: "taxpayerType", label: "Registering as", placeholder: "Individual or Business" },
      { key: "businessName", label: "Business name, if a business", placeholder: "Name or leave as Individual" },
    ],
  },
  {
    id: "tax-clearance",
    name: "Tax clearance certificate",
    ministryId: "revenue",
    blurb: "Prove your taxes are in order for contracts and imports.",
    about:
      "Apply for a tax clearance certificate from home. The Revenue Authority checks your account and issues the certificate to your PortaGov account when your record is clear, or tells you exactly what to settle first.",
    requirements: ["Your taxpayer identification number (TIN)"],
    visitType: "Fully online",
    visitNote: "Completed online.",
    fields: [
      { key: "tin", label: "Taxpayer identification number", placeholder: "TIN" },
      { key: "purpose", label: "What is the clearance for?", placeholder: "Contract, Import, Tender" },
    ],
  },
  {
    id: "driver-licence-new",
    name: "Driver licence, first licence",
    ministryId: "transport",
    blurb: "Apply for your first Liberian driver licence.",
    about:
      "Start your first driver licence application from home. PortaGov books your testing and biometrics visit at a time you choose, and your profile and documents are already in order when you arrive.",
    requirements: [
      "National ID, passport, or birth certificate in your document wallet",
      "One passport size photograph",
      "Testing and biometrics visit, booked through PortaGov",
    ],
    visitType: "Biometrics appointment",
    visitNote: "One visit for testing and biometrics, then collection when the licence is ready.",
    fields: [
      { key: "licenceClass", label: "Licence class", placeholder: "Car, Motorcycle, Truck" },
    ],
  },
  {
    id: "driver-licence-renewal",
    name: "Driver licence renewal",
    ministryId: "transport",
    blurb: "Renew an expiring driver licence.",
    about:
      "Renew your driver licence from home with your current licence number. Most renewals complete with a single collection visit.",
    requirements: ["Your current driver licence number"],
    visitType: "Collection only",
    visitNote: "Come in only to collect the renewed licence.",
    fields: [
      { key: "licenceNumber", label: "Current licence number", placeholder: "DL-000000" },
    ],
  },
  {
    id: "vehicle-registration",
    name: "Vehicle registration",
    ministryId: "transport",
    blurb: "Register a vehicle or renew its registration.",
    about:
      "Register a vehicle or renew its registration from home. Enter the vehicle details once, and PortaGov tells you when your plates and documents are ready.",
    requirements: [
      "Vehicle chassis (VIN) number",
      "Purchase or import documents in your document wallet",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect plates and documents.",
    fields: [
      { key: "plateOrVin", label: "Plate number or chassis (VIN) number", placeholder: "VIN or plate" },
      { key: "vehicleType", label: "Vehicle type", placeholder: "Car, Truck, Motorcycle" },
    ],
  },
  {
    id: "marriage-certificate",
    name: "Marriage certificate",
    ministryId: "internal-affairs",
    blurb: "Register a marriage and order the certificate.",
    about:
      "Register your marriage details from home for both partners, and collect the signed marriage certificate together at the appointed time. One visit, together, at the end.",
    requirements: [
      "Full names and ID details of both partners",
      "Date and place of the marriage",
      "Names of two witnesses",
    ],
    visitType: "Collection only",
    visitNote: "Both partners come in once, together, to sign and collect.",
    fields: [
      { key: "partnerName", label: "Partner's full name", placeholder: "Full name" },
      { key: "marriageDate", label: "Date of marriage", placeholder: "2026-01-15" },
      { key: "marriagePlace", label: "Place of marriage", placeholder: "Town, county" },
    ],
  },
  {
    id: "work-permit",
    name: "Work permit",
    ministryId: "labour",
    blurb: "A work permit for a non Liberian worker, applied for by the employer.",
    about:
      "Employers apply for work permits on PortaGov: worker details, job, and supporting documents in one application, with the permit collected when it is ready. Renewals start from the saved record.",
    requirements: [
      "Worker's passport details",
      "Employment contract or offer letter in the document wallet",
      "Employer business registration details",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the permit.",
    fields: [
      { key: "workerName", label: "Worker's full name", placeholder: "Full name" },
      { key: "workerPassport", label: "Worker's passport number", placeholder: "Passport number" },
      { key: "jobTitle", label: "Job title", placeholder: "Role at the company" },
      { key: "employerName", label: "Employer or company name", placeholder: "Company name" },
    ],
  },
  {
    id: "deed-registration",
    name: "Deed registration",
    ministryId: "land",
    blurb: "Register a land deed with the Land Authority.",
    about:
      "Start a deed registration from home: submit the deed and supporting documents once, follow the case on PortaGov, and collect the registered deed when the Land Authority completes it.",
    requirements: [
      "The deed document, in your document wallet",
      "Seller and buyer ID details",
      "Land location: county, district, and community",
    ],
    visitType: "Collection only",
    visitNote: "Come in only to collect the registered deed, unless the Authority books a verification visit.",
    fields: [
      { key: "landLocation", label: "Land location", placeholder: "Community, district, county" },
      { key: "sellerName", label: "Seller's full name", placeholder: "Full name" },
    ],
  },
];

export const COUNTIES = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe",
];

/* Electoral districts per county, numbered the way they are on the ballot
   (Montserrado has 17; the 15 counties total 73). The profile form's home
   address cascade offers these once a county is chosen. */
function numberedDistricts(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `District ${i + 1}`);
}

export const DISTRICTS: Record<string, string[]> = {
  "Bomi": numberedDistricts(3),
  "Bong": numberedDistricts(7),
  "Gbarpolu": numberedDistricts(3),
  "Grand Bassa": numberedDistricts(5),
  "Grand Cape Mount": numberedDistricts(3),
  "Grand Gedeh": numberedDistricts(3),
  "Grand Kru": numberedDistricts(2),
  "Lofa": numberedDistricts(5),
  "Margibi": numberedDistricts(5),
  "Maryland": numberedDistricts(3),
  "Montserrado": numberedDistricts(17),
  "Nimba": numberedDistricts(9),
  "River Cess": numberedDistricts(2),
  "River Gee": numberedDistricts(3),
  "Sinoe": numberedDistricts(3),
};

/* The communities and villages of every electoral district, researched
   district by district (see DATA-PLAN.md for the sources: the National
   Elections Commission district descriptions and 2023-2028 district maps,
   and the Greater Monrovia community table sourced from LISGIS and the
   NEC). Each district lists its own real communities, in alphabetical
   order A to Z. The form also offers an "Another community" choice with a
   text box, so a community that is not listed here never blocks anyone. */
export const DISTRICT_COMMUNITIES: Record<string, Record<string, string[]>> = {
  "Bomi": {
    "District 1": ["Gbah", "Joseph Town", "Sackie Town", "Tubmanburg", "Weakama", "Yomo Town", "Zamian Town"],
    "District 2": ["Beagonah Town", "Beh", "Fefeh Town", "Gbaigbon", "Jawajeh", "Julijuah", "Klay", "Maher", "Manjama", "Sass Town", "Vortor Town", "Zordee"],
    "District 3": ["Benda", "Bogbeh", "Bonor", "Bowein", "Dagweh", "Gonjeh", "Jenneh", "Leyan", "Suehn-Mecca", "Vincent", "Weajor", "Zohn Bamon"],
  },
  "Bong": {
    "District 1": ["Baila", "Dahn-Kan", "Dean Town", "Gbarta", "Kokoyah", "Nangbo", "Palala", "Sarworlor", "Tokpa-Ta", "Zowienta"],
    "District 2": ["Beh-Lah-Three", "Beletanta-Two", "Garwuquelleh-Two", "Gbarnga", "Gbenequellen-Two", "Jankpayah-Four", "Janyea-Four", "Kolleta-Mula-Two", "Mano-Weasue-Three", "Samay-One", "Tamay Ta-One", "Tomue-Five", "Yeanawoun-One"],
    "District 3": ["Gbaota-One", "Gbarmue-Four", "Gbarnga", "Gbarnay-Two", "Kayata", "Kpanyah-Two", "Melekei-One", "Wainsue-One", "Wongbai-Three"],
    "District 4": ["Belefana", "Bellemu", "Farvey", "Gbansue", "Gbansue Sulonmah", "Gbonota", "Gou", "Jarkai", "Laryea", "Naama", "Nyansue", "Pelelei", "Shamkpallai", "Yowee"],
    "District 5": ["Fenutoli", "Garyea", "Gbartala", "Palala", "Phebe", "Suakoko", "Tomgbeyah"],
    "District 6": ["Gbondoi", "Gborkornemah", "Salala", "Tarsiah", "Totota", "Zeansue"],
    "District 7": ["Darnenamah Town", "Handii", "Popota", "Sanoyea", "Woumai Town", "Zangbiama"],
  },
  "Gbarpolu": {
    "District 1": ["Bopolu", "Gbarngay", "Gbarquoi-Ta", "Gedema", "Henry Town", "Nyeamah", "Totoquelleh", "Wayama"],
    "District 2": ["Belleh Yallah", "Fassama", "Gbarkagborquoita", "Gungbe-Ta", "Kalata", "Kpawolozu", "Mollakwelle", "Porkpa-Ta", "Salayah", "Zalakai"],
    "District 3": ["Beatoe", "Gbarma", "Gbelleta", "Jawajeh", "Kungbor", "Nomodatanau", "Weasua"],
  },
  "Grand Bassa": {
    "District 1": ["Appee Town", "Bai Town", "Bokay Town", "Doewein Town", "Edina", "Gohn Town", "Little Bassa", "Lloydsville", "Owensgrove", "Wrayn Town", "Zuzohn"],
    "District 2": ["Bohn Town", "Fortsville", "Garneo Town", "Gorwee Town", "Juah Town", "Kpelleh Town", "Molon Town", "Quejay Town", "Senyah Town", "Waka Town", "Zahn Town"],
    "District 3": ["Benson River", "Biafra", "Buchanan", "Four Houses", "Paynesberry", "Upper Buchanan"],
    "District 4": ["Borbor Town", "Desoe Town", "Gardee Town", "Kennedy Town", "Klehn Town", "Sam Town", "Sue Town", "Timbo Town", "Wayzohn", "Zuagar Town"],
    "District 5": ["Bannie Town", "Behn Town", "Debbah Town", "Gargar Town", "Kahyah Town", "Mentee Town", "Soweah Town", "Yarweh Town", "Zondo Town"],
  },
  "Grand Cape Mount": {
    "District 1": ["Bamballa", "Benduma", "Fornor", "Keita", "Kongo", "Lofa Bridge", "Managorduah", "Porkpa", "Tahn Town", "Weajue"],
    "District 2": ["Bendu", "Jenne Brown", "Jundu", "Latia", "Mandoe", "Robertsport", "Sembehum", "Sinje", "Tombey"],
    "District 3": ["Bo-Mafa", "Damballa", "Dazanbo", "Gondama", "Kebba", "Kpallan", "Mambo", "Tallah", "Tiene", "Weima"],
  },
  "Grand Gedeh": {
    "District 1": ["Zwedru"],
    "District 2": ["Billibo", "Boundary Town", "Glay Town", "Konobo", "Kumah Town", "Pennoken", "Petroken", "Putu Jarwodee", "Tarloken", "Toe Town", "Tweh Town", "Ziah"],
    "District 3": ["Bartehjam", "Blown Town", "Bodee", "Gbao Jarwodee", "Gwein Town", "New Pohan", "Pouh Town", "Solo", "Tuzon", "Zilaken"],
  },
  "Grand Kru": {
    "District 1": ["Beloken", "Blebo", "Denteken", "Genoyah", "Grand Cess", "Newaken", "Pennuken", "Sawken", "Sorroken", "Weteken", "Wilsonville", "Zoloken"],
    "District 2": ["Barclayville", "Betu", "Boluwin", "Buah", "Feloken", "Parluken", "Picnic Cess", "Sasstown", "Warkpo", "Weayan"],
  },
  "Lofa": {
    "District 1": ["Bandenin", "Bandenin Melimu", "Borliloe", "Fassapoe", "Foya", "Konkpama", "Lepaloe", "Ndama", "Ndehuma", "Sinagole", "Yelayaloe"],
    "District 2": ["Fangonda", "Foya Tengia", "Kamatahun", "Kimbaloe", "Kpagamai", "Lehun", "Popalahun", "Porlowu", "Vahun", "Yallahun", "Yandohun", "Yassadu"],
    "District 3": ["Balahun", "Bolahun", "Fassavolu", "Kolahun", "Korworhun", "Kpadehmai", "Kpakamai", "Lawalazu", "Pasolahun", "Somalahun", "Tawalahun", "Tobogizizu", "Zawordamai"],
    "District 4": ["Barkedu", "Barziwen", "Dayzabah", "Karzah", "Kesselemai", "Konia", "Sarkonedu", "Vezala", "Voinjama", "Worbalamai", "Zogolemai"],
    "District 5": ["Fissibu", "Gorlu", "Passama", "Salayea", "Sucromu", "Warkesu", "Wuomai", "Yeala", "Ziggida", "Zolowu", "Zorzor"],
  },
  "Margibi": {
    "District 1": ["Browne Town", "Dwazon", "Garmaymu", "Garneo", "Karfeah", "Lloydsville", "Loongaye", "Marshall", "Scheiffelin", "Whowein", "Zoeduehn"],
    "District 2": ["Charlesville", "Cotton Tree", "Dolo Town", "Harbel", "Joe Blow Town", "Peter Town", "RIA Township", "Unification"],
    "District 3": ["Borbor Town", "Gborfela", "Kakata", "Madina"],
    "District 4": ["Benla", "Brownell", "Bullequelleh", "Gbamokollie Town", "Gorsue Town", "Konoquelleh Town", "Kpekeh Town", "Sakey Town", "Vanyema", "Yahlon", "Yeamen"],
    "District 5": ["Baypolu", "Boalian", "Cinta", "Gleegbar Town", "Jennita", "Kono Town", "Lakar Town", "Laynala", "Nuah Town", "Poye Town", "Weala", "Wolaila", "Worhn"],
  },
  "Maryland": {
    "District 1": ["Big Town", "Cape Palmas", "Cavalla", "Harper", "Kablaken", "New Kru Town", "Rock Town", "Worteken", "Wuduke"],
    "District 2": ["Gbeken", "Gbolobo", "Geebio", "Golobo", "Old Sodoken", "Pleebo", "Sedeken"],
    "District 3": ["Barrobo", "Boniken", "Dugboken", "Dwejah", "Gbamaken", "Gwissiken", "Karloken", "Kliliken", "Manolu", "Martuken", "Suasu", "Tarworken", "Wuluken", "Yederobo", "Yorken"],
  },
  "Montserrado": {
    "District 1": ["Bensonville", "Careysburg", "Crozierville", "Fendall", "Harrisburg", "Kingsville", "Louisiana", "Todee", "White Plains"],
    "District 2": ["City View", "Double Bridge", "Jacob Town", "Johnsonville", "Mount Barclay", "Rock Hill", "Zinc Factory"],
    "District 3": ["Morris Farm", "Neezoe", "Pipeline A", "Pipeline B", "Wood Camp"],
    "District 4": ["Barnard Farm", "Duport Road North", "Duport Road North East", "Duport Road South", "Kemah Town/Omega", "Paynesville Joe Bar", "Soul Clinic"],
    "District 5": ["72nd Community", "A.B. Tolbert Road", "Bassa Town", "Gobachop", "Pagos Island", "Police Academy", "Red Light", "Swankamore", "Town Hall"],
    "District 6": ["GSA Road Rockville", "Kendejah", "King Gray-ELWA", "Kpelle Town", "Rehab/Borbor Town", "S.D. Cooper"],
    "District 7": ["BTC Area", "Centennial Area", "Central West Point", "Fish Town", "Grandcess Yard", "Lynch/Center Streets", "Mamba Point", "Police Station", "Power Plant", "Randall/Lynch Streets", "Randall/Newport Streets", "Rock Crusher", "Snapper Hill", "Sports Commission", "West Point"],
    "District 8": ["Bassa Community", "Bernard Quarters", "Bishop Brooks", "Buzzi Quarters", "Capitol Hill", "Cooper Clinic", "Crown Hill", "Jallah Town", "Maternity Community", "Ocean View", "Plumkor", "Rock Spring Valley", "Saye Town", "Slipway", "Soniwein", "Warwein"],
    "District 9": ["Central Lakpazee", "Cooper Clinic", "Fiama", "Fiama East", "Fish Market", "Gbangaye Town", "ICA Camp", "New Matadi", "Ocean View", "Old Matadi", "Pyne People", "Raymond Field", "Wroto Town"],
    "District 10": ["Barchue Town", "Catholic Hospital", "Chugbor", "Congo Town", "Congo Town Old Road", "Divine-Togba Camp", "Gaye Town", "Key & Death Hole", "Nippay Town", "Oldest Congo Town", "Peace Island", "Smythe Road", "Tarr Town", "Yekpee Town"],
    "District 11": ["Barnersville Estate", "Barnersville Road", "Behwein Community", "Caldwell Market", "Cassava Hill", "Dabwe Town", "Day Break Mouth Open", "Dixville A", "Dixville B", "Dixville Water Side", "Duan Town", "Grass Field", "J.E. Marshall", "Johnsonville Road B", "Kaba Town", "Old Field South", "Samukai Town", "Upper Caldwell"],
    "District 12": ["Chicken Soup Factory", "JJY / Snow Hill", "Johnsonville Road A", "Kesselly Boulevard", "Mangrove Island", "MTA", "River View", "Shoe Factory", "Stephen Tolbert Estate"],
    "District 13": ["Bassa Town", "Battery Factory", "Chocolate City A", "Chocolate City B", "Flahn Town", "Iron Factory", "Jamaica Road", "New Georgia", "New Georgia Estate", "Old Field Gulf Sign Board", "SOS Transit", "St. Michael", "Stockton Creek", "Topoe Village"],
    "District 14": ["Central Clara Town I", "Central Clara Town II", "Cow Factory", "Free Port Community", "Giblata", "Hope Community", "Paity Town", "Peugeot Garage", "River View", "Struggle Community", "Vai Town A", "Vai Town B"],
    "District 15": ["Blamo Town", "Caldwell Community", "Central Caldwell", "Central Logan Town", "Free Port Development", "Gbandi Town", "King Peter Town", "Little White Chapel", "Lower Caldwell", "New Georgia Road", "Vicky Spot", "Zinc Camp", "Zondo Town"],
    "District 16": ["Bong Mines Bridge", "Central New Kru Town", "Crab Hole", "Duala Market", "Duala Mombo Town East", "Fundaye", "Lagoon East", "Lagoon West", "Monboe Town West", "Nyuan Town", "Point Four", "Popo Beach A", "Popo Beach B", "Tweh Farm"],
    "District 17": ["Arthington", "Bible College", "Brewerville", "Cheesmanburg", "Clay Ashland", "Millsburg", "Royesville", "Virginia"],
  },
  "Nimba": {
    "District 1": ["Ganta", "Tokay", "Tonglaywin", "Yelekoryee", "Yini", "Zokeseh"],
    "District 2": ["Boapea", "Borsonnoh", "Busie", "Dingamon", "Duo Boe", "Duo Gbeah", "Duo Gorton", "Gbedin", "Karnwin", "Kitoma", "Lehgain", "Sanniquellie", "Sehyi-Geh", "Sopea", "Tiapa", "Tondin", "Whynor", "Zolowee", "Zuluyee"],
    "District 3": ["Bonla", "Dulay", "Duoplay", "Gbapa", "Gbeleyee", "Guagortuo", "Karnplay", "Kinnon", "Loelay", "Lugbeyee", "Yekepa", "Yeaplay", "Younlay", "Zorgowee", "Zualay"],
    "District 4": ["Behplay", "Bongarplay", "Duanpea", "Garplay", "Gblanlay", "Gborplay", "Geanplay", "Kpaglay", "Lontuo", "Lowlay", "Payee", "Senlay", "Vayenglay", "Wehplay", "Yoolar", "Zuoplay"],
    "District 5": ["Beadatuo", "Beeplay", "Blemieplay", "Butuo", "Dinplay", "Frolay", "Gbanwea", "Gbloulay", "Glarlay", "Gruzianplay", "Nyor Diaplay", "Nyor-Gomahplay", "Tanwea", "Teahplay", "Tiaplay", "Yao Lepula", "Yao Nyarlay", "Yao Zuaplay"],
    "District 6": ["Behwalay", "Boe-Tunwea", "Bonglay", "Doeyelay", "Dubuzon", "Gbarplay", "Greanpea", "Kaylay", "Kparblee", "Kwipea", "Marlay", "Sarlay", "Tappita", "Vahnplay", "Zodru", "Zuatuo"],
    "District 7": ["Bahn", "Behyepea", "Bleevalay", "Buanplay", "Fleedin", "Garwonpa", "Guawin", "Kpaytuo", "Mehnpa", "Nyao", "Saclepea", "Tengbein", "Troupoe", "Zayglay", "Zoe-Luapa", "Zontuo"],
    "District 8": ["Banlah", "Beipa", "Blohwee", "Bunadin", "Burtein", "Duayee", "Flumpa", "Garnwein", "Gborwin", "Gelepa", "Gipo", "Karnwee", "Kpallah", "Kpein", "Sehwee", "Sokopa", "Tuudin Town", "Venn Town", "Wallah", "Yarsonnoh", "Yekeyee", "Zao"],
    "District 9": ["Blamein", "Boyee", "Dahnpa", "Doumpa", "Ganwee", "Goekorpa", "Guotoin", "Kaipa", "Karyee", "Kidka", "Kwendin", "Mehnla", "Nuopea", "Sahnpa", "Tiah", "Troyah", "Wontoe", "Yellay Town", "Zahnzayee", "Zekepa", "Zeonghen", "Ziah", "Zuotuo"],
  },
  "River Cess": {
    "District 1": ["Bahn Town", "Bannie Town", "Bluen", "Bodowhea", "Boe Town", "Dehgar", "Gbortoe", "Gozohn", "Kangbo", "Karchhukon", "Larkpazee", "Nagbo", "Neezuin", "Siahn", "Yolo Town", "Zammie", "Zoryeah"],
    "District 2": ["Borbor", "Cestos City", "Charlie Town", "Darsaw", "Dunn Town", "Farh", "Garwolor", "Gbarsaw", "Gorzohn", "James Town", "Kpah Town", "Neegba Town", "Nyorwein", "Sannah Town", "Upper Timbo", "Voin"],
  },
  "River Gee": {
    "District 1": ["Dartuken", "Dweaken", "Flewroken", "Gbeapo", "Gedeken", "Gmanyenken", "Nyonken", "Saywonken", "Seagboken", "Woloken"],
    "District 2": ["Fish Town", "Gbaquiah", "Jarkaken", "Jayproken", "Jaytoken", "Juwelbo", "Paroken", "Pronoken", "Tartuken"],
    "District 3": ["Depepo", "Freetown", "Gbaweleken", "Getu", "Karbuken", "Kiabo", "Klibo", "Nyaaken", "Soloblo", "Suwroken", "Tarwarken", "Taryaken", "Tuobo Sweaken", "Wlegboken", "Youbor"],
  },
  "Sinoe": {
    "District 1": ["Blaoh", "Drapoh", "Gibsonville", "Greenville", "Klaniadae", "Kpanyan", "Lexington", "Menwah", "Numopoh", "Palatroken", "Plasiken", "Saywon", "Wolee"],
    "District 2": ["Bleweeya", "Bokon", "Dordroken", "Droah", "Gbarteken", "Jarpuken", "Jokoken", "Kajaliken", "Kunwiah", "Nana Kru", "Nyenpon", "Sackor Village", "Setta Kru", "Titiyen", "Tuzonburg", "Twaoh", "Upper Jeadepo"],
    "District 3": ["Baffu Camp", "Ceeter", "Chebioh", "Chewlue", "Gboyee Town", "Jacksonville", "Juarzon", "Judu Town", "Kallor Town", "Karmo", "Korjayee", "Lower Juarzon", "Pelloken", "Plandialebo", "Sargbah Town", "Tarlow", "Tournata", "Tugbaville", "Voogbadee", "Wiah Town"],
  },
};

/* The communities of one district of one county, in alphabetical order.
   Each district has its own researched list above, so changing the
   district always changes the community list, and the list shown is only
   ever that district's own communities. A district with no researched
   list yet returns an empty list, and the form still offers "Another
   community" there, so nobody is ever blocked. */
export function communitiesForDistrict(
  county: string,
  district: string,
): string[] {
  return [...(DISTRICT_COMMUNITIES[county]?.[district] ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
}

export const OFFICES = [
  "PortaGov Service Centre, Capitol Hill, Monrovia",
  "Ministry of Foreign Affairs Passport Office, Monrovia",
  "Liberia National Police Headquarters, Monrovia",
  "National Identification Registry, Congo Town, Monrovia",
  "Civil Registry Office, Monrovia",
  "County Service Centre, Gbarnga, Bong County",
  "County Service Centre, Kakata, Margibi County",
  "County Service Centre, Buchanan, Grand Bassa County",
  "County Service Centre, Ganta, Nimba County",
  "County Service Centre, Zwedru, Grand Gedeh County",
];

export const TIME_SLOTS = [
  "08:00 to 09:00",
  "09:00 to 10:00",
  "10:00 to 11:00",
  "11:00 to 12:00",
  "13:00 to 14:00",
  "14:00 to 15:00",
  "15:00 to 16:00",
];

export const STATUS_STEPS = [
  "Submitted to PortaGov",
  "Under review by PortaGov",
  "Payment confirmed",
  "Released to institution",
  "Received by institution",
  "In review at institution",
  "Appointment set",
  "Ready for collection",
  "Completed",
] as const;

export function ministryById(id: string): Ministry {
  return MINISTRIES.find((m) => m.id === id) ?? MINISTRIES[0]!;
}

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function servicesForMinistry(id: string): Service[] {
  return SERVICES.filter((s) => s.ministryId === id);
}

/* ---------- finder details: cost, time, collection point (shown publicly) ---------- */

export interface ServiceDetails {
  feeUsd: number;
  processingTime: string;
  collectionPoint: string;
}

export const SERVICE_DETAILS: Record<string, ServiceDetails> = {
  "passport-new": { feeUsd: 50, processingTime: "10 to 15 working days", collectionPoint: "Ministry of Foreign Affairs Passport Office, Monrovia, or your county service centre" },
  "passport-renewal": { feeUsd: 50, processingTime: "7 to 10 working days", collectionPoint: "Ministry of Foreign Affairs Passport Office, Monrovia, or delivery to a Liberian embassy for diaspora applicants" },
  "passport-replacement": { feeUsd: 50, processingTime: "10 to 15 working days", collectionPoint: "Ministry of Foreign Affairs Passport Office, Monrovia" },
  "birth-certificate": { feeUsd: 10, processingTime: "5 to 7 working days", collectionPoint: "Civil Registry Office, Monrovia, or your county service centre" },
  "death-certificate": { feeUsd: 10, processingTime: "5 to 7 working days", collectionPoint: "Civil Registry Office, Monrovia, or your county service centre" },
  "police-clearance": { feeUsd: 15, processingTime: "3 to 5 working days", collectionPoint: "Liberia National Police Headquarters, Monrovia, or your county police office" },
  "police-report": { feeUsd: 5, processingTime: "1 to 2 working days", collectionPoint: "Online, with a stamped copy at your nearest police station if you need one" },
  "national-id-new": { feeUsd: 10, processingTime: "7 to 14 working days after enrolment", collectionPoint: "National Identification Registry, Congo Town, Monrovia, or your county enrolment centre" },
  "national-id-replacement": { feeUsd: 5, processingTime: "5 to 7 working days", collectionPoint: "National Identification Registry, Congo Town, Monrovia" },
  "name-correction": { feeUsd: 5, processingTime: "5 to 10 working days", collectionPoint: "Online, corrected record confirmed in your PortaGov account" },
  "business-registration": { feeUsd: 25, processingTime: "3 to 5 working days", collectionPoint: "Online, certificate issued to your PortaGov account" },
  "business-renewal": { feeUsd: 15, processingTime: "1 to 3 working days", collectionPoint: "Online, certificate issued to your PortaGov account" },
  "tin-registration": { feeUsd: 0, processingTime: "1 to 2 working days", collectionPoint: "Online, TIN issued to your PortaGov account" },
  "tax-clearance": { feeUsd: 10, processingTime: "2 to 4 working days", collectionPoint: "Online, certificate issued to your PortaGov account" },
  "driver-licence-new": { feeUsd: 30, processingTime: "7 to 10 working days after testing", collectionPoint: "Ministry of Transport office, Monrovia, or your county service centre" },
  "driver-licence-renewal": { feeUsd: 20, processingTime: "3 to 5 working days", collectionPoint: "Ministry of Transport office, Monrovia, or your county service centre" },
  "vehicle-registration": { feeUsd: 40, processingTime: "3 to 5 working days", collectionPoint: "Ministry of Transport office, Monrovia" },
  "marriage-certificate": { feeUsd: 15, processingTime: "5 to 7 working days", collectionPoint: "Ministry of Internal Affairs office or your county administration office" },
  "work-permit": { feeUsd: 100, processingTime: "10 to 15 working days", collectionPoint: "Ministry of Labour, Monrovia" },
  "deed-registration": { feeUsd: 30, processingTime: "15 to 30 working days", collectionPoint: "Liberia Land Authority office, Monrovia" },
};

export function serviceDetails(id: string): ServiceDetails {
  return (
    SERVICE_DETAILS[id] ?? {
      feeUsd: 0,
      processingTime: "Varies by institution",
      collectionPoint: "Your county service centre",
    }
  );
}

/* US dollar to Liberian dollar rate used wherever a fee is shown in both
   currencies: the Central Bank of Liberia market midpoint (buying
   L$163.31, selling L$165.45) of Wednesday 25 November 2026. Shown on the
   page wherever it is used, so the person can see the rate behind the
   LRD figure. */
export const USD_TO_LRD_RATE = 164.38;
export const USD_TO_LRD_RATE_LABEL =
  "US$1 = L$164.38, Central Bank of Liberia market rate, 25 November 2026";

export function feeInLrd(feeUsd: number): number {
  return Math.round(feeUsd * USD_TO_LRD_RATE);
}

/* ---------- priority and diaspora delivery pricing (shown before you apply, no hidden fees) ---------- */

export const FAST_TRACK_FEE_USD = 10;
export const EMERGENCY_FEE_USD = 25;
export const EMBASSY_DELIVERY_FEE_USD = 15;

export const EMBASSIES = [
  "Embassy of Liberia, Washington DC, United States",
  "Consulate of Liberia, New York, United States",
  "Embassy of Liberia, London, United Kingdom",
  "Embassy of Liberia, Paris, France",
  "Embassy of Liberia, Brussels, Belgium (also for the European Union)",
  "Embassy of Liberia, Berlin, Germany",
  "Embassy of Liberia, Rome, Italy",
  "Embassy of Liberia, Madrid, Spain",
  "Embassy of Liberia, Stockholm, Sweden",
  "Embassy of Liberia, Accra, Ghana",
  "Embassy of Liberia, Abidjan, Ivory Coast",
  "Embassy of Liberia, Conakry, Guinea",
  "Embassy of Liberia, Freetown, Sierra Leone",
  "Embassy of Liberia, Abuja, Nigeria",
  "Embassy of Liberia, Dakar, Senegal",
  "Embassy of Liberia, Yaounde, Cameroon",
  "Embassy of Liberia, Addis Ababa, Ethiopia",
  "Embassy of Liberia, Pretoria, South Africa",
  "Embassy of Liberia, Rabat, Morocco",
  "Embassy of Liberia, Cairo, Egypt",
  "Embassy of Liberia, Beijing, China",
  "Embassy of Liberia, Tokyo, Japan",
  "Embassy of Liberia, New Delhi, India",
  "Embassy of Liberia, Seoul, South Korea",
  "Embassy of Liberia, Doha, Qatar",
  "Embassy of Liberia, Kuwait City, Kuwait",
];

/* ---------- diaspora worldwide: countries, timezones, embassies ---------- */

export const COUNTRIES = [
  "Albania", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus",
  "Belgium", "Benin", "Bosnia and Herzegovina", "Botswana", "Brazil", "Bulgaria", "Burkina Faso", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic",
  "Chad", "Chile", "China", "Colombia", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo", "Denmark", "Dominican Republic", "Egypt",
  "Estonia", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Guinea",
  "Guinea-Bissau", "Haiti", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Laos", "Latvia", "Lebanon", "Liberia", "Lithuania", "Luxembourg",
  "Malaysia", "Mali", "Malta", "Mauritania", "Mexico", "Moldova", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nepal", "Netherlands", "New Zealand", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Papua New Guinea", "Peru", "Philippines",
  "Poland", "Portugal", "Qatar", "Republic of the Congo", "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Tanzania", "Thailand",
  "Togo", "Trinidad and Tobago", "Turkey", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uzbekistan", "Vietnam", "Yemen", "Zambia",
  "Zimbabwe", "Other country",
];

/* International dialling codes for the phone country picker, keyed by the
   country names in COUNTRIES. "Other country" has no single code and is not
   offered in the picker. */
export const DIAL_CODES: Record<string, string> = {
  "Liberia": "231", "United States": "1", "Canada": "1", "United Kingdom": "44", "Ireland": "353", "France": "33", "Germany": "49", "Belgium": "32", "Netherlands": "31", "Spain": "34", "Portugal": "351", "Italy": "39", "Switzerland": "41", "Austria": "43", "Sweden": "46", "Norway": "47", "Denmark": "45", "Finland": "358", "Poland": "48", "Greece": "30", "Czech Republic": "420", "Hungary": "36", "Romania": "40", "Ukraine": "380", "Russia": "7", "Turkey": "90", "Israel": "972", "United Arab Emirates": "971", "Qatar": "974", "Saudi Arabia": "966", "Kuwait": "965", "Egypt": "20", "Morocco": "212", "Ethiopia": "251", "Kenya": "254", "Tanzania": "255", "Uganda": "256", "Rwanda": "250", "South Africa": "27", "Nigeria": "234", "Ghana": "233", "Ivory Coast": "225", "Guinea": "224", "Sierra Leone": "232", "Senegal": "221", "Mali": "223", "Burkina Faso": "226", "Niger": "227", "Cameroon": "237", "Gabon": "241", "Republic of the Congo": "242", "Democratic Republic of the Congo": "243", "Angola": "244", "Zambia": "260", "Zimbabwe": "263", "Mozambique": "258", "Namibia": "264", "Botswana": "267", "Togo": "228", "Benin": "229", "Gambia": "220", "Guinea-Bissau": "245", "Cape Verde": "238", "Mauritania": "222", "Chad": "235", "Sudan": "249", "South Sudan": "211", "Central African Republic": "236", "China": "86", "Japan": "81", "South Korea": "82", "India": "91", "Pakistan": "92", "Bangladesh": "880", "Philippines": "63", "Indonesia": "62", "Malaysia": "60", "Singapore": "65", "Thailand": "66", "Vietnam": "84", "Australia": "61", "New Zealand": "64", "Brazil": "55", "Mexico": "52", "Argentina": "54", "Chile": "56", "Colombia": "57", "Peru": "51", "Jamaica": "1876", "Trinidad and Tobago": "1868", "Barbados": "1246", "Bahamas": "1242", "Haiti": "509", "Dominican Republic": "1809", "Cuba": "53", "Iceland": "354", "Luxembourg": "352", "Malta": "356", "Cyprus": "357", "Estonia": "372", "Latvia": "371", "Lithuania": "370", "Slovakia": "421", "Slovenia": "386", "Croatia": "385", "Serbia": "381", "Bulgaria": "359", "Albania": "355", "North Macedonia": "389", "Montenegro": "382", "Bosnia and Herzegovina": "387", "Moldova": "373", "Belarus": "375", "Georgia": "995", "Armenia": "374", "Azerbaijan": "994", "Kazakhstan": "7", "Uzbekistan": "998", "Iraq": "964", "Iran": "98", "Jordan": "962", "Lebanon": "961", "Yemen": "967", "Oman": "968", "Bahrain": "973", "Sri Lanka": "94", "Nepal": "977", "Myanmar": "95", "Cambodia": "855", "Laos": "856", "Mongolia": "976", "Papua New Guinea": "675", "Fiji": "679",
};

export const TIMEZONES = [
  "Africa/Monrovia", "Africa/Accra", "Africa/Abidjan", "Africa/Lagos", "Africa/Dakar", "Africa/Conakry", "Africa/Freetown", "Africa/Johannesburg", "Africa/Nairobi", "Africa/Cairo", "Africa/Casablanca", "Europe/London", "Europe/Paris", "Europe/Brussels", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Dublin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo", "America/Santiago", "Asia/Dubai", "Asia/Qatar", "Asia/Riyadh", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore", "Asia/Manila", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Australia/Perth", "Pacific/Auckland", "UTC",
];

/* ---------- embassy directory (batch five) ---------- */

export interface EmbassyInfo { name: string; city: string; country: string; collects: string[]; hours: string; contact: string; }

export const EMBASSY_DIRECTORY: EmbassyInfo[] = [
  { name: "Embassy of Liberia, Washington DC, United States", city: "Washington DC", country: "United States", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Consulate of Liberia, New York, United States", city: "New York", country: "United States", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, London, United Kingdom", city: "London", country: "United Kingdom", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Paris, France", city: "Paris", country: "France", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Brussels, Belgium (also for the European Union)", city: "Brussels", country: "Belgium", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Berlin, Germany", city: "Berlin", country: "Germany", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Rome, Italy", city: "Rome", country: "Italy", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Madrid, Spain", city: "Madrid", country: "Spain", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Stockholm, Sweden", city: "Stockholm", country: "Sweden", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Accra, Ghana", city: "Accra", country: "Ghana", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Abidjan, Ivory Coast", city: "Abidjan", country: "Ivory Coast", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Conakry, Guinea", city: "Conakry", country: "Guinea", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Freetown, Sierra Leone", city: "Freetown", country: "Sierra Leone", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Abuja, Nigeria", city: "Abuja", country: "Nigeria", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Dakar, Senegal", city: "Dakar", country: "Senegal", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Yaounde, Cameroon", city: "Yaounde", country: "Cameroon", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Addis Ababa, Ethiopia", city: "Addis Ababa", country: "Ethiopia", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Pretoria, South Africa", city: "Pretoria", country: "South Africa", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Rabat, Morocco", city: "Rabat", country: "Morocco", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Cairo, Egypt", city: "Cairo", country: "Egypt", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Beijing, China", city: "Beijing", country: "China", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Tokyo, Japan", city: "Tokyo", country: "Japan", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, New Delhi, India", city: "New Delhi", country: "India", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Seoul, South Korea", city: "Seoul", country: "South Korea", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Doha, Qatar", city: "Doha", country: "Qatar", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
  { name: "Embassy of Liberia, Kuwait City, Kuwait", city: "Kuwait City", country: "Kuwait", collects: ["Passports", "Birth and other certificates", "National ID cards", "Official documents for delivery"], hours: "Monday to Friday, 9:00 AM to 4:00 PM local time", contact: "Fastest: the embassy space inside your PortaGov application. The embassy confirms collection times there." },
];

export const SERVICE_CENTRE_HOURS = "Monday to Friday, 8:00 AM to 4:00 PM. Saturday morning at the Monrovia centre.";
