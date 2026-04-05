const DB_NAME = 'registro-lectura-db';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

const state = {
  entries: [],
  activeTab: 'current',
  installPrompt: null,
  openSwipeId: null,
};

const ui = {
  currentSummary: document.getElementById('currentSummary'),
  historyStatReading: document.getElementById('historyStatReading'),
  historyStatFinished: document.getElementById('historyStatFinished'),
  historyStatTotal: document.getElementById('historyStatTotal'),
  historyMonthDetails: document.getElementById('historyMonthDetails'),
  currentList: document.getElementById('currentList'),
  currentEmpty: document.getElementById('currentEmpty'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  historyMeta: document.getElementById('historyMeta'),
  historyMonthSummary: document.getElementById('historyMonthSummary'),
  searchHistory: document.getElementById('searchHistory'),
  historyTypeFilter: document.getElementById('historyTypeFilter'),
  historyFormatFilter: document.getElementById('historyFormatFilter'),
  menuBtn: document.getElementById('menuBtn'),
  menuPanel: document.getElementById('menuPanel'),
  addBtn: document.getElementById('addBtn'),
  dialog: document.getElementById('entryDialog'),
  dialogTitle: document.getElementById('dialogTitle'),
  form: document.getElementById('entryForm'),
  entryId: document.getElementById('entryId'),
  titleInput: document.getElementById('titleInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  typeInput: document.getElementById('typeInput'),
  formatInput: document.getElementById('formatInput'),
  statusInput: document.getElementById('statusInput'),
  startDateInput: document.getElementById('startDateInput'),
  endDateInput: document.getElementById('endDateInput'),
  endDateField: document.getElementById('endDateField'),
  deleteEntryBtn: document.getElementById('deleteEntryBtn'),
  closeDialogBtn: document.getElementById('closeDialogBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  clearBtn: document.getElementById('clearBtn'),
  toast: document.getElementById('toast'),
  installBtn: document.getElementById('installBtn'),
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '—';
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function monthKey(dateStr) {
  if (!dateStr) return 'Sin fecha';
  return dateStr.slice(0, 7);
}

function monthLabel(ym) {
  if (!ym || ym === 'Sin fecha') return 'Sin fecha';
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

function makeId() {
  return (crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

function normalized(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => ui.toast.classList.add('hidden'), 2200);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllEntries() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveEntry(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteEntry(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearEntries() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const aDate = a.updatedAt || a.createdAt || '';
    const bDate = b.updatedAt || b.createdAt || '';
    return bDate.localeCompare(aDate);
  });
}

function entryMatches(entry, searchText, typeFilter = 'all', formatFilter = 'all') {
  const query = normalized(searchText);
  const haystack = normalized(`${entry.title} ${entry.description} ${entry.type} ${entry.format}`);
  const typeOk = typeFilter === 'all' || entry.type === typeFilter;
  const formatOk = formatFilter === 'all' || entry.format === formatFilter;
  const queryOk = !query || haystack.includes(query);
  return typeOk && formatOk && queryOk;
}

function renderSummary() {
  const reading = state.entries.filter((entry) => entry.status === 'reading');
  const finished = state.entries.filter((entry) => entry.status === 'finished');
  const total = state.entries.length;

  ui.currentSummary.textContent = `Leyendo ahora: ${reading.length}.`;
  ui.historyStatReading.textContent = `Leyendo ahora: ${reading.length}`;
  ui.historyStatFinished.textContent = `Terminados: ${finished.length}`;
  ui.historyStatTotal.textContent = `Total histórico: ${total}`;
}

function renderEntryRow(entry, mode) {
  const article = document.createElement('article');
  article.className = 'entry-row-wrap';
  article.dataset.id = entry.id;

  const leftAction = mode === 'history'
    ? `<button class="swipe-action edit" data-action="edit" data-id="${entry.id}" type="button">Editar</button>`
    : `<button class="swipe-action edit" data-action="edit" data-id="${entry.id}" type="button">Editar</button>`;

  const rightAction = mode === 'history'
    ? `<button class="swipe-action reopen" data-action="reopen" data-id="${entry.id}" type="button">Leyendo</button>`
    : `<button class="swipe-action finish" data-action="finish" data-id="${entry.id}" type="button">Terminar</button>`;

  const dateLine = mode === 'history'
    ? `Inicio: ${formatDate(entry.startDate)} · Fin: ${formatDate(entry.endDate)}`
    : `Inicio: ${formatDate(entry.startDate)}`;

  article.innerHTML = `
    <div class="swipe-actions">
      <div class="swipe-actions-left">${leftAction}</div>
      <div class="swipe-actions-right">${rightAction}</div>
    </div>
    <div class="entry-row" data-id="${entry.id}">
      <div class="entry-mainline">
        <h3>${escapeHtml(entry.title)}</h3>
      </div>
      <p class="entry-meta">${labelType(entry.type)} · ${labelFormat(entry.format)} · ${dateLine}</p>
      ${entry.description ? `<p class="entry-description">${escapeHtml(entry.description)}</p>` : ''}
    </div>
  `;
  return article;
}

function renderCurrent() {
  const entries = sortEntries(state.entries)
    .filter((entry) => entry.status === 'reading');

  ui.currentList.innerHTML = '';
  ui.currentEmpty.classList.toggle('hidden', entries.length > 0);

  entries.forEach((entry) => {
    ui.currentList.appendChild(renderEntryRow(entry, 'current'));
  });
}

function renderHistory() {
  const query = ui.searchHistory.value;
  const typeFilter = ui.historyTypeFilter.value;
  const formatFilter = ui.historyFormatFilter.value;
  const entries = sortEntries(state.entries)
    .filter((entry) => entry.status === 'finished')
    .filter((entry) => entryMatches(entry, query, typeFilter, formatFilter))
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  ui.historyList.innerHTML = '';
  ui.historyMonthSummary.innerHTML = '';
  ui.historyEmpty.classList.toggle('hidden', entries.length > 0);
  ui.historyMeta.textContent = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'registro' : 'registros'} encontrados.`
    : 'Sin registros todavía.';

  const monthCounts = new Map();
  entries.forEach((entry) => {
    const key = monthKey(entry.endDate);
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  });

  [...monthCounts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([key, count]) => {
      const row = document.createElement('div');
      row.className = 'history-month-row muted small';
      row.innerHTML = `<span>${capitalize(monthLabel(key))}</span><strong>${count}</strong>`;
      ui.historyMonthSummary.appendChild(row);
    });

  ui.historyMonthDetails.open = monthCounts.size > 0;

  const grouped = new Map();
  entries.forEach((entry) => {
    const key = monthKey(entry.endDate);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  [...grouped.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([key, groupEntries]) => {
      const section = document.createElement('section');
      section.className = 'history-group';
      const header = document.createElement('div');
      header.className = 'history-group-header';
      header.innerHTML = `<h3>${capitalize(monthLabel(key))}</h3><span class="muted small">${groupEntries.length}</span>`;
      section.appendChild(header);

      groupEntries.forEach((entry) => {
        section.appendChild(renderEntryRow(entry, 'history'));
      });

      ui.historyList.appendChild(section);
    });
}

function renderAll() {
  state.openSwipeId = null;
  renderSummary();
  renderCurrent();
  renderHistory();
}

function labelType(type) {
  return {
    libro: 'Libro',
    historieta: 'Historieta',
    revista: 'Revista',
    apunte: 'Apunte',
    otro: 'Otro',
  }[type] || 'Otro';
}

function labelFormat(format) {
  return format === 'digital' ? 'Digital' : 'Físico';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function setTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.menu-item').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  closeMenu();
}

function openMenu() {
  ui.menuPanel.classList.remove('hidden');
  ui.menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  ui.menuPanel.classList.add('hidden');
  ui.menuBtn.setAttribute('aria-expanded', 'false');
}

function resetForm() {
  ui.form.reset();
  ui.entryId.value = '';
  ui.statusInput.value = 'reading';
  ui.endDateInput.value = '';
  ui.dialogTitle.textContent = 'Nueva lectura';
  ui.deleteEntryBtn.classList.add('hidden');
  syncEndDateState();
}

function syncEndDateState() {
  const finished = ui.statusInput.value === 'finished';
  ui.endDateInput.disabled = !finished;
  ui.endDateField.style.opacity = finished ? '1' : '0.6';
  if (!finished) ui.endDateInput.value = '';
}

function openCreateDialog() {
  resetForm();
  ui.dialog.showModal();
}

function openEditDialog(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  ui.dialogTitle.textContent = 'Editar lectura';
  ui.entryId.value = entry.id;
  ui.titleInput.value = entry.title || '';
  ui.descriptionInput.value = entry.description || '';
  ui.typeInput.value = entry.type || 'libro';
  ui.formatInput.value = entry.format || 'fisico';
  ui.statusInput.value = entry.status || 'reading';
  ui.startDateInput.value = entry.startDate || '';
  ui.endDateInput.value = entry.endDate || '';
  ui.deleteEntryBtn.classList.remove('hidden');
  syncEndDateState();
  ui.dialog.showModal();
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const id = ui.entryId.value || makeId();
  const existing = state.entries.find((entry) => entry.id === id);
  const status = ui.statusInput.value;
  const entry = {
    id,
    title: ui.titleInput.value.trim(),
    description: ui.descriptionInput.value.trim(),
    type: ui.typeInput.value,
    format: ui.formatInput.value,
    status,
    startDate: ui.startDateInput.value || '',
    endDate: status === 'finished' ? (ui.endDateInput.value || new Date().toISOString().slice(0, 10)) : '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (!entry.title) {
    showToast('El título es obligatorio.');
    return;
  }

  await saveEntry(entry);
  await refreshEntries();
  ui.dialog.close();
  showToast(existing ? 'Registro actualizado.' : 'Registro guardado.');
}

async function refreshEntries() {
  state.entries = await getAllEntries();
  renderAll();
}

function closeAllSwipes() {
  document.querySelectorAll('.entry-row').forEach((row) => {
    row.classList.remove('swiped-left', 'swiped-right');
  });
  state.openSwipeId = null;
}

function setSwipeState(id, direction) {
  closeAllSwipes();
  if (!id || !direction) return;
  const row = document.querySelector(`.entry-row[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.classList.add(direction === 'left' ? 'swiped-left' : 'swiped-right');
  state.openSwipeId = id;
}

async function handleCardAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  if (action === 'edit') {
    openEditDialog(id);
    return;
  }

  if (action === 'finish') {
    const updated = {
      ...entry,
      status: 'finished',
      endDate: entry.endDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    await saveEntry(updated);
    await refreshEntries();
    showToast('Pasó al historial.');
    return;
  }

  if (action === 'reopen') {
    const updated = {
      ...entry,
      status: 'reading',
      endDate: '',
      updatedAt: new Date().toISOString(),
    };
    await saveEntry(updated);
    await refreshEntries();
    showToast('Volvió a lecturas en curso.');
  }
}

function setupSwipe(container) {
  let startX = 0;
  let currentId = null;

  container.addEventListener('pointerdown', (event) => {
    const row = event.target.closest('.entry-row');
    if (!row || event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX;
    currentId = row.dataset.id;
  });

  container.addEventListener('pointerup', (event) => {
    if (!currentId) return;
    const deltaX = event.clientX - startX;
    if (deltaX > 44) {
      setSwipeState(currentId, 'right');
    } else if (deltaX < -44) {
      setSwipeState(currentId, 'left');
    } else if (Math.abs(deltaX) < 10 && state.openSwipeId === currentId) {
      closeAllSwipes();
    }
    currentId = null;
  });

  container.addEventListener('pointercancel', () => {
    currentId = null;
  });
}

async function handleDeleteFromDialog() {
  const id = ui.entryId.value;
  if (!id) return;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const confirmed = window.confirm(`¿Eliminar “${entry.title}”?`);
  if (!confirmed) return;
  await deleteEntry(id);
  ui.dialog.close();
  await refreshEntries();
  showToast('Registro eliminado.');
}

function exportJson() {
  const payload = {
    app: 'Registro de lectura',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registro-de-lectura-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Copia exportada.');
}

async function importJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(entries)) throw new Error('Formato inválido.');

  const ok = window.confirm(`Se importarán ${entries.length} registros y se reemplazará el contenido actual. ¿Continuar?`);
  if (!ok) return;

  await clearEntries();
  for (const raw of entries) {
    const entry = {
      id: raw.id || makeId(),
      title: String(raw.title || '').trim(),
      description: String(raw.description || '').trim(),
      type: ['libro', 'historieta', 'revista', 'apunte', 'otro'].includes(raw.type) ? raw.type : 'otro',
      format: raw.format === 'digital' ? 'digital' : 'fisico',
      status: raw.status === 'finished' ? 'finished' : 'reading',
      startDate: raw.startDate || '',
      endDate: raw.status === 'finished' ? (raw.endDate || '') : '',
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
    if (!entry.title) continue;
    await saveEntry(entry);
  }
  await refreshEntries();
  showToast('Importación lista.');
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (error) {
      console.warn('No se pudo registrar el service worker', error);
    }
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    ui.installBtn.classList.remove('hidden');
  });

  ui.installBtn.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    ui.installBtn.classList.add('hidden');
  });
}

function bindEvents() {
  document.querySelectorAll('.menu-item').forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
  });

  ui.menuBtn.addEventListener('click', () => {
    const expanded = ui.menuBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) closeMenu(); else openMenu();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu-wrap')) closeMenu();
    if (!event.target.closest('.entry-row-wrap')) closeAllSwipes();
  });

  ui.addBtn.addEventListener('click', openCreateDialog);
  ui.closeDialogBtn.addEventListener('click', () => ui.dialog.close());
  ui.form.addEventListener('submit', handleFormSubmit);
  ui.statusInput.addEventListener('change', syncEndDateState);
  ui.searchHistory.addEventListener('input', renderHistory);
  ui.historyTypeFilter.addEventListener('change', renderHistory);
  ui.historyFormatFilter.addEventListener('change', renderHistory);
  ui.currentList.addEventListener('click', handleCardAction);
  ui.historyList.addEventListener('click', handleCardAction);
  setupSwipe(ui.currentList);
  setupSwipe(ui.historyList);
  ui.deleteEntryBtn.addEventListener('click', handleDeleteFromDialog);
  ui.exportBtn.addEventListener('click', exportJson);
  ui.importInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      await importJson(file);
    } catch (error) {
      console.error(error);
      showToast('No se pudo importar el archivo.');
    } finally {
      ui.importInput.value = '';
    }
  });
  ui.clearBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Esto borra todos los registros guardados en este dispositivo.');
    if (!confirmed) return;
    await clearEntries();
    await refreshEntries();
    showToast('Registros borrados.');
  });
}

async function init() {
  bindEvents();
  setupInstallPrompt();
  syncEndDateState();
  await refreshEntries();
  await registerServiceWorker();
}

init();
