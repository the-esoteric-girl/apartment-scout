# Apartment Scout — Product Requirements Document
**Version:** 1.1  
**Author:** [Your Name]  
**Date:** March 2026  
**Status:** Ready for Development

---

## 1. Overview

Apartment Scout is a personal web app for scoring, saving, and comparing Seattle apartment listings against a fixed set of weighted criteria. It uses the Anthropic Claude API to analyze raw listing text and return structured scores and recommendations.

This is a solo-use tool built during an active apartment search. The primary user is a junior UX/UI designer relocating to the Green Lake area of Seattle with a budget of under $2,000/month.

---

## 2. Problem Statement

Browsing listings on Zillow is time-consuming and subjective. It's hard to remember which listings scored well against specific must-haves (in-unit W/D, parking, ceiling height, pet policy) and easy to lose track of ones worth revisiting. There's no good way to compare 2–4 finalists side by side with consistent criteria.

This tool solves all three problems: fast scoring, persistent saving, and structured comparison.

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React (Vite) | Fast setup, component-based, easy to host |
| Styling | Tailwind CSS | Utility-first, consistent spacing |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) | Listing analysis and scoring |
| Persistence | localStorage | Solo use, single device, zero backend needed |
| Hosting | Vercel | Auto-deploys from GitHub, free tier, env var support |
| API Key | `.env` file locally, Vercel environment variable in production | Never hardcoded in source |

**Important:** The Anthropic API key must be stored in a `.env` file as `VITE_ANTHROPIC_API_KEY`. Never commit this to GitHub. Include `.env` in `.gitignore`.

---

## 4. Application Structure

### 4.1 Tab Navigation

Three primary tabs, always visible at the top of the app:

| Tab | Icon | Purpose |
|---|---|---|
| Browse | 🔍 | Score a single listing quickly |
| Decision | ⚖️ | Compare 2–4 listings side by side |
| Saved | 🏠 + count badge | View, manage, and filter all saved listings |

A **⚙ gear icon** lives in the top-right corner of the header, separate from the tabs. Clicking it opens the scoring criteria editor as a full-panel overlay on top of the current tab. It is not a tab — it's a persistent control always accessible from anywhere in the app.

The Saved tab shows a count badge with the number of saved listings. Badge disappears when count is 0.

Active tab has a bottom border indicator. Switching tabs preserves unsaved form state where possible.

---

## 5. Scoring System

### 5.1 Criteria & Priority Order

Weights are **never shown to the user.** The user sees only a ranked priority order in the Settings tab. Weights are calculated automatically from rank position — rank 1 gets the most influence, last rank gets the least. The user controls priority through drag-to-reorder.

**Default priority order (rank 1 = highest):**

| Rank | Criterion | Key | Hard Disqualifier? | Notes |
|---|---|---|---|---|
| 1 | In-unit W/D | `washer_dryer` | ✅ Yes | If missing = instant Skip regardless of other scores |
| 2 | Price ≤ $2,000/mo | `price` | No | |
| 3 | Near Green Lake | `green_lake` | No | Phinney Ridge, Roosevelt, Wallingford, Fremont all qualify |
| 4 | Parking included | `parking` | No | Street or assigned, must accommodate a car |
| 5 | Co-signer friendly | `cosigner` | No | Individual landlords = likely yes; large corporate = unclear |
| 6 | Month-to-month lease | `month_to_month` | No | |
| — | Pet policy (cat) | `pet_policy` | Flag only | Not scored, always surfaced as safe / risk / unknown |
| — | Ceiling height | `ceiling_height` | Flag only | Not scored, always surfaced if any mention found |
| — | Neighborhood note | `neighborhood_note` | Flag only | Distance/context relative to Green Lake |

**Auto weight calculation from rank (implement in `scoring.js`):**
```javascript
// weights[i] = (N - i) / sum(1..N) * 100
// Example for 6 criteria: [28.6, 23.8, 19, 14.3, 9.5, 4.8] — always sums to 100
// Recalculate any time criteria are reordered, added, or removed
function calculateWeights(rankedCriteria) {
  const N = rankedCriteria.length;
  const total = (N * (N + 1)) / 2;
  return rankedCriteria.map((c, i) => ({
    ...c,
    weight: ((N - i) / total) * 100
  }));
}
```

