import { useState, useCallback } from 'react';
import MarkdownContent from './MarkdownContent';
import StreamingIndicator from './StreamingIndicator';
import ImageAttachment from './ImageAttachment';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, onSpeak, onRetry }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = message.state === 'streaming';
  const isError = message.state === 'error';
  const isAborted = message.state === 'aborted';

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [message.content]);

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
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 px-4`}>
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

        {/* Action row: copy, TTS, retry — visible on hover */}
        {!isStreaming && !isSystem && message.content && (
          <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
              title={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              )}
            </button>

            {/* TTS button */}
            {!isUser && onSpeak && (
              <button
                onClick={() => onSpeak(message.content)}
                className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                title="Read aloud"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              </button>
            )}

            {/* Retry button — shown on error messages */}
            {isError && onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="p-1 text-red-500 hover:text-red-300 transition-colors"
                title="Retry"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            )}
          </div>
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
