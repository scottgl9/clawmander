import { useAPI } from '../../hooks/useAPI';
import { api } from '../../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-white mb-3 pb-2 border-b border-gray-700">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-semibold text-accent uppercase tracking-wide mt-5 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-gray-200 mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-xs text-gray-300 leading-relaxed mb-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 space-y-0.5 pl-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 space-y-0.5 pl-3 list-decimal">{children}</ol>
  ),
  li: ({ children, className }) => {
    const isTask = className === 'task-list-item';
    return (
      <li className={`text-xs text-gray-300 leading-relaxed ${isTask ? 'list-none -ml-3 flex items-start gap-1.5' : 'list-disc'}`}>
        {children}
      </li>
    );
  },
  input: ({ checked }) => (
    <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border flex-shrink-0 mt-0.5 ${
      checked ? 'bg-accent border-accent text-white' : 'border-gray-600 bg-gray-800'
    }`}>
      {checked && (
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
        </svg>
      )}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-xs text-gray-400 [&_p]:mb-0 [&_strong]:text-gray-300">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-800 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-gray-700">
      <table className="min-w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-800 border-b border-gray-700">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-800">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-300 align-top">{children}</td>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 bg-gray-800 text-green-400 rounded font-mono text-[10px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 my-2 overflow-x-auto text-[10px] font-mono text-green-400 leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
};

export default function WorkBrief() {
  const { data, loading, error } = useAPI(() => api.work.getBrief());

  if (loading) return <div className="text-gray-600 text-xs">Loading...</div>;
  if (error) return <div className="text-red-400 text-xs">{error}</div>;
  if (!data?.content && !data?.summary) return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-2">Daily Brief</h3>
      <p className="text-xs text-gray-600 italic">No brief generated yet for today.</p>
    </div>
  );

  const markdownContent = (data.content || data.summary).replace(/\\n/g, '\n');

  return (
    <div className="bg-surface rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">Daily Brief</h3>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
}
