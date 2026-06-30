import { useCallback, useEffect, useRef, useState } from 'react';

function decisionLabel(decision) {
  if (decision === 'allow-once') return 'approved once';
  if (decision === 'deny') return 'denied';
  return decision || 'resolved';
}

export default function ApprovalEmojiActions({ approval, onResolve }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const disabled = approval?.state === 'resolving' || approval?.state === 'resolved';
  const resolved = approval?.state === 'resolved';
  const resolving = approval?.state === 'resolving';

  useEffect(() => {
    if (!open) return;
    const handle = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open]);

  const resolve = useCallback((decision) => {
    if (disabled) return;
    setOpen(false);
    onResolve?.(approval.approvalId, decision);
  }, [approval?.approvalId, disabled, onResolve]);

  if (!approval) return null;

  return (
    <div className="relative inline-flex items-center gap-2" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-base transition-colors ${
          resolved
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-default'
            : resolving
            ? 'bg-yellow-900/30 border-yellow-700/60 text-yellow-300 cursor-wait'
            : 'bg-yellow-900/40 border-yellow-600/70 hover:bg-yellow-800/60 text-yellow-200'
        }`}
        title={resolved ? `Approval ${decisionLabel(approval.decision)}` : 'Respond to exec approval'}
        aria-label={resolved ? `Approval ${decisionLabel(approval.decision)}` : 'Respond to exec approval'}
      >
        {resolved ? (approval.decision === 'deny' ? '❌' : '✅') : '🔐'}
      </button>

      {resolved && (
        <span className="text-xs text-gray-500">Request {decisionLabel(approval.decision)}</span>
      )}
      {resolving && (
        <span className="text-xs text-yellow-400">Submitting...</span>
      )}
      {approval.error && approval.state === 'pending' && (
        <span className="text-xs text-red-400">{approval.error}</span>
      )}

      {open && !disabled && (
        <div className="absolute left-0 bottom-10 z-20 w-44 rounded-xl border border-gray-700 bg-gray-900 shadow-xl p-1">
          <button
            type="button"
            onClick={() => resolve('allow-once')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-100 hover:bg-green-900/40"
          >
            <span>✅</span>
            <span>Approve once</span>
          </button>
          <button
            type="button"
            onClick={() => resolve('deny')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-100 hover:bg-red-900/40"
          >
            <span>❌</span>
            <span>Deny</span>
          </button>
        </div>
      )}
    </div>
  );
}
