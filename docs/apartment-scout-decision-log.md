# Apartment Scout — Decision Log

_Running log of build decisions. Add entries as new decisions are made._

---

## Session 2 — March 2026 | Architecture & Pre-Build Decisions

### 🔐 D1 — API Key: Vercel Proxy (not browser-exposed)

**Decision:** API key lives in a Vercel serverless function (`/api/analyze`), not in the browser bundle.

**Why:** `VITE_` prefixed env vars get bundled into client-side JS — anyone with DevTools can read them. Even for a personal tool, establishing good security practices matters, especially since the app may be shared with friends in the future.

**Pattern:**

```
Browser → /api/analyze (Vercel function) → Anthropic API
```

**Tradeoff:** One extra file to set up. Worth it for correctness and future-proofing.

---

### 📊 D2 — Decision Mode: Use Stored Scores (No Re-Analysis)

**Decision:** When a saved listing is added to Decision Mode, use its stored `scores` and `weighted_score` directly. Do not re-send `rawText` to Claude.

**Why:** Faster, costs no API tokens, and simpler. The risk (scores may reflect old criteria) is mitigated by D4 below.

---

### 🔑 D3 — Custom Criteria Keys: UUID-Based, Permanent

**Decision:** When a user creates a new criterion, it gets a stable UUID key (e.g. `crit_a3f9b2`) generated once and never changed. The label is just the display name — fully editable without breaking anything.

**Why:** If keys were generated from labels (e.g. `natural_light`), renaming a criterion would orphan all its stored scores. UUID keys decouple identity from display name.

**Missing scores:** If a saved listing predates a criterion, that criterion gets `"unclear"` (half-weight) as a fallback. A subtle note is shown on the listing: _"This listing wasn't scored for [criterion name]."_

---

### ♻️ D4 — Criteria Changes: Auto-Recalculate Locally

**Decision:** All criteria changes instantly recalculate scores and verdicts on saved listings for free — except adding a brand new criterion (which requires a fresh Claude analysis to score accurately).

| Change type              | What happens                               | Cost |
| ------------------------ | ------------------------------------------ | ---- |
| Reorder criteria         | Weighted scores recalculate instantly      | Free |
| Remove a criterion       | Scores recalculate instantly               | Free |
| Toggle hard disqualifier | Verdicts update instantly                  | Free |
| Rename a criterion       | Display-only, nothing breaks               | Free |
| Add new criterion        | Old listings get `"unclear"` + subtle flag | Free |

**Why:** The original PRD approach (a "scored with previous criteria" warning badge) was overly cautious and would have caused unnecessary noise. Auto-recalculation is cleaner and more honest.

---

### ⚠️ D5 — Price: Soft Disqualifier (User-Controlled)

**Decision:** Price is NOT a hard disqualifier by default — it's a regular ranked criterion that affects the weighted score. Any criterion can be toggled to a hard disqualifier by the user in Settings.

**Why:** The v1.0 PRD had price hardcoded as a disqualifier. v1.1 removes this — the user should decide what's disqualifying, not the app.

---

### 🏷 D6 — Scorecard: Show Rank Numbers, Not Weights

**Decision:** Each criterion in the scorecard shows its rank number (#1, #2, etc.) next to the label. Numeric weights (e.g. 28.6%) are internal only and never displayed.

**Why:** Percentages imply false precision. Rank order is honest about relative priority without making the user do math. This is a UX simplification, not a technical one — weights still drive the scoring engine under the hood.

---

## Build Order (Confirmed)

| Phase | Scope                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 1     | Foundation — Vite + Tailwind, file structure, `defaultCriteria.js`, `storage.js`, `scoring.js`, tab shell |
| 2     | Browse Tab — `claude.js` with dynamic prompt, `ScoreCard`, `ScorePill`, `VerdictBadge`                    |
| 3     | Save + Saved Tab — save from Browse, `ListingCard`, `EmptyState`, search/sort/filter/expand/delete        |
| 4     | Decision Tab — slots, from-saved selector, paste-new, compare, winner banner                              |
| 5     | Settings Overlay — `@dnd-kit` drag-to-reorder, add/remove/rename, save/reset, UUID key generation         |
| 6     | Polish — responsive pass, error states, edge cases, visual QA                                             |

---
