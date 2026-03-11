/**
 * claude.js
 *
 * Two responsibilities:
 *   1. buildSystemPrompt(criteria) — generates the Claude system prompt
 *      dynamically from the user's current criteria settings.
 *   2. analyzeListing({ systemPrompt, userPrompt }) — calls our Vercel
 *      serverless function at /api/analyze (which holds the actual API key).
 *
 * The frontend NEVER touches the Anthropic API directly.
 * The key lives only on the server side (Vercel env var: ANTHROPIC_API_KEY).
 */

import { calculateWeights } from './scoring';
import { CRITERION_DESCRIPTIONS } from '../constants/defaultCriteria';

/**
 * Build the system prompt Claude receives before every analysis.
 *
 * We generate this fresh on each call so it always reflects the user's
 * current criteria (order, weights, disqualifiers, custom names) and location.
 *
 * @param {Array}  criteria — the current criteria array from localStorage
 * @param {string} location — target neighborhood (e.g. "Capitol Hill, Seattle")
 * @returns {string} — the full system prompt
 */
export function buildSystemPrompt(criteria, location = 'Green Lake, Seattle') {
  const weighted = calculateWeights(criteria);
  const scoredCriteria = weighted.filter(c => !c.flagOnly);
  const flagCriteria = criteria.filter(c => c.flagOnly);

  // Build the "Scoring rules:" lines
  const scoringLines = scoredCriteria.map(c => {
    const pct = Math.round(c.weight);
    const disqualifierNote = c.isDisqualifier ? ', HARD DISQUALIFIER' : '';
    // The location criterion description is generated dynamically from the user's location.
    // All other criteria use CRITERION_DESCRIPTIONS, falling back to the label.
    let description;
    if (c.key === 'green_lake') {
      description = `Located within reasonable distance of ${location}`;
    } else {
      description = CRITERION_DESCRIPTIONS[c.key] ?? c.label;
    }
    return `- ${c.key} (${pct}%${disqualifierNote}): ${description}`;
  });

  const flagLines = flagCriteria.map(c => {
    const description = CRITERION_DESCRIPTIONS[c.key] ?? c.label;
    return `- ${c.key} (flag only): ${description}`;
  });

  // Build a template showing Claude exactly which keys to return in scores{}
  const scoresTemplate = {};
  scoredCriteria.forEach(c => {
    scoresTemplate[c.key] = 'yes|no|unclear';
  });
  flagCriteria.forEach(c => {
    if (c.key === 'pet_policy') {
      scoresTemplate[c.key] = 'safe|risk|unknown';
    } else {
      scoresTemplate[c.key] = 'exact quote from listing or null';
    }
  });

  return `You are an apartment research assistant helping a junior UX designer find housing near ${location}.

Analyze the listing(s) provided and respond ONLY with valid JSON. No markdown, no explanation, no code fences.

Scoring rules:
${scoringLines.join('\n')}
${flagLines.join('\n')}

Score each criterion as "yes" | "no" | "unclear". Never assume yes if not stated.

For browse mode (single listing) return:
{
  "mode": "browse",
  "name": "building name or short descriptor extracted from listing",
  "address": "full address if available, otherwise neighborhood",
  "price": "monthly rent as stated",
  "scores": ${JSON.stringify(scoresTemplate, null, 2)},
  "weighted_score": <0-100>,
  "verdict": "apply|tour|skip",
  "verdict_reason": "one sentence explanation",
  "key_concern": "single most important concern, or null"
}

For decision mode (multiple listings) return:
{
  "mode": "decision",
  "listings": [
    {
      "id": 1,
      "name": "building name or short descriptor",
      "address": "full address or neighborhood",
      "price": "monthly rent as stated",
      "scores": { ...same keys as browse scores above... },
      "weighted_score": <0-100>,
      "verdict": "apply|tour|skip",
      "strengths": ["up to 2 short strings"],
      "concerns": ["up to 2 short strings"]
    }
  ],
  "winner": <1-based index of winning listing>,
  "winner_reason": "one sentence",
  "tradeoff_note": "one sentence on the key tradeoff between top two options"
}`;
}

/**
 * Build the user prompt for browse mode (single listing).
 *
 * @param {string} listingText — the raw pasted listing text
 * @param {string} [urlOrLabel] — optional URL or nickname the user typed
 */
export function buildBrowsePrompt(listingText, urlOrLabel = '') {
  const header = urlOrLabel ? `${urlOrLabel}\n` : '';
  return `Analyze this single listing in browse mode:\n\n${header}${listingText}`;
}

/**
 * Build the user prompt for decision mode (multiple listings).
 *
 * @param {Array} slots — array of { urlOrLabel, text } objects
 *   text can be the raw listing text OR a pre-built "From saved: {name}" string
 */
export function buildDecisionPrompt(slots) {
  const parts = slots.map((slot, i) => {
    const header = slot.urlOrLabel ? `${slot.urlOrLabel}\n` : '';
    return `--- LISTING ${i + 1} ---\n${header}${slot.text}`;
  });
  return `Analyze these ${slots.length} listings in decision mode:\n\n${parts.join('\n\n')}`;
}

/**
 * Call our Vercel serverless function to analyze a listing.
 *
 * The function at /api/analyze holds the Anthropic API key server-side.
 * We send it our prompts; it calls Claude and returns the response.
 *
 * @param {Object} params
 * @param {string} params.system — the system prompt (from buildSystemPrompt)
 * @param {string} params.userPrompt — the user message (from buildBrowsePrompt or buildDecisionPrompt)
 * @returns {Object} — parsed JSON result from Claude
 * @throws {Error} — with a user-friendly message on failure
 */
// Truncate listing text that would burn excessive tokens.
// 20,000 chars ≈ ~5,000 tokens — more than enough for any real listing.
const MAX_USER_PROMPT_CHARS = 20_000;

export async function analyzeListing({ system, userPrompt }) {
  const truncatedPrompt =
    userPrompt.length > MAX_USER_PROMPT_CHARS
      ? userPrompt.slice(0, MAX_USER_PROMPT_CHARS) + '\n\n[listing text truncated — too long]'
      : userPrompt;

  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, userPrompt: truncatedPrompt }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error("Request timed out — Claude took too long. Try again.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Server error (${response.status}). Try again.`);
  }

  const data = await response.json();

  // Claude's response is wrapped: { content: [{ type: "text", text: "..." }] }
  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error("Got an unexpected response. Try again.");
  }

  // Strip any accidental code fences Claude might add despite instructions
  const cleaned = textBlock.text
    .replace(/^```json?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Claude returned an unreadable response. This sometimes happens with very short or unusual listing text — try adding more details and analyze again.");
  }
}
