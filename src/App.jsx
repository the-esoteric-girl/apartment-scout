/**
 * App.jsx — Root component
 *
 * Manages the three things that need to be accessible app-wide:
 *   - activeTab: which tab is showing
 *   - criteria: the user's scoring criteria (read from localStorage on load)
 *   - listings: all saved listings (read from localStorage on load)
 *   - showSettings: whether the settings overlay is open
 *   - decisionPreload: a listing to pre-load into Decision tab (from "Use in Decision Mode")
 *
 * Why keep listings + criteria here instead of reading localStorage in each tab?
 * Because React needs to re-render when data changes. If Tab A saves a listing,
 * Tab B needs to show it immediately — that only works if they share the same
 * state. Lifting state to the common parent (App) is the React way.
 */

import { useState } from 'react';
import { getCriteria, getListings, getLocation, saveCriteria, saveListing, saveLocation, updateListing, deleteListing } from './utils/storage';
import { recalculateForCriteria } from './utils/scoring';
import BrowseTab from './components/tabs/BrowseTab';
import DecisionTab, { createSlot } from './components/tabs/DecisionTab';
import SavedTab from './components/tabs/SavedTab';
import SettingsOverlay from './components/SettingsOverlay';

const TABS = [
  { id: 'browse',   label: 'Browse',   icon: '🔍' },
  { id: 'decision', label: 'Decision', icon: '⚖️' },
  { id: 'saved',    label: 'Saved',    icon: '🏠' },
];

// ── Persistent tab state defaults ────────────────────────────────────────────
// These live in App so they survive tab switching within a session.

const INITIAL_BROWSE_STATE = {
  urlOrLabel: '',
  listingText: '',
  result: null,
  error: null,
  isLoading: false,
  justSaved: false,
};

const INITIAL_SAVED_FILTERS = {
  search: '',
  sortBy: 'score',
  statusFilter: 'all',
  bedroomsFilter: 'any',
  verdictFilter: 'any',
  scoreFloor: 0,
  maxRent: '',
  neighborhoodSearch: '',
  mustBeYes: new Set(),
};

