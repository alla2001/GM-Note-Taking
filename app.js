// ----------------------------------------------------------------
// What is this file?
// It builds the Express application: which middleware to use,
// which routes to expose, how to handle errors.
//
// We export a *function* that creates a fresh app rather than the
// app itself, so tests can build their own copy without sharing state.
// ----------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const path = require('path');
const notesRouter = require('./routes/notes');

function createApp() {
  const app = express();

  // ---- Middleware ----
  // Middleware functions run on every request, in the order they're registered.

  // CORS = Cross-Origin Resource Sharing.
  // Lets a webpage on a different domain call this API
  // (e.g. opening the HTML from VS Code Live Server while the API is on :3000).
  app.use(cors());

  // Tell Express how to read JSON request bodies.
  // The 100kb limit protects against accidentally huge payloads.
  app.use(express.json({ limit: '100kb' }));

  // Serve the static frontend (index.html, style.css, script.js)
  // out of the /public folder. So http://localhost:3000/ returns index.html.
  app.use(express.static(path.join(__dirname, 'public')));

  // ---- Routes ----

  // Simple "is the server alive?" endpoint, useful for tests / health checks.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // All note CRUD lives under /api/notes (see routes/notes.js).
  app.use('/api/notes', notesRouter);

  // Catch-all 404 for any /api/... path that wasn't matched above.
  // We return JSON (not an HTML page) so API clients get a useful response.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ---- Error handler ----
  // Express recognises a middleware function with FOUR arguments
  // (err, req, res, next) as the global error handler. Anything passed to
  // `next(err)` from a route ends up here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
