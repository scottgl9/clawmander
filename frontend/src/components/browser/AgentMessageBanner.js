export default function AgentMessageBanner({ message, checklist, onRelease }) {
  if (!message) return null;

  return (
    <div className="absolute top-12 left-0 right-0 z-10 mx-4">
      <div className="flex flex-col gap-2 px-4 py-3 rounded-lg bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>Agent needs your help: {message}</span>
          </div>
          <button
            onClick={onRelease}
            className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/30 text-amber-200 hover:bg-amber-500/50 transition-colors whitespace-nowrap"
          >
            Return Control
          </button>
        </div>
        {checklist && checklist.length > 0 && (
          <ul className="ml-7 space-y-1">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-amber-200/80">
                <input type="checkbox" className="rounded border-amber-500/50 bg-transparent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
