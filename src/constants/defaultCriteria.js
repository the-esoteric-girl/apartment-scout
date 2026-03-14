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
    key: 'parking_details',
    label: 'Parking',
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
    key: 'location_context',
    label: 'Location & transit',
    isDisqualifier: false,
    flagOnly: true,
  },
  {
    key: 'interior_features',
    label: 'Interior features',
    isDisqualifier: false,
    flagOnly: true,
  },
];

/**
 * Descriptions sent to Claude for each known criterion key.
 * Used in buildSystemPrompt() — tells Claude what each key means.
 *
 * The `green_lake` key is intentionally omitted here — its description
 * is generated dynamically from the user's saved location setting.
 *
 * Legacy keys (prefixed with a comment) are kept as aliases so that
 * saved listings with old scores continue to display correctly.
 */
export const CRITERION_DESCRIPTIONS = {
  // ── Default criteria ─────────────────────────────────────────
  washer_dryer:      'In-unit washer/dryer present',
  price:             'Total rent under $2,000/month',
  cosigner:          'Likely to accept co-signer. Individual/private landlords = yes. Large property management companies = unclear unless stated.',
  month_to_month:    'Month-to-month or short/flexible lease available',

  // ── Merged master criteria ────────────────────────────────────
  parking_details:   'Any parking available — street, assigned, garage, or covered. Note type and whether included or extra cost.',
  pet_policy:        'Pet policy — cats and/or dogs allowed. Note any restrictions or fees.',
  location_context:  'Location summary — neighborhood walkability, nearby transit (bus/light rail), and proximity to the target area.',
  interior_features: 'Notable interior details — ceiling height, natural light, flooring type (hardwood/LVP/carpet), or any standout finishes.',

  // ── Appliances ───────────────────────────────────────────────
  dishwasher:        'Dishwasher present in unit',
  central_ac:        'Central air conditioning or in-unit AC (not just a window unit)',

  // ── Outdoor ──────────────────────────────────────────────────
  balcony:           'Private balcony, patio, deck, or any outdoor space included with unit',
  private_yard:      'Private or shared yard/garden access',

  // ── Building ─────────────────────────────────────────────────
  elevator:          'Building has an elevator — important for upper-floor units or moving furniture',
  gym:               'On-site gym or fitness center available to residents',
  secure_entry:      'Secure building entry — key fob, intercom system, or doorman',
  no_basement:       'Unit is above ground (not a basement or garden-level unit)',
  package_receiving: 'Package locker, mailroom, or secure package receiving available',
  new_construction:  'Building or unit is new construction or recently renovated (within ~5 years)',

  // ── Location ─────────────────────────────────────────────────
  bike_storage:      'Secure indoor bike storage or bike room available',

  // ── Utilities & Lease ────────────────────────────────────────
  utilities_included: 'Water, electricity, or gas included in rent (partially or fully)',
  internet_included:  'Internet or cable included in rent',
  no_credit_check:    'No credit check required, or flexible/alternative rental qualification accepted',

  // ── Space & Feel ─────────────────────────────────────────────
  quiet_building:    'Building or street described as quiet, residential, or away from busy roads',
  storage_unit:      'Additional storage unit, cage, or large closets included or available',
  home_office:       'Space suitable for a home office — den, second bedroom, alcove, or extra room mentioned',

  // ── Legacy aliases (kept so old saved listings render correctly) ──────────
  cats_allowed:      'Cats are allowed. Check pet policy section.',
  ceiling_height:    'Any mention of ceiling height, loft, top floor, high ceilings, vaulted. Extract the exact phrase or null.',
  neighborhood_note: 'Brief note on neighborhood location relative to the target area. One sentence max.',
  garage_parking:    'Covered or garage parking available (included or available to rent)',
  parking:           'Street or assigned parking available for a car',
  near_transit:      'Within comfortable walking distance of a bus line or light rail station',
  walkable:          'Neighborhood is walkable — amenities, groceries, cafes nearby on foot',
  dog_friendly:      'Dogs allowed — any size, or confirm if restrictions apply',
  hardwood_floors:   'Hardwood, LVP, or non-carpet flooring throughout main living areas',
  natural_light:     'Unit has good natural light — south or west-facing windows, or described as bright/sunny',
  high_ceilings:     'Ceilings described as high, vaulted, or over 9 feet',
  concierge:         'On-site concierge or building manager',
};

