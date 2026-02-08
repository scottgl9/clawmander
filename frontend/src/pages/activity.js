import Layout from '../components/layout/Layout';
import { useSSE } from '../hooks/useSSE';
import ActivityLog from '../components/activity/ActivityLog';

export default function ActivityPage() {
  const connected = useSSE(() => {});

  return (
    <Layout connected={connected}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-6">Activity Log</h2>
        <ActivityLog limit={100} showHeader={false} />
      </div>
    </Layout>
  );
}
