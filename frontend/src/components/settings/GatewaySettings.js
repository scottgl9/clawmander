import { useState } from 'react';
import { useGatewayRestart } from '../../hooks/useGatewayRestart';
import Modal from '../shared/Modal';

export default function GatewaySettings() {
  const [showRestartModal, setShowRestartModal] = useState(false);
  const { state: restartState, error: restartError, restart, reset: resetRestart } = useGatewayRestart();

  return (
    <div className="space-y-4">
      {/* Danger Zone */}
      <div className="bg-gray-900 border border-amber-700/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-3">
          Restarting the gateway will temporarily disconnect all agents.
        </p>

        {restartState === 'success' && (
          <p className="text-xs px-3 py-2 rounded-lg mb-3 text-green-400 bg-green-950/30 border border-green-900/50">
            Gateway restarted successfully.
          </p>
        )}
        {restartState === 'error' && (
          <p className="text-xs px-3 py-2 rounded-lg mb-3 text-red-400 bg-red-950/30 border border-red-900/50">
            {restartError || 'Gateway restart failed.'}
          </p>
        )}

        <button
          type="button"
          onClick={() => { resetRestart(); setShowRestartModal(true); }}
          disabled={restartState === 'restarting'}
          className="text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-500"
        >
          {restartState === 'restarting' ? 'Restarting...' : 'Restart Gateway'}
        </button>
      </div>

      <Modal
        isOpen={showRestartModal}
        onClose={() => setShowRestartModal(false)}
        title="Confirm Gateway Restart"
      >
        <p className="text-sm text-gray-300 mb-4">
          Are you sure you want to restart the gateway? All connected agents will be temporarily disconnected.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setShowRestartModal(false)}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => { setShowRestartModal(false); restart(); }}
            className="text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors bg-amber-600 hover:bg-amber-500"
          >
            Restart
          </button>
        </div>
      </Modal>
    </div>
  );
}
