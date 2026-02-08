const express = require('express');
const { requireAuth } = require('../middleware/auth');
const FileStore = require('../storage/FileStore');

const router = express.Router();
const jobsStore = new FileStore('job-listings.json');

// Get recent job listings (sorted by match score)
router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const jobs = jobsStore.read()
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, limit);
  res.json(jobs);
});

// Get all job listings
router.get('/listings', (req, res) => {
  res.json(jobsStore.read());
});

// Create a job listing
router.post('/listings', requireAuth, (req, res) => {
  const job = {
    id: Date.now().toString(),
    title: req.body.title || 'Untitled',
    company: req.body.company || 'Unknown',
    location: req.body.location || 'Remote',
    salary: req.body.salary || '',
    summary: req.body.summary || '',
    url: req.body.url || '#',
    matchScore: req.body.matchScore || 75,
    postedDate: req.body.postedDate || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  jobsStore.insert(job);
  res.status(201).json(job);
});

// Clear all job listings (for sync purposes)
router.delete('/clear', requireAuth, (req, res) => {
  const jobs = jobsStore.read();
  jobs.forEach(job => jobsStore.remove(job.id));
  res.json({ success: true, cleared: jobs.length });
});

// Delete a specific job listing
router.delete('/listings/:id', requireAuth, (req, res) => {
  const removed = jobsStore.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Job listing not found' });
  res.json({ success: true });
});

module.exports = router;
