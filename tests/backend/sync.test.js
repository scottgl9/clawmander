const request = require('supertest');
const express = require('express');

// Mock the anyAuth middleware
jest.mock('../../backend/middleware/anyAuth', () => (req, res, next) => next());

const syncRouter = require('../../backend/routes/sync');

describe('Sync Routes', () => {
  let app;
  let mockMessageModel;
  let mockGenericSyncModel;

  beforeEach(() => {
    mockMessageModel = {
      upsert: jest.fn()
    };
    mockGenericSyncModel = {
      upsert: jest.fn()
    };

    app = express();
    app.use(express.json());
    
    app.use('/api/sync', syncRouter(mockMessageModel, mockGenericSyncModel));
  });

  describe('POST /api/sync/sms', () => {
    it('should reject non-array payloads with 400', async () => {
      const response = await request(app)
        .post('/api/sync/sms')
        .set('Authorization', 'Bearer test-token')
        .send({ id: "123", body: "Hello" });
        
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Payload must be an array', status: 'error' });
      expect(mockMessageModel.upsert).not.toHaveBeenCalled();
    });

    it('should reject payload if an item is missing an id', async () => {
      const response = await request(app)
        .post('/api/sync/sms')
        .set('Authorization', 'Bearer test-token')
        .send([{ body: "Hello" }]);
        
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing id field in item', status: 'error' });
    });

    it('should process SMS successfully and classify as sms', async () => {
      mockMessageModel.upsert.mockReturnValue({ inserted: true });
      
      const payload = [{
        id: "456",
        address: "+1234567890",
        body: "Test SMS message",
        date_ms: 1700000000000,
        type: 1 // incoming
      }];

      const response = await request(app)
        .post('/api/sync/sms')
        .set('Authorization', 'Bearer test-token')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 1, status: 'ok', accepted: true });
      
      expect(mockMessageModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
        id: "456",
        type: "sms",
        sender: "+1234567890",
        body: "Test SMS message"
      }));
    });

    it('should process MMS successfully and classify as mms based on mms_ prefix', async () => {
      mockMessageModel.upsert.mockReturnValue({ inserted: true });
      
      const payload = [{
        id: "mms_789",
        address: "+0987654321",
        body: "Test MMS message",
        date_ms: 1700000000000,
        type: 2 // outgoing
      }];

      const response = await request(app)
        .post('/api/sync/sms')
        .set('Authorization', 'Bearer test-token')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 1, status: 'ok', accepted: true });
      
      expect(mockMessageModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
        id: "mms_789",
        type: "mms",
        recipient: "+0987654321",
        sender: "me",
        body: "Test MMS message"
      }));
    });
  });
});
