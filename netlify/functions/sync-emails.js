// Generic email providers and applicant-tracking / job-board domains. These are
// never real employer names, so we must never derive a company from them.
const GENERIC_DOMAINS = new Set([
  "linkedin", "indeed", "ziprecruiter", "glassdoor", "monster", "dice",
  "greenhouse", "greenhouse-mail", "lever", "hire", "myworkday", "workday",
  "wd1", "wd5", "ashbyhq", "ashby", "smartrecruiters", "jobvite", "taleo",
  "icims", "bamboohr", "workable", "rippling", "gem", "notifications",
  "noreply", "no-reply", "mail", "email", "gmail", "outlook", "hotmail",
  "yahoo", "icloud", "live", "msn", "aol"
]);

// Strong signals that an email really is about a job application. A non-LinkedIn
// email must match at least one of these to be counted.
const JOB_SIGNALS = [
  "application was sent to", "your application was sent", "you applied to",
  "thank you for applying", "thanks for applying", "application received",
  "we received your application", "received your application",
  "your application for", "your application to", "your application has been",
  "application has been received", "moving forward", "not moving forward",
  "not selected", "your candidacy", "candidate", "for the position",
  "for this position", "interview",
  // Offer / hire language so accepted-offer emails are recognized as applications.
  "offer", "job offer", "offer of employment", "pleased to offer", "offer letter",
  "you have been hired", "you're hired", "welcome aboard", "welcome to the team",
  "onboarding"
];

// Things that look like job emails to a broad search but are not (e.g. a gym
// membership "application", marketing, account housekeeping). These are dropped.
const NOISE_SIGNALS = [
  "membership", "planet fitness", "gym", "subscription", "newsletter",
  "verify your email", "confirm your email", "password reset", "reset your password",
  "order confirmation", "your order", "your receipt", "invoice", "free trial",
  "webinar", "promo", "% off", "sale ends"
];

// Phrases that a pattern can capture but that are clearly NOT a company name —
// usually because the surrounding sentence was about timing or the applicant
// rather than an employer (e.g. "...review your application at your earliest
// convenience" must never yield a company called "your earliest convenience").
const COMPANY_BLOCKLIST = new Set([
  "your earliest convenience", "earliest convenience", "this position",
  "the position", "this role", "the role", "this time", "our team", "the team",
  "us", "you", "your application", "our company", "the company", "the following",
  "this opportunity", "the opportunity", "your interest", "your resume",
  "your account", "the hiring team", "our records", "your profile"
]);

// Reject captured strings that are obviously not employer names.
function looksLikeJunkCompany(name) {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  if (n.length < 2) return true;
  if (COMPANY_BLOCKLIST.has(n)) return true;
  // A leading pronoun/article means we captured part of a sentence, not a name.
  if (/^(your|our|my|the|a|an|this|that|these|those|their|his|her|its|we|you|us)\b/.test(n)) return true;
  // Must contain at least one letter.
  if (!/[a-z]/i.test(n)) return true;
  return false;
}

// Escape a string so it can be embedded safely inside a dynamic RegExp.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Trim an extracted string down to just the name/title: stop at the first
// natural delimiter and strip surrounding noise.
function cleanText(raw) {
  if (!raw) return "";
  let name = String(raw).trim();
  // Cut at the first separator that signals the name has ended.
  const stops = [" - ", " — ", " – ", " · ", " • ", " | ", "! ", "? ", ": ", "; ",
                 " for ", " regarding ", " ("];
  let cutAt = name.length;
  for (const s of stops) {
    const idx = name.indexOf(s);
    if (idx > 0 && idx < cutAt) cutAt = idx;
  }
  name = name.slice(0, cutAt);
  // Stop at a sentence boundary, e.g. "Shopify. Your application has been received."
  // We only break on ". " when the next word clearly starts a new sentence, so
  // abbreviations inside a name (e.g. "St. Mary's School") are preserved.
  name = name.split(/\.\s+(?=Your|We|Thank|Thanks|Please|The|This|You|Our|Best|Hi|Hello|Dear|Congratulations|Unfortunately)/)[0];
  // Strip trailing punctuation / common filler words.
  name = name.replace(/[\s.,!?:;·•|–—-]+$/g, "").trim();
  name = name.replace(/\s+(team|careers|recruiting|talent acquisition)$/i, "").trim();
  name = name.replace(/^the\s+/i, "").trim();
  if (name.length > 70) name = name.slice(0, 70).trim();
  return name;
}

