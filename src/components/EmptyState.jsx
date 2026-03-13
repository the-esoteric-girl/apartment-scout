/**
 * EmptyState — shown in Saved tab when no listings have been saved yet.
 *
 * Props:
 *   onGoToBrowse — fn() called when user clicks the CTA
 */
export default function EmptyState({ onGoToBrowse }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Icon */}
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl mb-6 text-4xl bg-inactive">
        🏠
      </div>

      <h2 className="text-xl font-bold mb-2 text-primary">
        No saved listings yet
      </h2>

      <p
        className="text-sm mb-8 max-w-xs text-secondary"
        style={{ lineHeight: '1.6' }}
      >
        Analyze a listing in Browse mode, then hit Save to track it here.
      </p>

      <button
        onClick={onGoToBrowse}
        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary"
      >
        Go to Browse
      </button>
    </div>
  );
}
