const fs = require('fs');
const path = require('path');
const FileStore = require('../../backend/storage/FileStore');

const DATA_DIR = path.join(__dirname, '../../backend/storage/data');
const TEST_FILE = 'test-filestore.json';
const TEST_PATH = path.join(DATA_DIR, TEST_FILE);

describe('FileStore.findBy', () => {
  let store;

  beforeEach(() => {
    store = new FileStore(TEST_FILE);
    store.write([
      { id: '1', agentId: 'a', sessionKey: 's1', runId: 'r1' },
      { id: '2', agentId: 'a', sessionKey: 's1', runId: 'r2' },
      { id: '3', agentId: 'b', sessionKey: 's2', runId: 'r1' },
    ]);
  });

  afterEach(() => {
    try { fs.unlinkSync(TEST_PATH); } catch {}
  });

  test('returns first matching item', () => {
    const result = store.findBy((item) => item.agentId === 'a' && item.runId === 'r1');
    expect(result).toEqual({ id: '1', agentId: 'a', sessionKey: 's1', runId: 'r1' });
  });

  test('returns null when no match', () => {
    const result = store.findBy((item) => item.agentId === 'z');
    expect(result).toBeNull();
  });

  test('returns null for empty store', () => {
    store.write([]);
    const result = store.findBy(() => true);
    expect(result).toBeNull();
  });
});
