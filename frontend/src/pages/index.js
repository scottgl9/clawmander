import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import KanbanBoard from '../components/kanban/KanbanBoard';
import ActionItemsList from '../components/work/ActionItemsList';
import WorkBrief from '../components/work/WorkBrief';
import BudgetSummary from '../components/budget/BudgetSummary';
import TrendChart from '../components/budget/TrendChart';
import UpcomingBills from '../components/budget/UpcomingBills';
import JobsList from '../components/jobs/JobsList';
import ActivityLog from '../components/activity/ActivityLog';
import { useSSE } from '../hooks/useSSE';

export default function Dashboard() {
  const connected = useSSE(() => {});

  return (
    <Layout connected={connected}>
      <div className="space-y-6">
        {/* Kanban Board - full width hero */}
        <KanbanBoard />

        {/* 3-column widget grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Work column */}
          <div className="space-y-4">
            <ActionItemsList />
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
