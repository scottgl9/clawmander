import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-gray-200 mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-300 mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-gray-200 mb-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-gray-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-gray-200">{children}</ol>,
  li: ({ children }) => <li className="text-gray-200">{children}</li>,
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="px-1 py-0.5 bg-gray-800 text-green-300 rounded text-[12px] font-mono">
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 my-2 overflow-x-auto">
        <code className="text-green-300 text-[12px] font-mono whitespace-pre">{children}</code>
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500 pl-3 my-2 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border border-gray-700 rounded text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
  tr: ({ children }) => <tr className="odd:bg-gray-900 even:bg-gray-850">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-gray-300 font-semibold border-b border-gray-700">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-gray-200 border-r border-gray-700 last:border-r-0">{children}</td>,
  hr: () => <hr className="border-gray-700 my-3" />,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
};

export default function MarkdownContent({ content }) {
  if (!content) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
