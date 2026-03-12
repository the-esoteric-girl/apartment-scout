/**
 * storage.js
 *
 * All localStorage reads and writes go through these functions.
 * Keeping I/O in one place means if we ever swap to a different
 * storage backend (IndexedDB, a real API), we only change this file.
 *
 * localStorage keys:
 *   apartment_scout_listings  — array of saved listing objects
 *   apartment_scout_criteria  — array of criteria in priority order
 *   apartment_scout_location  — target neighborhood string
 */

import { DEFAULT_CRITERIA } from '../constants/defaultCriteria';

const LISTINGS_KEY  = 'apartment_scout_listings';
const CRITERIA_KEY  = 'apartment_scout_criteria';
const LOCATION_KEY  = 'apartment_scout_location';
export const DEFAULT_LOCATION = 'Green Lake, Seattle';

// ─────────────────────────────────────────
// Listings
// ─────────────────────────────────────────

/** Read all saved listings. Returns [] on error or empty storage. */
export function getListings() {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    // If the stored JSON is corrupted somehow, start fresh rather than crashing
    return [];
  }
}

/** Add a new listing to the saved list. */
export function saveListing(listing) {
  const listings = getListings();
  listings.push(listing);
  try {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
  } catch (e) {
    // localStorage can throw if storage is full (QuotaExceededError)
    if (e.name === 'QuotaExceededError') {
      throw new Error('STORAGE_FULL');
    }
    throw e;
  }
}

/** Update specific fields on an existing listing by id. */
export function updateListing(id, changes) {
  const listings = getListings().map(l =>
    l.id === id ? { ...l, ...changes } : l
  );
  try {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
  } catch {
    // ignore write errors (e.g. private browsing quota limits)
  }
}

/** Remove a listing by id. */
export function deleteListing(id) {
  const listings = getListings().filter(l => l.id !== id);
  try {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
  } catch {
    // ignore write errors
  }
}

// ─────────────────────────────────────────
// Criteria
// ─────────────────────────────────────────

/** Read saved criteria. Falls back to defaults if nothing is stored yet. */
export function getCriteria() {
  try {
    const raw = localStorage.getItem(CRITERIA_KEY);
    if (!raw) return DEFAULT_CRITERIA;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CRITERIA;
  }
}

/** Save the current criteria array (after user edits in Settings). */
export function saveCriteria(criteria) {
  localStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria));
}

/** Reset criteria to defaults and return the default array. */
export function resetCriteria() {
  localStorage.setItem(CRITERIA_KEY, JSON.stringify(DEFAULT_CRITERIA));
  return DEFAULT_CRITERIA;
}

// ─────────────────────────────────────────
// Location
// ─────────────────────────────────────────

/** Read the saved target neighborhood. Falls back to Green Lake, Seattle. */
export function getLocation() {
  try {
    return localStorage.getItem(LOCATION_KEY) || DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

/** Save the target neighborhood string. */
export function saveLocation(location) {
  localStorage.setItem(LOCATION_KEY, location);
}
