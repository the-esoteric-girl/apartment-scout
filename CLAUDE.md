# CLAUDE.md — Apartment Scout

> **Keep this file updated.** Whenever a significant architectural decision is made or reversed, update the relevant section before writing code.

---

## Project Overview

Apartment Scout is a personal AI-powered apartment research tool for a solo user (junior UX/UI designer) searching near Green Lake, Seattle. It lets you paste a listing, get an AI-scored analysis against weighted criteria, save listings, and compare finalists side by side.

**This is a solo-use tool.** No auth, no multi-user, no backend database. Simplicity is a feature.

After each working feature, remind me to commit to GitHub.

---

## Tech Stack

| Layer         | Choice                                            | Notes                                |
| ------------- | ------------------------------------------------- | ------------------------------------ |
| Framework     | React 19 (Vite 7)                                 | Component-based, fast HMR            |
| Styling       | Tailwind CSS v4                                   | Vite plugin — no config file needed  |
| AI            | Anthropic Claude API (`claude-sonnet-4-20250514`) | Via serverless function only         |
| Persistence   | `localStorage`                                    | Two keys: listings + criteria        |
| Hosting       | Vercel                                            | Auto-deploys from GitHub             |
| Drag-and-drop | `@dnd-kit/core`, `@dnd-kit/sortable`              | Settings criteria reordering         |
| IDs           | `uuid` (v4)                                       | For stable listing and criteria keys |

---

## File Structure

```
apartment-scout/
├── api/
│   └── analyze.js              # Vercel serverless function — ONLY place API key lives
├── public/
├── src/
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── BrowseTab.jsx   # Single listing analysis
│   │   │   ├── DecisionTab.jsx # Side-by-side comparison (2–4 listings)
│   │   │   └── SavedTab.jsx    # View/manage/filter saved listings
│   │   ├── SettingsOverlay.jsx # Gear icon → full overlay, drag-to-reorder criteria
│   │   ├── ListingCard.jsx     # Saved listing card (Saved tab)
│   │   ├── ScoreCard.jsx       # Criteria scorecard — reused in Browse, Decision, Saved
│   │   ├── VerdictBadge.jsx    # apply / tour / skip badge
│   │   ├── ScorePill.jsx       # yes / no / unclear colored pill
│   │   ├── DraggableCriteriaList.jsx  # dnd-kit list for Settings
│   │   └── EmptyState.jsx      # Empty state for Saved tab
│   ├── utils/
│   │   ├── storage.js          # All localStorage reads/writes (listings + criteria)
│   │   ├── claude.js           # buildSystemPrompt, buildBrowsePrompt, buildDecisionPrompt, analyzeListing
│   │   └── scoring.js          # calculateWeights, calculateWeightedScore, calculateVerdict, recalculateForCriteria
│   ├── constants/
│   │   └── defaultCriteria.js  # DEFAULT_CRITERIA array + CRITERION_DESCRIPTIONS map
│   ├── App.jsx                 # Root: tab routing, shared listings/criteria state
│   ├── index.css               # Tailwind imports + DM Sans font
│   └── main.jsx
├── .env                        # ANTHROPIC_API_KEY (gitignored)
├── .env.example                # Safe to commit — key name only, no value
├── .gitignore
├── CLAUDE.md                   # This file
├── package.json
└── vite.config.js
```

---

## Key Architectural Decisions — Never Reverse Without Discussion

### 1. API key lives server-side only (`/api/analyze.js`)

The Anthropic API key **must never** appear in the browser bundle. The Vercel serverless function at `/api/analyze` is the sole caller of the Anthropic API. The React frontend calls `/api/analyze` via `fetch`. Using `VITE_` prefix would expose the key in the client bundle — don't do it.

**Locally:** Use `vercel dev` (not `npm run dev`) to run the serverless function alongside Vite.

### 2. Decision Mode uses stored scores — no re-analysis

When a saved listing is loaded into Decision Mode, we use its stored `scores`, `weighted_score`, and `verdict` as-is. We do **not** re-call the Claude API. This saves cost and keeps behavior predictable.

### 3. Criteria keys are permanent UUIDs — labels are display-only

Each criterion has a stable `key` (built-in criteria use semantic keys like `washer_dryer`; user-added criteria get a UUID). The `key` is used as the JSON property in stored scores. The `label` is display-only and can be renamed freely without breaking anything.

### 4. Criteria changes recalculate scores locally — no API call

When the user reorders, adds, or removes criteria, existing saved listings are recalculated using `recalculateForCriteria()` in `scoring.js`. The stored `yes/no/unclear` scores don't change — only weights and verdict are recalculated. New criteria missing from old listings default to `"unclear"`. This is free and instant.

