# GM Note Taking

Backend service + simple web UI for a Game Master note-taking app, built with **Node.js + Express + MongoDB (Mongoose)**.

A GM can quickly record short events during a tabletop session, tag them, and filter them later by tag or by time.

---

## Features

- REST API to **create / read / update / delete** notes.
- Filter notes by **tags** and **timestamp range**.
- Enforces the brief: each note is capped at 400 characters (~2 sentences).
- Simple HTML/CSS/JS frontend served by the same server.
- Edge-case tests with Jest + Supertest + in-memory MongoDB — no external DB needed to run the tests.

---

## Requirements

- **Node.js** 18+ (only requirement besides MongoDB).
- **MongoDB** running locally on `mongodb://127.0.0.1:27017` for the app itself.
  (Tests spin up their own in-memory Mongo and need no local install.)

---

## Setup

```bash
# 1. Clone
git clone <your-repo-url> gm-note-taking
cd gm-note-taking

# 2. Install dependencies
npm install

# 3. (Optional) create a .env file to override defaults
cp .env.example .env

# 4. Initialise the database (creates indexes + seeds 2 example notes)
npm run init-db

# 5. Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

---

## Environment variables

| Variable    | Default                                  | Purpose                       |
| ----------- | ---------------------------------------- | ----------------------------- |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/gm_notes`     | MongoDB connection string     |
| `PORT`      | `3000`                                   | HTTP port for the Express app |

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
├── server.js             # Entry point: connects to Mongo and starts the app
├── db.js                 # Mongoose connect/disconnect helpers
├── models/
│   └── Note.js           # Mongoose schema + indexes
├── routes/
│   └── notes.js          # REST endpoints
├── scripts/
│   └── init-db.js        # DB init + seed script (npm run init-db)
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

## Running the tests

```bash
npm test
```

The tests use `mongodb-memory-server`, which downloads a MongoDB binary the first time it runs and then starts an in-memory instance — no local MongoDB needed.

Covered edge cases include:
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
