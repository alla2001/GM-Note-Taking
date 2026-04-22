// ----------------------------------------------------------------
// What is this file?
// A "schema" describes the shape of one document in MongoDB.
// Mongoose (the library) takes the schema and gives us a "Model" object
// (`Note` at the bottom of this file) that we use to read/write data:
//
//     await Note.create({ ... })
//     await Note.find({ tags: 'cave' })
//     await Note.findById(someId)
//
// Mongoose also validates data against the schema before saving,
// so bad data never reaches the database.
// ----------------------------------------------------------------

const { type } = require('express/lib/response');
const mongoose = require('mongoose');

// Helper used by the `tags` field below.
// Takes whatever the user submitted and returns a clean array:
//   [" Goblin ", "goblin", "CAVE"]  ->  ["goblin", "cave"]
function normalizeTags(input) {
  // If the caller didn't pass an array (or didn't pass anything), use [].
  if (!Array.isArray(input)) {
    return [];
  }

  const cleanedTags = [];
  for (const rawTag of input) {
    const tag = String(rawTag).trim().toLowerCase();
    // Skip empty strings.
    if (tag.length === 0) continue;
    // Skip tags we already added (de-duplicate).
    if (cleanedTags.includes(tag)) continue;
    cleanedTags.push(tag);
  }
  return cleanedTags;
}

// Define the schema — the "shape" of a note document.
const NoteSchema = new mongoose.Schema(
  {
    // Optional short title, e.g. "Session 3 - Boss fight".
    title: {
      type: String,
      required: true,
      trim: true,                   // strip whitespace before saving
      maxlength: 120,
      default: 'Titleless note',    // used if the caller doesn't send a title
    },

    // The note body itself.
    // The brief says notes should be "no longer than 2 sentences",
    // so we cap content at 400 characters.
    content: {
      type: String,
      required: [true, 'content is required'],   // [value, error message]
      trim: true,
      maxlength: [400, 'content must be 400 characters or fewer'],
    },

    // Tags like "combat", "session-1", "goblin".
    // `set` runs every time someone assigns to this field — we use it
    // to normalise the array so filtering works predictably later.
    tags: {
      type: [String],
      default: [],
      set: normalizeTags,
    },
  },

  // Schema options.
  // `timestamps: true` tells Mongoose to add two fields automatically:
  //   - createdAt: when the document was first inserted
  //   - updatedAt: when it was last modified
  // We rely on createdAt to support the time-range filter in the API.
  { timestamps: true }
);

// Indexes make queries fast.
// Without an index on `tags`, MongoDB would scan every document
// to find ones with a given tag — fine for 10 notes, slow for 10,000.
NoteSchema.index({ tags: 1 });
NoteSchema.index({ createdAt: -1 });   // -1 = newest first

// Compile the schema into a Model and export it.
// The first argument "Note" becomes the collection name "notes" in MongoDB
// (Mongoose pluralises and lower-cases automatically).
const Note = mongoose.model('Note', NoteSchema);

module.exports = Note;
