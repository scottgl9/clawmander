import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';

export default function MessageList({ messages, loading, onSpeak }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Loading history...
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-sm">No messages yet</div>
          <div className="text-xs mt-1">Send a message to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-0">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} onSpeak={onSpeak} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
