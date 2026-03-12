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

### D7 — Dirty-State Guard: Lift Flag to App, Intercept Tab Clicks

**Decision:** `isDirty` is computed in `SettingsTab` via `useEffect` (comparing local state to saved props) and surfaced to `App` via an `onDirtyChange` callback; tab-click interception happens in `App`.

**Why:** The dirty flag needs to live where tab navigation lives (App), but the comparison logic belongs in SettingsTab where the local state is. Lifting the flag via a callback keeps each layer responsible for what it owns. An alternative was lifting all Settings local state into App, but that would bloat App and break the existing clean separation where Settings manages its own draft state.

**Tradeoff:** Two render cycles on each change (SettingsTab updates local state → effect fires → App re-renders with new dirty flag), but this is imperceptible and avoids coupling App to Settings internals.

---

### D8 — Criteria Library: Collapsible Panel + Toggle-Remove Pills

**Decision:** Replaced the dashed-border "Add criteria" toggle button with a collapsible panel (matching the Saved tab filter pattern), and made already-added criteria pills clickable to remove (red hover affordance) instead of rendering them disabled.

**Why:** The original pattern had two problems: (1) the dashed button was visually inconsistent with the collapsible filter panel introduced in the Saved tab, and (2) disabled pills gave no affordance for removing a criterion — users had to scroll up to the draggable list and find the ✕ button. The new pattern surfaces removal in the same place as addition, where the user's attention already is.

**Tradeoff:** The red-on-hover removal affordance is only discoverable by hovering. A persistent remove icon on each added pill would be more explicit but clutters the pill at small text sizes.

---
