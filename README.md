# Apartment Scout

A personal AI-powered tool for scoring, saving, and comparing Seattle apartment listings against your own weighted criteria.

Built during an active apartment search near Green Lake, Seattle. Paste a listing, get a structured score and recommendation in seconds, save finalists, and compare them side by side.

---

## Features

### Browse

Paste a raw listing (from Zillow, Craigslist, etc.) and get an instant AI analysis: a per-criterion scorecard, a weighted score (0–100), and a verdict — **Apply**, **Tour**, or **Skip** — with a one-sentence reason. Save any result to your list with one click.

### Decision

Load 2–4 listings side by side — from saved listings or fresh pastes — and run a single comparison call. Returns a winner pick, per-listing strengths and concerns, and a tradeoff note between the top two options.

### Saved

All saved listings in one place. Filter by verdict, status (Considering / Toured / Applied / Rejected), score floor, max rent, and neighborhood. Sort by score, price, or recency. Send any listing directly to Decision mode. Add personal notes.

### Settings

Edit your scoring criteria: rename, reorder by drag, toggle hard disqualifiers, add new criteria. Weights are auto-calculated from rank order — you never touch a percentage. Changes instantly recalculate scores for all saved listings locally, no API call needed.

### Export

Export your saved listings to a CSV from the Saved tab. Choose which listings and criteria columns to include, and pick a score format: human-readable (Yes / No / Unclear), raw stored values, or both side by side. Downloads as `Apartment_Scout_Export_YYYY-MM-DD.csv`.

---

## Tech Stack

| Layer         | Choice                                            | Notes                               |
| ------------- | ------------------------------------------------- | ----------------------------------- |
| Framework     | React 19 (Vite 7)                                 | Component-based, fast HMR           |
| Styling       | Tailwind CSS v4                                   | Vite plugin — no config file needed |
| AI            | Anthropic Claude API (`claude-sonnet-4-20250514`) | Via serverless function only        |
| Persistence   | `localStorage`                                    | Two keys: listings + criteria       |
| Hosting       | Vercel                                            | Auto-deploys from GitHub            |
| Drag-and-drop | `@dnd-kit/core`, `@dnd-kit/sortable`              | Criteria reordering in Settings     |
| IDs           | `uuid` (v4)                                       | Stable listing and criteria keys    |

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`
- An [Anthropic API key](https://console.anthropic.com/)

### Install

```bash
git clone https://github.com/the-esoteric-girl/apartment-scout.git
cd apartment-scout
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env and add your key:
# ANTHROPIC_API_KEY=sk-ant-...
```

### Run locally

```bash
vercel login      # first time only
vercel link       # first time only — links to your Vercel project
vercel dev        # starts both Vite and the /api serverless function
```

> **Important:** Use `vercel dev`, not `npm run dev`. The app calls `/api/analyze` — a Vercel serverless function — to reach the Claude API. Running Vite alone will cause all analysis calls to fail.

The app runs at `http://localhost:3000`.

---

## Project Structure

```
apartment-scout/
├── api/
│   └── analyze.js              # Vercel serverless function — only place the API key lives
├── src/
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── BrowseTab.jsx   # Single listing analysis
│   │   │   ├── DecisionTab.jsx # Side-by-side comparison (2–4 listings)
│   │   │   ├── SavedTab.jsx    # View/manage/filter saved listings
│   │   │   └── SettingsTab.jsx # Drag-to-reorder criteria editor
│   │   ├── ScoreCard.jsx       # Criteria scorecard — shared across all tabs
│   │   ├── VerdictBadge.jsx    # Apply / Tour / Skip badge
│   │   ├── ScorePill.jsx       # yes / no / unclear colored pill
│   │   ├── ListingCard.jsx     # Saved listing card
│   │   └── DraggableCriteriaList.jsx
│   ├── utils/
│   │   ├── storage.js          # All localStorage reads/writes
│   │   ├── claude.js           # Prompt builders + API call
│   │   └── scoring.js          # Weight calculation, scoring, verdict logic
│   ├── constants/
│   │   └── defaultCriteria.js  # Default criteria — used for Settings reset
│   └── App.jsx                 # Root: tab routing + shared state
├── .env.example
└── vite.config.js
```

---

## Scoring System

Weights are derived automatically from drag-order rank. The user never sets a percentage.

```
weight[i] = (N - i) / sum(1..N) * 100
```

Example for 6 criteria: `[28.6%, 23.8%, 19%, 14.3%, 9.5%, 4.8%]` — always sums to 100%.

Each criterion scores as `yes` (full weight), `unclear` (half weight), or `no` (0). The weighted sum gives a 0–100 score.

**Verdict thresholds:**

| Score | Verdict |
| ----- | ------- |
| ≥ 70  | Apply   |
| 45–69 | Tour    |
| < 45  | Skip    |

Any criterion marked as a **hard disqualifier** that scores `no` immediately forces the score to 0 and the verdict to Skip — regardless of all other scores.

---

## Architecture Notes

**API key never touches the browser.** The Anthropic API key lives in a Vercel serverless function (`/api/analyze.js`). The React frontend calls that endpoint via `fetch`. Using a `VITE_` prefix would expose the key in the client bundle.

**Decision mode uses stored scores.** When a saved listing is loaded into Decision mode, its existing `scores`, `weighted_score`, and `verdict` are used as-is. No API call is made. This keeps cost low and results consistent.

**Criteria changes recalculate locally.** When you reorder, add, or remove criteria, all saved listings are rescored instantly in the browser using the stored `yes/no/unclear` values — only the weights and verdicts change. New criteria missing from older listings default to `unclear`.

**Criteria keys are stable UUIDs.** The `key` on each criterion (e.g. `washer_dryer`) is the JSON property used in stored scores. The `label` is display-only and can be renamed freely without breaking any saved data.
