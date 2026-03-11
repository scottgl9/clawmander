import { useState, useCallback, useRef, useEffect } from 'react';
import { chatApi } from '../lib/chatApi';

export function useChatState() {
  const [sessions, setSessions] = useState([]);
  const [models, setModels] = useState([]);
  const [activeSession, setActiveSessionState] = useState(null);

  const setActiveSession = useCallback((key) => {
    setActiveSessionState(key);
    if (key) {
      try { localStorage.setItem('clawmander-active-session', key); } catch {}
    }
  }, []);
  // messages: Map<sessionKey, Message[]>
  const [messages, setMessages] = useState({});
  const [streamingContent, setStreamingContent] = useState(''); // accumulated delta text
  const [streamingRunId, setStreamingRunId] = useState(null);
  const [approvalPending, setApprovalPending] = useState(null);
  const [subagentActivity, setSubagentActivity] = useState([]);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  const streamingRef = useRef({ runId: null, content: '' });
  const activeSessionRef = useRef(null);
  // Stable ref to loadHistory so handleSSEEvent ([] deps) can call it without stale closures
  const loadHistoryRef = useRef(null);

  // Keep activeSessionRef in sync to avoid stale closures in SSE handler
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  // Load sessions + models
  const loadSessions = useCallback(async () => {
    try {
      const { sessions: list, connected: isConnected } = await chatApi.getSessions();
      setSessions(list || []);
      setConnected(isConnected || false);
      if (!activeSession && list && list.length > 0) {
        // Restore previously active session if it still exists, else use first
        let savedKey = null;
        try { savedKey = localStorage.getItem('clawmander-active-session'); } catch {}
        const exists = savedKey && list.some((s) => (s.key || s.sessionKey) === savedKey);
        setActiveSession(exists ? savedKey : (list[0].key || list[0].sessionKey));
      }
    } catch (err) {
      setError(err.message);
    }
  }, [activeSession]);

  const loadModels = useCallback(async () => {
    try {
      const { models: list } = await chatApi.getModels();
      setModels(list || []);
    } catch {}
  }, []);

  const loadHistory = useCallback(async (sessionKey) => {
    if (!sessionKey) return;
    setLoadingHistory(true);
    try {
      const { messages: msgs, activeRunId } = await chatApi.getHistory(sessionKey);
      const history = msgs || [];

      // If the backend reports an active run, restore streaming state so the UI shows dots
      if (activeRunId) {
        const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          lastAssistant.state = 'streaming';
          lastAssistant.runId = activeRunId;
        }
        setStreamingRunId(activeRunId);
        streamingRef.current = { runId: activeRunId, content: lastAssistant?.content || '' };
      }

      setMessages((prev) => ({ ...prev, [sessionKey]: history }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);
  // Keep ref in sync so handleSSEEvent ([] deps) can call loadHistory without stale closure
  loadHistoryRef.current = loadHistory;

  // Switch session
  const switchSession = useCallback((sessionKey) => {
    setActiveSession(sessionKey);
    // Don't clear streaming state — the SSE handlers will continue updating
    // whichever session the event belongs to via sessionKey matching.
    // Only reset the visual streaming indicator (it's per-session in the UI).
    setStreamingContent('');
    setStreamingRunId(null);
    streamingRef.current = { runId: null, content: '' };
    loadHistory(sessionKey);
  }, [loadHistory]);

  // Handle SSE events
  const handleSSEEvent = useCallback((event) => {
    switch (event.type) {
      case 'chat.delta': {
        const { sessionKey, runId, text } = event.data;
        if (!text) break;

        streamingRef.current = { runId, content: text };
        setStreamingRunId(runId);
        setStreamingContent(text);

        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            // Accumulate delta text — gateway sends incremental chunks, not cumulative text
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], content: (updated[idx].content || '') + text, state: 'streaming' };
            return { ...prev, [sessionKey]: updated };
          }
          // Claim a runId-less streaming placeholder if present (the optimistic placeholder
          // added by sendMessage). The gateway's runId differs from our idempotencyKey, so
          // the placeholder never had a matching runId — claim it on first delta.
          const placeholderIdx = sessionMsgs.findIndex(
            (m) => !m.runId && m.role === 'assistant' && m.state === 'streaming'
          );
          if (placeholderIdx !== -1) {
            const updated = [...sessionMsgs];
            updated[placeholderIdx] = { ...updated[placeholderIdx], runId, content: text, state: 'streaming' };
            return { ...prev, [sessionKey]: updated };
          }
          // No placeholder found — create a new streaming message (e.g. navigated back mid-stream)
          const newMsg = {
            id: `stream-${runId}`,
            sessionKey,
            role: 'assistant',
            content: text,
            runId,
            state: 'streaming',
            attachments: [],
            timestamp: new Date().toISOString(),
          };
          return { ...prev, [sessionKey]: [...sessionMsgs, newMsg] };
        });
        break;
      }
      case 'chat.final': {
        const { sessionKey, runId, text } = event.data;
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunId(null);
        setStreamingContent('');

        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], content: text || updated[idx].content, state: 'complete' };
            return { ...prev, [sessionKey]: updated };
          }
          // Try to claim a runId-less streaming placeholder (fast response where final
          // arrives before any delta had a chance to claim it).
          const placeholderIdx = sessionMsgs.findIndex(
            (m) => !m.runId && m.role === 'assistant' && m.state === 'streaming'
          );
          if (placeholderIdx !== -1 && text) {
            const updated = [...sessionMsgs];
            updated[placeholderIdx] = { ...updated[placeholderIdx], runId, content: text, state: 'complete' };
            return { ...prev, [sessionKey]: updated };
          }
          // Create a new complete message if we have text.
          if (text) {
            const newMsg = {
              id: `final-${runId}`,
              sessionKey,
              role: 'assistant',
              content: text,
              runId,
              state: 'complete',
              attachments: [],
              timestamp: new Date().toISOString(),
            };
            return { ...prev, [sessionKey]: [...sessionMsgs, newMsg] };
          }
          // No text and no matching message — reload history as a safety net.
          setTimeout(() => loadHistoryRef.current?.(sessionKey), 0);
          return prev;
        });
        setSending(false);
        break;
      }
      case 'chat.error': {
        const { sessionKey, runId, error: errMsg } = event.data;
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunId(null);
        setStreamingContent('');
        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], state: 'error', content: `Error: ${errMsg}` };
            return { ...prev, [sessionKey]: updated };
          }
          return prev;
        });
        setSending(false);
        setError(errMsg);
        break;
      }
      case 'chat.aborted': {
        const { sessionKey, runId } = event.data;
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunId(null);
        setStreamingContent('');
        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], state: 'aborted' };
            return { ...prev, [sessionKey]: updated };
          }
          return prev;
        });
        setSending(false);
        break;
      }
      case 'chat.approval':
        setApprovalPending(event.data);
        break;
      case 'chat.subagent':
        setSubagentActivity((prev) => {
          const filtered = prev.filter((s) => s.childSessionKey !== event.data.childSessionKey);
          if (event.data.state === 'done' || event.data.state === 'error') return filtered;
          return [...filtered, event.data];
        });
        break;
      case 'sse.reconnected':
        // SSE dropped and reconnected — reload history to catch any missed events
        if (activeSessionRef.current) {
          loadHistoryRef.current?.(activeSessionRef.current);
        }
        setSending(false);
        break;
      default:
        break;
    }
  }, []);

  // Send a message (or slash command)
  const sendMessage = useCallback(async (text, attachments = []) => {
    if (!activeSession || !text.trim() || sending) return;

    // Handle slash commands
    if (text.startsWith('/')) {
      return handleSlashCommand(text.trim());
    }

    setError(null);
    setSending(true);

    // Optimistically add user message to UI
    const tempUserMsg = {
      id: `temp-user-${Date.now()}`,
      sessionKey: activeSession,
      role: 'user',
      content: text,
      attachments,
      state: 'complete',
      timestamp: new Date().toISOString(),
    };
    // Optimistically add assistant placeholder
    const tempAsstMsg = {
      id: `temp-asst-${Date.now()}`,
      sessionKey: activeSession,
      role: 'assistant',
      content: '',
      state: 'streaming',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeSession]: [...(prev[activeSession] || []), tempUserMsg, tempAsstMsg],
    }));

    try {
      await chatApi.send(activeSession, text, attachments);
    } catch (err) {
      setSending(false);
      setError(err.message);
      // Remove placeholder on failure
      setMessages((prev) => {
        const sessionMsgs = (prev[activeSession] || []).filter(
          (m) => m.id !== tempAsstMsg.id
        );
        return { ...prev, [activeSession]: sessionMsgs };
      });
    }
  }, [activeSession, sending]);

  // Inject a local-only system message (not sent to gateway)
  const injectSystemMessage = useCallback((sessionKey, content) => {
    const msg = {
      id: `sys-${Date.now()}`,
      sessionKey,
      role: 'system',
      content,
      state: 'complete',
      attachments: [],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => ({
      ...prev,
      [sessionKey]: [...(prev[sessionKey] || []), msg],
    }));
  }, []);

  const handleSlashCommand = useCallback(async (cmd) => {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (command) {
        case '/model':
          // /model with arg → switch model directly
          if (args[0] && activeSession) {
            await chatApi.patchSession(activeSession, { model: args[0] });
            injectSystemMessage(activeSession, `Model switched to \`${args[0]}\`.`);
          }
          // /model with no arg → slash menu handles this (shows picker)
          break;
        case '/reset':
        case '/new':
          if (activeSession) {
            await chatApi.resetSession(activeSession, 'new');
            setMessages((prev) => ({ ...prev, [activeSession]: [] }));
          }
          break;
        case '/abort':
          if (activeSession) await chatApi.abort(activeSession);
          break;
        case '/approve':
          if (approvalPending) {
            await chatApi.resolveApproval(approvalPending.approvalId, 'approve');
            setApprovalPending(null);
          }
          break;
        case '/deny':
          if (approvalPending) {
            await chatApi.resolveApproval(approvalPending.approvalId, 'deny');
            setApprovalPending(null);
          }
          break;
        case '/think':
          if (args[0] && activeSession) {
            await chatApi.patchSession(activeSession, { thinkingLevel: args[0] });
          }
          break;
        case '/verbose':
          if (args[0] && activeSession) {
            await chatApi.patchSession(activeSession, { verboseLevel: args[0] });
          }
          break;
        case '/elevated':
        case '/elev':
          if (args[0] && activeSession) {
            await chatApi.patchSession(activeSession, { elevatedLevel: args[0] });
          }
          break;
        case '/agent':
        case '/session':
          if (args[0]) {
            const key = sessions.find((s) => s.agentId === args[0] || s.key === args[0]);
            if (key) switchSession(key.key || key.sessionKey);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err.message);
    }
  }, [activeSession, approvalPending, sessions, switchSession, models, injectSystemMessage]);

  // Switch model on the active session (called directly from model picker)
  const switchModel = useCallback(async (modelId) => {
    if (!activeSession || !modelId) return;
    try {
      await chatApi.patchSession(activeSession, { model: modelId });
      injectSystemMessage(activeSession, `Model switched to \`${modelId}\`.`);
      // Refresh sessions to update sidebar model display
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }, [activeSession, injectSystemMessage, loadSessions, setError]);

  // Create a new direct session for an agent, numbered sequentially (e.g. agent:qwen-agent:clawmander:1)
  // Format: agent:<agentId>:clawmander:<N> so the gateway routes to the correct agent.
  const createSession = useCallback(async (agentId) => {
    const suffix = `:clawmander:`;
    const prefix = `agent:${agentId}${suffix}`;
    const nums = sessions
      .map((s) => s.key || s.sessionKey || '')
      .filter((k) => k.startsWith(prefix))
      .map((k) => {
        const n = parseInt(k.slice(prefix.length), 10);
        return isNaN(n) ? 0 : n;
      })
      .filter((n) => n > 0);
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const sessionKey = `${prefix}${nextNum}`;
    try {
      await chatApi.resetSession(sessionKey, 'new');
    } catch {
      // Session might not exist yet — sending a message will create it
    }
    await loadSessions();
    switchSession(sessionKey);
  }, [sessions, loadSessions, switchSession]);

  // Initial load
  useEffect(() => {
    loadSessions();
    loadModels();
  }, []);

  // Load history when session changes
  useEffect(() => {
    if (activeSession && !messages[activeSession]) {
      loadHistory(activeSession);
    }
  }, [activeSession]);

  return {
    sessions,
    models,
    activeSession,
    messages,
    streamingContent,
    streamingRunId,
    approvalPending,
    setApprovalPending,
    subagentActivity,
    connected,
    sending,
    loadingHistory,
    error,
    setError,
    loadSessions,
    switchSession,
    switchModel,
    createSession,
    sendMessage,
    handleSSEEvent,
    handleSlashCommand,
  };
}
