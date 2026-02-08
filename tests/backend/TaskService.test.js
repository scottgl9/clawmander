const TaskService = require('../../backend/services/TaskService');
const FileStore = require('../../backend/storage/FileStore');

jest.mock('../../backend/storage/FileStore');

function mockSSE() {
  return { broadcast: jest.fn() };
}

describe('TaskService', () => {
  let service;
  let sse;
  let mockStore;

  beforeEach(() => {
    sse = mockSSE();
    mockStore = {
      read: jest.fn().mockReturnValue([]),
      findById: jest.fn(),
      findBy: jest.fn().mockReturnValue(null),
      insert: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAll: jest.fn(),
    };
    FileStore.mockImplementation(() => mockStore);
    service = new TaskService(sse);
  });

  test('getAll passes agentType filter', () => {
    service.getAll({ agentType: 'subagent' });
    expect(mockStore.findAll).toHaveBeenCalled();
    const filterFn = mockStore.findAll.mock.calls[0][0];
    expect(filterFn({ agentType: 'subagent' })).toBe(true);
    expect(filterFn({ agentType: 'main' })).toBe(false);
    expect(filterFn({})).toBe(false);
  });

  test('create inserts task and broadcasts', () => {
    const result = service.create({ title: 'Test task', status: 'queued' });

    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test task');
    expect(result.status).toBe('queued');
    expect(mockStore.insert).toHaveBeenCalledWith(result);
    expect(sse.broadcast).toHaveBeenCalledWith('task.created', result);
  });

  describe('upsert', () => {
    test('creates new task when no match found', () => {
      mockStore.findBy.mockReturnValue(null);

      const result = service.upsert({
        title: 'New task',
        agentId: 'agent-1',
        sessionKey: 'sess-1',
        runId: 'run-1',
        status: 'queued',
      });

      expect(result.created).toBe(true);
      expect(result.task).toHaveProperty('id');
      expect(result.task.title).toBe('New task');
      expect(mockStore.insert).toHaveBeenCalled();
      expect(sse.broadcast).toHaveBeenCalledWith('task.created', result.task);
    });

    test('updates existing task when agentId+sessionKey+runId match', () => {
      const existing = {
        id: 'existing-1',
        title: 'Old title',
        agentId: 'agent-1',
        sessionKey: 'sess-1',
        runId: 'run-1',
        status: 'queued',
      };
      mockStore.findBy.mockReturnValue(existing);
      const updated = { ...existing, title: 'Updated title', status: 'in_progress', updatedAt: '2026-02-08' };
      mockStore.update.mockReturnValue(updated);

      const result = service.upsert({
        title: 'Updated title',
        agentId: 'agent-1',
        sessionKey: 'sess-1',
        runId: 'run-1',
        status: 'in_progress',
      });

      expect(result.created).toBe(false);
      expect(result.task).toEqual(updated);
      expect(mockStore.update).toHaveBeenCalledWith('existing-1', expect.objectContaining({ title: 'Updated title', status: 'in_progress' }));
      expect(sse.broadcast).toHaveBeenCalledWith('task.updated', updated);
    });

    test('preserves original id and createdAt on update', () => {
      const existing = {
        id: 'orig-id',
        agentId: 'agent-1',
        sessionKey: 'sess-1',
        runId: 'run-1',
        createdAt: '2026-01-01',
      };
      mockStore.findBy.mockReturnValue(existing);
      mockStore.update.mockReturnValue({ ...existing, title: 'New', updatedAt: '2026-02-08' });

      service.upsert({
        id: 'new-id',
        agentId: 'agent-1',
        sessionKey: 'sess-1',
        runId: 'run-1',
        title: 'New',
        createdAt: '2026-02-08',
      });

      expect(mockStore.update).toHaveBeenCalledWith(
        'orig-id',
        expect.not.objectContaining({ id: 'new-id', createdAt: '2026-02-08' })
      );
    });

    test('creates new task when agentId is missing', () => {
      const result = service.upsert({ title: 'No agent', sessionKey: 'sess-1', runId: 'run-1' });

      expect(result.created).toBe(true);
      expect(mockStore.findBy).not.toHaveBeenCalled();
    });

    test('creates new task when sessionKey is missing', () => {
      const result = service.upsert({ title: 'No session', agentId: 'agent-1', runId: 'run-1' });

      expect(result.created).toBe(true);
      expect(mockStore.findBy).not.toHaveBeenCalled();
    });

    test('creates new task when runId is missing', () => {
      const result = service.upsert({ title: 'No run', agentId: 'agent-1', sessionKey: 'sess-1' });

      expect(result.created).toBe(true);
      expect(mockStore.findBy).not.toHaveBeenCalled();
    });

    test('does not broadcast task.created on upsert update', () => {
      const existing = { id: 'e1', agentId: 'a', sessionKey: 's', runId: 'r' };
      mockStore.findBy.mockReturnValue(existing);
      mockStore.update.mockReturnValue({ ...existing, updatedAt: 'now' });

      service.upsert({ agentId: 'a', sessionKey: 's', runId: 'r', title: 'x' });

      const broadcastCalls = sse.broadcast.mock.calls;
      expect(broadcastCalls).toHaveLength(1);
      expect(broadcastCalls[0][0]).toBe('task.updated');
    });
  });
});
