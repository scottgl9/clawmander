const express = require('express');
const router = express.Router();

router.get('/recent', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Senior Full Stack Engineer',
      company: 'TechCorp',
      location: 'Austin, TX',
      matchScore: 92,
      postedDate: new Date(Date.now() - 86400000).toISOString(),
      url: '#',
    },
    {
      id: 2,
      title: 'Backend Developer',
      company: 'StartupXYZ',
      location: 'Remote',
      matchScore: 87,
      postedDate: new Date(Date.now() - 172800000).toISOString(),
      url: '#',
    },
    {
      id: 3,
      title: 'Platform Engineer',
      company: 'BigCo',
      location: 'Houston, TX',
      matchScore: 78,
      postedDate: new Date(Date.now() - 259200000).toISOString(),
      url: '#',
    },
  ]);
});

module.exports = router;