### 5.2 Score Values Per Criterion
Each criterion is evaluated as:
- `"yes"` — clearly stated in the listing
- `"no"` — clearly absent or ruled out
- `"unclear"` — not mentioned or ambiguous

Pet policy also uses: `"safe"` | `"risk"` | `"unknown"`

### 5.3 Weighted Score Calculation
Only non-flag criteria contribute to the weighted score (0–100):
- `yes` = full weight value
- `unclear` = half weight value
- `no` = 0
- Any hard disqualifier scoring `no` forces overall score to 0

### 5.4 Browse Mode Verdict Logic
| Condition | Verdict |
|---|---|
| Any hard disqualifier = no | Skip |
| Weighted score ≥ 70 | Apply |
| Weighted score 45–69 | Tour |
| Weighted score < 45 | Skip |

---

## 6. Claude API Integration

### 6.1 System Prompt

**Important:** The system prompt is built dynamically from the user's current criteria settings, not hardcoded. Implement a `buildSystemPrompt(criteria)` function in `claude.js` that reads the current criteria array from localStorage and generates the prompt on every call.

**Template (default criteria):**

```
You are an apartment research assistant helping a junior UX designer find housing in Seattle near Green Lake.

Analyze the listing(s) provided and respond ONLY with valid JSON. No markdown, no explanation, no code fences.

Scoring rules:
- washer_dryer (25%, HARD DISQUALIFIER): In-unit washer/dryer present
- price (22%): Total rent under $2,000/month
- green_lake (18%): Located in or near Green Lake, Phinney Ridge, Roosevelt, Wallingford, Fremont, or Northgate
- parking (14%): Street or assigned parking available for a car
- cosigner (11%): Likely to accept co-signer. Individual/private landlords = yes. Large property management companies = unclear unless stated.
- month_to_month (10%): Month-to-month or short/flexible lease available
- pet_policy (flag only): Cat-friendly. Values: "safe" | "risk" | "unknown"
- ceiling_height (flag only): Any mention of ceiling height, loft, top floor, high ceilings, vaulted. Extract the exact phrase or null.
- neighborhood_note (flag only): Brief note on neighborhood location relative to Green Lake. One sentence max.

Score each criterion as "yes" | "no" | "unclear". Never assume yes if not stated.

For browse mode (single listing) return:
{
  "mode": "browse",
  "name": "building name or short descriptor extracted from listing",
  "address": "full address if available, otherwise neighborhood",
  "price": "monthly rent as stated",
  "scores": {
    "washer_dryer": "yes|no|unclear",
    "price": "yes|no|unclear",
    "green_lake": "yes|no|unclear",
    "parking": "yes|no|unclear",
    "cosigner": "yes|no|unclear",
    "month_to_month": "yes|no|unclear",
    "pet_policy": "safe|risk|unknown",
    "ceiling_height": "exact quote from listing or null",
    "neighborhood_note": "one sentence or null"
  },
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
      "scores": { ...same as browse... },
      "weighted_score": <0-100>,
      "verdict": "apply|tour|skip",
      "strengths": ["up to 2 short strings"],
      "concerns": ["up to 2 short strings"]
    }
  ],
  "winner": <1-based index>,
  "winner_reason": "one sentence",
  "tradeoff_note": "one sentence on the key tradeoff between top two options"
}
```

### 6.2 User Prompt Format

**Browse mode:**
```
Analyze this single listing in browse mode:

[URL or label if provided]
[Full listing text]
```

**Decision mode (mixed input):**
```
Analyze these [N] listings in decision mode:

--- LISTING 1 ---
[URL or label]
[Text or "From saved: {name}"]

--- LISTING 2 ---
[Text]
```

### 6.3 API Call Settings
```javascript
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 1500,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }]
}
```

Parse response: find `content` block with `type: "text"`, strip any accidental code fences, `JSON.parse()`. Wrap in try/catch with user-facing error state.

---

## 7. Feature Specifications

### 7.1 Browse Tab

**Layout:** Single column, max-width 680px, centered.

**Inputs:**
- URL / label field (optional): text input, placeholder "Zillow URL or nickname"
- Listing text: textarea, 6 rows, placeholder "Paste the full listing text here — description, amenities, price, location..."
- "Analyze Listing" button: disabled until textarea has >20 characters

