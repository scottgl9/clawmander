/**
 * Lightweight markdown renderer for action item descriptions.
 * Handles: bold, italic, inline code, code blocks, links, lists, and line breaks.
 * No external dependencies.
 */

function parseLine(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    // Inline code
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        tokens.push({ type: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Bold **text**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        tokens.push({ type: 'bold', text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // Italic *text*
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && text[end + 1] !== '*') {
        tokens.push({ type: 'italic', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          tokens.push({
            type: 'link',
            text: text.slice(i + 1, closeBracket),
            href: text.slice(closeBracket + 2, closeParen),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Plain text — accumulate until next special char
    let end = i + 1;
    while (end < text.length && !'*`['.includes(text[end])) end++;
    tokens.push({ type: 'text', text: text.slice(i, end) });
    i = end;
  }

  return tokens;
}

function renderTokens(tokens, keyPrefix) {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case 'bold':
        return <strong key={key} className="font-semibold text-gray-300">{token.text}</strong>;
      case 'italic':
        return <em key={key}>{token.text}</em>;
      case 'code':
        return <code key={key} className="px-1 py-0.5 bg-gray-800 rounded text-[11px] font-mono">{token.text}</code>;
      case 'link':
        return <a key={key} href={token.href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{token.text}</a>;
      default:
        return <span key={key}>{token.text}</span>;
    }
  });
}

export default function SimpleMarkdown({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-0.5 my-1">
          {listItems.map((li, idx) => (
            <li key={idx}>{renderTokens(parseLine(li), `li-${elements.length}-${idx}`)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`pre-${i}`} className="bg-gray-800 rounded p-2 my-1 text-[11px] font-mono overflow-x-auto">
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Unordered list item
    if (/^(\s*[-*+]\s)/.test(line)) {
      const content = line.replace(/^\s*[-*+]\s/, '');
      listItems.push(content);
      continue;
    }

    // Ordered list item
    if (/^(\s*\d+\.\s)/.test(line)) {
      const content = line.replace(/^\s*\d+\.\s/, '');
      listItems.push(content);
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-1" />);
      continue;
    }

    // Heading (just bold it, don't change size much)
    if (line.startsWith('# ')) {
      elements.push(<div key={`h-${i}`} className="font-semibold text-gray-300 mt-1">{line.slice(2)}</div>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<div key={`h-${i}`} className="font-semibold text-gray-300 mt-1">{line.slice(3)}</div>);
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={`p-${i}`}>{renderTokens(parseLine(line), `p-${i}`)}</div>
    );
  }

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}
