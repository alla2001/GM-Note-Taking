// Production entry point.
// Loads env vars, connects to the real MongoDB defined by MONGO_URI, then starts the Express app.
// For a no-install local run, use `npm run dev:memory` instead (see scripts/dev-server.js).

require('dotenv').config(); // load variables from .env into process.env
const createApp = require('./app');
const { connect } = require('./db');

const PORT = process.env.PORT || 3000;

async function main() {
  // Open the MongoDB connection FIRST. If Mongo is unreachable we want to
  // fail fast before binding the HTTP port.
  await connect();

  // Build the Express app and start listening.
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`GM Notes API running at http://localhost:${PORT}`);
  });
}

// Top-level await isn't available in CommonJS, so we run main() and
// surface any startup error with a non-zero exit code.
main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
