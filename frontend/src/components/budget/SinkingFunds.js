function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SinkingFunds({ data }) {
  const sf = data?.sinkingFunds;
  if (!sf || !sf.items || sf.items.length === 0) return null;

  return (
    <div className="bg-surface rounded-lg p-4 sm:p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">Sinking Funds</h3>
        <div className="text-xs text-gray-400">
          Set aside <span className="text-white font-semibold">{money(sf.totalMonthly)}</span>/mo
        </div>
      </div>
      <p className="text-[11px] text-gray-600 mb-4">
        Monthly reserve for irregular (quarterly/annual) bills so they don&apos;t surprise you.
        Suggested reserve on hand now: <span className="text-gray-400">{money(sf.reserveNeededNow)}</span>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 font-medium">Bill</th>
              <th className="text-left py-2 font-medium">Cadence</th>
              <th className="text-right py-2 font-medium">Amount</th>
              <th className="text-right py-2 font-medium">Set aside/mo</th>
              <th className="text-right py-2 font-medium">Reserve now</th>
              <th className="text-left py-2 font-medium pl-3">Next charge</th>
            </tr>
          </thead>
          <tbody>
            {sf.items.map((i) => (
              <tr key={`${i.merchant}-${i.nextCharge}`} className="border-b border-gray-800">
                <td className="py-2 text-white">{i.merchant}<div className="text-[11px] text-gray-500">{i.category}</div></td>
                <td className="py-2 text-gray-300 capitalize">{i.cadence}</td>
                <td className="py-2 text-right text-gray-300 font-mono">{money(i.amount)}</td>
                <td className="py-2 text-right text-teal-300 font-mono">{money(i.monthlySetAside)}</td>
                <td className="py-2 text-right text-gray-400 font-mono">{money(i.reserveNeededNow)}</td>
                <td className="py-2 pl-3 text-gray-300">{fmtDate(i.nextCharge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
