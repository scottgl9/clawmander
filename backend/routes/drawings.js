const express = require('express');
const anyAuth = require('../middleware/anyAuth');

module.exports = function (drawingService) {
  const router = express.Router();

  // GET /api/drawings — list all (metadata only, no full data)
  router.get('/', (req, res) => {
    res.json(drawingService.getAll());
  });

  // GET /api/drawings/:id — get full drawing with data
  router.get('/:id', (req, res) => {
    const drawing = drawingService.getById(req.params.id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found' });
    res.json(drawing);
  });

  // POST /api/drawings — create new drawing
  router.post('/', anyAuth, (req, res) => {
    const drawing = drawingService.create(req.body);
    res.status(201).json(drawing);
  });

  // PATCH /api/drawings/:id — update drawing
  router.patch('/:id', anyAuth, (req, res) => {
    const drawing = drawingService.update(req.params.id, req.body);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found' });
    res.json(drawing);
  });

  // DELETE /api/drawings/:id — delete drawing
  router.delete('/:id', anyAuth, (req, res) => {
    const removed = drawingService.delete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Drawing not found' });
    res.json({ success: true });
  });

  return router;
};
