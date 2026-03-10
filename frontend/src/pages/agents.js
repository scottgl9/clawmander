import { useState } from 'react';
import Layout from '../components/layout/Layout';
import KanbanBoard from '../components/kanban/KanbanBoard';
import AgentStatusBar from '../components/agents/AgentStatusBar';

export default function AgentsPage() {
  const [connected, setConnected] = useState(false);

  return (
    <Layout connected={connected}>
      <div className="flex flex-col h-full">
        <AgentStatusBar />
        <div className="flex-1 overflow-hidden">
          <KanbanBoard onConnectionChange={setConnected} />
        </div>
      </div>
    </Layout>
  );
}
