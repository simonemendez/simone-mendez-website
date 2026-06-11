exports.handler = async () => {
  try {
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

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Token refresh failed", detail: tokenData }) };
    }

    const accessToken = tokenData.access_token;

    const query = '"application received" OR "thank you for applying" OR "your application" OR "move forward" OR "not selected" OR "interview" OR "candidacy" OR "greenhouse" OR "lever" OR "workday" OR "ashby"';
    const url = `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"&$top=50&$select=subject,from,receivedDateTime,bodyPreview`;

    const mailRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const mailData = await mailRes.json();
    if (!mailData.value) {
      return { statusCode: 400, body: JSON.stringify({ error: "Mail fetch failed", detail: mailData }) };
    }

    const applications = mailData.value.map(email => {
      const subject = email.subject || "";
      const sender = email.from?.emailAddress?.address || "";
      const preview = email.bodyPreview || "";
      const date = email.receivedDateTime?.split("T")[0] || "";

      let status = "Applied";
      const lowerSubject = subject.toLowerCase();
      const lowerPreview = preview.toLowerCase();
      if (lowerSubject.includes("not selected") || lowerSubject.includes("unfortunately") || lowerPreview.includes("not moving forward") || lowerPreview.includes("other candidates")) {
        status = "Rejected";
      } else if (lowerSubject.includes("interview") || lowerPreview.includes("schedule") || lowerPreview.includes("interview")) {
        status = "Interview";
      } else if (lowerSubject.includes("offer") || lowerPreview.includes("offer")) {
        status = "Offer";
      }

      const domain = sender.split("@")[1] || "";
      const company = domain.split(".")[0] || "Unknown";

      return {
        company: company.charAt(0).toUpperCase() + company.slice(1),
        position: subject,
        dateApplied: date,
        status,
        notes: preview.substring(0, 100)
      };
    });

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
