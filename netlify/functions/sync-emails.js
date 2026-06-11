const GENERIC_DOMAINS = new Set([
  "linkedin", "indeed", "ziprecruiter", "glassdoor", "monster", "dice",
  "greenhouse", "greenhouse-mail", "lever", "hire", "myworkday", "workday",
  "wd1", "wd5", "ashbyhq", "ashby", "smartrecruiters", "jobvite", "taleo",
  "icims", "bamboohr", "workable", "rippling", "gem", "notifications",
  "noreply", "no-reply", "mail", "email", "gmail", "outlook", "hotmail",
  "yahoo", "icloud", "live", "msn", "aol"
]);

const JOB_SIGNALS = [
  "application was sent to", "your application was sent", "you applied to",
  "thank you for applying", "thanks for applying", "application received",
  "we received your application", "received your application",
  "your application for", "your application to", "your application has been",
  "application has been received", "moving forward", "not moving forward",
  "not selected", "your candidacy", "candidate", "for the position",
  "for this position", "interview", "phone screen", "phone screening",
  "schedule", "recruiter", "hiring manager", "next steps",
  "offer", "job offer", "offer of employment", "pleased to offer", "offer letter",
  "you have been hired", "you're hired", "welcome aboard", "welcome to the team",
  "onboarding", "start date"
];

const NOISE_SIGNALS = [
  "membership", "planet fitness", "gym", "subscription", "newsletter",
  "verify your email", "confirm your email", "password reset", "reset your password",
  "order confirmation", "your order", "your receipt", "invoice", "free trial",
  "webinar", "promo", "% off", "sale ends", "unsubscribe", "preferences"
];

const COMPANY_BLOCKLIST = new Set([
  "your earliest convenience", "earliest convenience", "this position",
  "the position", "this role", "the role", "this time", "our team", "the team",
  "us", "you", "your application", "our company", "the company", "the following",
  "this opportunity", "the opportunity", "your interest", "your resume",
  "your account", "the hiring team", "our records", "your profile"
]);

