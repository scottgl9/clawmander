const { createTask, parseSessionKey, VALID_AGENT_TYPES } = require('../../backend/models/Task');

describe('Task model', () => {
  describe('createTask agentType', () => {
    test('defaults agentType to main', () => {
      const task = createTask({ title: 'Test' });
      expect(task.agentType).toBe('main');
    });

    test('accepts main agentType', () => {
      const task = createTask({ title: 'Test', agentType: 'main' });
      expect(task.agentType).toBe('main');
    });

    test('accepts subagent agentType', () => {
      const task = createTask({ title: 'Test', agentType: 'subagent' });
      expect(task.agentType).toBe('subagent');
    });

    test('falls back to main for invalid agentType', () => {
      const task = createTask({ title: 'Test', agentType: 'invalid' });
      expect(task.agentType).toBe('main');
    });
  });

  describe('parseSessionKey', () => {
    test('parses main agent session key', () => {
      const result = parseSessionKey('agent:whatsapp-agent:sess-123');
      expect(result).toEqual({ isSubagent: false, agentId: 'whatsapp-agent', subagentId: null });
    });

    test('parses subagent session key', () => {
      const result = parseSessionKey('agent:whatsapp-agent:subagent:uuid-456');
      expect(result).toEqual({ isSubagent: true, agentId: 'whatsapp-agent', subagentId: 'uuid-456' });
    });

    test('returns defaults for null', () => {
      const result = parseSessionKey(null);
      expect(result).toEqual({ isSubagent: false, agentId: null, subagentId: null });
    });

    test('returns defaults for undefined', () => {
      const result = parseSessionKey(undefined);
      expect(result).toEqual({ isSubagent: false, agentId: null, subagentId: null });
    });

    test('returns defaults for empty string', () => {
      const result = parseSessionKey('');
      expect(result).toEqual({ isSubagent: false, agentId: null, subagentId: null });
    });

    test('returns defaults for non-agent format', () => {
      const result = parseSessionKey('random-session-key');
      expect(result).toEqual({ isSubagent: false, agentId: null, subagentId: null });
    });

    test('handles agent with only id', () => {
      const result = parseSessionKey('agent:my-agent');
      expect(result).toEqual({ isSubagent: false, agentId: 'my-agent', subagentId: null });
    });
  });

  describe('VALID_AGENT_TYPES', () => {
    test('contains main and subagent', () => {
      expect(VALID_AGENT_TYPES).toEqual(['main', 'subagent']);
    });
  });
});
