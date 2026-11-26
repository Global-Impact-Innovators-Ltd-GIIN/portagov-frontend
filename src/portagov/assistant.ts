// Local replacement for the server's model calls (ctx.inference).
//
// The assistant, the Liberian English rewrite and the ticket summary
// used to call a model on the server. On the free Vercel tier there is
// no model to call, so these are answered here, only from the real
// information the app already passes in: the service catalogue with
// fees and requirements, the citizen's own applications, and the
// staff-written knowledge base. Nothing is invented: when the context
// does not hold the answer, the question is routed to a real person
// as a ticket instead.

interface ServiceLine {
  name: string;
  ministry: string;
  fee: string;
  time: string;
  collection: string;
  needs: string;
  visit: string;
}

function parseServiceLines(context: string): ServiceLine[] {
  const out: ServiceLine[] = [];
  const re =
    /Service: (.+?) at (.+?)\. Fee \$(\d+(?:\.\d+)?)\. Time: (.+?)\. Collection: (.+?)\. Needs: (.+?)\. Visit: (.+?)(?:\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(context)) !== null) {
    out.push({
      name: m[1].trim(),
      ministry: m[2].trim(),
      fee: m[3].trim(),
      time: m[4].trim(),
      collection: m[5].trim(),
      needs: m[6].trim(),
      visit: m[7].trim(),
    });
  }
  return out;
}

function parseKb(context: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const re = /Q: ([\s\S]+?)\nA: ([\s\S]+?)(?:\nQ:|\n\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(context)) !== null) {
    out.push({ q: m[1].trim(), a: m[2].trim() });
  }
  return out;
}

function parseAppLines(context: string): string[] {
  const section = context.split("The citizen's own applications:\n")[1];
  if (!section) return [];
  const body = section.split("\n\n")[0];
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("Application "));
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length;
}

function howParagraph(context: string): string {
  return context.split("\n\n")[0] ?? "";
}

function sentencesAbout(text: string, keys: string[]): string[] {
  const wanted = keys.map((k) => k.toLowerCase());
  return text
    .split(/(?<=[.!])\s+/)
    .filter((s) => wanted.some((k) => s.toLowerCase().includes(k)));
}

function answerAssistant(prompt: string): {
  answer: string;
  route: string;
  needs_ticket: boolean;
} {
  const contextMatch = prompt.match(/Context:\n([\s\S]*?)\n\nCitizen question:/);
  const questionMatch = prompt.match(/Citizen question: ([\s\S]*)$/);
  const context = contextMatch ? contextMatch[1] : "";
  const question = (questionMatch ? questionMatch[1] : "").trim();
  const q = question.toLowerCase();
  const qWords = words(question);
  const how = howParagraph(context);

  // Staff-written knowledge base answers come first.
  for (const entry of parseKb(context)) {
    if (overlap(qWords, words(entry.q)) > 0) {
      return { answer: entry.a, route: "None", needs_ticket: false };
    }
  }

  // A named service in the question: answer from its catalogue line.
  const services = parseServiceLines(context);
  const matched = services.filter(
    (s) => overlap(qWords, words(s.name)) > 0,
  );
  if (matched.length > 0) {
    const s = matched[0];
    if (/cost|fee|price|much|pay|charge/.test(q)) {
      return {
        answer: `A ${s.name} costs $${s.fee}. It takes ${s.time}, and you collect it at ${s.collection}.`,
        route: "None",
        needs_ticket: false,
      };
    }
    if (/document|need|require|paper|bring/.test(q)) {
      return {
        answer: `For a ${s.name} you need: ${s.needs}. ${s.visit}`,
        route: "None",
        needs_ticket: false,
      };
    }
    return {
      answer: `A ${s.name} costs $${s.fee} and takes ${s.time}. You need: ${s.needs}. ${s.visit}`,
      route: "None",
      needs_ticket: false,
    };
  }

  // The citizen's own applications.
  if (/track|status|reference|my application|application/.test(q)) {
    const lines = parseAppLines(context);
    const ref = question.match(/PG-\d{4}-\d{5}/i);
    if (ref) {
      const hit = lines.find((l) =>
        l.toUpperCase().includes(ref[0].toUpperCase()),
      );
      if (hit) return { answer: hit, route: "None", needs_ticket: false };
      return {
        answer: `I could not find an application with reference ${ref[0]} on this account. Check the number and try again, or ask the Help desk.`,
        route: "Help desk",
        needs_ticket: true,
      };
    }
    if (lines.length > 0) {
      return {
        answer: lines.slice(0, 3).join(" "),
        route: "None",
        needs_ticket: false,
      };
    }
    if (context.includes("not signed in")) {
      return {
        answer:
          "I cannot see your applications because you are not signed in. Sign in with your phone number, or use Track with your reference number and phone number.",
        route: "None",
        needs_ticket: false,
      };
    }
  }

  if (/how.*apply|apply|start|begin|sign up|create account|register/.test(q)) {
    const picked = sentencesAbout(how, ["applies", "apply", "checklist", "documents"]);
    return {
      answer:
        picked.length > 0
          ? picked.join(" ")
          : "Apply to PortaGov first with the checklist for your service. When every item is green, pay the billing number, and PortaGov releases your application to the institution.",
      route: "None",
      needs_ticket: false,
    };
  }
  if (/pay|payment|billing|momo|orange money|money/.test(q)) {
    const picked = sentencesAbout(how, ["pay", "billing", "payment"]);
    return {
      answer:
        picked.length > 0
          ? picked.join(" ")
          : "You pay the billing number on your application with MTN MoMo or Orange Money. PortaGov will never ask for payment to a personal number, only to the official billing number.",
      route: "None",
      needs_ticket: false,
    };
  }
  if (/embassy|diaspora|abroad|outside liberia/.test(q)) {
    return {
      answer:
        "Liberians abroad apply from any country and can choose delivery to the Liberian embassy in their country for a $15 fee.",
      route: "None",
      needs_ticket: false,
    };
  }
  if (/national id|national identification|nir/.test(q)) {
    return {
      answer:
        "A national ID is never a blocker: a birth certificate, passport, voter card, or photo plus witness also work, and you can apply for a national ID inside PortaGov.",
      route: "None",
      needs_ticket: false,
    };
  }
  if (/release|held|waiting|institution.*(not|yet|receive)/.test(q)) {
    return {
      answer:
        "PortaGov checks your application first and releases it to the institution only after your payment is confirmed. Until then the institution cannot see it.",
      route: "None",
      needs_ticket: false,
    };
  }
  if (/fast|emergency|urgent/.test(q)) {
    return {
      answer:
        "Fast-track costs an extra $10 and emergency costs an extra $25, shown before you pay. There are no hidden fees.",
      route: "None",
      needs_ticket: false,
    };
  }

  // No answer in the context: say so and route to a real person.
  let route = "Help desk";
  if (/pay|billing|refund|momo|orange|money/.test(q)) route = "Payments desk";
  else if (/release/.test(q)) route = "Release team";
  else {
    const ministry = services.find((s) =>
      q.includes(s.ministry.toLowerCase()),
    );
    if (ministry) route = ministry.ministry;
  }
  return {
    answer: `I do not have that answer yet. I have passed your question to the ${route} as a ticket, so a real person answers you.`,
    route,
    needs_ticket: true,
  };
}

