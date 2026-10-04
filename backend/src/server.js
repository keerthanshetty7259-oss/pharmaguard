const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { migrate, query } = require('./db');
const { requireAuth } = require('./middleware/auth');
const { countInteractionPairs } = require('./services/interactions');
const { asyncHandler } = require('./utils');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Public
app.use('/api/auth', require('./routes/auth'));
app.get(
  '/api/status',
  asyncHandler(async (req, res) => {
    const pairs = await countInteractionPairs({ query });
    res.json({
      interactionPairs: pairs,
      fullInteractionData: pairs >= 10000, // false => only the small starter set is loaded
      chatbotConfigured: Boolean(config.openaiApiKey),
    });
  })
);

// Protected (JWT)
app.use('/api/members', requireAuth, require('./routes/family'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/chat', requireAuth, require('./routes/chat'));
app.use('/api', requireAuth, require('./routes/medicines'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('PharmaGuard API is running. The React build was not found in backend/public.'));
}

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const badInput = err.code === 'LIMIT_FILE_SIZE' || err.code === '22P02'; // too-large upload / non-numeric id
  const status = err.status || (badInput ? 400 : 500);
  if (status >= 500) console.error('[error]', err);
  let message = err.message;
  if (err.code === 'LIMIT_FILE_SIZE') message = 'The image is too large (max 10 MB).';
  else if (err.code === '22P02') message = 'Invalid request.';
  else if (status >= 500 && !err.status) message = 'Something went wrong on the server.';
  res.status(status).json({ error: message, ...(err.extra || {}) });
});

async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error('\n[PharmaGuard] Could not connect to PostgreSQL / create tables:', err.message);
    console.error('Check DATABASE_URL in backend/.env and run "npm run setup" first.\n');
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`\nPharmaGuard is running ->  http://localhost:${config.port}\n`);
  });
}

if (require.main === module) start();

module.exports = { app, start };
