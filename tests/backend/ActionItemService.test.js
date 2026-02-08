const ActionItemService = require('../../backend/services/ActionItemService');
const FileStore = require('../../backend/storage/FileStore');

jest.mock('../../backend/storage/FileStore');

function mockSSE() {
  return { broadcast: jest.fn() };
}

describe('ActionItemService', () => {
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
    service = new ActionItemService(sse);
  });

  test('getAll returns all items when no category', () => {
    const items = [
      { id: '1', category: 'personal' },
      { id: '2', category: 'work' },
    ];
    mockStore.read.mockReturnValue(items);

    expect(service.getAll()).toEqual(items);
    expect(mockStore.read).toHaveBeenCalled();
  });

  test('getAll filters by category', () => {
    const personal = [{ id: '1', category: 'personal' }];
    mockStore.findAll.mockReturnValue(personal);

    const result = service.getAll('personal');
    expect(result).toEqual(personal);
    expect(mockStore.findAll).toHaveBeenCalledWith(expect.any(Function));
  });

  test('getPersonal calls getAll with personal', () => {
    mockStore.findAll.mockReturnValue([]);
    service.getPersonal();
    expect(mockStore.findAll).toHaveBeenCalled();
  });

  test('getWork calls getAll with work', () => {
    mockStore.findAll.mockReturnValue([]);
    service.getWork();
    expect(mockStore.findAll).toHaveBeenCalled();
  });

  test('getById delegates to store', () => {
    const item = { id: '1', title: 'Test' };
    mockStore.findById.mockReturnValue(item);
    expect(service.getById('1')).toEqual(item);
  });

  test('create inserts item and broadcasts', () => {
    const result = service.create({ title: 'New item', category: 'work', priority: 'high' });

    expect(result).toHaveProperty('id');
    expect(result.title).toBe('New item');
    expect(result.category).toBe('work');
    expect(result.priority).toBe('high');
    expect(result.done).toBe(false);
    expect(mockStore.insert).toHaveBeenCalledWith(result);
    expect(sse.broadcast).toHaveBeenCalledWith('actionitem.created', result);
  });

  test('create uses defaults for missing fields', () => {
    const result = service.create({});
    expect(result.title).toBe('Untitled');
    expect(result.priority).toBe('medium');
    expect(result.category).toBe('personal');
    expect(result.done).toBe(false);
    expect(result.metadata).toEqual({});
  });

  test('update broadcasts on success', () => {
    const updated = { id: '1', title: 'Updated' };
    mockStore.update.mockReturnValue(updated);

    const result = service.update('1', { title: 'Updated' });
    expect(result).toEqual(updated);
    expect(sse.broadcast).toHaveBeenCalledWith('actionitem.updated', updated);
  });

  test('update returns null and does not broadcast when not found', () => {
    mockStore.update.mockReturnValue(null);

    const result = service.update('missing', { title: 'x' });
    expect(result).toBeNull();
    expect(sse.broadcast).not.toHaveBeenCalled();
  });

  test('delete broadcasts on success', () => {
    mockStore.remove.mockReturnValue(true);

    const result = service.delete('1');
    expect(result).toBe(true);
    expect(sse.broadcast).toHaveBeenCalledWith('actionitem.deleted', { id: '1' });
  });

  test('delete returns false and does not broadcast when not found', () => {
    mockStore.remove.mockReturnValue(false);

    const result = service.delete('missing');
    expect(result).toBe(false);
    expect(sse.broadcast).not.toHaveBeenCalled();
  });

  describe('upsert', () => {
    test('creates new item when no match found', () => {
      mockStore.findBy.mockReturnValue(null);

      const result = service.upsert({ title: 'New item', category: 'work' });

      expect(result.created).toBe(true);
      expect(result.item).toHaveProperty('id');
      expect(result.item.title).toBe('New item');
      expect(mockStore.insert).toHaveBeenCalled();
      expect(sse.broadcast).toHaveBeenCalledWith('actionitem.created', result.item);
    });

    test('updates existing item when title+category match', () => {
      const existing = { id: 'existing-1', title: 'Buy groceries', category: 'personal', done: false };
      mockStore.findBy.mockReturnValue(existing);
      const updated = { ...existing, details: 'milk, eggs', updatedAt: expect.any(String) };
      mockStore.update.mockReturnValue(updated);

      const result = service.upsert({ title: 'Buy groceries', category: 'personal', details: 'milk, eggs' });

      expect(result.created).toBe(false);
      expect(mockStore.update).toHaveBeenCalledWith('existing-1', expect.objectContaining({ details: 'milk, eggs' }));
      expect(sse.broadcast).toHaveBeenCalledWith('actionitem.updated', updated);
    });

    test('preserves original id and createdAt on update', () => {
      const existing = { id: 'orig-id', title: 'Test', category: 'work', createdAt: '2026-01-01' };
      mockStore.findBy.mockReturnValue(existing);
      mockStore.update.mockReturnValue({ ...existing, priority: 'high', updatedAt: '2026-02-08' });

      const result = service.upsert({ id: 'new-id', title: 'Test', category: 'work', priority: 'high', createdAt: '2026-02-08' });

      expect(result.created).toBe(false);
      // update should be called with existing id, and new id/createdAt should not be in updates
      expect(mockStore.update).toHaveBeenCalledWith('orig-id', expect.not.objectContaining({ id: 'new-id', createdAt: '2026-02-08' }));
    });

    test('creates new item when title is missing', () => {
      const result = service.upsert({ category: 'work' });

      expect(result.created).toBe(true);
      expect(mockStore.findBy).not.toHaveBeenCalled();
    });

    test('creates new item when category is missing', () => {
      const result = service.upsert({ title: 'Test' });

      expect(result.created).toBe(true);
      expect(mockStore.findBy).not.toHaveBeenCalled();
    });
  });
});
