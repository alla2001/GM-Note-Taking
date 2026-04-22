// Edge-case tests for the Notes API.
//
// Strategy:
//   - Use mongodb-memory-server so tests run against a real MongoDB
//     (same query semantics as production) without needing one installed.
//   - Use supertest to drive the Express app directly — no need to bind a real port.
//   - Wipe the collection between tests so each one starts from a known state.

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../app');
const Note = require('../models/Note');

let mongod;
let app;

// One-time setup: spin up an in-memory Mongo and connect Mongoose to it.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

// One-time teardown: shut everything down so Jest can exit cleanly.
afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// Per-test reset: empty the notes collection so tests are isolated.
beforeEach(async () => {
  await Note.deleteMany({});
});

describe('Notes API - happy path', () => {
  test('POST creates a note and GET returns it', async () => {
    const create = await request(app)
      .post('/api/notes')
      .send({ title: 'Arrival', content: 'The party arrived in Stonehaven.', tags: ['town'] });

    expect(create.status).toBe(201);
    expect(create.body._id).toBeDefined(); // Mongo assigned an _id
    expect(create.body.title).toBe('Arrival');
    expect(create.body.tags).toEqual(['town']);

    const list = await request(app).get('/api/notes');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  test('PUT updates a note', async () => {
    const { body: note } = await request(app)
      .post('/api/notes')
      .send({ content: 'Original content.', tags: ['a'] });

    const res = await request(app)
      .put(`/api/notes/${note._id}`)
      .send({ content: 'Updated content.', tags: ['b', 'c'] });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated content.');
    // Sort because tag order isn't part of the contract.
    expect(res.body.tags.sort()).toEqual(['b', 'c']);
  });

  test('DELETE removes a note', async () => {
    const { body: note } = await request(app)
      .post('/api/notes')
      .send({ content: 'Will be deleted.' });

    const del = await request(app).delete(`/api/notes/${note._id}`);
    expect(del.status).toBe(200);

    // Subsequent GET should now 404.
    const get = await request(app).get(`/api/notes/${note._id}`);
    expect(get.status).toBe(404);
  });
});

describe('Notes API - filtering', () => {
  test('filter by tags returns only notes with ALL requested tags', async () => {
    // n1 has both tags, n2 only one, n3 has cave but not goblin.
    await Note.create({ content: 'n1', tags: ['goblin', 'cave'] });
    await Note.create({ content: 'n2', tags: ['goblin'] });
    await Note.create({ content: 'n3', tags: ['cave', 'dragon'] });

    const res = await request(app).get('/api/notes?tags=goblin,cave');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('n1');
  });

  test('filter by from/to timestamps', async () => {
    // Backfill createdAt manually to test specific dates.
    // (The schema sets createdAt on insert, so we update it after the fact.)
    const old = await Note.create({ content: 'old' });
    await Note.updateOne({ _id: old._id }, { $set: { createdAt: new Date('2026-01-01') } });

    const mid = await Note.create({ content: 'mid' });
    await Note.updateOne({ _id: mid._id }, { $set: { createdAt: new Date('2026-06-01') } });

    const recent = await Note.create({ content: 'recent' });
    await Note.updateOne({ _id: recent._id }, { $set: { createdAt: new Date('2026-12-01') } });

    const res = await request(app).get('/api/notes?from=2026-03-01&to=2026-09-01');
    expect(res.status).toBe(200);
    const contents = res.body.map((n) => n.content);
    // Only "mid" sits inside the requested window.
    expect(contents).toEqual(['mid']);
  });

  test('tags filter is case-insensitive via normalization on save', async () => {
    // Schema lower-cases tags on save, so a lower-cased query should still match.
    await Note.create({ content: 'mixed', tags: ['Goblin', 'CAVE'] });
    const res = await request(app).get('/api/notes?tags=goblin,cave');
    expect(res.body).toHaveLength(1);
  });
});

describe('Notes API - edge cases', () => {
  test('POST without content returns 400', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'No body' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content/i);
  });

  test('POST with empty content returns 400', async () => {
    // Whitespace-only content should be treated as missing (schema trims).
    const res = await request(app).post('/api/notes').send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  test('POST with content over 400 chars returns 400', async () => {
    const long = 'x'.repeat(401);
    const res = await request(app).post('/api/notes').send({ content: long });
    expect(res.status).toBe(400);
  });

  test('POST deduplicates and lowercases tags', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ content: 'dup tags', tags: ['Goblin', 'goblin', '  GOBLIN ', 'cave'] });
    expect(res.status).toBe(201);
    // 4 raw inputs -> 2 normalised, deduped tags.
    expect(res.body.tags.sort()).toEqual(['cave', 'goblin']);
  });

  test('GET with invalid id returns 400', async () => {
    // Not a valid ObjectId at all.
    const res = await request(app).get('/api/notes/not-an-id');
    expect(res.status).toBe(400);
  });

  test('GET with well-formed but missing id returns 404', async () => {
    // Valid ObjectId shape, but no document with that id.
    const res = await request(app).get(`/api/notes/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  test('PUT on non-existent note returns 404', async () => {
    const res = await request(app)
      .put(`/api/notes/${new mongoose.Types.ObjectId()}`)
      .send({ content: 'nope' });
    expect(res.status).toBe(404);
  });

  test('DELETE on non-existent note returns 404', async () => {
    const res = await request(app).delete(`/api/notes/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  test('GET with invalid date in from/to returns 400', async () => {
    const res = await request(app).get('/api/notes?from=not-a-date');
    expect(res.status).toBe(400);
  });

  test('GET with empty tags param is ignored (returns all)', async () => {
    // tags= is empty after trimming, so no filter should be applied.
    await Note.create({ content: 'a' });
    await Note.create({ content: 'b' });
    const res = await request(app).get('/api/notes?tags=');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET respects limit up to max 500', async () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({ content: `n${i}` }));
    await Note.insertMany(docs);
    const res = await request(app).get('/api/notes?limit=5');
    expect(res.body).toHaveLength(5);
  });

  test('PUT updating content over 400 chars returns 400', async () => {
    const { body } = await request(app).post('/api/notes').send({ content: 'ok' });
    const long = 'y'.repeat(500);
    const res = await request(app).put(`/api/notes/${body._id}`).send({ content: long });
    expect(res.status).toBe(400);
  });

  test('unknown API route returns 404', async () => {
    // Catch-all under /api in app.js should return JSON 404.
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
