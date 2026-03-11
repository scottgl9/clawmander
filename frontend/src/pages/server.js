import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAPI } from '../hooks/useAPI';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import ServerStatus from '../components/server/ServerStatus';
import ServiceSettings from '../components/server/ServiceSettings';

export default function ServerPage() {
  const [data, setData] = useState(null);

  const connected = useSSE((event) => {
    if (event.type === 'server.status') {
      setData(event.data);
    }
  });

  const { data: initialData, loading, error } = useAPI(() => api.server.getStatus());

  const status = data || initialData;

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Server Status</h2>
        <p className="text-sm text-gray-500 mb-6">OpenClaw gateway connection and runtime info</p>

        {loading && !status && <p className="text-gray-600">Loading...</p>}
        {error && !status && <p className="text-red-400 text-sm">{error}</p>}

        <ServerStatus status={status} />

        <h2 className="text-xl font-bold text-white mt-8 mb-1">Settings</h2>
        <p className="text-sm text-gray-500 mb-6">Configure external service endpoints</p>
        <ServiceSettings />
      </div>
    </Layout>
  );
}
