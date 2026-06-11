exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  if (!code) return { statusCode: 400, body: "No code provided" };

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    code: code,
    redirect_uri: process.env.MS_REDIRECT_URI,
    grant_type: "authorization_code",
    scope: "offline_access Mail.Read"
  });

  const response = await fetch(
    `https://login.microsoftonline.com/consumers/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }
  );

  const data = await response.json();

  if (data.refresh_token) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "SUCCESS! Copy your refresh token and add it to Netlify as MS_REFRESH_TOKEN",
        refresh_token: data.refresh_token
      })
    };
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: data })
  };
};
