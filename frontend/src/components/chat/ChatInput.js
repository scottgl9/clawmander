import { useState, useRef, useCallback } from 'react';
import SlashCommandMenu from './SlashCommandMenu';
import { chatApi } from '../../lib/chatApi';
import { API_URL } from '../../lib/constants';

export default function ChatInput({ onSend, onAbort, onAction, sending, disabled, models = [] }) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowSlash(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    setShowSlash(val.startsWith('/'));
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  const handleSend = useCallback(() => {
    if (!input.trim() || sending) return;
    onSend(input.trim(), attachments);
    setInput('');
    setAttachments([]);
    setShowSlash(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, attachments, sending, onSend]);

  const handleSlashSelect = (cmd) => {
    setInput(cmd);
    setShowSlash(false);
    textareaRef.current?.focus();
  };

  const handleAction = (action, payload) => {
    // Close the slash menu and clear input after action
    setInput('');
    setShowSlash(false);
    if (onAction) onAction(action, payload);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await chatApi.uploadImage(file);
      setAttachments((prev) => [...prev, result]);
    } catch (err) {
      console.error('Upload failed:', err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSend = input.trim() && !sending && !disabled;

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-4 py-3">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              <img
                src={att.url.startsWith('http') ? att.url : `${API_URL}${att.url}`}
                alt={att.originalname}
                className="h-14 w-14 object-cover rounded-lg border border-gray-700"
              />
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] items-center justify-center hidden group-hover:flex"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* Slash command menu */}
        <SlashCommandMenu input={input} onSelect={handleSlashSelect} onAction={handleAction} visible={showSlash} models={models} />

        {/* Attach image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          title="Attach image"
        >
          {uploading ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={sending ? 'Agent is responding...' : 'Message agent... (/ for commands)'}
          disabled={disabled && !sending}
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 transition-colors disabled:opacity-50"
          style={{ minHeight: 40, maxHeight: 160 }}
        />

        {/* Send / Abort button */}
        {sending ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 p-2 bg-red-700 hover:bg-red-600 text-white rounded-xl transition-colors"
            title="Abort"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send (Enter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
