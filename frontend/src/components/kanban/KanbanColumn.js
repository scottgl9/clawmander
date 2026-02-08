import { STATUS_COLORS } from '../../lib/constants';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ status, label, tasks, agents, heartbeats }) {
  const color = STATUS_COLORS[status] || '#6b7280';

  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold text-gray-300">{label}</h3>
        <span
          className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{ backgroundColor: color + '20', color }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-0 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-700 text-xs">No tasks</div>
        )}
        {tasks.map((task) => {
          const agent = agents?.find((a) => a.id === task.agentId);
          const hb = heartbeats?.find((h) => h.agentId === task.agentId);
          return <KanbanCard key={task.id} task={task} agent={agent} heartbeat={hb} />;
        })}
      </div>
    </div>
  );
}
