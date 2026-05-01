import { chatApi } from '../../lib/chatApi';

export default function ApprovalBanner({ approval, onResolved }) {
  if (!approval) return null;

  const handle = async (decision) => {
    try {
      await chatApi.resolveApproval(approval.approvalId, decision);
      onResolved?.();
    } catch (err) {
      console.error('Approval resolve failed:', err.message);
    }
  };

  return (
    <div className="mx-4 mb-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-yellow-300 mb-1">Approval Required</div>
          <div className="text-sm text-gray-300 font-mono bg-gray-900 rounded px-2 py-1 truncate">
            {approval.command}
          </div>
          {approval.description && (
            <div className="text-xs text-gray-400 mt-1">{approval.description}</div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handle('allow-once')}
            className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded font-medium transition-colors"
          >
            Approve Once
          </button>
          <button
            onClick={() => handle('deny')}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-medium transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
