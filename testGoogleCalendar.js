const fetch = require("node-fetch");

async function testGoogleCalendar(accessToken) {
  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    console.error("❌ Google API error:", res.status, await res.text());
    return;
  }

  const data = await res.json();
  console.log("✅ Raw Google Calendar events:", JSON.stringify(data, null, 2));
}

// Replace with a valid access token from your sign-in flow
testGoogleCalendar("YOUR_ACCESS_TOKEN_HERE");
