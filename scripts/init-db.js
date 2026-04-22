// Initialises the MongoDB database for the GM Notes app:
//   1. Connects using MONGO_URI (or the default localhost URI).
//   2. Ensures the `notes` collection exists with the schema's indexes.
//   3. Seeds two example notes if the collection is empty.
//
// Run with:   npm run init-db

require('dotenv').config(); // load MONGO_URI from .env if present
const { connect, disconnect } = require('../db');
const Note = require('../models/Note');

async function main() {
  // Open the Mongo connection. Throws if Mongo isn't reachable.
  await connect();
  console.log('Connected to MongoDB.');

  // Make sure the indexes declared on the schema actually exist in Mongo.
  // First time this runs the indexes get created; on later runs it's a no-op.
  await Note.syncIndexes();
  console.log('Indexes synced.');

  // Only seed if the collection is empty, so re-running the script is safe.
  const count = await Note.countDocuments();
  if (count === 0) {
    await Note.insertMany([
      {
        title: 'Session 1 - Entering the cave',
        content: 'Players entered the Whispering Cave and met a wounded goblin scout.',
        tags: ['session-1', 'cave', 'goblin'],
      },
      {
        title: 'Blessing of the Moon',
        content: 'Cleric received the Blessing of the Moon from the shrine. Expires in 3 days.',
        tags: ['blessing', 'cleric'],
      },
    ]);
    console.log('Seeded 2 example notes.');
  } else {
    console.log(`Collection already has ${count} notes — skipping seed.`);
  }

  // Always close the connection so the script exits cleanly.
  await disconnect();
  console.log('Done.');
}

main().catch(async (err) => {
  console.error('init-db failed:', err);
  // Best-effort cleanup — ignore disconnect errors during shutdown.
  await disconnect().catch(() => {});
  process.exit(1);
});
