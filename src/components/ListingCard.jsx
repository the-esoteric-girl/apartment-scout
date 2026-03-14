/**
 * ListingCard — a single saved listing in the Saved tab.
 *
 * Collapsed view: name, address/price, score, verdict, status selector, expand toggle, delete.
 * Expanded view: full scorecard, ceiling/neighborhood/pet callouts, notes textarea,
 *                "Use in Decision Mode" button, saved timestamp.
 *
 * Props:
 *   listing           — saved listing object
 *   criteria          — current criteria array (for ScoreCard)
 *   onUpdate(id, obj) — persist changes to a listing
 *   onDelete(id)      — remove listing
 *   onUseInDecision   — fn(listing) opens Decision tab with this listing pre-loaded
 */
import { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import ScoreCard from "./ScoreCard";
import VerdictBadge from "./VerdictBadge";
import { calculateWeightedScore, calculateVerdict } from "../utils/scoring";

// ─────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────
const STATUSES = [
  { value: "considering", label: "Considering" },
  { value: "toured", label: "Toured" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_ACTIVE_CLASS = {
  considering: "bg-inactive text-prose",
  toured: "bg-status-toured-bg text-verdict-tour",
  applied: "bg-status-applied-bg text-status-applied-text",
  rejected: "bg-status-rejected-bg text-status-rejected-text",
};

// ─────────────────────────────────────────────────────────────
// Pet policy display
// ─────────────────────────────────────────────────────────────
const PET_STYLES = {
  safe: {
    className: "bg-score-yes-bg border-l-score-yes text-callout-yes-text",
    icon: "🐱",
    label: "Cat-friendly",
  },
  risk: {
    className: "bg-score-no-bg border-l-score-no text-error",
    icon: "⚠️",
    label: "Pet risk — check policy",
  },
  unknown: {
    className: "bg-score-unclear-bg border-l-warning text-score-unclear",
    icon: "❓",
    label: "Pet policy unknown",
  },
};

function Callout({ className, children }) {
  return (
    <div className={`rounded-lg px-4 py-3 text-sm border-l-4 ${className}`}>
      {children}
    </div>
  );
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function ListingCard({
  listing,
  criteria,
  onUpdate,
  onDelete,
  onUseInDecision,
  onAddToCompare,
  inCompareQueue,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localNotes, setLocalNotes] = useState(listing.notes ?? "");

  // Inline-edit state: name, address, price
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(listing.name);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddress, setEditAddress] = useState(listing.address ?? "");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState(listing.price ?? "");

  const nameInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const priceInputRef = useRef(null);

  // Focus inputs when editing starts
  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);
  useEffect(() => {
    if (isEditingAddress) addressInputRef.current?.focus();
  }, [isEditingAddress]);
  useEffect(() => {
    if (isEditingPrice) priceInputRef.current?.focus();
  }, [isEditingPrice]);

  // Generic commit/cancel helpers
  function commitField(field, value, original, setEditing, resetValue) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== original) onUpdate(listing.id, { [field]: trimmed });
    else resetValue(original);
    setEditing(false);
  }

  function handleFieldKeyDown(e, commit, cancel) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  }

  // Per-field helpers
  function commitNameEdit() {
    commitField("name", editName, listing.name, setIsEditingName, setEditName);
  }
  function handleNameKeyDown(e) {
    handleFieldKeyDown(e, commitNameEdit, () => {
      setEditName(listing.name);
      setIsEditingName(false);
    });
  }

  function commitAddressEdit() {
    commitField(
      "address",
      editAddress,
      listing.address ?? "",
      setIsEditingAddress,
      setEditAddress,
    );
  }
  function handleAddressKeyDown(e) {
    handleFieldKeyDown(e, commitAddressEdit, () => {
      setEditAddress(listing.address ?? "");
      setIsEditingAddress(false);
    });
  }

  function commitPriceEdit() {
    commitField(
      "price",
      editPrice,
      listing.price ?? "",
      setIsEditingPrice,
      setEditPrice,
    );
  }
  function handlePriceKeyDown(e) {
    handleFieldKeyDown(e, commitPriceEdit, () => {
      setEditPrice(listing.price ?? "");
      setIsEditingPrice(false);
    });
  }

  function handleStatusChange(status) {
    onUpdate(listing.id, { status });
  }

  function handleNotesBlur() {
    if (localNotes !== listing.notes) {
      onUpdate(listing.id, { notes: localNotes });
    }
  }

  function handleScoreChange(key, newScore) {
    const newScores = { ...listing.scores, [key]: newScore };
    const newWeightedScore = calculateWeightedScore(newScores, criteria);
    const newVerdict = calculateVerdict(newScores, criteria, newWeightedScore);
    onUpdate(listing.id, {
      scores: newScores,
      weighted_score: newWeightedScore,
      verdict: newVerdict,
    });
  }

  const petPolicy = listing.scores?.pet_policy;
  const petStyle = PET_STYLES[petPolicy] ?? null;
  const ceilingQuote = listing.scores?.ceiling_height;
  const neighborhoodNote = listing.scores?.neighborhood_note;

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-border">
      {/* ── Collapsed row ── */}
      <div className="px-5 py-4">
        {/* Top row: name + score + verdict */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Editable name */}
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={handleNameKeyDown}
                className="text-base font-bold rounded px-1 -mx-1 outline-none border-b-2 w-full text-primary border-b-accent bg-transparent"
              />
            ) : (
              <button
                onClick={() => {
                  setIsEditingName(true);
                  setEditName(listing.name);
                }}
                className="text-base font-bold text-left hover:underline decoration-dashed truncate block w-full text-primary"
                title="Click to rename"
              >
                {listing.name}
              </button>
            )}

            {/* Address + price — editable only when blank */}
            <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5 text-sm text-secondary">
              {/* Address */}
              {listing.address && /\d/.test(listing.address) ? (
                <span className="truncate max-w-[200px]">
                  {listing.address}
                </span>
              ) : isEditingAddress ? (
                <input
                  ref={addressInputRef}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  onBlur={commitAddressEdit}
                  onKeyDown={handleAddressKeyDown}
                  placeholder="Address"
                  className="rounded px-1 -mx-1 outline-none border-b text-secondary border-b-accent bg-transparent"
                  style={{ minWidth: "120px" }}
                />
              ) : (
                <button
                  onClick={() => {
                    setIsEditingAddress(true);
                    setEditAddress(listing.address ?? "");
                  }}
                  className={`hover:underline decoration-dashed ${listing.address ? "text-secondary" : "text-faint"}`}
                  title={
                    listing.address ? "Click to edit address" : "Add address"
                  }
                >
                  {listing.address || "Add address"}
                </button>
              )}

              {/* Separator */}
              {(listing.address || isEditingAddress) &&
                (listing.price || isEditingPrice) && (
                  <span aria-hidden="true">·</span>
                )}

              {/* Price */}
              {listing.price ? (
                <span>{listing.price}</span>
              ) : isEditingPrice ? (
                <input
                  ref={priceInputRef}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  onBlur={commitPriceEdit}
                  onKeyDown={handlePriceKeyDown}
                  placeholder="Price"
                  className="rounded px-1 -mx-1 outline-none border-b text-secondary border-b-accent bg-transparent"
                  style={{ minWidth: "80px" }}
                />
              ) : (
                <button
                  onClick={() => {
                    setIsEditingPrice(true);
                    setEditPrice("");
                  }}
                  className="hover:underline decoration-dashed text-faint"
                  title="Add price"
                >
                  Add price
                </button>
              )}
            </div>
          </div>

          {/* Score + verdict */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-2xl font-extrabold text-primary">
                {listing.weighted_score}
              </span>
              <span className="text-xs ml-0.5 text-tertiary">/100</span>
            </div>
            <VerdictBadge verdict={listing.verdict} size="sm" />
          </div>
        </div>

        {/* Collapsed callouts: neighborhood note (always) + pet risk warning */}
        {(neighborhoodNote || petPolicy === "risk") && (
          <div className="flex flex-col gap-1.5 mb-3">
            {neighborhoodNote && (
              <div className="rounded-lg px-3 py-2 text-xs border-l-4 bg-callout-bg border-l-accent text-callout-text">
                <span className="font-semibold">📍 </span>
                {neighborhoodNote}
              </div>
            )}
            {petPolicy === "risk" && (
              <div className="rounded-lg px-3 py-2 text-xs border-l-4 bg-score-no-bg border-l-score-no text-error">
                <span className="font-semibold">⚠️ Pet risk</span> — check
                policy before applying
              </div>
            )}
          </div>
        )}

        {/* Status pill group */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {STATUSES.map((s) => {
            const isActive = listing.status === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? `${STATUS_ACTIVE_CLASS[s.value]} cursor-default`
                    : "bg-gray-50 text-tertiary cursor-pointer hover:bg-inactive"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Bottom row: expand toggle + compare + delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="text-sm font-medium text-accent"
            >
              {isExpanded ? "Hide details ↑" : "View details ↓"}
            </button>

            {onAddToCompare && (
              <button
                onClick={() => onAddToCompare(listing)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  inCompareQueue
                    ? "text-white border-primary bg-primary"
                    : "text-secondary border-border bg-white"
                }`}
              >
                {inCompareQueue ? "✓ Added" : "Compare"}
              </button>
            )}
          </div>

          {/* Delete with confirmation */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">
                Delete this listing?
              </span>
              <button
                onClick={() => onDelete(listing.id)}
                className="text-xs font-semibold px-2.5 py-1 rounded bg-score-no-bg text-score-no"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs font-medium px-2.5 py-1 rounded bg-inactive text-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 transition-opacity opacity-40 hover:opacity-100 text-score-no"
              title="Delete listing"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded detail view ── */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-inactive flex flex-col gap-4">
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">
              Scorecard
            </p>
            <ScoreCard
              scores={listing.scores}
              criteria={criteria}
              onScoreChange={handleScoreChange}
            />
          </div>

          {/* Neighborhood note */}
          {neighborhoodNote && (
            <Callout className="bg-callout-bg border-l-accent text-callout-text">
              <span className="font-semibold">📍 Location: </span>
              {neighborhoodNote}
            </Callout>
          )}

          {/* Ceiling height */}
          {ceilingQuote && (
            <Callout className="bg-score-yes-bg border-l-score-yes text-callout-yes-text">
              <span className="font-semibold">⬆️ Ceiling: </span>
              &ldquo;{ceilingQuote}&rdquo;
            </Callout>
          )}

          {/* Pet policy */}
          {petStyle && (
            <Callout className={petStyle.className}>
              <span className="font-semibold">
                {petStyle.icon} {petStyle.label}
              </span>
            </Callout>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-tertiary">
              Personal notes
            </label>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add your own notes about this listing…"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none border-border text-primary focus:border-accent"
            />
          </div>

          {/* Footer: Use in Decision Mode + timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              onClick={() => onUseInDecision(listing)}
              className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors text-accent border-accent bg-white"
            >
              ⚖️ Use in Decision Mode
            </button>

            <span className="text-xs text-tertiary">
              Saved {formatDate(listing.savedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
