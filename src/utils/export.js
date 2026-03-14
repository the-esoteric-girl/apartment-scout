/**
 * export.js
 *
 * CSV export utility for Apartment Scout.
 * Generates a CSV string from selected listings and criteria,
 * then triggers a browser download.
 */

/**
 * Escape a single value for CSV output.
 * Wraps in double quotes if the value contains commas, newlines, or double quotes.
 * Internal double quotes are escaped as "".
 */
function escapeCell(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Format a score value for a scored criterion based on display mode.
 *   'scores' → Yes / No / Unclear (capitalized, human-readable)
 *   'raw'    → yes / no / unclear (as stored)
 *
 * Flag-only criteria store free-text strings (e.g. ceiling height quotes),
 * so they always return the raw stored value regardless of mode.
 */
function formatScore(value, isFlagOnly, mode) {
  // Flag-only criteria store free text — empty just means nothing was extracted
  if (isFlagOnly) return value == null ? '' : String(value);
  // Scored criterion with no stored value = was never part of the AI analysis
  if (value == null || value === '') return 'N/A';

  if (mode === 'raw') return String(value);

  const MAP = { yes: 'Yes', no: 'No', unclear: 'Unclear' };
  return MAP[value] ?? String(value);
}

/**
 * Return today's date as YYYY-MM-DD for the filename.
 */
function todayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build and trigger a CSV download.
 *
 * Column order: Name, URL, Price, Price (Sortable), Address, Weighted Score,
 * Verdict, Status, then one column per selected criterion (or two for scored
 * criteria in 'both' mode).
 *
 * Price columns:
 *   "Price"           — price_display string (e.g. "$1,530–$2,706"), falls back to price
 *   "Price (Sortable)" — price_min integer (e.g. 1530), empty if null
 *
 * @param {object[]} listings          - Listing objects to export
 * @param {object[]} criteria          - Criteria to include as columns
 * @param {object}   options
 * @param {string}   options.scoreFormat - 'scores' | 'raw' | 'both'
 */
export function exportToCSV(listings, criteria, options = {}) {
  const { scoreFormat = 'scores' } = options;

  // ── Header row ────────────────────────────────────────────────────────────
  const fixedHeaders = ['Name', 'URL', 'Price', 'Price (Sortable)', 'Address', 'Weighted Score', 'Verdict', 'Status'];

  const criteriaHeaders = [];
  for (const c of criteria) {
    if (scoreFormat === 'both' && !c.flagOnly) {
      // Scored criteria in 'both' mode get two columns
      criteriaHeaders.push(`${c.label} Score`, `${c.label} Raw`);
    } else {
      // Flag-only criteria always get a single column; scored criteria in
      // 'scores' or 'raw' mode also get a single column
      criteriaHeaders.push(c.label);
    }
  }

  const headers = [...fixedHeaders, ...criteriaHeaders];

  // ── Data rows ─────────────────────────────────────────────────────────────
  const rows = listings.map(listing => {
    // Price: prefer price_display (new field), fall back to legacy price string
    const priceDisplay = listing.price_display ?? listing.price ?? null;
    // price_min: sortable integer, empty cell if null
    const priceMin = typeof listing.price_min === 'number' ? listing.price_min : null;

    const fixed = [
      listing.name ?? '',
      listing.url ?? '',
      priceDisplay ?? '',
      priceMin ?? '',
      listing.address ?? '',
      listing.weighted_score ?? '',
      listing.verdict ?? '',
      listing.status ?? '',
    ];

    const criteriaValues = [];
    for (const c of criteria) {
      const stored = listing.scores?.[c.key] ?? '';

      if (scoreFormat === 'both' && !c.flagOnly) {
        // Two columns: formatted score + raw stored value
        criteriaValues.push(
          formatScore(stored, false, 'scores'),
          formatScore(stored, false, 'raw'),
        );
      } else {
        // Single column — flag-only always shows text, scored follows mode
        criteriaValues.push(formatScore(stored, c.flagOnly, scoreFormat));
      }
    }

    return [...fixed, ...criteriaValues];
  });

  // ── Assemble CSV ──────────────────────────────────────────────────────────
  const allRows = [headers, ...rows];
  const csv = allRows.map(row => row.map(escapeCell).join(',')).join('\r\n');

  // ── Trigger download ──────────────────────────────────────────────────────
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Apartment_Scout_Export_${todayString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
