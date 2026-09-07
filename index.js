const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Welcome to AutoForge02',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'AutoForge02',
    version: '1.0.0',
    description: 'AutoForge02 Express application',
  });
});

app.listen(PORT, () => {
  console.log(`AutoForge02 server listening on port ${PORT}`);
});
