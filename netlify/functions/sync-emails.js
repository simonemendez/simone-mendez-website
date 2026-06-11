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
  "thank you for applying", "thanks for applying", "thank you for your interest",
  "application received", "application submitted", "application confirmation",
  "we received your application", "received your application",
  "your application for", "your application to", "your application has been",
  "application has been received", "your recent job application",
  "recent job application", "job application for",
  "moving forward", "not moving forward", "not selected",
  "your candidacy", "candidate", "for the position", "for this position",
  "interview", "phone screen", "phone screening", "brief phone screening",
  "screening call", "recruiter screen", "schedule", "recruiter",
  "hiring manager", "next steps",
  "offer", "job offer", "offer of employment", "pleased to offer",
  "offer letter", "you have been hired", "you're hired",
  "welcome aboard", "welcome to the team", "onboarding", "start date"
];

const NOISE_SIGNALS = [
  "membership", "planet fitness", "gym", "subscription", "newsletter",
  "verify your email", "confirm your email", "password reset", "reset your password",
  "order confirmation", "your order", "your receipt", "invoice", "free trial",
  "webinar", "promo", "% off", "sale ends"
];

const COMPANY_BLOCKLIST = new Set([
  "your earliest convenience", "earliest convenience", "this position",
  "the position", "this role", "the role", "this time", "our team", "the team",
  "us", "you", "your application", "our company", "the company", "the following",
  "this opportunity", "the opportunity", "your interest", "your resume",
  "your account", "the hiring team", "our records", "your profile""doctor","yourdoctor",
"appointment",
"medical",
"patient",
"tanf",
"benefits",
"vacation",
"cruise",
"travel",
"reservation"
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\u034f/g, " ")
    .replace(/\u200b/g, " ")
    .replace(/\u200c/g, " ")
    .replace(/\u200d/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(raw) {
  if (!raw) return "";
  let text = normalizeText(raw);

  const stops = [
    " - ", " — ", " – ", " · ", " • ", " | ", "! ", "? ", ": ", "; ",
    " regarding ", " ("
  ];

  let cutAt = text.length;
  for (const stop of stops) {
    const idx = text.indexOf(stop);
    if (idx > 0 && idx < cutAt) cutAt = idx;
  }

  text = text.slice(0, cutAt);
  text = text.split(/\.\s+(?=Your|We|Thank|Thanks|Please|The|This|You|Our|Best|Hi|Hello|Dear|Congratulations|Unfortunately)/)[0];

  text = text
    .replace(/[\s.,!?:;·•|–—-]+$/g, "")
    .replace(/\s+(team|careers|recruiting|talent acquisition)$/i, "")
    .replace(/^the\s+/i, "")
    .trim();

  if (text.length > 90) text = text.slice(0, 90).trim();
  return text;
}

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

function extractCompany(subject, fullText) {
  const sources = [subject, fullText];

  const patterns = [
    /application was sent to\s+([^\n\r]+)/i,
    /your application was sent to\s+([^\n\r]+)/i,
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
    /(?:join|joining)\s+(?:the\s+)?(.+?)\s+(?:team|family)\b/i
  ];

  for (const pattern of patterns) {
    for (const src of sources) {
      if (!src) continue;
      const match = src.match(pattern);
      if (match && match[1]) {
        const company = cleanText(match[1]);
        if (company && company.length >= 2 && !looksLikeJunkCompany(company)) {
          return company;
        }
      }
    }
  }

  return "";
}

if (isLinkedIn) {
  const linkedInTitle = extractLinkedInPosition(fullText, company);
  if (linkedInTitle) return linkedInTitle;
}
  if (!fullText || !company) return "";

  const text = normalizeText(fullText);
  const companyName = cleanText(company);
  const companyEsc = escapeRegex(companyName);

  const pattern = new RegExp(
    "your application was sent to\\s+" +
      companyEsc +
      "\\s+(.+?)\\s+" +
      companyEsc +
      "\\s*[·•|]",
    "i"
  );

  const match = text.match(pattern);

  if (match && match[1]) {
    const title = cleanText(match[1]);

    if (
      title &&
      title.toLowerCase() !== companyName.toLowerCase() &&
      !title.toLowerCase().includes("your application was sent")
    ) {
      return title;
    }
  }

  return "";
}

function extractPosition(subject, fullText, isLinkedIn, company) {
  if (isLinkedIn) {
    const linkedInTitle = extractLinkedInPosition(fullText, company);
    if (linkedInTitle) return linkedInTitle;
  }

  const sources = [subject, fullText];

  const patterns = [
    /your recent job application for\s+(.+?)(?:,| - |$)/i,
    /recent job application for\s+(.+?)(?:,| - |$)/i,
    /job application for\s+(.+?)(?:,| - |$)/i,
    /you applied to\s+(.+?)\s+at\s+/i,
    /application for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /applied for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /your application for (?:the\s+)?(.+?)\s+(?:position|role|at|has|was)/i,
    /for the\s+(.+?)\s+(?:position|role)/i,
    /(?:position|role|job title)\s*[:\-]\s*(.+)/i,
    /offer you (?:the\s+)?(?:position|role)\s+of\s+(.+?)\s+(?:at|with|\.)/i,
    /position of\s+(.+?)\s+(?:at|with)\b/i
  ];

  for (const pattern of patterns) {
    for (const src of sources) {
      if (!src) continue;
      const match = src.match(pattern);
      if (match && match[1]) {
        const role = cleanText(match[1]);

        if (
          role &&
          role.length >= 2 &&
          !role.toLowerCase().includes("your application was sent")
        ) {
          return role;
        }
      }
    }
  }

  return "Position not found";
}

function deriveStatus(subject, fullText) {
  const text = `${subject || ""}\n${fullText || ""}`.toLowerCase();

  if (/\b(not selected|unfortunately|not moving forward|other candidates?|another candidate|regret to inform|decided not to|will not be moving|pursue other|moved? forward with (?:other|another)|no longer|reject|declined|withdrawn|cancelled|canceled)\b/.test(text)) {
    return "Rejected";
  }

if (/\b(pleased to offer|happy to offer|glad to offer|excited to offer|we would like to offer|offer of employment|job offer|offer letter|formal offer|extend(?:ing|ed)? (?:you )?(?:an|the)? ?offer|you have been hired|you're hired|employment agreement)\b/.test(text)) {
  return "Offer";
}

  if (/(brief\s+phone\s+screening|phone\s+screening|phone\s+screen|screening\s+call|recruiter\s+screen|phone\s+interview|video\s+interview|virtual\s+interview|\binterview\b|interview\s+scheduled|next\s+round|hiring\s+manager|recruiter\s+call)/i.test(text)) {
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

  while (url && messages.length < max && pages < 30) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.body-content-type="text"'
      }
    });

    const data = await res.json();

    if (!Array.isArray(data.value)) {
      if (messages.length === 0) {
        throw new Error(data.error?.message || "Mail fetch failed");
      }
      break;
    }

    messages.push(...data.value);
    url = data["@odata.nextLink"] || null;
    pages++;
  }

  return messages.slice(0, max);
}

