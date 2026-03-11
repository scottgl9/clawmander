import MarkdownContent from './MarkdownContent';
import StreamingIndicator from './StreamingIndicator';
import ImageAttachment from './ImageAttachment';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, onSpeak }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = message.state === 'streaming';
  const isError = message.state === 'error';
  const isAborted = message.state === 'aborted';

  // System messages: centered, subtle, full-width
  if (isSystem) {
    return (
      <div className="px-4 mb-3">
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-300">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 px-4`}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5">
          A
        </div>
      )}

      <div className={`max-w-[85%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble — only rendered when there is content (or error/aborted).
            When streaming with no content yet, only the dots below are shown. */}
        {(message.content || isError || isAborted) && (
          <div
            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed min-w-0 overflow-hidden ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : isError
                ? 'bg-red-900/40 border border-red-700/50 text-red-300 rounded-tl-sm'
                : 'bg-gray-800 text-gray-100 rounded-tl-sm'
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <>
                {message.content ? (
                  <MarkdownContent content={message.content} />
                ) : isStreaming ? (
                  /* Empty streaming bubble — dots shown below, nothing in bubble */
                  null
                ) : (
                  <span className="text-gray-500 italic">Empty response</span>
                )}
                {isAborted && (
                  <span className="text-xs text-gray-500 italic">[aborted]</span>
                )}
              </>
            )}

            {/* Image attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-1">
                {message.attachments.map((att, i) => (
                  <ImageAttachment key={i} url={att.url} filename={att.filename || att.originalname} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Per-message TTS button for complete assistant messages */}
        {!isUser && !isStreaming && !isSystem && message.content && onSpeak && (
          <button
            onClick={() => onSpeak(message.content)}
            className="mt-1 ml-1 p-1 text-gray-600 hover:text-gray-300 transition-colors"
            title="Read aloud"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </button>
        )}

        {/* Streaming indicator — always OUTSIDE the bubble */}
        {isStreaming && (
          <div className="mt-1.5 ml-1">
            <StreamingIndicator />
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] text-gray-600 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ml-2 mt-0.5">
          U
        </div>
      )}
    </div>
  );
}
