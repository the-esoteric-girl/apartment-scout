/**
 * claude.js
 *
 * Two responsibilities:
 *   1. buildSystemPrompt(criteria, location) — generates the compact Claude system
 *      prompt dynamically from the user's current criteria settings.
 *   2. analyzeListing({ system, userPrompt, criteria }) — calls our Vercel
 *      serverless function at /api/analyze, then normalizes the compact response
 *      back into the flat shape the rest of the app expects.
 *
 * The frontend NEVER touches the Anthropic API directly.
 * The key lives only on the server side (Vercel env var: ANTHROPIC_API_KEY).
 *
 * Compact format (internal — callers never see this):
 *   Active scored criteria  → { "s": "Y|N|U", "r": "≤10 words" }
 *   Active flag-only        → { "r": "≤10 words" }
 *   Inactive library items  → { "v": "≤5 words" } or null
 *   Price                   → price_display (string) + price_min (integer)
 */

import { calculateWeights } from './scoring';
import { CRITERION_DESCRIPTIONS, CRITERIA_LIBRARY } from '../constants/defaultCriteria';

// ─────────────────────────────────────────────────────────────────────────────
// buildSystemPrompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the system prompt Claude receives before every analysis.
 *
 * Generated fresh on each call so it always reflects the user's current
 * criteria (order, weights, disqualifiers, custom names) and location.
 *
 * @param {Array}  criteria — the current criteria array from localStorage
 * @param {string} location — target neighborhood (e.g. "Capitol Hill, Seattle")
 * @returns {string} — the full system prompt
 */
