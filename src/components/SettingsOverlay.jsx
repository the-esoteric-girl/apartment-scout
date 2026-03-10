// Placeholder — full implementation in Phase 5
export default function SettingsOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-8 shadow-xl">
        <p className="text-gray-400 mb-4">Settings overlay — coming in Phase 5</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1a1a2e' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
