const DrawingService = require('../../backend/services/DrawingService');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../backend/storage/data/drawings.json');

describe('DrawingService', () => {
  let service;
  let mockSSE;

  beforeEach(() => {
    // Clean up test file
    try { fs.unlinkSync(DATA_FILE); } catch {}
    mockSSE = { broadcast: jest.fn() };
    service = new DrawingService(mockSSE);
  });

  afterEach(() => {
    try { fs.unlinkSync(DATA_FILE); } catch {}
  });

  test('create() generates a drawing with id and timestamps', () => {
    const drawing = service.create({ title: 'Test Diagram' });

    expect(drawing.id).toBeDefined();
    expect(drawing.title).toBe('Test Diagram');
    expect(drawing.data).toBeDefined();
    expect(drawing.data.elements).toEqual([]);
    expect(drawing.createdAt).toBeDefined();
    expect(drawing.updatedAt).toBeDefined();
    expect(mockSSE.broadcast).toHaveBeenCalledWith('drawing.created', expect.objectContaining({ id: drawing.id, title: 'Test Diagram' }));
  });

  test('create() uses defaults for missing title and data', () => {
    const drawing = service.create({});

    expect(drawing.title).toBe('Untitled Drawing');
    expect(drawing.data.elements).toEqual([]);
    expect(drawing.data.appState).toBeDefined();
  });

  test('getAll() returns metadata only (no data field)', () => {
    service.create({ title: 'A' });
    service.create({ title: 'B' });

    const all = service.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].data).toBeUndefined();
    expect(all[0].title).toBe('A');
    expect(all[1].title).toBe('B');
  });

  test('getById() returns full drawing with data', () => {
    const created = service.create({ title: 'Full', data: { elements: [{ id: 'el-1' }], appState: {}, files: {} } });
    const found = service.getById(created.id);

    expect(found).toBeDefined();
    expect(found.data.elements).toHaveLength(1);
    expect(found.data.elements[0].id).toBe('el-1');
  });

  test('getById() returns null for non-existent id', () => {
    expect(service.getById('nonexistent')).toBeFalsy();
  });

  test('update() modifies drawing and broadcasts', () => {
    const created = service.create({ title: 'Original' });
    const updated = service.update(created.id, { title: 'Renamed' });

    expect(updated.title).toBe('Renamed');
    expect(mockSSE.broadcast).toHaveBeenCalledWith('drawing.updated', expect.objectContaining({ id: created.id, title: 'Renamed' }));
  });

  test('update() returns null for non-existent id', () => {
    const result = service.update('nonexistent', { title: 'X' });
    expect(result).toBeFalsy();
  });

  test('delete() removes drawing and broadcasts', () => {
    const created = service.create({ title: 'ToDelete' });
    const removed = service.delete(created.id);

    expect(removed).toBeTruthy();
    expect(service.getById(created.id)).toBeFalsy();
    expect(mockSSE.broadcast).toHaveBeenCalledWith('drawing.deleted', { id: created.id });
  });

  test('delete() returns falsy for non-existent id', () => {
    const result = service.delete('nonexistent');
    expect(result).toBeFalsy();
  });
});
