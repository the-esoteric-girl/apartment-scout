/**
 * api/analyze.js — Vercel Serverless Function
 *
 * This file runs on Vercel's servers, not in the browser.
 * It's the only place the Anthropic API key exists.
 *
 * Flow:
 *   Browser → POST /api/analyze → this function → Anthropic API → browser
 *
 * The API key is stored as a Vercel environment variable (ANTHROPIC_API_KEY).
 * It is NEVER sent to the browser, NEVER in your JavaScript bundle.
 *
 * Locally: run `vercel dev` instead of `npm run dev` to use this function.
 * In production: Vercel runs this automatically when deployed.
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, userPrompt } = req.body;

  // Basic validation — don't call the API with empty inputs
  if (!system || !userPrompt) {
    return res.status(400).json({ error: 'Missing system or userPrompt in request body' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: error.error?.message ?? `Anthropic API error (${response.status})`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('analyze function error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