### 5. Hard disqualifiers force score to 0 / verdict to Skip

Any criterion with `isDisqualifier: true` that scores `"no"` immediately sets `weighted_score = 0` and `verdict = "skip"`. This is enforced in both `scoring.js` (for local recalculation) and in the Claude system prompt (for fresh analysis).

### 6. Scorecard shows rank numbers, not weights

The user sees `#1`, `#2`, etc. in the criteria scorecard. Numeric weights (28.6%, 23.8%, etc.) are internal only — never rendered in any UI element. The user controls priority through drag-to-reorder in Settings.

---

## Scoring System

Weights are calculated automatically from rank position (rank 1 = most important):

```
weight[i] = (N - i) / sum(1..N) * 100
```

For 6 criteria: `[28.6%, 23.8%, 19%, 14.3%, 9.5%, 4.8%]` — always sums to 100%.

**Score values:** `yes` = full weight · `unclear` = half weight · `no` = 0

**Verdict thresholds:** ≥70 = Apply · 45–69 = Tour · <45 = Skip

---

## Color Tokens

Use inline `style` props for these — they're not in Tailwind config:

| Purpose            | Value                    |
| ------------------ | ------------------------ |
| Primary dark       | `#1a1a2e`                |
| Accent teal        | `#2A7F7F`                |
| Background         | `#f7f7f5`                |
| Surface (cards)    | `#ffffff`                |
| Border             | `#e8e8e8`                |
| Yes/green text     | `#43a047` · bg `#e8f5e9` |
| No/red text        | `#ef5350` · bg `#ffebee` |
| Unclear/amber text | `#ffb300` · bg `#fff8e1` |
| Tour/blue          | `#1565c0`                |

---

## Coding Conventions

- **Inline styles for brand colors** — Tailwind handles layout/spacing, inline `style` handles the color palette above.
- **No weights shown in UI** — ever. Only rank numbers.
- **Shared display components** — `ScorePill`, `VerdictBadge`, `ScoreCard` are used in Browse, Decision, and Saved tabs. Don't duplicate score rendering logic.
- **Pure utility functions** — `scoring.js` and `storage.js` have no React imports. They're plain JS.
- **State lives in App.jsx** — `listings` and `criteria` are lifted to the root. Tabs receive them as props and call handler functions (`onSave`, `onUpdate`, etc.) to mutate.
- **localStorage never called directly in components** — always go through `storage.js` functions.
- **`buildSystemPrompt(criteria)` is called fresh on every API call** — reads current criteria, never cached between calls.

---

## localStorage Keys

| Key                        | Contents                                 |
| -------------------------- | ---------------------------------------- |
| `apartment_scout_listings` | JSON array of saved listing objects      |
| `apartment_scout_criteria` | JSON array of criteria in priority order |

Both are read/written exclusively through `src/utils/storage.js`.

---

## Running Locally

```bash
# Install dependencies
npm install

# Create .env file with your Anthropic API key
# (copy .env.example and fill in the value)
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY=sk-ant-...

# Run with Vercel dev (required for /api/analyze serverless function)
vercel dev

# The app will be at http://localhost:3000
# If you run `npm run dev` instead, API calls will fail (no serverless function)
```

**First-time Vercel setup:**

```bash
npm install -g vercel
vercel login
vercel link   # link to your Vercel project
```

---

## Phases

| Phase | Focus                                           | Status      |
| ----- | ----------------------------------------------- | ----------- |
| 1     | Foundation — utilities, API function, App shell | ✅ Complete |
| 2     | Browse Tab — analyze + scorecard + save         | ✅ Complete |
| 3     | Saved Tab — listing cards, filter/sort/search   | ✅ Complete |
| 4     | Decision Tab — side-by-side comparison          | ✅ Complete |
| 5     | Settings Overlay — drag-to-reorder criteria     | ✅ Complete |
| 6     | Polish — responsive, error states, edge cases   | Pending     |

## Decision logging

After completing any task, update /docs/decisions.md.
Only log a decision if it meets one of these criteria:

- It was a real choice between two or more options
- It deviates from the default or most obvious approach
- A future developer (or recruiter) would ask "why did you do it this way?"

Do not log standard practice with no real alternative.
Append only — never edit existing entries.

Use this format exactly:

### D[next number] — [short title]

**Decision:** [what was decided, one sentence]

**Why:** [reasoning, tradeoffs, what was considered and rejected]

**Tradeoff:** [what you gave up by choosing this approach, or "None significant"]
