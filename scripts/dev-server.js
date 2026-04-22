// Convenience dev runner: starts the API against an in-memory MongoDB.
// Useful when you don't have a local MongoDB installed (e.g. the marker
// running this fresh from GitHub).
// Data lives only in memory — it disappears when the process exits.
//
// Run with:  npm run dev:memory

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../app');
const Note = require('../models/Note');

const PORT = process.env.PORT || 3000;

async function main() {
  // Boot an ephemeral MongoDB on a random port.
  // launchTimeout is bumped to 60s because Windows first-start of the
  // bundled mongod binary can take longer than the default 10s.
  const mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  const uri = mongod.getUri();

  // Point Mongoose at the in-memory instance.
  await mongoose.connect(uri);
  console.log(`In-memory MongoDB running at ${uri}`);

  // Build the same Express app the production entry point uses,
  // so behaviour matches `npm start` exactly.
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`GM Notes API (in-memory mode) running at http://localhost:${PORT}`);
  });

  // Clean shutdown when Ctrl+C / kill is received: stop accepting new
  // connections, disconnect Mongoose, then stop the in-memory server.
  const shutdown = async () => {
    console.log('\nShutting down...');
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('dev-server failed:', err);
  process.exit(1);
});