// Try a series of phrase patterns to pull the employer name out of the email.
function extractCompany(subject, preview) {
  const sources = [subject, preview];
  const patterns = [
    // LinkedIn quick/easy-apply confirmations: "your application was sent to X"
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
    // Offer / hire confirmations name the employer too.
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
        if (company && company.length >= 2 && !looksLikeJunkCompany(company)) return company;
      }
    }
  }
  return "";
}

// LinkedIn application-sent emails carry the company in the subject but the role
// applied for in the body. The body preview is shaped roughly like
//   "<greeting>, your application was sent to <Company>  <Job title>  <Company> · <Location> ..."
// or, in other variants, the job block comes first and the confirmation sentence
// trails it. The job title always sits next to the "<Company> · <Location>" block,
// so we anchor on that block, strip any confirmation sentence and a repeated
// company name, and keep what remains.
function extractLinkedInPosition(preview, company) {
  if (!preview) return "";
  const p = preview.replace(/\s+/g, " ").trim();
  const comp = (company || "").toLowerCase().trim();

  // Location-only segments (e.g. "Remote", "United States", "New York, NY") are
  // not job titles.
  const isLocationOnly = (s) =>
    /^(remote|on-?site|hybrid|united states|usa|us|[a-z .'-]+,\s*[a-z]{2}\b.*)$/i.test(s.trim());

  // Drop a leading greeting + "your application was sent to <Company>" sentence and
  // any immediately repeated company name, leaving just the job-detail text.
  const stripNoise = (s) => {
    let t = s.replace(/.*?your application was sent to\s+/i, "");
    if (comp) t = t.replace(new RegExp("^\\s*" + escapeRegex(company) + "\\b[\\s:.,–—-]*", "i"), "");
    return t.trim();
  };

  // Boilerplate that can follow the confirmation sentence and must not be mistaken
  // for a job title.
  const isBoilerplate = (s) =>
    /^(see |view |apply|applied|your application|track|manage|premium|linkedin|unsubscribe|get |download|jobs? you|similar|recommended|more jobs)/i.test(s.trim());

  // 1) Anchor on "<Company> · <Location>" and take the text right before it.
  if (comp) {
    const anchor = p.match(new RegExp(escapeRegex(company) + "\\s*[·•|]", "i"));
    if (anchor && anchor.index > 0) {
      const title = cleanText(stripNoise(p.slice(0, anchor.index)));
      if (title && title.toLowerCase() !== comp && !isLocationOnly(title)) return title;
    }
  }

  // 2) Otherwise take the first segment after the confirmation sentence, guarding
  //    against location-only text and LinkedIn boilerplate.
  const after = stripNoise(p);
  if (after && !isBoilerplate(after)) {
    const seg = cleanText(after.split(/[·•|]/)[0]);
    if (seg && seg.toLowerCase() !== comp && !isLocationOnly(seg) && !isBoilerplate(seg)) return seg;
  }
  return "";
}

// Best-effort extraction of the role/title the person applied for.
function extractPosition(subject, preview, isLinkedIn, company) {
  const sources = [subject, preview];
  const patterns = [
    /you applied to\s+(.+?)\s+at\s+/i,
    /application for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /applied for (?:the\s+)?(.+?)\s+(?:position|role)/i,
    /your application for (?:the\s+)?(.+?)\s+(?:position|role|at|has|was)/i,
    /for the\s+(.+?)\s+(?:position|role)/i,
    /(?:position|role|job title)\s*[:\-]\s*(.+)/i,
    // Offer / hire wording: "offer you the position of X at ..." / "position of X"
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
    const role = extractLinkedInPosition(preview, company);
    if (role) return role;
  }
  return "";
}

// Determine an application's status from its language.
function deriveStatus(subject, preview) {
  const text = `${subject}\n${preview}`.toLowerCase();

  // Rejections first — "we extended an offer to another candidate" is still a
  // rejection, so this must win over the offer check below.
  if (/\b(not selected|unfortunately|not moving forward|other candidates?|another candidate|regret to inform|decided not to|will not be moving|pursue other|moved? forward with (?:other|another))\b/.test(text)) {
    return "Rejected";
  }

  // Offers / hires. The email has already passed the job-application filter, so a
  // mention of an offer here reliably means a real job offer.
  if (/\b(pleased to offer|happy to offer|glad to offer|excited to offer|we would like to offer|offer of employment|job offer|offer letter|formal offer|extend(?:ing|ed)? (?:you )?(?:an|the)? ?offer|you have been hired|you're hired|welcome aboard|welcome to the team|onboarding)\b/.test(text) ||
      /\boffer\b/.test(text)) {
    return "Offer";
  }

  if (/\binterview\b|schedule (?:an?|the) (?:call|interview|time)|set up (?:an?|the) (?:call|interview)/.test(text)) {
    return "Interview";
  }
  return "Applied";
}

// Exchange the long-lived refresh token for a short-lived access token.
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

// Follow Microsoft Graph paging (@odata.nextLink) so we collect every matching
// message, not just the first page. Without this the tracker could never show
// more than a single page (100) of applications.
async function fetchAllMessages(initialUrl, accessToken, max = 1000) {
  const messages = [];
  let url = initialUrl;
  let pages = 0;

  while (url && messages.length < max && pages < 20) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await res.json();
    if (!Array.isArray(data.value)) {
      // Surface the error only if we have nothing at all; otherwise keep what we got.
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
    const select = "id,subject,from,receivedDateTime,bodyPreview";

    // 1) Pull EVERY LinkedIn application-confirmation email directly by sender.
    //    $filter supports real pagination (unlike the relevance-ranked $search),
    //    so this reliably captures all easy/quick-apply submissions — the bulk of
    //    the application total.
    const linkedInFilter = "from/emailAddress/address eq 'jobs-noreply@linkedin.com'";
    const linkedInUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(linkedInFilter)}` +
      `&$top=100&$select=${select}`;

    // 2) Pull other job-application emails (ATS / company replies) by keyword.
    const query = 'application received OR thank you for applying OR your application OR move forward OR not selected OR interview OR candidacy OR offer OR "job offer" OR "offer of employment" OR onboarding OR "welcome to the team" OR "you have been hired"';
    const searchUrl =
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"` +
      `&$top=100&$select=${select}`;

    let linkedInMessages = [];
    let searchMessages = [];
    try { linkedInMessages = await fetchAllMessages(linkedInUrl, accessToken, 2000); } catch (_) { /* keep going */ }
    try { searchMessages = await fetchAllMessages(searchUrl, accessToken, 500); } catch (_) { /* keep going */ }

    if (linkedInMessages.length === 0 && searchMessages.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Mail fetch failed" }) };
    }

    // Merge and de-duplicate by the stable message id so the same email is never
    // processed twice across the two queries.
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
      const haystack = `${subject}\n${preview}`.toLowerCase();

      const isLinkedIn = sender.includes("linkedin.com");

      if (isLinkedIn) {
        // Only LinkedIn "application sent" confirmations are real applications —
        // ignore job alerts, viewer notifications, network noise, etc.
        if (!haystack.includes("application was sent") && !haystack.includes("your application was sent to")) {
          continue;
        }
      } else {
        // Drop anything that isn't clearly a job-application email.
        const isNoise = NOISE_SIGNALS.some(sig => haystack.includes(sig));
        const isJob = JOB_SIGNALS.some(sig => haystack.includes(sig));
        if (isNoise || !isJob) continue;
      }

      // Figure out the employer name from the email content first.
      let company = extractCompany(subject, preview);

      // Only fall back to the sender's domain when it is a genuine employer
      // domain (not LinkedIn, Indeed, an ATS, or a free email provider).
      if (!company && !isLinkedIn) {
        const domain = (sender.split("@")[1] || "");
        const root = domain.split(".")[0] || "";
        if (root && !GENERIC_DOMAINS.has(root)) {
          company = root.charAt(0).toUpperCase() + root.slice(1);
        }
      }

      // If we still cannot identify a real company, skip rather than show junk.
      if (!company) continue;

      const status = deriveStatus(subject, preview);
      const position = extractPosition(subject, preview, isLinkedIn, company) || "—";

      applications.push({
        id: email.id,
        company,
        position,
        dateApplied: date,
        status,
        notes: preview.substring(0, 100)
      });
    }

    // Newest applications first.
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
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
