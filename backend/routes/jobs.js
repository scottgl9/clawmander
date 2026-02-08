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
      summary: 'Build and maintain full-stack web applications using React and Node.js. Lead architecture decisions for a growing SaaS platform.',
      postedDate: new Date(Date.now() - 86400000).toISOString(),
      url: '#',
    },
    {
      id: 2,
      title: 'Backend Developer',
      company: 'StartupXYZ',
      location: 'Remote',
      matchScore: 87,
      summary: 'Design and implement RESTful APIs and microservices. Work with PostgreSQL, Redis, and Docker in a fast-paced startup environment.',
      postedDate: new Date(Date.now() - 172800000).toISOString(),
      url: '#',
    },
    {
      id: 3,
      title: 'Platform Engineer',
      company: 'BigCo',
      location: 'Houston, TX',
      matchScore: 78,
      summary: 'Manage cloud infrastructure on AWS and Kubernetes. Improve CI/CD pipelines and developer tooling for a large engineering org.',
      postedDate: new Date(Date.now() - 259200000).toISOString(),
      url: '#',
    },
  ]);
});

module.exports = router;
