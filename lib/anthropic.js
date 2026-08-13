const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function callClaude(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Server is missing ANTHROPIC_API_KEY. Add it to .env.local (or your Vercel project's Environment Variables) and restart."
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "The Anthropic API request failed.");
  }
  return data;
}
