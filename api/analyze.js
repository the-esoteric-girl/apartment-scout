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
 *
 * Security:
 *   - Rate limited to 10 requests per IP per 60 seconds (protects API token budget)
 *   - Input capped at 50KB combined (prevents prompt-stuffing / cost attacks)
 *   - Only POST accepted; no other methods
 */

// ── Rate limiting ────────────────────────────────────────────────────────────
// In-memory store — resets on cold start, which is fine for a solo-use tool.
// Each Vercel function instance has its own store; this deters casual abuse.
const rateLimitMap = new Map(); // IP → { count, resetAt }
const RATE_LIMIT_MAX = 10;      // max requests per window
const RATE_LIMIT_MS  = 60_000;  // 60-second window

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Input size cap ───────────────────────────────────────────────────────────
// Prevents excessively large prompts that would burn tokens or time out.
const MAX_SYSTEM_CHARS     = 8_000;   // system prompt is generated internally, stays small
const MAX_USER_PROMPT_CHARS = 20_000; // listing text — 20K chars ≈ ~5K tokens, plenty

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ??
    req.socket?.remoteAddress ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many requests — please wait a minute and try again.',
    });
  }

  const { system, userPrompt } = req.body ?? {};

  // Basic validation — don't call the API with empty inputs
  if (!system || !userPrompt) {
    return res.status(400).json({ error: 'Missing system or userPrompt in request body' });
  }

  // ── Input size cap ────────────────────────────────────────────────────────
  if (system.length > MAX_SYSTEM_CHARS || userPrompt.length > MAX_USER_PROMPT_CHARS) {
    return res.status(413).json({
      error: 'Request too large — try pasting a shorter listing (under ~15,000 characters).',
    });
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