**On submit:**
1. Show loading spinner in button
2. Call Claude API
3. On success: render result below inputs, show "Save this listing" button
4. On error: show inline error message with retry option

**Result display:**
- Header row: extracted name, address, price, verdict badge (Apply / Tour / Skip)
- Neighborhood note (if present): shown prominently below header in a teal callout
- Criteria scorecard: each criterion as a row with label, weight, and colored pill (yes = green, no = red, unclear = yellow)
- Ceiling height callout: green callout box if any mention found, shows exact quote
- Pet policy callout: colored based on safe/risk/unknown
- Key concern: amber warning box if present
- Verdict reason: gray body text below scorecard
- "Save this listing" button: saves to localStorage and switches Save button to "Saved ✓" (disabled)

### 7.2 Decision Tab

**Layout:** Full width up to 1100px.

**Adding listings to compare:**

Two methods, both available:

*Method A — From Saved:*
- Dropdown or search input showing saved listing names
- Select one to add it to the comparison slot
- Shows its name and price in the slot header

*Method B — Paste new:*
- Same URL + textarea inputs as Browse tab
- Clearly labeled "New listing"

Each comparison slot shows which method is active with a small toggle ("From saved" / "Paste new").

Minimum 2 listings required to run comparison. Maximum 4.
"Add listing" button appears below slots until max is reached.
Each slot has a remove button (×) unless only 2 remain.

**On submit:**
- "Compare Listings" button, disabled until ≥2 valid slots
- Loading state with spinner
- Results render as side-by-side cards

**Result display:**
- Winner banner at top: dark background, listing name, winner reason
- Cards: one per listing, winner card has highlighted border and "TOP PICK" badge
- Each card shows: name, price, weighted score (large number), full criteria scorecard, strengths list, concerns list
- Ceiling height and neighborhood notes shown per card if present
- Tradeoff note: amber box below all cards
- "Save all" button + individual "Save" buttons per card

### 7.3 Saved Tab

**Layout:** Single column, max-width 780px.

**Empty state (first launch or no saved listings):**
- Illustration or large icon (house or search)
- Heading: "No saved listings yet"
- Body: "Analyze a listing in Browse mode, then hit Save to track it here."
- CTA button: "Go to Browse" — switches to Browse tab

**When listings exist:**

*Summary bar at top:*
- Total count
- Status counts inline: e.g. "3 Considering · 1 Toured · 1 Applied"

*Controls row:*
- Search input: filters by name in real time
- Sort dropdown: "Highest score" | "Lowest price" | "Most recent"
- Filter by status: "All" | "Considering" | "Toured" | "Applied" | "Rejected" — pill toggles

*Listing cards:*
Each saved listing displays as a card with:
- Name (editable inline on click)
- Address + price
- Weighted score (large)
- Verdict badge
- Status selector: pill group — Considering / Toured / Applied / Rejected (Considering is default)
- "View details" expand toggle
- Delete button (×) with confirmation tooltip "Delete this listing?"

*Expanded detail view (on "View details"):*
- Full criteria scorecard
- Ceiling height note if present
- Neighborhood note if present
- Pet policy flag
- Personal notes textarea (saves on blur to localStorage)
- "Use in Decision Mode" button — opens Decision tab with this listing pre-loaded in slot 1
- Timestamp: "Saved on [date]"

### 7.4 Settings Overlay (⚙ Gear Icon)

**Trigger:** Gear icon (⚙) in the top-right of the app header. Always visible regardless of active tab.

**Behavior:** Opens as a full-panel overlay that fades in over the current content. Does not navigate away from the current tab — closing returns the user to exactly where they were.

**Overlay header:**
- Title: "Scoring Criteria"
- Close button (×) top right

**Layout:** Single column, max-width 520px, centered panel.

**Section: Scored Criteria**

