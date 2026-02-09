import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import ActionItemsList from '../components/work/ActionItemsList';
import WorkBrief from '../components/work/WorkBrief';
import BudgetSummary from '../components/budget/BudgetSummary';
import TrendChart from '../components/budget/TrendChart';
import UpcomingBills from '../components/budget/UpcomingBills';
import JobsList from '../components/jobs/JobsList';
import ActivityLog from '../components/activity/ActivityLog';
import { useSSE } from '../hooks/useSSE';
import { useAPI } from '../hooks/useAPI';
import { api } from '../lib/api';

function deriveAgentStatus(agents) {
  if (!agents || agents.length === 0) return 'offline';
  if (agents.some((a) => a.status === 'error')) return 'error';
  // Check if any agent is truly active (has a current task)
  if (agents.some((a) => a.status === 'active' && a.currentTask)) return 'active';
  // Check if any agent is marked idle or active but with no task
  if (agents.some((a) => a.status === 'idle' || (a.status === 'active' && !a.currentTask))) return 'idle';
  return 'offline';
}

const STATUS_DOT = {
  active: { color: 'bg-green-500', label: 'Agent active' },
  idle: { color: 'bg-gray-500', label: 'Agent idle' },
  error: { color: 'bg-red-500', label: 'Agent error' },
  offline: { color: 'bg-gray-700', label: 'Agent offline' },
};

export default function Dashboard() {
  const { data: agents, setData: setAgents } = useAPI(() => api.agents.getStatus());

  const connected = useSSE((event) => {
    if (event.type === 'agent.status_changed' && event.data?.agent) {
      setAgents((prev) => {
        if (!prev) return [event.data.agent];
        const exists = prev.find((a) => a.id === event.data.agentId);
        if (exists) return prev.map((a) => (a.id === event.data.agentId ? { ...a, ...event.data.agent } : a));
        return [...prev, event.data.agent];
      });
    }
  });

  const status = deriveAgentStatus(agents);
  const dot = STATUS_DOT[status] || STATUS_DOT.offline;

  return (
    <Layout connected={connected}>
      <div className="space-y-6">
        {/* Agent status indicator */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot.color}`} />
          <span className="text-sm text-gray-400">{dot.label}</span>
        </div>

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
