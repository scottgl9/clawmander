import MarkdownContent from './MarkdownContent';
import StreamingIndicator from './StreamingIndicator';
import ImageAttachment from './ImageAttachment';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message }) {
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

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
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
              ) : isStreaming ? null : (
                <span className="text-gray-500 italic">Empty response</span>
              )}
              {isStreaming && !message.content && <StreamingIndicator />}
              {isStreaming && message.content && (
                <span className="inline-block ml-1">
                  <StreamingIndicator />
                </span>
              )}
              {isAborted && (
                <span className="text-xs text-gray-500 italic ml-1">[aborted]</span>
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