function looksLikeJunkCompany(name) {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  if (n.length < 2) return true;
  if (COMPANY_BLOCKLIST.has(n)) return true;
  if (/^(your|our|my|the|a|an|this|that|these|those|their|his|her|its|we|you|us)\b/.test(n)) return true;
  if (!/[a-z]/i.test(n)) return true;
  return false;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(raw) {
  if (!raw) return "";
  let name = String(raw).trim();
  const stops = [" - ", " — ", " – ", " · ", " • ", " | ", "! ", "? ", ": ", "; ", " for ", " regarding ", " ("];
  let cutAt = name.length;
  for (const s of stops) {
    const idx = name.indexOf(s);
    if (idx > 0 && idx < cutAt) cutAt = idx;
  }
  name = name.slice(0, cutAt);
  name = name.split(/\.\s+(?=Your|We|Thank|Thanks|Please|The|This|You|Our|Best|Hi|Hello|Dear|Congratulations|Unfortunately)/)[0];
  name = name.replace(/[\s.,!?:;·•|–—-]+$/g, "").trim();
  name = name.replace(/\s+(team|careers|recruiting|talent acquisition)$/i, "").trim();
  name = name.replace(/^the\s+/i, "").trim();
  if (name.length > 70) name = name.slice(0, 70).trim();
  return name;
}

function extractCompany(subject, preview) {
  const sources = [subject, preview];
  const patterns = [
    /application was sent to\s+([^\n\r]+)/i,
    /you applied to .+? at\s+([^\n\r]+)/i,
    /thank you for applying (?:to|at|with)\s+([^\n\r]+)/i,
    /thanks for applying (?:to|at|with)\s+([^\n\r]+)/i,
    /your application (?:to|with|at)\s+([^\n\r]+)/i,
    /application (?:to|with|at)\s+([^\n\r]+)/i,
    /interview with\s+([^\n\r]+)/i,
    /your candidacy (?:at|with|for)\s+([^\n\r]+)/i,
    /position at\s+([^\n\r]+)/i,
    /(?:role|opportunity) at\s+([^\n\r]+)/i,
    /offer (?:you )?(?:the\s+)?(?:position|role|job)[^\n\r]*?\b(?:at|with)\s+([^\n\r]+)/i,
    /welcome to\s+(?:the\s+)?(.+?)\s+(?:team|family)\b/i,
    /(?:join|joining)\s+(?:the\s+)?(.+?)\s+(?:team|family)\b/i,
    /interview (?:with|at)\s+([^\n\r]+)/i,
    /phone (?:screen|interview) (?:with|at)\s+([^\n\r]+)/i
  ];

  for (const pattern of patterns) {
    for (const src of sources) {
      if (!src) continue;
      const match = src.match(pattern);
      if (match && match[1]) {
        const company = cleanText(match[1]);
        if (company && company.length >= 2 && !looksLikeJunkCompany(company)) return company;
      }
    }
  }
  return "";
}

function extractLinkedInPosition(preview, company) {
  if (!preview) return "";
  const p = preview.replace(/\s+/g, " ").trim();
  const comp = (company || "").toLowerCase().trim();

  const isLocationOnly = (s) =>
    /^(remote|on-?site|hybrid|united states|usa|us|[a-z .'\-]+,\s*[a-z]{2}\b.*)$/i.test(s.trim());

  const stripNoise = (s) => {
    let t = s.replace(/.*?your application was sent to\s+/i, "");
    if (comp) t = t.replace(new RegExp("^\\s*" + escapeRegex(company) + "\\b[\\s:.,–—-]*", "i"), "");
    return t.trim();
  };

  const isBoilerplate = (s) =>
    /^(see |view |apply|applied|your application|track|manage|premium|linkedin|unsubscribe|get |download|jobs? you|similar|recommended|more jobs)/i.test(s.trim());

  if (comp) {
    const anchor = p.match(new RegExp(escapeRegex(company) + "\\s*[·•|]", "i"));
    if (anchor && anchor.index > 0) {
      const title = cleanText(stripNoise(p.slice(0, anchor.index)));
      if (title && title.toLowerCase() !== comp && !isLocationOnly(title)) return title;
    }
  }

  const after = stripNoise(p);
  if (after && !isBoilerplate(after)) {
    const seg = cleanText(after.split(/[·•|]/)[0]);
    if (seg && seg.toLowerCase() !== comp && !isLocationOnly(seg) && !isBoilerplate(seg)) return seg;
  }
  return "";
}

function extractPosition(subject, preview, isLinkedIn, company) {
  const sources = [subject, preview];
  const patterns = [
    /you applied to\s+(.+?)\s+at\s+/i,
    /application for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /applied for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /your application for (?:the\s+)?(.+?)\s+(?:position|role|at|has|was)/i,
    /for the\s+(.+?)\s+(?:position|role)/i,
    /(?:position|role|job title)\s*[:\-]\s+(.+)/i,
    /offer you (?:the\s+)?(?:position|role)\s+of\s+(.+?)\s+(?:at|with|\.)/i,
    /position of\s+(.+?)\s+(?:at|with)\b/i,
    /(?:phone\s+)?(?:screen|interview) (?:for|re)?(?::\s+)?(.+)/i
  ];
  for (const pattern of patterns) {
    for (const src of sources) {
      if (!src) continue;
      const match = src.match(pattern);
      if (match && match[1]) {
        const role = cleanText(match[1]);
        if (role && role.length >= 2) return role;
      }
    }
  }

  if (isLinkedIn) {
    const role = extractLinkedInPosition(preview, company);
    if (role) return role;
  }
  return "";
}

function deriveStatus(subject, preview) {
  const text = `${subject}\n${preview}`.toLowerCase();

  if (/\b(not selected|unfortunately|not moving forward|other candidates?|another candidate|regret to inform|decided not to|will not be moving|pursue other|moved? forward with (?:other|another)|no longer|reject|declined|withdrawn)\b/.test(text)) {
    return "Rejected";
  }

  if (/\b(pleased to offer|happy to offer|glad to offer|excited to offer|we would like to offer|offer of employment|job offer|offer letter|formal offer|extend(?:ing|ed)? (?:you )?(?:an|the)? ?offer|you have been hired|you're hired|welcome aboard|welcome to the team|onboarding|start date|joining us|pleased to announce|excited to welcome|congrats|congratulations)\b/.test(text) ||
      /\boffer\b/.test(text)) {
    return "Offer";
  }

  if (/\b(phone\s+screen(?:ing)?|phone\s+call|phone\s+interview|video\s+interview|virtual\s+interview|interview|schedule|interview scheduled|interview on|interview at|next (?:round|step)|screening|call with|time slot|calendar|zoom|teams|meet)\b/.test(text) &&
      !/\b(phone\s+number|phone\s+me|call\s+me|contact|email)\b/.test(text)) {
    return "Interview";
  }

  return "Applied";
}

async function getAccessToken() {
  const tokenParams = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    refresh_token: process.env.MS_REFRESH_TOKEN,
    grant_type: "refresh_token",
    scope: "offline_access Mail.Read"
  });

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    }
  );
  return tokenRes.json();
}

