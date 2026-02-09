/**
 * Lightweight markdown renderer for action item descriptions.
 * Handles: bold, italic, inline code, code blocks, links, lists, checkboxes, and line breaks.
 * No external dependencies.
 */

function parseLine(text, isCheckboxLine = false) {
  const tokens = [];
  let i = 0;

  // Handle checkbox at start of line
  if (isCheckboxLine) {
    const checkboxMatch = text.match(/^\[([xX ])\]\s*/);
    if (checkboxMatch) {
      const checked = checkboxMatch[1] !== ' ';
      tokens.push({ type: 'checkbox', checked });
      i = checkboxMatch[0].length;
    }
  }

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

    // Plain URL (http:// or https://)
    if (text.slice(i, i + 7) === 'http://' || text.slice(i, i + 8) === 'https://') {
      const urlStart = i;
      let urlEnd = i;
      // Find end of URL (stops at whitespace or common punctuation)
      while (urlEnd < text.length && !/[\s<>]/.test(text[urlEnd])) {
        urlEnd++;
      }
      const url = text.slice(urlStart, urlEnd);
      tokens.push({
        type: 'link',
        text: url,
        href: url,
      });
      i = urlEnd;
      continue;
    }

    // Plain text — accumulate until next special char or URL
    let end = i + 1;
    while (end < text.length && !'*`[h'.includes(text[end])) end++;
    // Check if 'h' is start of http
    if (end < text.length && text[end] === 'h') {
      if (text.slice(end, end + 7) !== 'http://' && text.slice(end, end + 8) !== 'https://') {
        end++;
      }
    }
    tokens.push({ type: 'text', text: text.slice(i, end) });
    i = end;
  }

  return tokens;
}

function renderTokens(tokens, keyPrefix) {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case 'checkbox':
        return (
          <span key={key} className={`inline-block w-3 h-3 rounded border mr-1.5 flex-shrink-0 ${
            token.checked ? 'bg-green-500 border-green-500' : 'border-gray-600'
          }`} />
        );
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

  // Convert literal \n to actual newlines
  const normalizedContent = content.replace(/\\n/g, '\n');
  const lines = normalizedContent.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let listItems = [];
  let checkboxItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-0.5 my-1">
          {listItems.map((li, idx) => (
            <li key={idx}>{renderTokens(parseLine(li.content, li.isCheckbox), `li-${elements.length}-${idx}`)}</li>
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

    // Checkbox list item (- [ ] or - [x])
    if (/^(\s*[-*+]\s*\[([xX ])\])/.test(line)) {
      const content = line.replace(/^\s*[-*+]\s*/, '');
      listItems.push({ content, isCheckbox: true });
      continue;
    }

    // Unordered list item
    if (/^(\s*[-*+]\s)/.test(line)) {
      const content = line.replace(/^\s*[-*+]\s/, '');
      listItems.push({ content, isCheckbox: false });
      continue;
    }

    // Ordered list item
    if (/^(\s*\d+\.\s)/.test(line)) {
      const content = line.replace(/^\s*\d+\.\s/, '');
      listItems.push({ content, isCheckbox: false });
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-1" />);
      continue;
    }

    // Headings (trim leading whitespace first, support h1-h4)
    const trimmedLine = line.trimStart();
    const headingMatch = trimmedLine.match(/^(#{1,4})\s*(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const styles = {
        1: 'font-bold text-white text-base mt-1',
        2: 'font-semibold text-gray-300 text-sm mt-1',
        3: 'font-medium text-gray-400 text-xs mt-1',
        4: 'font-medium text-gray-400 text-xs mt-1',
      };
      elements.push(
        <div key={`h-${i}`} className={styles[level]}>
          {renderTokens(parseLine(text), `h${level}-${i}`)}
        </div>
      );
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
