# GM Note Taking

Backend service + simple web UI for a Game Master note-taking app, built with **Node.js + Express + MongoDB (Mongoose)**.

A GM can quickly record short events during a tabletop session, tag them, and filter them later by tag or by time.

---

## Features

- REST API to **create / read / update / delete** notes.
- Filter notes by **tags** and **timestamp range**.
- Enforces the brief: each note is capped at 400 characters (~2 sentences).
- Simple HTML/CSS/JS frontend served by the same server.
- Edge-case tests with Jest + Supertest + in-memory MongoDB.

---

## Requirements

- **Node.js 18+** — that's it.
  No need to install MongoDB. The default `npm start` runs the API against an in-memory MongoDB that's bundled as a dependency.

---

## Run it

```bash
git clone https://github.com/alla2001/GM-Note-Taking.git
cd GM-Note-Taking
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The first `npm install` downloads a small MongoDB binary (~70 MB) the first time it runs, then caches it. Data lives in memory and resets when the server stops.

### Optional: run against a real MongoDB

If you have a local MongoDB and want persistent data:

```bash
npm run init-db   # creates indexes + seeds 2 example notes
npm run start:mongo
```

This uses the connection string in `MONGO_URI` (default `mongodb://127.0.0.1:27017/gm_notes`).

---

## Run the tests

```bash
npm test
```

Tests use the same in-memory MongoDB — no setup needed.

---

## Environment variables

| Variable    | Default                                  | Used by                  |
| ----------- | ---------------------------------------- | ------------------------ |
| `PORT`      | `3000`                                   | both modes               |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/gm_notes`     | `start:mongo` / `init-db`|

---

## API reference

Base URL: `http://localhost:3000/api`

### `GET /api/notes`
List notes (newest first).

| Query param | Example                       | Meaning                                         |
| ----------- | ----------------------------- | ----------------------------------------------- |
| `tags`      | `goblin,cave`                 | Notes that contain **all** listed tags          |
| `from`      | `2026-01-01T00:00:00.000Z`    | `createdAt >= from`                             |
| `to`        | `2026-12-31T23:59:59.000Z`    | `createdAt <= to`                               |
| `limit`     | `50`                          | Max results (default `100`, hard cap `500`)     |

### `GET /api/notes/:id`
Fetch a single note. Returns `404` if not found, `400` if the id is malformed.

### `POST /api/notes`
Create a note.
```json
{
  "title": "Arrival at Stonehaven",
  "content": "The party arrived at Stonehaven at dusk. The gates were closed.",
  "tags": ["session-1", "town"]
}
```
- `content` is **required** and must be 1–400 chars.
- `tags` are trimmed, lower-cased, and de-duplicated.

### `PUT /api/notes/:id`
Update any of `title`, `content`, `tags`. Same validation rules as POST.

### `DELETE /api/notes/:id`
Delete a note. Returns `{ "success": true, "id": "..." }`.

### `GET /api/health`
Returns `{ "status": "ok" }` — handy for smoke tests.

---

## Project structure

```
.
├── app.js                # Express app factory (used by server + tests)
├── server.js             # Real-MongoDB entry point (npm run start:mongo)
├── db.js                 # Mongoose connect/disconnect helpers
├── models/
│   └── Note.js           # Mongoose schema + indexes
├── routes/
│   └── notes.js          # REST endpoints
├── scripts/
│   ├── dev-server.js     # In-memory MongoDB entry point (npm start)
│   └── init-db.js        # DB init + seed for real MongoDB (npm run init-db)
├── public/
│   ├── index.html        # Simple UI
│   ├── style.css
│   └── script.js
├── tests/
│   └── notes.test.js     # Edge-case tests
├── package.json
├── .env.example
└── README.md
```

---

## Edge cases covered by tests

- Missing / empty / oversized `content`
- Invalid and non-existent IDs (GET / PUT / DELETE)
- Tag normalisation (trim, lower-case, de-dup)
- Filtering by tag intersection and by time range
- Invalid date query params
- Empty `tags=` param
- `limit` bounds

---

## Example curl commands

```bash
# Create
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"content":"Party fled the cave.","tags":["cave","session-1"]}'

# List with filter
curl "http://localhost:3000/api/notes?tags=cave&from=2026-01-01"

# Update
curl -X PUT http://localhost:3000/api/notes/<id> \
  -H "Content-Type: application/json" \
  -d '{"tags":["cave","escape"]}'

# Delete
curl -X DELETE http://localhost:3000/api/notes/<id>
```