async function fetchAllMessages(initialUrl, accessToken, max = 1000) {
  const messages = [];
  let url = initialUrl;
  let pages = 0;

  while (url && messages.length < max && pages < 20) {
    const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: 'outlook.body-content-type="text"'
  }
});
    const data = await res.json();
    if (!Array.isArray(data.value)) {
      if (messages.length === 0) throw new Error(data.error?.message || "Mail fetch failed");
      break;
    }
    messages.push(...data.value);
    url = data["@odata.nextLink"] || null;
    pages++;
  }
  return messages;
}

exports.handler = async () => {
  try {
    const tokenData = await getAccessToken();
    if (!tokenData.access_token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Token refresh failed", detail: tokenData }) };
    }
    const accessToken = tokenData.access_token;
    const select = "id,subject,from,receivedDateTime,bodyPreview,body";

    const linkedInFilter = "from/emailAddress/address eq 'jobs-noreply@linkedin.com'";
    const linkedInUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(linkedInFilter)}` +
      `&$top=100&$select=${select}`;

    const query = 'application received OR thank you for applying OR your application OR move forward OR not selected OR interview OR phone screen OR phone screening OR candidacy OR offer OR "job offer" OR "offer of employment" OR onboarding OR "welcome to the team" OR "you have been hired" OR "schedule" OR "next steps" OR "phone call" OR "video interview" OR "hiring manager" OR "recruiter" OR "start date"';
    const searchUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"` +
      `&$top=100&$select=${select}`;

    let linkedInMessages = [];
    let searchMessages = [];
    try { linkedInMessages = await fetchAllMessages(linkedInUrl, accessToken, 2000); } catch (e) { console.error("LinkedIn fetch error:", e); }
    try { searchMessages = await fetchAllMessages(searchUrl, accessToken, 500); } catch (e) { console.error("Search fetch error:", e); }

    if (linkedInMessages.length === 0 && searchMessages.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Mail fetch failed" }) };
    }

    const byId = new Map();
    for (const m of [...linkedInMessages, ...searchMessages]) {
      if (m && m.id && !byId.has(m.id)) byId.set(m.id, m);
    }

    const applications = [];

    for (const email of byId.values()) {
      const subject = email.subject || "";
      const sender = (email.from?.emailAddress?.address || "").toLowerCase();
      const preview = email.bodyPreview || "";
      const date = email.receivedDateTime?.split("T")[0] || "";
const body = email.body?.content || "";
const fullText = `${subject}\n${preview}\n${body}`;
const haystack = fullText.toLowerCase();

const isLinkedIn = sender.includes("linkedin.com");

if (isLinkedIn) {
  if (
    !haystack.includes("application was sent") &&
    !haystack.includes("your application was sent to")
  ) {
    continue;
  }
} else {
  const isNoise = NOISE_SIGNALS.some(sig => haystack.includes(sig));
  const isJob = JOB_SIGNALS.some(sig => haystack.includes(sig));
  if (isNoise || !isJob) continue;
}

let company = extractCompany(subject, fullText);
      let company = extractCompany(subject, preview);

      if (!company && !isLinkedIn) {
        const domain = (sender.split("@")[1] || "");
        const root = domain.split(".")[0] || "";
        if (root && !GENERIC_DOMAINS.has(root)) {
          company = root.charAt(0).toUpperCase() + root.slice(1);
        }
      }

      if (!company && isLinkedIn) {   company = "Unknown Company"; } else if (!company) {   continue; }

      const status = deriveStatus(subject, preview);
      const position = extractPosition(subject, fullText, isLinkedIn, company) || "—";
console.log({
  company,
  position,
  subject
});
      applications.push({
        id: email.id,
        company,
        position,
        dateApplied: date,
        status,
        notes: preview.substring(0, 100)
      });
    }

    applications.sort((a, b) => (b.dateApplied || "").localeCompare(a.dateApplied || ""));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ applications, count: applications.length })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};