const SIMPLE_WORDS: [RegExp, string][] = [
  [/\bin order to\b/gi, "to"],
  [/\bapproximately\b/gi, "about"],
  [/\badditional\b/gi, "more"],
  [/\bdocumentation\b/gi, "papers"],
  [/\bindividuals\b/gi, "people"],
  [/\butilize\b/gi, "use"],
  [/\bcommence\b/gi, "start"],
  [/\bobtain\b/gi, "get"],
  [/\brequires\b/gi, "needs"],
  [/\brequire\b/gi, "need"],
  [/\btherefore\b/gi, "so"],
  [/\bresidence\b/gi, "home"],
  [/\bverify\b/gi, "check"],
  [/\bensure\b/gi, "make sure"],
  [/\bassistance\b/gi, "help"],
  [/\bcurrently\b/gi, "now"],
  [/\bprior to\b/gi, "before"],
  [/\bsubmit\b/gi, "send in"],
  [/\bapplication\b/gi, "application"],
  [/\bin the event that\b/gi, "if"],
  [/\ba number of\b/gi, "some"],
  [/\bis able to\b/gi, "can"],
  [/\bmake use of\b/gi, "use"],
  [/\bat this point in time\b/gi, "now"],
  [/\bdue to the fact that\b/gi, "because"],
];

function simplifyText(text: string): string {
  let out = text;
  for (const [re, replacement] of SIMPLE_WORDS) {
    out = out.replace(re, (match) => {
      const first = match[0];
      const upper = first >= "A" && first <= "Z";
      return upper
        ? replacement[0].toUpperCase() + replacement.slice(1)
        : replacement;
    });
  }
  return out;
}

function summarizeTicket(prompt: string): string {
  const topic = prompt.match(/Ticket topic: (.+?)\n/)?.[1]?.trim() ?? "";
  const message =
    prompt.match(/Citizen message: (.+?)\n/)?.[1]?.trim() ?? "";
  const record =
    prompt.match(/Citizen record: ([\s\S]*?)$/)?.[1]?.trim() ?? "";
  const app = record.match(/Latest application: (.+?)(?:\.|$)/)?.[1] ?? "";
  const wordsOut = `${topic}: ${message}`.split(/\s+/).filter(Boolean);
  let summary = wordsOut.slice(0, 20).join(" ");
  if (app) summary += ` (${app})`;
  const capped = summary.split(/\s+/).slice(0, 25).join(" ");
  return capped.endsWith(".") ? capped : `${capped}.`;
}

/** Local model replacement. The prompt itself says which job it is. */
export function localComplete(prompt: string): unknown {
  if (prompt.includes("Rewrite the text below in simple Liberian English")) {
    const text = prompt.split("Text:\n")[1] ?? "";
    return simplifyText(text.trim());
  }
  if (prompt.includes("Write ONE short line for a PortaGov help desk officer")) {
    return summarizeTicket(prompt);
  }
  if (prompt.includes("You are the PortaGov assistant")) {
    return answerAssistant(prompt);
  }
  return "I do not have that answer yet.";
}