export default function App() {
  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('browse');
  const [showSettings, setShowSettings] = useState(false);

  // () => getCriteria() means "run this once on mount to get the initial value"
  // This pattern (lazy initial state) avoids reading localStorage on every render
  const [criteria, setCriteria] = useState(() => getCriteria());
  const [listings, setListings] = useState(() => getListings());
  const [location, setLocation] = useState(() => getLocation());

  // ── Session-persistent tab state ────────────────────────────────────────
  const [browseState, setBrowseState] = useState(INITIAL_BROWSE_STATE);
  const [savedFilters, setSavedFilters] = useState(INITIAL_SAVED_FILTERS);
  const [savedCompareQueue, setSavedCompareQueue] = useState(new Set());
  const [decisionState, setDecisionState] = useState(() => ({
    slots: [createSlot('new'), createSlot('new')],
    isLoading: false,
    results: null,
    error: null,
    resultsView: 'card',
    savedIndices: new Set(),
  }));

  // When user clicks "Use in Decision Mode" from a saved listing (single)
  // or "Compare selected" from the Saved tab compare queue (array)
  const [decisionPreload, setDecisionPreload] = useState(null);
  const [decisionPreloadMany, setDecisionPreloadMany] = useState(null);

  // ── Listing actions (passed down to child tabs) ───────────────────────────
  function handleSaveListing(listing) {
    saveListing(listing);
    setListings(getListings()); // re-sync state from localStorage
  }

  function handleUpdateListing(id, changes) {
    updateListing(id, changes);
    setListings(getListings());
  }

  function handleDeleteListing(id) {
    deleteListing(id);
    setListings(getListings());
  }

  function handleUseInDecision(listing) {
    setDecisionPreload(listing);
    setActiveTab('decision');
  }

  function handleCompareMany(listingsToCompare) {
    setDecisionPreloadMany(listingsToCompare);
    setActiveTab('decision');
  }

  // ── Browse state helpers ──────────────────────────────────────────────────
  function updateBrowseState(changes) {
    setBrowseState(prev => ({ ...prev, ...changes }));
  }

  // ── Decision state helpers ───────────────────────────────────────────────
  function updateDecisionState(changes) {
    setDecisionState(prev => ({ ...prev, ...changes }));
  }

  // ── Saved tab filter/queue helpers ───────────────────────────────────────
  function setSavedFilter(key, valueOrUpdater) {
    setSavedFilters(prev => ({
      ...prev,
      [key]: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev[key]) : valueOrUpdater,
    }));
  }

  function resetSavedFilters() {
    setSavedFilters(INITIAL_SAVED_FILTERS);
  }

  function toggleSavedCompare(listingId) {
    setSavedCompareQueue(prev => {
      const next = new Set(prev);
      next.has(listingId) ? next.delete(listingId) : next.add(listingId);
      return next;
    });
  }

  function clearSavedCompareQueue() {
    setSavedCompareQueue(new Set());
  }

  // ── Criteria + location actions ───────────────────────────────────────────
  // Called by SettingsOverlay with both the new criteria and new location.
  // Location change also updates the 'green_lake' criterion label to match.
  function handleSaveSettings(newCriteria, newLocation) {
    // Derive a short display name from the location for the criterion label
    // e.g. "Capitol Hill, Seattle" → "Capitol Hill"
    const shortName = newLocation.split(',')[0].trim();

    // Update the green_lake criterion label to reflect the new location
    const updatedCriteria = newCriteria.map(c =>
      c.key === 'green_lake' ? { ...c, label: `Near ${shortName}` } : c
    );

    saveCriteria(updatedCriteria);
    setCriteria(updatedCriteria);

    saveLocation(newLocation);
    setLocation(newLocation);

    // When criteria change, recalculate scores for all saved listings.
    // The raw yes/no/unclear scores stay the same — only the weights and
    // verdicts are recalculated. Missing scores (new criteria) default to "unclear".
    const updatedListings = listings.map(l => recalculateForCriteria(l, updatedCriteria));
    updatedListings.forEach(l => updateListing(l.id, {
      weighted_score: l.weighted_score,
      verdict: l.verdict,
    }));
    setListings(getListings());

    setShowSettings(false);
  }

  // ── Tab header ────────────────────────────────────────────────────────────
  const savedCount = listings.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f5' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
      >
        <div
          className="mx-auto flex items-center justify-between px-4 sm:px-8"
          style={{ maxWidth: '1100px', height: '56px' }}
        >
          {/* Logo */}
          <span className="font-extrabold text-lg tracking-tight" style={{ color: '#1a1a2e' }}>
            Apartment Scout
          </span>

          {/* Tab navigation — center */}
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? '#1a1a2e' : '#6b7280',
                    backgroundColor: isActive ? '#f3f4f6' : 'transparent',
                  }}
                  title={tab.label}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>

                  {/* Count badge on Saved tab */}
                  {tab.id === 'saved' && savedCount > 0 && (
                    <span
                      className="ml-0.5 rounded-full px-1.5 py-0 text-xs font-bold text-white"
                      style={{ backgroundColor: '#2A7F7F', fontSize: '11px' }}
                    >
                      {savedCount}
                    </span>
                  )}

                  {/* Active underline indicator */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ backgroundColor: '#2A7F7F' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Settings gear icon — right side */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-lg"
            style={{ color: '#6b7280' }}
            title="Scoring criteria settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <main className="mx-auto px-3 sm:px-8 py-5 sm:py-8" style={{ maxWidth: '1100px' }}>
        {activeTab === 'browse' && (
          <BrowseTab
            criteria={criteria}
            listings={listings}
            location={location}
            onSave={handleSaveListing}
            browseState={browseState}
            onBrowseStateChange={updateBrowseState}
          />
        )}
        {activeTab === 'decision' && (
          <DecisionTab
            criteria={criteria}
            listings={listings}
            location={location}
            preloadListing={decisionPreload}
            preloadMany={decisionPreloadMany}
            onPreloadConsumed={() => { setDecisionPreload(null); setDecisionPreloadMany(null); }}
            onSave={handleSaveListing}
            decisionState={decisionState}
            onDecisionStateChange={updateDecisionState}
          />
        )}
        {activeTab === 'saved' && (
          <SavedTab
            criteria={criteria}
            listings={listings}
            onUpdate={handleUpdateListing}
            onDelete={handleDeleteListing}
            onUseInDecision={handleUseInDecision}
            onCompareMany={handleCompareMany}
            onGoToBrowse={() => setActiveTab('browse')}
            filters={savedFilters}
            onSetFilter={setSavedFilter}
            onResetFilters={resetSavedFilters}
            compareQueue={savedCompareQueue}
            onToggleCompare={toggleSavedCompare}
            onClearCompareQueue={clearSavedCompareQueue}
          />
        )}
      </main>

      {/* ── Settings overlay ───────────────────────────────────────────── */}
      {showSettings && (
        <SettingsOverlay
          criteria={criteria}
          location={location}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
