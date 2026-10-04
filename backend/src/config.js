const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharmaguard',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  rxnormBaseUrl: (process.env.RXNORM_BASE_URL || 'https://rxnav.nlm.nih.gov/REST').replace(/\/$/, ''),
};

if (!config.jwtSecret || config.jwtSecret === 'change-me') {
  console.warn('[config] JWT_SECRET is not set. Run "npm run setup" (it generates one) or set it in backend/.env');
  if (!config.jwtSecret) config.jwtSecret = 'insecure-dev-secret-please-run-setup';
}

module.exports = config;