/**
 * Criteria library — grouped for the Settings picker.
 * Keys must exist in CRITERION_DESCRIPTIONS above.
 * The `green_lake` location criterion is excluded — it's managed via the location setting.
 *
 * Consolidated from ~30 items to ~20 master criteria via 4 merges:
 *   parking + garage_parking            → parking_details
 *   cats_allowed + dog_friendly         → pet_policy
 *   walkable + near_transit             → location_context  (+ neighborhood_note from DEFAULT)
 *   ceiling_height + natural_light +
 *     hardwood_floors + high_ceilings   → interior_features
 */
export const CRITERIA_LIBRARY = [
  {
    category: 'Essentials',
    items: [
      { key: 'washer_dryer',   label: 'In-unit W/D' },
      { key: 'price',          label: 'Price ≤ $2,000' },
      { key: 'parking_details', label: 'Parking' },
      { key: 'cosigner',       label: 'Co-signer friendly' },
      { key: 'month_to_month', label: 'Month-to-month lease' },
    ],
  },
  {
    category: 'Appliances',
    items: [
      { key: 'dishwasher',  label: 'Dishwasher' },
      { key: 'central_ac',  label: 'Central A/C' },
    ],
  },
  {
    category: 'Outdoor',
    items: [
      { key: 'balcony',      label: 'Balcony or patio' },
      { key: 'private_yard', label: 'Private yard' },
    ],
  },
  {
    category: 'Building',
    items: [
      { key: 'elevator',          label: 'Elevator' },
      { key: 'gym',               label: 'Gym / fitness center' },
      { key: 'secure_entry',      label: 'Secure entry' },
      { key: 'no_basement',       label: 'Not a basement unit' },
      { key: 'package_receiving', label: 'Package receiving' },
      { key: 'new_construction',  label: 'New / recently renovated' },
    ],
  },
  {
    category: 'Space & Feel',
    items: [
      { key: 'interior_features', label: 'Interior features' },
      { key: 'quiet_building',    label: 'Quiet building' },
      { key: 'storage_unit',      label: 'Storage unit' },
      { key: 'home_office',       label: 'Home office space' },
    ],
  },
  {
    category: 'Pets',
    items: [
      { key: 'pet_policy', label: 'Pet policy' },
    ],
  },
  {
    category: 'Utilities & Lease',
    items: [
      { key: 'utilities_included', label: 'Utilities included' },
      { key: 'internet_included',  label: 'Internet included' },
      { key: 'no_credit_check',    label: 'No credit check' },
    ],
  },
  {
    category: 'Location',
    items: [
      { key: 'location_context', label: 'Location & transit' },
      { key: 'bike_storage',     label: 'Bike storage' },
    ],
  },
];

/**
 * Seattle neighborhoods for the location autocomplete.
 * Shown as suggestions when user types in the location field.
 */
export const SEATTLE_NEIGHBORHOODS = [
  'Green Lake, Seattle',
  'Phinney Ridge, Seattle',
  'Fremont, Seattle',
  'Wallingford, Seattle',
  'Roosevelt, Seattle',
  'Northgate, Seattle',
  'Capitol Hill, Seattle',
  'First Hill, Seattle',
  'Central District, Seattle',
  'Columbia City, Seattle',
  'Beacon Hill, Seattle',
  'Queen Anne, Seattle',
  'Magnolia, Seattle',
  'Ballard, Seattle',
  'Crown Hill, Seattle',
  'Greenwood, Seattle',
  'Ravenna, Seattle',
  'University District, Seattle',
  'Eastlake, Seattle',
  'South Lake Union, Seattle',
  'Belltown, Seattle',
  'Downtown Seattle',
  'Pioneer Square, Seattle',
  'West Seattle',
  'Delridge, Seattle',
  'Rainier Valley, Seattle',
  'Mount Baker, Seattle',
  'Madison Valley, Seattle',
  'Montlake, Seattle',
  'Bryant, Seattle',
  'Maple Leaf, Seattle',
  'Wedgwood, Seattle',
  'Lake City, Seattle',
  'Bitter Lake, Seattle',
  'Broadview, Seattle',
  'Loyal Heights, Seattle',
  'Interbay, Seattle',
  'Shoreline, WA',
  'Kenmore, WA',
  'Bothell, WA',
  'Kirkland, WA',
  'Bellevue, WA',
  'Redmond, WA',
  'Renton, WA',
  'Burien, WA',
];
