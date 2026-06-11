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
  "for this position", "interview", "offer", "job offer", "offer of employment",
  "pleased to offer", "offer letter", "you have been hired", "you're hired",
  "welcome aboard", "welcome to the team", "onboarding"
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
  "your account", "the hiring team", "our records", "your profile"
]);

function stripHTML(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, " ")
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
  let text = stripHTML(raw).trim();

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

function extractCompany(subject, preview, bodyText) {
  const sources = [subject, preview, bodyText];

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
        if (company && !looksLikeJunkCompany(company)) return company;
      }
    }
  }

  return "";
}

function extractLinkedInPosition(preview, bodyText, company) {
  const text = stripHTML(`${preview || ""} ${bodyText || ""}`);
  if (!text) return "";

  const comp = cleanText(company);
  const compEsc = comp ? escapeRegex(comp) : "";

  const badTitle = (s) => {
    const t = cleanText(s).toLowerCase();
    if (!t) return true;
    if (comp && t === comp.toLowerCase()) return true;
    if (/^(remote|hybrid|on-site|on site|united states|usa|us|[a-z .'-]+,\s*[a-z]{2})\b/i.test(t)) return true;
    if (/^(see|view|apply|applied|your application|track|manage|premium|linkedin|unsubscribe|get|download|recommended|similar|more jobs)/i.test(t)) return true;
    if (/application was sent/i.test(t)) return true;
    return false;
  };

  const cleanTitle = (s) => {
    let title = stripHTML(s);

    title = title.replace(/.*?your application was sent to\s+/i, "");
    if (compEsc) {
      title = title.replace(new RegExp("^\\s*" + compEsc + "\\b[\\s:.,–—-]*", "i"), "");
    }

    title = title
      .replace(/\b(remote|hybrid|on-site|on site)\b.*$/i, "")
      .replace(/\b(united states|usa|us)\b.*$/i, "")
      .replace(/\b[a-z .'-]+,\s*[a-z]{2}\b.*$/i, "")
      .trim();

    title = cleanText(title);
    return badTitle(title) ? "" : title;
  };

  if (compEsc) {
    const anchorRegex = new RegExp("(.{0,180})\\b" + compEsc + "\\b\\s*[·•|]", "i");
    const anchorMatch = text.match(anchorRegex);
    if (anchorMatch && anchorMatch[1]) {
      const possible = cleanTitle(anchorMatch[1]);
      if (possible) return possible;
    }
  }

  const sentRegex = /your application was sent to\s+(.+?)(?:\s{2,}|\.|$)/i;
  const sentMatch = text.match(sentRegex);
  if (sentMatch) {
    let after = text.slice(sentMatch.index + sentMatch[0].length).trim();

    if (compEsc) {
      after = after.replace(new RegExp("^\\s*" + compEsc + "\\b[\\s:.,–—-]*", "i"), "");
    }

    const possible = cleanTitle(after.split(/[·•|]/)[0]);
    if (possible) return possible;
  }

  const linkedInPatterns = [
    /(?:job title|position|role)\s*[:\-]\s*(.+?)(?:\s{2,}|Company|Location|$)/i,
    /applied for\s+(.+?)\s+(?:at|with)\s+/i,
    /you applied to\s+(.+?)\s+at\s+/i
  ];

  for (const pattern of linkedInPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const possible = cleanTitle(match[1]);
      if (possible) return possible;
    }
  }

  return "";
}

function extractPosition(subject, preview, bodyText, isLinkedIn, company) {
  const sources = [subject, preview, bodyText];

  const patterns = [
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
        if (role && role.length >= 2) return role;
      }
    }
  }

  if (isLinkedIn) {
    const role = extractLinkedInPosition(preview, bodyText, company);
    if (role) return role;
  }

  return "";
}

function deriveStatus(subject, preview, bodyText) {
  const text = `${subject || ""}\n${preview || ""}\n${bodyText || ""}`.toLowerCase();

  if (/\b(not selected|unfortunately|not moving forward|other candidates?|another candidate|regret to inform|decided not to|will not be moving|pursue other|moved? forward with (?:other|another))\b/.test(text)) {
    return "Rejected";
  }

  if (/\b(pleased to offer|happy to offer|glad to offer|excited to offer|we would like to offer|offer of employment|job offer|offer letter|formal offer|extend(?:ing|ed)? (?:you )?(?:an|the)? ?offer|you(?:'| a)?re hired|you have been hired|welcome aboard|welcome to the team|onboarding)\b/.test(text)) {
    return "Offer";
  }

  if (/\binterview\b|schedule (?:an?|the) (?:call|interview|time)|set up (?:an?|the) (?:call|interview)/.test(text)) {
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Token refresh failed", detail: tokenData })
      };
    }

    const accessToken = tokenData.access_token;

    // IMPORTANT: body is included so LinkedIn job titles can be pulled from the message body.
    const select = "id,subject,from,receivedDateTime,bodyPreview,body";

    const linkedInFilter = "from/emailAddress/address eq 'jobs-noreply@linkedin.com'";
    const linkedInUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(linkedInFilter)}` +
      `&$top=100&$select=${select}`;

    const query = 'application received OR thank you for applying OR your application OR move forward OR not selected OR interview OR candidacy OR offer OR "job offer" OR "offer of employment" OR "pleased to offer" OR hired OR onboarding OR "welcome to the team" OR greenhouse OR lever OR workday OR ashby OR "your application was sent to" OR "application was sent"';

    const searchUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"` +
      `&$top=100&$select=${select}`;

    let linkedInMessages = [];
    let searchMessages = [];

    try {
      linkedInMessages = await fetchAllMessages(linkedInUrl, accessToken, 3000);
    } catch (err) {
      console.log("LinkedIn fetch failed:", err.message);
    }

    try {
      searchMessages = await fetchAllMessages(searchUrl, accessToken, 1000);
    } catch (err) {
      console.log("Search fetch failed:", err.message);
    }

    if (linkedInMessages.length === 0 && searchMessages.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ applications: [], count: 0, warning: "No messages found." })
      };
    }

    const byId = new Map();

    for (const msg of [...linkedInMessages, ...searchMessages]) {
      if (msg && msg.id && !byId.has(msg.id)) {
        byId.set(msg.id, msg);
      }
    }

    const applications = [];

    for (const email of byId.values()) {
      const subject = email.subject || "";
      const sender = (email.from?.emailAddress?.address || "").toLowerCase();
      const preview = email.bodyPreview || "";
      const bodyText = stripHTML(email.body?.content || "");
      const date = email.receivedDateTime?.split("T")[0] || "";
      const haystack = `${subject}\n${preview}\n${bodyText}`.toLowerCase();

      const isLinkedIn = sender === "jobs-noreply@linkedin.com" || sender.includes("linkedin.com");

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

      let company = extractCompany(subject, preview, bodyText);

      if (!company && !isLinkedIn) {
        const domain = sender.split("@")[1] || "";
        const root = domain.split(".")[0] || "";

        if (root && !GENERIC_DOMAINS.has(root)) {
          company = root.charAt(0).toUpperCase() + root.slice(1);
        }
      }

      if (!company) continue;

      const status = deriveStatus(subject, preview, bodyText);
      const position =
        extractPosition(subject, preview, bodyText, isLinkedIn, company) ||
        "Position not found";

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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
