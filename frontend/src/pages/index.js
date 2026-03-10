import Layout from '../components/layout/Layout';
import ActionItemsList from '../components/work/ActionItemsList';
import WorkBrief from '../components/work/WorkBrief';
import BudgetSummary from '../components/budget/BudgetSummary';
import TrendChart from '../components/budget/TrendChart';
import UpcomingBills from '../components/budget/UpcomingBills';
import JobsList from '../components/jobs/JobsList';
import ActivityLog from '../components/activity/ActivityLog';
import AgentStatusBar from '../components/agents/AgentStatusBar';
import { useSSE } from '../hooks/useSSE';

export default function Dashboard() {
  const connected = useSSE(() => {});

  return (
    <Layout connected={connected}>
      <div className="space-y-6">
        {/* Agent status bar */}
        <AgentStatusBar />

        {/* Widget grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Work & Personal - spans 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionItemsList category="work" />
              <ActionItemsList category="personal" />
            </div>
            <WorkBrief />
          </div>

          {/* Budget column */}
          <div className="space-y-4">
            <BudgetSummary />
            <TrendChart />
            <UpcomingBills />
          </div>

          {/* Jobs column */}
          <div className="space-y-4">
            <JobsList />
          </div>
        </div>

        {/* Activity Log - collapsible */}
        <ActivityLog limit={30} />
      </div>
    </Layout>
  );
}
