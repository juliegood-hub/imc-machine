export default function CompletionBar({ completed, total, label, mini = false }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = pct >= 100;
  const barColor = isComplete ? '#22c55e' : '#c8a45e';

  if (mini) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[#0d1b2a]/10 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: barColor, transition: 'width 0.3s ease' }}
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {isComplete ? '✓' : `${pct}%`}
        </span>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {label || 'Completion'}
        </span>
        <span className="text-sm text-gray-500">
          {isComplete ? (
            <span className="text-[#22c55e] font-medium">✓ Complete!</span>
          ) : (
            `${completed} of ${total} complete (${pct}%)`
          )}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[#0d1b2a] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: barColor, transition: 'width 0.3s ease' }}
        />
      </div>
    </div>
  );
}