export function buildSystemPrompt(criteria, location = 'Green Lake, Seattle') {
  const weighted = calculateWeights(criteria);
  const scoredCriteria = weighted.filter(c => !c.flagOnly);
  const flagCriteria = criteria.filter(c => c.flagOnly);

  // Inactive library items — in the library but not in the user's active criteria.
  const activeKeys = new Set(criteria.map(c => c.key));
  const allLibraryItems = CRITERIA_LIBRARY.flatMap(g => g.items);
  const inactiveLibraryItems = allLibraryItems.filter(item => !activeKeys.has(item.key));

  // Scoring rules lines (compact)
  const scoringLines = scoredCriteria.map(c => {
    const pct = Math.round(c.weight);
    const disq = c.isDisqualifier ? ' HARD-DISQUALIFIER' : '';
    let description;
    if (c.key === 'green_lake') {
      description = `Within reasonable distance of ${location}`;
    } else {
      description = CRITERION_DESCRIPTIONS[c.key] ?? c.label;
    }
    return `  ${c.key} ${pct}%${disq}: ${description}`;
  });

  const flagLines = flagCriteria.map(c => {
    const description = CRITERION_DESCRIPTIONS[c.key] ?? c.label;
    return `  ${c.key} FLAG: ${description}`;
  });

  const noteLines = inactiveLibraryItems.map(item => {
    const description = CRITERION_DESCRIPTIONS[item.key] ?? item.label;
    return `  ${item.key}: ${description}`;
  });

  // Build the scores template showing Claude exactly what shape to return
  const scoresTemplate = {};
  scoredCriteria.forEach(c => {
    scoresTemplate[c.key] = { s: 'Y|N|U', r: '≤10 words' };
  });
  flagCriteria.forEach(c => {
    scoresTemplate[c.key] = { r: '≤10 words' };
  });
  inactiveLibraryItems.forEach(item => {
    scoresTemplate[item.key] = { v: '≤5 words' };
  });

  const noteSection = noteLines.length > 0
    ? `\nLibrary notes — extract only, never score (return {"v":"≤5 words"} or null):\n${noteLines.join('\n')}\n`
    : '';

  return `You are an apartment research assistant for a renter searching near ${location}.
Respond ONLY with valid JSON. No markdown, no explanation, no code fences.

Active scored criteria (return {"s":"Y|N|U","r":"≤10 words"} for each):
${scoringLines.join('\n')}

Active flag-only criteria (return {"r":"≤10 words"} — no s field, never scored):
${flagLines.join('\n')}
${noteSection}
Rules:
- s values: Y=yes, N=no, U=unclear. Never assume Y if not stated.
- HARD-DISQUALIFIER: if s="N" → weighted_score=0, verdict="skip"
- price_display: rent as written (e.g. "$1,530–$2,706"), or null
- price_min: lowest monthly rent as integer (e.g. 1530), or null
- If price_display missing but price_min known, still return both separately

Browse mode response (single listing):
{
  "mode": "browse",
  "name": "building name or short descriptor",
  "address": "full address or neighborhood",
  "price_display": "rent string or null",
  "price_min": integer_or_null,
  "bedrooms": "studio|1br|2br|3br|4br+",
  "neighborhood": "short name or null",
  "scores": ${JSON.stringify(scoresTemplate)},
  "weighted_score": <0-100>,
  "verdict": "apply|tour|skip",
  "verdict_reason": "one sentence",
  "key_concern": "top concern or null"
}

Decision mode response (multiple listings):
{
  "mode": "decision",
  "listings": [
    {
      "id": 1,
      "name": "building name or short descriptor",
      "address": "full address or neighborhood",
      "price_display": "rent string or null",
      "price_min": integer_or_null,
      "bedrooms": "studio|1br|2br|3br|4br+",
      "neighborhood": "short name or null",
      "scores": { ...same keys as browse scores... },
      "weighted_score": <0-100>,
      "verdict": "apply|tour|skip",
      "strengths": ["≤2 short strings"],
      "concerns": ["≤2 short strings"]
    }
  ],
  "winner": <1-based index>,
  "winner_reason": "one sentence",
  "tradeoff_note": "one sentence on the key tradeoff between top two"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

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
 */
export function buildDecisionPrompt(slots) {
  const parts = slots.map((slot, i) => {
    const header = slot.urlOrLabel ? `${slot.urlOrLabel}\n` : '';
    return `--- LISTING ${i + 1} ---\n${header}${slot.text}`;
  });
  return `Analyze these ${slots.length} listings in decision mode:\n\n${parts.join('\n\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeCompactResult (internal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a single listing object from Claude's compact format
 * into the flat shape the rest of the app expects.
 *
 * Compact → expanded mappings:
 *   scored  { s:"Y", r:"..." }  →  scores[key] = "yes",    reasons[key] = "..."
 *   scored  { s:"N", r:"..." }  →  scores[key] = "no",     reasons[key] = "..."
 *   scored  { s:"U", r:"..." }  →  scores[key] = "unclear", reasons[key] = "..."
 *   flag    { r:"..." }         →  scores[key] = "..." (text note)
 *   inactive { v:"..." }|null   →  scores[key] = "..." or null
 *   price_display / price_min   →  normalized + backward-compat price alias
 */
function normalizeSingleListing(listing, criteria) {
  const activeKeys = new Set(criteria.map(c => c.key));
  const allLibraryItems = CRITERIA_LIBRARY.flatMap(g => g.items);
  const inactiveLibraryItems = allLibraryItems.filter(item => !activeKeys.has(item.key));

  const S_MAP = { Y: 'yes', N: 'no', U: 'unclear' };
  const scores = {};
  const reasons = {};

  // Active scored criteria
  for (const c of criteria.filter(c => !c.flagOnly)) {
    const item = listing.scores?.[c.key];
    if (item && typeof item === 'object' && 's' in item) {
      scores[c.key] = S_MAP[item.s] ?? 'unclear';
      if (item.r) reasons[c.key] = item.r;
    } else if (typeof item === 'string') {
      // Graceful fallback: Claude returned old-format flat string
      scores[c.key] = item;
    } else {
      scores[c.key] = 'unclear';
    }
  }

  // Active flag-only criteria — r value is the text note
  for (const c of criteria.filter(c => c.flagOnly)) {
    const item = listing.scores?.[c.key];
    if (item && typeof item === 'object') {
      scores[c.key] = item.r ?? null;
    } else if (typeof item === 'string') {
      scores[c.key] = item;
    } else {
      scores[c.key] = null;
    }
  }

  // Inactive library items — v value is the extracted snippet, null if not found
  for (const libItem of inactiveLibraryItems) {
    const item = listing.scores?.[libItem.key];
    if (item === null || item === undefined) {
      scores[libItem.key] = null;
    } else if (item && typeof item === 'object') {
      scores[libItem.key] = item.v ?? null;
    } else if (typeof item === 'string') {
      scores[libItem.key] = item;
    } else {
      scores[libItem.key] = null;
    }
  }

  // Price normalization
  let price_display = listing.price_display ?? null;
  const price_min = typeof listing.price_min === 'number' ? listing.price_min : null;

  // Mentor tweak: auto-generate display string if only min is present
  if (!price_display && price_min !== null) {
    price_display = `$${price_min.toLocaleString()}`;
  }

  // Backward compat: keep `price` field pointing at the display string
  // so BrowseTab/DecisionTab components that read `result.price` still work
  const price = price_display ?? listing.price ?? null;

  return {
    ...listing,
    scores,
    reasons,
    price_display,
    price_min,
    price,
  };
}

/**
 * Normalize a full Claude response (browse or decision) from compact format.
 * This is the "black box" boundary — callers receive the same expanded shape
 * regardless of what the API returned internally.
 *
 * @param {Object} raw      — parsed JSON from Claude
 * @param {Array}  criteria — current active criteria array
 * @returns {Object} — normalized result ready for the rest of the app
 */
function normalizeCompactResult(raw, criteria) {
  if (raw.mode === 'decision' && Array.isArray(raw.listings)) {
    return {
      ...raw,
      listings: raw.listings.map(l => normalizeSingleListing(l, criteria)),
    };
  }
  return normalizeSingleListing(raw, criteria);
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeListing
// ─────────────────────────────────────────────────────────────────────────────

// Truncate listing text that would burn excessive tokens.
// 20,000 chars ≈ ~5,000 tokens — more than enough for any real listing.
const MAX_USER_PROMPT_CHARS = 20_000;

/**
 * Call our Vercel serverless function to analyze a listing.
 *
 * The function at /api/analyze holds the Anthropic API key server-side.
 * We send it our prompts; it calls Claude and returns the compact response.
 * The compact response is normalized here before being returned — callers
 * receive the same flat shape they have always expected.
 *
 * @param {Object} params
 * @param {string} params.system      — the system prompt (from buildSystemPrompt)
 * @param {string} params.userPrompt  — the user message (from buildBrowsePrompt or buildDecisionPrompt)
 * @param {Array}  params.criteria    — current active criteria (used by the normalizer)
 * @returns {Object} — normalized result from Claude
 * @throws {Error}   — with a user-friendly message on failure
 */
export async function analyzeListing({ system, userPrompt, criteria = [] }) {
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

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude returned an unreadable response. This sometimes happens with very short or unusual listing text — try adding more details and analyze again.");
  }

  // Normalize compact format → flat shape the rest of the app expects
  return normalizeCompactResult(parsed, criteria);
}
