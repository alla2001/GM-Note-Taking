// Thin wrapper around Mongoose's connect/disconnect.
// Centralising it here keeps the connection string logic in one place
// and makes it easy to swap implementations later (e.g. test DB).

const mongoose = require('mongoose');

// Open a connection to MongoDB.
// Priority: explicit `uri` argument  >  process.env.MONGO_URI  >  localhost default.
async function connect(uri) {
  const mongoUri =
    uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gm_notes';
  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

// Cleanly close the connection (used by the init script and tests).
async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
