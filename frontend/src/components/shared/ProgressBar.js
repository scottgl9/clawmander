export default function ProgressBar({ value = 0, className = '' }) {
  const color = value >= 100 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
  return (
    <div className={`w-full bg-gray-700 rounded-full h-1.5 ${className}`}>
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}
