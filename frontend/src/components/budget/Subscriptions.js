import { useMemo } from 'react';

function fmtMoney(n) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

const FLAG_BADGES = {
  priceIncrease: { label: 'PRICE ↑', cls: 'bg-red-500/20 text-red-300', title: 'Latest charge is higher than the prior typical amount' },
  new: { label: 'NEW', cls: 'bg-blue-500/20 text-blue-300', title: 'First seen recently' },
  trialLikely: { label: 'TRIAL?', cls: 'bg-amber-500/20 text-amber-300', title: 'Few charges so far — may be a trial converting' },
  duplicateService: { label: 'OVERLAP', cls: 'bg-orange-500/20 text-orange-300', title: 'You have multiple active services in this category (possible savings)' },
  lapsed: { label: 'LAPSED', cls: 'bg-gray-500/20 text-gray-400', title: 'Expected charge is overdue — may have been cancelled' },
};

function FlagBadges({ flags = {}, serviceGroup }) {
  const active = Object.keys(FLAG_BADGES).filter((k) => flags[k]);
  if (active.length === 0) return null;
  const groupLabel = (serviceGroup || '').replace(/_/g, ' ');
  return (
    <span className="inline-flex flex-wrap gap-1">
      {active.map((k) => {
        const title = k === 'duplicateService' && groupLabel
          ? `Multiple active "${groupLabel}" services (possible savings)`
          : FLAG_BADGES[k].title;
        return (
          <span
            key={k}
            title={title}
            className={`px-1.5 py-0.5 text-[9px] rounded font-semibold ${FLAG_BADGES[k].cls}`}
          >
            {FLAG_BADGES[k].label}
          </span>
        );
      })}
    </span>
  );
}

export default function Subscriptions({ data }) {
  const summary = data?.summary;
  const subs = useMemo(() => {
    const list = (data?.subscriptions || []).filter((s) => s.isSubscription);
    // Active first (by annualized cost desc), lapsed last.
    return list.sort((a, b) => {
      const al = a.flags?.lapsed ? 1 : 0;
      const bl = b.flags?.lapsed ? 1 : 0;
      if (al !== bl) return al - bl;
      return (b.annualizedCost || 0) - (a.annualizedCost || 0);
    });
  }, [data]);

  if (!summary && subs.length === 0) return null;

  return (
    <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Subscriptions</h3>
        {summary && (
          <div className="text-xs text-gray-400">
            <span className="text-white font-semibold">{summary.activeCount}</span> active ·{' '}
            <span className="text-white font-semibold">{fmtMoney(summary.totalMonthly)}</span>/mo ·{' '}
            <span className="text-gray-300">{fmtMoney(summary.totalAnnual)}/yr</span>
          </div>
        )}
      </div>

      {summary?.upcoming?.length > 0 && (
        <div className="mb-4 text-xs text-gray-400">
          <span className="uppercase text-gray-500">Next 30 days: </span>
          {summary.upcoming.map((u, i) => (
            <span key={`${u.merchant}-${u.date}`}>
              {i > 0 ? ' · ' : ''}
              <span className="text-gray-200">{u.merchant}</span> {fmtMoney(u.amount)} ({fmtDate(u.date)})
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 font-medium">Service</th>
              <th className="text-left py-2 font-medium">Cadence</th>
              <th className="text-right py-2 font-medium">Amount</th>
              <th className="text-right py-2 font-medium">Monthly</th>
              <th className="text-right py-2 font-medium">Annual</th>
              <th className="text-left py-2 font-medium pl-3">Next charge</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr
                key={s.id || s.merchantKey}
                className={`border-b border-gray-800 ${s.flags?.lapsed ? 'opacity-50' : ''}`}
              >
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white">{s.merchant}</span>
                    <FlagBadges flags={s.flags} serviceGroup={s.serviceGroup} />
                  </div>
                  <div className="text-[11px] text-gray-500">{s.category}</div>
                </td>
                <td className="py-2 text-gray-300 capitalize">{s.cadence || '—'}</td>
                <td className="py-2 text-right text-gray-300 font-mono">{fmtMoney(s.amount)}</td>
                <td className="py-2 text-right text-gray-300 font-mono">{fmtMoney(s.monthlyEquivalent)}</td>
                <td className="py-2 text-right text-gray-400 font-mono">{fmtMoney(s.annualizedCost)}</td>
                <td className="py-2 pl-3 text-gray-300">
                  {s.flags?.lapsed ? <span className="text-gray-500">lapsed</span> : fmtDate(s.predictedNextCharge)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {subs.length === 0 && (
        <p className="text-sm text-gray-500">No subscriptions detected for this month.</p>
      )}
    </div>
  );
}
