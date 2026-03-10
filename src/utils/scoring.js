/**
 * scoring.js
 *
 * Pure calculation functions — no UI, no API, no localStorage.
 * These can be called from anywhere in the app.
 *
 * The core idea: the user ranks criteria by importance (rank 1 = most important).
 * We convert that rank order into percentage weights automatically using a
 * linear decay formula: higher rank = more weight.
 *
 * Formula: weight[i] = (N - i) / sum(1..N) * 100
 * Example for 6 criteria: [28.6%, 23.8%, 19%, 14.3%, 9.5%, 4.8%] — always sums to 100%
 */

/**
 * Given an array of criteria (in priority order, index 0 = highest rank),
 * return the same array with a `weight` property added to each item.
 * Flag-only criteria always get weight 0.
 */
export function calculateWeights(criteria) {
  const scored = criteria.filter(c => !c.flagOnly);
  const N = scored.length;

  if (N === 0) return criteria.map(c => ({ ...c, weight: 0 }));

  // Sum of 1+2+...+N = N*(N+1)/2 — the denominator for our formula
  const total = (N * (N + 1)) / 2;

  let scoredIndex = 0;
  return criteria.map(c => {
    if (c.flagOnly) return { ...c, weight: 0 };

    // rank 1 (i=0) gets weight (N-0)/total, rank N (i=N-1) gets weight 1/total
    const weight = ((N - scoredIndex) / total) * 100;
    scoredIndex++;
    return { ...c, weight };
  });
}

/**
 * Calculate a 0–100 weighted score for a listing.
 *
 * Score values:
 *   "yes"     → full weight
 *   "unclear" → half weight (we don't know, so we're conservative)
 *   "no"      → 0
 *   missing   → treated as "unclear" (listing predates this criterion)
 *
 * If ANY hard disqualifier scores "no", the total is forced to 0.
 */
export function calculateWeightedScore(scores, criteria) {
  const weighted = calculateWeights(criteria);
  const scoredCriteria = weighted.filter(c => !c.flagOnly);

  // Hard disqualifier check — one "no" here means score = 0
  for (const c of scoredCriteria) {
    if (c.isDisqualifier && scores[c.key] === 'no') {
      return 0;
    }
  }

  // Sum up partial scores
  let total = 0;
  for (const c of scoredCriteria) {
    const score = scores[c.key];
    if (score === 'yes') {
      total += c.weight;
    } else if (score === 'unclear' || score === undefined || score === null) {
      total += c.weight * 0.5;
    }
    // 'no' contributes 0 — no else needed
  }

  return Math.round(total);
}

/**
 * Determine the verdict (apply / tour / skip) from scores and a pre-calculated weighted score.
 * We pass in the weighted score rather than recalculating it to avoid double work.
 */
export function calculateVerdict(scores, criteria, weightedScore) {
  const scoredCriteria = criteria.filter(c => !c.flagOnly);

  // Hard disqualifier forces Skip
  for (const c of scoredCriteria) {
    if (c.isDisqualifier && scores[c.key] === 'no') {
      return 'skip';
    }
  }

  if (weightedScore >= 70) return 'apply';
  if (weightedScore >= 45) return 'tour';
  return 'skip';
}

/**
 * Recalculate a saved listing's weighted_score and verdict
 * using the CURRENT criteria (after the user has reordered, added, or removed criteria).
 *
 * The stored scores (yes/no/unclear) don't change — only the math changes.
 * Missing scores (from newly added criteria) default to "unclear".
 *
 * Returns a new listing object — doesn't mutate the original.
 */
export function recalculateForCriteria(listing, criteria) {
  const newWeightedScore = calculateWeightedScore(listing.scores, criteria);
  const newVerdict = calculateVerdict(listing.scores, criteria, newWeightedScore);
  return {
    ...listing,
    weighted_score: newWeightedScore,
    verdict: newVerdict,
  };
}
