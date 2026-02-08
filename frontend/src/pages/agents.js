import Layout from '../components/layout/Layout';
import KanbanBoard from '../components/kanban/KanbanBoard';
import { useSSE } from '../hooks/useSSE';

export default function AgentsPage() {
  const connected = useSSE(() => {});

  return (
    <Layout connected={connected}>
      <KanbanBoard />
    </Layout>
  );
}
