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
  // Per-session streaming state maps (Fix #5)
  const [streamingContentMap, setStreamingContentMap] = useState({});
  const [streamingRunIdMap, setStreamingRunIdMap] = useState({});
  const [sendingMap, setSendingMap] = useState({});
  const [approvalPending, setApprovalPending] = useState(null);
  const [subagentActivity, setSubagentActivity] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  // Message queue: Map<sessionKey, {text, attachments, msgId}[]>
  const [messageQueue, setMessageQueue] = useState({});
  const queuedSendRef = useRef(null);
  const processQueueRef = useRef(null);

  const streamingRef = useRef({ runId: null, content: '' });
  const activeSessionRef = useRef(null);
  // Stable ref to loadHistory so handleSSEEvent ([] deps) can call it without stale closures
  const loadHistoryRef = useRef(null);
  // Synchronous send-in-flight guard (per session) — prevents double-send
  // on rapid submits where React `sending` state is still stale.
  const sendingRef = useRef({});
  // Per-session stale-stream watchdog timers: clears streaming state if no
  // deltas arrive for STREAM_STALE_MS, so the UI doesn't hang on "...".
  const streamTimeoutRef = useRef({});
  const STREAM_STALE_MS = 90000;

  // Keep activeSessionRef in sync to avoid stale closures in SSE handler
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  // Derive current-session values for backward-compatible return API
  const sending = activeSession ? (sendingMap[activeSession] || false) : false;
  const streamingContent = activeSession ? (streamingContentMap[activeSession] || '') : '';
  const streamingRunId = activeSession ? (streamingRunIdMap[activeSession] || null) : null;

  const setSendingForSession = useCallback((sessionKey, value) => {
    if (value) sendingRef.current[sessionKey] = true;
    else delete sendingRef.current[sessionKey];
    setSendingMap(prev => ({ ...prev, [sessionKey]: value }));
  }, []);

  // Arm/reset the stale-stream watchdog for a session. Called on each delta
  // so as long as the gateway keeps streaming, the timer never fires.
  const resetStreamingTimeout = useCallback((sessionKey) => {
    if (!sessionKey) return;
    const existing = streamTimeoutRef.current[sessionKey];
    if (existing) clearTimeout(existing);
    streamTimeoutRef.current[sessionKey] = setTimeout(() => {
      delete streamTimeoutRef.current[sessionKey];
      // Watchdog fired — clear streaming + sending so the UI unsticks.
      setStreamingContentMap((prev) => ({ ...prev, [sessionKey]: '' }));
      setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: null }));
      delete sendingRef.current[sessionKey];
      setSendingMap((prev) => ({ ...prev, [sessionKey]: false }));
      setMessages((prev) => {
        const sessionMsgs = prev[sessionKey] || [];
        const updated = sessionMsgs.map((m) =>
          m.state === 'streaming' ? { ...m, state: 'complete' } : m
        );
        return { ...prev, [sessionKey]: updated };
      });
    }, STREAM_STALE_MS);
  }, []);

  const clearStreamingTimeout = useCallback((sessionKey) => {
    if (!sessionKey) return;
    const existing = streamTimeoutRef.current[sessionKey];
    if (existing) {
      clearTimeout(existing);
      delete streamTimeoutRef.current[sessionKey];
    }
  }, []);

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
        setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: activeRunId }));
        streamingRef.current = { runId: activeRunId, content: lastAssistant?.content || '' };
      }

      // Fix #6: Merge rather than replace — preserve mid-stream messages
      setMessages((prev) => {
        const current = prev[sessionKey] || [];
        const streaming = current.filter((m) => m.state === 'streaming' && m.runId);
        if (streaming.length === 0) return { ...prev, [sessionKey]: history };
        const merged = [...history];
        for (const sm of streaming) {
          const idx = merged.findIndex((m) => m.runId === sm.runId);
          if (idx !== -1) merged[idx] = sm;
          else merged.push(sm);
        }
        return { ...prev, [sessionKey]: merged };
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);
  // Keep ref in sync so handleSSEEvent ([] deps) can call loadHistory without stale closure
  loadHistoryRef.current = loadHistory;

  // Switch session — no longer clears streaming state (Fix #5: each session has its own)
  const switchSession = useCallback((sessionKey) => {
    setActiveSession(sessionKey);
    loadHistory(sessionKey);
  }, [loadHistory]);

  // Process queued messages for a session
  const processQueue = useCallback((sessionKey) => {
    setMessageQueue(prev => {
      const queue = prev[sessionKey];
      if (!queue || queue.length === 0) return prev;
      const [next, ...rest] = queue;
      queuedSendRef.current = { sessionKey, ...next };
      return { ...prev, [sessionKey]: rest };
    });
  }, []);
  processQueueRef.current = processQueue;

  // Handle SSE events
  const handleSSEEvent = useCallback((event) => {
    switch (event.type) {
      case 'chat.delta': {
        const { sessionKey, runId, text } = event.data;
        if (!text) break;

        resetStreamingTimeout(sessionKey);
        streamingRef.current = { runId, content: text };
        setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: runId }));
        setStreamingContentMap((prev) => ({ ...prev, [sessionKey]: text }));

        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            // Gateway sends cumulative text in each delta — replace, don't accumulate
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], content: text, state: 'streaming' };
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
        clearStreamingTimeout(sessionKey);
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: null }));
        setStreamingContentMap((prev) => ({ ...prev, [sessionKey]: '' }));

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
        delete sendingRef.current[sessionKey];
        setSendingMap((prev) => ({ ...prev, [sessionKey]: false }));
        setTimeout(() => processQueueRef.current?.(sessionKey), 0);
        break;
      }
      case 'chat.error': {
        const { sessionKey, runId, error: errMsg } = event.data;
        clearStreamingTimeout(sessionKey);
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: null }));
        setStreamingContentMap((prev) => ({ ...prev, [sessionKey]: '' }));
        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          if (idx !== -1) {
            const updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], state: 'error', content: `Error: ${errMsg}` };
            return { ...prev, [sessionKey]: updated };
          }
          // Fix #3: Claim runId-less placeholder on error (zombie streaming placeholder)
          const placeholderIdx = sessionMsgs.findIndex(
            (m) => !m.runId && m.role === 'assistant' && m.state === 'streaming'
          );
          if (placeholderIdx !== -1) {
            const updated = [...sessionMsgs];
            updated[placeholderIdx] = { ...updated[placeholderIdx], runId, state: 'error', content: `Error: ${errMsg}` };
            return { ...prev, [sessionKey]: updated };
          }
          return prev;
        });
        delete sendingRef.current[sessionKey];
        setSendingMap((prev) => ({ ...prev, [sessionKey]: false }));
        setTimeout(() => processQueueRef.current?.(sessionKey), 0);
        setError(errMsg);
        break;
      }
      case 'chat.aborted': {
        const { sessionKey, runId } = event.data;
        clearStreamingTimeout(sessionKey);
        streamingRef.current = { runId: null, content: '' };
        setStreamingRunIdMap((prev) => ({ ...prev, [sessionKey]: null }));
        setStreamingContentMap((prev) => ({ ...prev, [sessionKey]: '' }));
        setMessages((prev) => {
          const sessionMsgs = prev[sessionKey] || [];
          const idx = sessionMsgs.findIndex((m) => m.runId === runId && m.role === 'assistant');
          let updated = sessionMsgs;
          if (idx !== -1) {
            updated = [...sessionMsgs];
            updated[idx] = { ...updated[idx], state: 'aborted' };
          }
          // Clear queued messages on abort
          return { ...prev, [sessionKey]: updated.filter(m => m.state !== 'queued') };
        });
        delete sendingRef.current[sessionKey];
        setSendingMap((prev) => ({ ...prev, [sessionKey]: false }));
        // Clear the queue for this session
        setMessageQueue(prev => ({ ...prev, [sessionKey]: [] }));
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
        // SSE dropped and reconnected — only reload history if a run is
        // actually in flight. Unconditional reloads clobber in-flight
        // streaming state and cause bubble flicker on idle reconnects.
        if (activeSessionRef.current) {
          const hasInFlight =
            !!streamingRef.current.runId ||
            Object.values(sendingRef.current).some(Boolean);
          if (hasInFlight) {
            loadHistoryRef.current?.(activeSessionRef.current);
          }
        }
        break;
      default:
        break;
    }
  }, []);

  // Core send logic — sends a message directly to the API
  const sendMessageDirect = useCallback(async (sessionKey, text, attachments = [], fromQueue = false) => {
    setSendingForSession(sessionKey, true);

    const tempAsstMsg = {
      id: `temp-asst-${Date.now()}`,
      sessionKey,
      role: 'assistant',
      content: '',
      state: 'streaming',
      timestamp: new Date().toISOString(),
    };

    if (fromQueue) {
      // Promote queued message to complete state, then append assistant placeholder
      setMessages((prev) => {
        const sessionMsgs = (prev[sessionKey] || []).map(m =>
          m.state === 'queued' && m.content === text ? { ...m, state: 'complete' } : m
        );
        return { ...prev, [sessionKey]: [...sessionMsgs, tempAsstMsg] };
      });
    } else {
      const tempUserMsg = {
        id: `temp-user-${Date.now()}`,
        sessionKey,
        role: 'user',
        content: text,
        attachments,
        state: 'complete',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => ({
        ...prev,
        [sessionKey]: [...(prev[sessionKey] || []), tempUserMsg, tempAsstMsg],
      }));
    }

    try {
      await chatApi.send(sessionKey, text, attachments);
    } catch (err) {
      setSendingForSession(sessionKey, false);
      setError(err.message);
      // Remove placeholder on failure
      setMessages((prev) => {
        const sessionMsgs = (prev[sessionKey] || []).filter(
          (m) => m.id !== tempAsstMsg.id
        );
        return { ...prev, [sessionKey]: sessionMsgs };
      });
    }
  }, [setSendingForSession]);

  // Send a message (or slash command) — queues if session is busy
  const sendMessage = useCallback(async (text, attachments = []) => {
    if (!activeSession || !text.trim()) return;

    // Handle slash commands
    if (text.startsWith('/')) {
      return handleSlashCommand(text.trim());
    }

    if (sendingRef.current[activeSession] || sendingMap[activeSession]) {
      // Queue: add user message with state='queued', push to queue
      const queuedMsg = {
        id: `queued-user-${Date.now()}`,
        sessionKey: activeSession,
        role: 'user',
        content: text,
        attachments,
        state: 'queued',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => ({
        ...prev,
        [activeSession]: [...(prev[activeSession] || []), queuedMsg],
      }));
      setMessageQueue(prev => ({
        ...prev,
        [activeSession]: [...(prev[activeSession] || []), { text, attachments, msgId: queuedMsg.id }],
      }));
      return;
    }

    setError(null);
    await sendMessageDirect(activeSession, text, attachments);
  }, [activeSession, sendingMap, sendMessageDirect]);

  // Effect to process queued sends
  useEffect(() => {
    if (queuedSendRef.current) {
      const { sessionKey, text, attachments } = queuedSendRef.current;
      queuedSendRef.current = null;
      sendMessageDirect(sessionKey, text, attachments, true);
    }
  });

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
            setSendingMap((prev) => ({ ...prev, [activeSession]: false }));
            setMessageQueue((prev) => ({ ...prev, [activeSession]: [] }));
            setStreamingContentMap((prev) => ({ ...prev, [activeSession]: '' }));
            setStreamingRunIdMap((prev) => ({ ...prev, [activeSession]: null }));
            streamingRef.current = { runId: null, content: '' };
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
    messageQueue,
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
