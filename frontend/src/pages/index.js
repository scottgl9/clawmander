import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import ActionItemsList from '../components/work/ActionItemsList';
import WorkBrief from '../components/work/WorkBrief';
import BudgetSummary from '../components/budget/BudgetSummary';
import TrendChart from '../components/budget/TrendChart';
import UpcomingBills from '../components/budget/UpcomingBills';
import JobsList from '../components/jobs/JobsList';
import RecentFeeds from '../components/shared/RecentFeeds';
import CronMonitor from '../components/shared/CronMonitor';
import { useSSE } from '../hooks/useSSE';

export default function Dashboard() {
  const [refreshKeys, setRefreshKeys] = useState({
    actionItems: 0, feeds: 0, cron: 0, budget: 0,
  });

  const handleSSE = useCallback((event) => {
    const { type } = event;
    if (type.startsWith('actionitem.')) {
      setRefreshKeys((prev) => ({ ...prev, actionItems: prev.actionItems + 1 }));
    } else if (type.startsWith('budget.')) {
      setRefreshKeys((prev) => ({ ...prev, budget: prev.budget + 1 }));
    } else if (type === 'feed.new') {
      setRefreshKeys((prev) => ({ ...prev, feeds: prev.feeds + 1 }));
    } else if (type === 'cron.status') {
      setRefreshKeys((prev) => ({ ...prev, cron: prev.cron + 1 }));
    }
  }, []);

  const connected = useSSE(handleSSE);

  return (
    <Layout connected={connected}>
      <div className="space-y-6">

        {/* Feeds + Cron row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentFeeds limit={5} refreshKey={refreshKeys.feeds} />
          <CronMonitor refreshKey={refreshKeys.cron} />
        </div>

        {/* Widget grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Work & Personal - spans 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionItemsList category="work" refreshKey={refreshKeys.actionItems} />
              <ActionItemsList category="personal" refreshKey={refreshKeys.actionItems} />
            </div>
            <WorkBrief />
          </div>

          {/* Budget column */}
          <div className="space-y-4">
            <BudgetSummary refreshKey={refreshKeys.budget} />
            <TrendChart refreshKey={refreshKeys.budget} />
            <UpcomingBills refreshKey={refreshKeys.budget} />
          </div>

          {/* Jobs column */}
          <div className="space-y-4">
            <JobsList />
          </div>
        </div>
      </div>
    </Layout>
  );
}
