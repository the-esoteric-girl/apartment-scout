/**
 * defaultCriteria.js
 *
 * The single source of truth for the app's default scoring criteria.
 * These are used on first launch and when the user resets Settings.
 *
 * Each criterion has:
 *   key          — stable identifier used as the JSON key in Claude's response
 *                  and in stored listing scores. Never changes (even if label changes).
 *   label        — display name shown in the UI, user can rename this
 *   isDisqualifier — if true, a "no" score forces the overall verdict to Skip
 *   flagOnly     — if true, this criterion is surfaced as info but NOT scored
 *                  (no weight, doesn't affect the 0–100 number)
 *
 * The order here IS the default priority order — index 0 = rank 1 (most important).
 * Scored criteria come first, then flag-only criteria at the end.
 */
export const DEFAULT_CRITERIA = [
  // --- Scored criteria (contribute to weighted score) ---
  {
    key: 'washer_dryer',
    label: 'In-unit W/D',
    isDisqualifier: true,
    flagOnly: false,
  },
  {
    key: 'price',
    label: 'Price ≤ $2,000',
    isDisqualifier: false,
    flagOnly: false,
  },
  {
    key: 'green_lake',
    label: 'Near Green Lake',
    isDisqualifier: false,
    flagOnly: false,
  },
  {
    key: 'parking',
    label: 'Parking included',
    isDisqualifier: false,
    flagOnly: false,
  },
  {
    key: 'cosigner',
    label: 'Co-signer friendly',
    isDisqualifier: false,
    flagOnly: false,
  },
  {
    key: 'month_to_month',
    label: 'Month-to-month lease',
    isDisqualifier: false,
    flagOnly: false,
  },

  // --- Flag-only criteria (always surfaced, never scored) ---
  {
    key: 'pet_policy',
    label: 'Pet policy (cat)',
    isDisqualifier: false,
    flagOnly: true,
  },
  {
    key: 'ceiling_height',
    label: 'Ceiling height',
    isDisqualifier: false,
    flagOnly: true,
  },
  {
    key: 'neighborhood_note',
    label: 'Neighborhood note',
    isDisqualifier: false,
    flagOnly: true,
  },
];

/**
 * Descriptions sent to Claude for each known criterion key.
 * Used in buildSystemPrompt() — tells Claude what each key means.
 * Custom user-added criteria fall back to their label text.
 */
export const CRITERION_DESCRIPTIONS = {
  washer_dryer:      'In-unit washer/dryer present',
  price:             'Total rent under $2,000/month',
  green_lake:        'Located in or near Green Lake, Phinney Ridge, Roosevelt, Wallingford, Fremont, or Northgate',
  parking:           'Street or assigned parking available for a car',
  cosigner:          'Likely to accept co-signer. Individual/private landlords = yes. Large property management companies = unclear unless stated.',
  month_to_month:    'Month-to-month or short/flexible lease available',
  pet_policy:        'Cat-friendly. Values: "safe" | "risk" | "unknown"',
  ceiling_height:    'Any mention of ceiling height, loft, top floor, high ceilings, vaulted. Extract the exact phrase or null.',
  neighborhood_note: 'Brief note on neighborhood location relative to Green Lake. One sentence max.',
};
