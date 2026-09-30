import 'dotenv/config';
import { createApp } from './app.js';

function proxySetting(value) {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be an integer between 1 and 65535.');

const app = createApp({
  apiKey: process.env.TYPESAFE_API_KEY || '',
  model: process.env.JEV_MODEL || 'jev-latest',
  mock: process.env.JEV_MOCK === 'true',
  ...(process.env.ALLOWED_ORIGINS ? { allowedOrigins: process.env.ALLOWED_ORIGINS } : {}),
  trustProxy: proxySetting(process.env.TRUST_PROXY),
});
const server = app.listen(port, () => {
  console.log(`Gesture proxy listening on http://localhost:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 2_000).unref();
  });
}
