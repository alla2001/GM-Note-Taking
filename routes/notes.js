// ----------------------------------------------------------------
// What is this file?
// It defines the REST API routes under /api/notes.
// An Express "Router" is like a mini Express app you attach to the main one.
// In app.js we do:  app.use('/api/notes', notesRouter)
// So a route defined here as router.get('/:id', ...) becomes:
//     GET /api/notes/:id
//
// Each route is an async function. We wrap the body in try/catch because
// if a Promise rejects inside an Express handler, Express needs us to call
// `next(err)` to forward it to the error handler we set up in app.js.
// ----------------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/Note');

const router = express.Router();

// ---------- helpers ----------

// Mongo's _id is a 24-char hex string like "507f1f77bcf86cd799439011".
// If the user sends anything else, we can reject early with a 400
// instead of letting Mongoose throw.
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Returns true if the given string parses as a real date.
function isValidDate(value) {
  const parsed = new Date(value);
  return !isNaN(parsed.getTime());
}

// Build the `createdAt` part of a MongoDB filter, given `from` / `to` query params.
// Mongo operators:
//   $gte = "greater than or equal"
//   $lte = "less than or equal"
// Returns null when neither was supplied, so the caller can skip the filter.
function buildDateFilter(from, to) {
  if (!from && !to) return null;

  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
}

// Turn a comma-separated string from the querystring into a clean array:
//   "goblin, cave ,"  ->  ["goblin", "cave"]
function parseTagList(rawValue) {
  if (!rawValue) return [];
  return String(rawValue)
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
}

// ---------- routes ----------

// GET /api/notes
// Returns a list of notes (newest first).
// Optional query params:
//   tags=goblin,cave   only notes that contain ALL these tags
//   from=2026-01-01    createdAt >= from
//   to=2026-12-31      createdAt <= to
//   limit=50           default 100, hard cap 500
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    // Tag filter.
    // `$all` means: the `tags` array must contain every listed value.
    const tags = parseTagList(req.query.tags);
    if (tags.length > 0) {
      filter.tags = { $all: tags };
    }

    // Date filter.
    const fromRaw = req.query.from;
    const toRaw = req.query.to;
    if (fromRaw && !isValidDate(fromRaw)) {
      return res.status(400).json({ error: 'Invalid from date' });
    }
    if (toRaw && !isValidDate(toRaw)) {
      return res.status(400).json({ error: 'Invalid to date' });
    }
    const dateFilter = buildDateFilter(fromRaw, toRaw);
    if (dateFilter) {
      filter.createdAt = dateFilter;
    }

    // Limit.
    // Parse the user's limit, default to 100, and never go above 500.
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 500) limit = 500;

    // Run the query.
    //   .find(filter)         -> all docs matching the filter
    //   .sort({ createdAt:-1})-> newest first
    //   .limit(n)             -> at most n results
    //   .lean()               -> return plain JS objects (faster, no Mongoose wrapping)
    const notes = await Note.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/:id  — fetch one note by id.
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const note = await Note.findById(id).lean();
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(note);
  } catch (err) {
    next(err);
  }
});

// POST /api/notes  — create a new note.
router.post('/', async (req, res, next) => {
  try {
    // Read only the fields we expect from the request body.
    // Never trust the client to send exactly the right shape.
    const body = req.body || {};
    const newNote = {
      title: body.title,
      content: body.content,
      tags: body.tags,
    };

    // `Note.create` runs all schema validators (required, maxlength, etc.)
    // and inserts the document. If validation fails, it throws.
    const savedNote = await Note.create(newNote);

    // 201 = "Created"
    res.status(201).json(savedNote);
  } catch (err) {
    // Turn schema validation errors into a 400 Bad Request.
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// PUT /api/notes/:id  — update an existing note.
// Only the fields the caller actually sends get updated.
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Build the update object with only the fields that were provided.
    const body = req.body || {};
    const update = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.content !== undefined) update.content = body.content;
    if (body.tags !== undefined) update.tags = body.tags;

    // Options explained:
    //   new: true            -> return the UPDATED doc, not the original
    //   runValidators: true  -> apply schema validators on updates too
    const updatedNote = await Note.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!updatedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(updatedNote);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/notes/:id  — delete a note.
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const deletedNote = await Note.findByIdAndDelete(id);
    if (!deletedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, id: id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