exports.handler = async () => {
  try {
    const tokenData = await getAccessToken();

    if (!tokenData.access_token) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "Token refresh failed",
          detail: tokenData
        })
      };
    }

    const accessToken = tokenData.access_token;
    const select = "id,subject,from,receivedDateTime,bodyPreview,body";

    const linkedInFilter = "from/emailAddress/address eq 'jobs-noreply@linkedin.com'";
    const linkedInUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(linkedInFilter)}` +
      `&$top=100&$select=${select}`;

    const query =
      'application received OR application submitted OR thank you for applying OR thanks for applying OR thank you for your interest OR your application OR your recent job application OR job application for OR move forward OR not selected OR interview OR phone screen OR phone screening OR brief phone screening OR screening call OR candidacy OR offer OR "job offer" OR "offer of employment" OR onboarding OR "welcome to the team" OR "you have been hired" OR schedule OR "next steps" OR "phone call" OR "video interview" OR "hiring manager" OR recruiter OR "start date"';

    const searchUrl =
  `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"` +
  `&$top=100&$select=${select}`;

const recentUrl =
  `https://graph.microsoft.com/v1.0/me/messages?$top=200&$orderby=receivedDateTime desc&$select=${select}`;
    
    let linkedInMessages = [];
let searchMessages = [];
let recentMessages = [];

    try {
      linkedInMessages = await fetchAllMessages(linkedInUrl, accessToken, 3000);
    } catch (e) {
      console.error("LinkedIn fetch error:", e);
    }

    try {
      searchMessages = await fetchAllMessages(searchUrl, accessToken, 1500);
    } catch (e) {
      console.error("Search fetch error:", e);
    }
try {
  recentMessages = await fetchAllMessages(recentUrl, accessToken, 200);
} catch (e) {
  console.error("Recent fetch error:", e);
}
    if (linkedInMessages.length === 0 && searchMessages.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          applications: [],
          count: 0,
          warning: "No messages found."
        })
      };
    }

    const byId = new Map();

    for (const message of [...linkedInMessages, ...searchMessages, ...recentMessages]) {
      if (message && message.id && !byId.has(message.id)) {
        byId.set(message.id, message);
      }
    }

    const applications = [];

    for (const email of byId.values()) {
      const subject = email.subject || "";
      const sender = (email.from?.emailAddress?.address || "").toLowerCase();
      const preview = email.bodyPreview || "";
      const body = email.body?.content || "";
      const fullText = normalizeText(`${subject}\n${preview}\n${body}`);
      const haystack = fullText.toLowerCase();
      const date = email.receivedDateTime?.split("T")[0] || "";
      const isLinkedIn = sender.includes("linkedin.com");

      if (isLinkedIn) {
        if (
          !haystack.includes("application") &&
          !haystack.includes("applied") &&
          !haystack.includes("submitted")
        ) {
          continue;
        }
      } else {
        const isNoise = NOISE_SIGNALS.some(sig => haystack.includes(sig));
        const isJob = JOB_SIGNALS.some(sig => haystack.includes(sig));
        if (isNoise || !isJob) continue;
      }

      let company = extractCompany(subject, fullText);

      if (!company && !isLinkedIn) {
        const domain = sender.split("@")[1] || "";
        const root = domain.split(".")[0] || "";

        if (root && root.length > 2 && !GENERIC_DOMAINS.has(root)) {
          company = root.charAt(0).toUpperCase() + root.slice(1);
        }
      }

      if (!company && isLinkedIn) {
        company = "Unknown Company";
      } else if (!company) {
        continue;
      }

      const status = deriveStatus(subject, fullText);
      const position = extractPosition(subject, fullText, isLinkedIn, company);

      applications.push({
        id: email.id,
        company,
        position,
        dateApplied: date,
        status,
        notes: preview.substring(0, 150)
      });
    }

    applications.sort((a, b) => (b.dateApplied || "").localeCompare(a.dateApplied || ""));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        applications,
        count: applications.length,
        debug: {
          linkedInMessages: linkedInMessages.length,
          searchMessages: searchMessages.length,
          uniqueMessages: byId.size
        }
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: err.message,
        stack: err.stack
      })
    };
  }
};
