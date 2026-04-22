// ----------------------------------------------------------------
// What is this file?
// The frontend logic. It runs in the browser and talks to the API
// (the Node/Express server) using fetch().
// Because the page is served from the same Express server, we can
// use a relative URL ("/api/notes") instead of a full one.
// ----------------------------------------------------------------

const API_URL = '/api/notes';

// Grab references to all the form/input/list elements once,
// so we don't keep calling document.getElementById in every handler.
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const tagsInput = document.getElementById('tags');
const formMessage = document.getElementById('form-msg');

const filterForm = document.getElementById('filter-form');
const filterTagsInput = document.getElementById('filter-tags');
const filterFromInput = document.getElementById('filter-from');
const filterToInput = document.getElementById('filter-to');
const clearFiltersButton = document.getElementById('clear-filters');

const notesList = document.getElementById('notes-list');
const emptyMessage = document.getElementById('empty-msg');

// ---------- helpers ----------

// Turn "a, b ,c" into ["a", "b", "c"].
function parseTagInput(rawValue) {
  if (!rawValue) return [];
  return rawValue
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// Show a small status message, then clear it after 3 seconds.
function showMessage(element, text, kind) {
  element.textContent = text;
  element.className = kind ? 'msg ' + kind : 'msg';

  if (!text) return;

  setTimeout(() => {
    // Only clear it if the message is still the one we set
    // (avoid clobbering a newer message).
    if (element.textContent === text) {
      element.textContent = '';
      element.className = 'msg';
    }
  }, 3000);
}

// Escape user-provided text before putting it into innerHTML.
// Without this, text like "<script>" would actually run (XSS).
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Build the HTML for a single note and append it to the list.
function renderNote(note) {
  const li = document.createElement('li');
  li.className = 'note';

  const createdDate = new Date(note.createdAt).toLocaleString();

  const tags = note.tags || [];
  const tagsHtml = tags
    .map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>')
    .join('');

  const titleHtml = note.title
    ? '<p class="note-title">' + escapeHtml(note.title) + '</p>'
    : '';

  li.innerHTML =
    titleHtml +
    '<p class="note-content">' + escapeHtml(note.content) + '</p>' +
    '<div class="note-meta">' +
      '<div>' + tagsHtml + '<span>' + createdDate + '</span></div>' +
      '<div class="note-actions">' +
        '<button data-id="' + note._id + '" class="delete-btn">Delete</button>' +
      '</div>' +
    '</div>';

  notesList.appendChild(li);
}

// Render an array of notes into the list.
function renderNotes(notes) {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    emptyMessage.classList.remove('hidden');
    return;
  }
  emptyMessage.classList.add('hidden');

  for (const note of notes) {
    renderNote(note);
  }
}

// ---------- API calls ----------

// Fetch notes from the API using the current filter values.
async function loadNotes() {
  // URLSearchParams builds "?key=value&key=value" for us, with proper escaping.
  const params = new URLSearchParams();

  const tags = parseTagInput(filterTagsInput.value);
  if (tags.length > 0) {
    params.set('tags', tags.join(','));
  }

  // <input type="datetime-local"> gives us local time as a string.
  // Convert to ISO so the server interprets it the same regardless of timezone.
  if (filterFromInput.value) {
    params.set('from', new Date(filterFromInput.value).toISOString());
  }
  if (filterToInput.value) {
    params.set('to', new Date(filterToInput.value).toISOString());
  }

  const response = await fetch(API_URL + '?' + params.toString());
  if (!response.ok) {
    showMessage(formMessage, 'Failed to load notes', 'error');
    return;
  }

  const notes = await response.json();
  renderNotes(notes);
}

// Send a new note to the API.
async function createNote() {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const tags = parseTagInput(tagsInput.value);

  // Build the request body.
  // We only include `title` if the user actually typed one,
  // so the model's default ("Titleless note") can kick in otherwise.
  const body = { content: content, tags: tags };
  if (title) body.title = title;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    noteForm.reset();
    showMessage(formMessage, 'Note saved.', 'success');
    loadNotes();
    return;
  }

  // Try to surface the server's validation error message.
  let errorText = 'Failed to save';
  try {
    const data = await response.json();
    if (data.error) errorText = data.error;
  } catch (e) {
    // ignore parse failures, fall back to the generic message
  }
  showMessage(formMessage, errorText, 'error');
}

// Delete a single note by id.
async function deleteNote(noteId) {
  const response = await fetch(API_URL + '/' + noteId, { method: 'DELETE' });
  if (response.ok) {
    loadNotes();
  } else {
    showMessage(formMessage, 'Failed to delete', 'error');
  }
}

// ---------- event handlers ----------

// "New note" form submit.
noteForm.addEventListener('submit', (event) => {
  event.preventDefault();   // stop the browser from doing a real form POST + page reload
  createNote();
});

// "Filters" form submit.
filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadNotes();
});

// "Clear" button — empty the filter inputs and reload.
clearFiltersButton.addEventListener('click', () => {
  filterTagsInput.value = '';
  filterFromInput.value = '';
  filterToInput.value = '';
  loadNotes();
});

// Delete button clicks — handled at the list level (event delegation),
// so we don't need to bind a handler to each note when the list re-renders.
notesList.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-btn');
  if (!button) return;

  const confirmed = confirm('Delete this note?');
  if (!confirmed) return;

  const noteId = button.dataset.id;
  deleteNote(noteId);
});

// Load notes once when the page first opens.
loadNotes();
