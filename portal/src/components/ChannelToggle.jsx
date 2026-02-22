export default function ChannelToggle({ label, icon, enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all border-2 ${
        enabled
          ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