Displays a draggable list of scored criteria. Each row shows:
- Drag handle (⠿) on the left — grab to reorder
- Rank number (small gray label: #1, #2, etc.) — updates live as user reorders
- Editable label (inline text input, click to edit)
- Hard disqualifier toggle (red/gray switch) — when red, this criterion failing = automatic Skip
- Remove button (×)

**Section: Flag-Only Criteria**

Separate static list below scored criteria showing the flag-only items (pet policy, ceiling height, neighborhood note). Always active, cannot be removed or reordered. User can rename the label only.

**Section: Add Criterion**

A "+ Add criterion" button opens an inline form:
- Label input (required)
- Hard disqualifier toggle (default off)
- Confirm (Add) and Cancel buttons

New criteria added at the bottom of the ranked list (lowest priority) by default.

**Save behavior:**
- Changes not applied until user hits "Save Changes"
- "Save Changes" disabled until something has changed
- "Reset to defaults" link restores original 6 criteria and order
- On save: stored to localStorage under `apartment_scout_criteria`, weights recalculated, existing saved listings flagged as "scored with previous criteria" with a small warning badge

**Validation:**
- Cannot save with no scored criteria
- Cannot save if any label is empty
- Cannot have duplicate label names

**localStorage key:** `apartment_scout_criteria`

```javascript
// Stored as ordered array — index = rank
[
  { key: "washer_dryer", label: "In-unit W/D", isDisqualifier: true, flagOnly: false },
  { key: "price", label: "Price ≤ $2,000", isDisqualifier: false, flagOnly: false },
  // ... etc
  // Flag-only items always at end, flagOnly: true
  { key: "pet_policy", label: "Pet policy (cat)", isDisqualifier: false, flagOnly: true },
  { key: "ceiling_height", label: "Ceiling height", isDisqualifier: false, flagOnly: true },
  { key: "neighborhood_note", label: "Neighborhood note", isDisqualifier: false, flagOnly: true },
]
```

**Dynamic system prompt:** The Claude API system prompt must be generated dynamically from current saved criteria, not hardcoded. `claude.js` should call `buildSystemPrompt(criteria)` which reads from localStorage before every API call.

---

Each saved listing stored in localStorage under key `apartment_scout_listings` as a JSON array:

```javascript
{
  id: string,              // uuid or timestamp-based
  savedAt: ISO string,     // when it was saved
  name: string,            // extracted or user-edited nickname
  address: string,
  price: string,
  url: string | null,      // original URL label if provided
  rawText: string,         // original pasted listing text
  scores: {
    washer_dryer: "yes"|"no"|"unclear",
    price: "yes"|"no"|"unclear",
    green_lake: "yes"|"no"|"unclear",
    parking: "yes"|"no"|"unclear",
    cosigner: "yes"|"no"|"unclear",
    month_to_month: "yes"|"no"|"unclear",
    pet_policy: "safe"|"risk"|"unknown",
    ceiling_height: string | null,
    neighborhood_note: string | null
  },
  weighted_score: number,  // 0–100
  verdict: "apply"|"tour"|"skip",
  verdict_reason: string,
  key_concern: string | null,
  status: "considering"|"toured"|"applied"|"rejected",  // default: "considering"
  notes: string            // user's personal notes, default ""
}
```

Helper functions needed:
- `getListings()` — parse from localStorage, return array, handle empty/corrupt gracefully
- `saveListing(listing)` — append to array, write back
- `updateListing(id, changes)` — find by id, merge changes, write back
- `deleteListing(id)` — filter out, write back

---

## 9. UI & Design

### 9.1 Visual Style
- **Aesthetic:** Clean, minimal, desktop-first
- **Font:** DM Sans (Google Fonts) — weights 400, 500, 700, 800
- **Colors:**
  - Primary dark: `#1a1a2e`
  - Accent teal: `#2A7F7F`
  - Background: `#f7f7f5`
  - Surface: `#ffffff`
  - Border: `#e8e8e8`
  - Yes/green: `#43a047` bg `#e8f5e9`
  - No/red: `#ef5350` bg `#ffebee`
  - Unclear/amber: `#ffb300` bg `#fff8e1`
- **Border radius:** 10–14px for cards, 8px for inputs, 20px for pills
- **Max content width:** 1100px centered, padding 32px sides

### 9.2 Score Pills
Three states rendered consistently everywhere:
- `yes` → green pill
- `no` → red pill  
- `unclear` → amber pill

### 9.3 Verdict Badges
- `apply` → dark `#1a1a2e` background, white text, "✦ Apply"
- `tour` → blue `#1565c0` background, white text, "◎ Tour"
- `skip` → light gray, muted text, "✕ Skip"

### 9.4 Status Pills (Saved tab)
- Considering → gray
- Toured → blue
- Applied → teal/green
- Rejected → red/muted

### 9.5 Responsiveness

Fully responsive. The layout is desktop-first but must work cleanly on mobile and tablet.

| Breakpoint | Behavior |
|---|---|
| Desktop (≥ 1024px) | Full layout — side-by-side decision cards, full header |
| Tablet (768–1023px) | Decision cards wrap to 2 columns max, tabs stay horizontal |
| Mobile (< 768px) | Single column throughout, tabs scroll horizontally if needed, decision cards stack vertically, gear icon stays in header |

**Key responsive rules:**
- Decision mode cards: 2 per row on tablet, 1 per row on mobile
- Textareas: full width on all screen sizes
- Overlay (settings): full screen on mobile, centered panel on desktop
- No horizontal scrolling on any breakpoint
- Font sizes scale down one step on mobile (e.g. 13px → 12px body)

---

## 10. Error States

| Scenario | Behavior |
|---|---|
| API call fails | Inline error: "Couldn't analyze this listing. Check your connection and try again." + retry button |
| JSON parse fails | Inline error: "Got an unexpected response. Try again." + retry button |
| localStorage full | Warn user: "Storage is almost full. Consider deleting old listings." |
| Listing already saved | "Save" button shows "Already saved ✓" and is disabled |
| Decision mode < 2 listings | Compare button disabled, helper text: "Add at least 2 listings to compare" |
| Criteria changed after save | Small warning badge on saved listing: "Scored with previous criteria" |
| Settings: duplicate label | Inline error under the field: "Each criterion needs a unique name" |
| Settings: all criteria removed | Save button disabled, error: "You need at least one scored criterion" |

---

## 11. Project Structure (Suggested)

```
apartment-scout/
├── public/
├── src/
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── BrowseTab.jsx
│   │   │   ├── DecisionTab.jsx
│   │   │   └── SavedTab.jsx
│   │   ├── SettingsOverlay.jsx       # Gear icon → full overlay with drag-to-reorder
│   │   ├── ListingCard.jsx           # Saved listing card
│   │   ├── ScoreCard.jsx             # Criteria scorecard (reused in all tabs)
│   │   ├── VerdictBadge.jsx
│   │   ├── ScorePill.jsx
│   │   ├── DraggableCriteriaList.jsx # Drag-to-reorder list for Settings
│   │   └── EmptyState.jsx
│   ├── utils/
│   │   ├── storage.js                # localStorage helpers for listings AND criteria
│   │   ├── claude.js                 # API call + buildSystemPrompt(criteria)
│   │   └── scoring.js                # calculateWeights(criteria) + verdict logic
│   ├── constants/
│   │   └── defaultCriteria.js        # Default criteria array — used for reset
│   ├── App.jsx                       # Tab routing + state
│   └── main.jsx
├── .env                              # VITE_ANTHROPIC_API_KEY (gitignored)
├── .gitignore                        # Must include .env
├── .env.example                      # Safe to commit — key name, no value
└── README.md
```

---

## 12. Environment Setup Instructions for Claude Code

1. Scaffold with Vite: `npm create vite@latest apartment-scout -- --template react`
2. Install Tailwind CSS following Vite guide
3. Install additional deps: `npm install uuid @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
4. Create `.env` with `VITE_ANTHROPIC_API_KEY=your_key_here`
5. Create `.env.example` with `VITE_ANTHROPIC_API_KEY=` (empty value)
6. Add `.env` to `.gitignore`
7. Access key in code via `import.meta.env.VITE_ANTHROPIC_API_KEY`

**Note on drag-to-reorder:** Use `@dnd-kit` for the draggable criteria list in Settings — it's the most reliable React drag-and-drop library and works well with Vite.

---

## 13. Out of Scope (v1)

- User accounts or authentication
- Multi-user access
- Backend or database
- Email/notification alerts for new listings
- Automatic Zillow scraping
- Map view
- Export to PDF or spreadsheet

These may be added in a future version, especially if this becomes a portfolio case study demo for other users.

---

## 14. Success Criteria

This tool is successful if:
- A listing can be scanned in under 30 seconds
- Saved listings persist across browser sessions
- Decision mode surfaces a clear recommendation with reasoning
- Ceiling height and pet policy are always visible in results
- The interface requires no instructions to use on first visit

---

*PRD created March 2026 · Apartment Scout v1 · Personal use · Seattle area*
