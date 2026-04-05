const DB_NAME = 'registro-lectura-db';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

const state = {
  entries: [],
  activeTab: 'current',
  installPrompt: null,
};

const ui = {
  statReading: document.getElementById('statReading'),
  statFinished: document.getElementById('statFinished'),
  statThisMonth: document.getElementById('statThisMonth'),
  monthlyNote: document.getElementById('monthlyNote'),
  currentList: document.getElementById('currentList'),
  currentEmpty: document.getElementById('currentEmpty'),
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  historyMeta: document.getElementById('historyMeta'),
  historyMonthSummary: document.getElementById('historyMonthSummary'),
  searchCurrent: document.getElementById('searchCurrent'),
  searchHistory: document.getElementById('searchHistory'),
  historyTypeFilter: document.getElementById('historyTypeFilter'),
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
  cancelBtn: document.getElementById('cancelBtn'),
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

function entryMatches(entry, searchText, typeFilter = 'all') {
  const query = normalized(searchText);
  const haystack = normalized(`${entry.title} ${entry.description} ${entry.type} ${entry.format}`);
  const typeOk = typeFilter === 'all' || entry.type === typeFilter;
  const queryOk = !query || haystack.includes(query);
  return typeOk && queryOk;
}

function renderSummary() {
  const reading = state.entries.filter((entry) => entry.status === 'reading');
  const finished = state.entries.filter((entry) => entry.status === 'finished');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const finishedThisMonth = finished.filter((entry) => monthKey(entry.endDate) === currentMonth);

  ui.statReading.textContent = String(reading.length);
  ui.statFinished.textContent = String(finished.length);
  ui.statThisMonth.textContent = String(finishedThisMonth.length);

  if (!finished.length) {
    ui.monthlyNote.textContent = 'Todavía no hay cierres de lectura.';
    return;
  }

  const monthlyMap = new Map();
  finished.forEach((entry) => {
    const key = monthKey(entry.endDate);
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  });

  const latestRealMonth = [...monthlyMap.keys()].filter((key) => key !== 'Sin fecha').sort().pop();
  if (!latestRealMonth) {
    ui.monthlyNote.textContent = 'Hay lecturas terminadas sin fecha de cierre.';
    return;
  }

  const latestCount = monthlyMap.get(latestRealMonth);
  ui.monthlyNote.textContent = `${monthLabel(latestRealMonth)}: ${latestCount} ${latestCount === 1 ? 'lectura terminada' : 'lecturas terminadas'}.`;
}

function renderCurrent() {
  const query = ui.searchCurrent.value;
  const entries = sortEntries(state.entries)
    .filter((entry) => entry.status === 'reading')
    .filter((entry) => entryMatches(entry, query));

  ui.currentList.innerHTML = '';
  ui.currentEmpty.classList.toggle('hidden', entries.length > 0);

  entries.forEach((entry) => {
    const article = document.createElement('article');
    article.className = 'reading-card';
    article.innerHTML = `
      <div class="card-topline">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="badge status">Leyendo</span>
      </div>
      <div class="card-badges">
        <span class="badge">${labelType(entry.type)}</span>
        <span class="badge">${labelFormat(entry.format)}</span>
        <span class="badge">Inicio: ${formatDate(entry.startDate)}</span>
      </div>
      ${entry.description ? `<p class="card-description">${escapeHtml(entry.description)}</p>` : ''}
      <div class="card-actions">
        <button class="secondary-button" data-action="finish" data-id="${entry.id}" type="button">Marcar terminado</button>
        <button class="secondary-button" data-action="edit" data-id="${entry.id}" type="button">Editar</button>
        <button class="text-button" data-action="delete" data-id="${entry.id}" type="button">Borrar</button>
      </div>
    `;
    ui.currentList.appendChild(article);
  });
}

function renderHistory() {
  const query = ui.searchHistory.value;
  const typeFilter = ui.historyTypeFilter.value;
  const entries = sortEntries(state.entries)
    .filter((entry) => entry.status === 'finished')
    .filter((entry) => entryMatches(entry, query, typeFilter))
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
      const chip = document.createElement('div');
      chip.className = 'history-month-chip';
      chip.innerHTML = `<span class="muted small">${capitalize(monthLabel(key))}</span><strong>${count}</strong>`;
      ui.historyMonthSummary.appendChild(chip);
    });

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
        const article = document.createElement('article');
        article.className = 'history-card';
        article.innerHTML = `
          <div class="card-topline">
            <h3>${escapeHtml(entry.title)}</h3>
            <span class="badge status">Terminado</span>
          </div>
          <div class="card-badges">
            <span class="badge">${labelType(entry.type)}</span>
            <span class="badge">${labelFormat(entry.format)}</span>
          </div>
          <p class="history-meta muted small">Inicio: ${formatDate(entry.startDate)} · Fin: ${formatDate(entry.endDate)}</p>
          ${entry.description ? `<p class="card-description">${escapeHtml(entry.description)}</p>` : ''}
          <div class="card-actions">
            <button class="secondary-button" data-action="reopen" data-id="${entry.id}" type="button">Volver a leyendo</button>
            <button class="secondary-button" data-action="edit" data-id="${entry.id}" type="button">Editar</button>
            <button class="text-button" data-action="delete" data-id="${entry.id}" type="button">Borrar</button>
          </div>
        `;
        section.appendChild(article);
      });

      ui.historyList.appendChild(section);
    });
}

function renderAll() {
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
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function resetForm() {
  ui.form.reset();
  ui.entryId.value = '';
  ui.statusInput.value = 'reading';
  ui.endDateInput.value = '';
  ui.dialogTitle.textContent = 'Nueva lectura';
  syncEndDateState();
}

function syncEndDateState() {
  const finished = ui.statusInput.value === 'finished';
  ui.endDateInput.disabled = !finished;
  ui.endDateInput.closest('.field').style.opacity = finished ? '1' : '0.65';
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
    showToast('El nombre es obligatorio.');
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

  if (action === 'delete') {
    const confirmed = window.confirm(`¿Borrar “${entry.title}”?`);
    if (!confirmed) return;
    await deleteEntry(id);
    await refreshEntries();
    showToast('Registro borrado.');
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
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
  });

  ui.addBtn.addEventListener('click', openCreateDialog);
  ui.cancelBtn.addEventListener('click', () => ui.dialog.close());
  ui.closeDialogBtn.addEventListener('click', () => ui.dialog.close());
  ui.form.addEventListener('submit', handleFormSubmit);
  ui.statusInput.addEventListener('change', syncEndDateState);
  ui.searchCurrent.addEventListener('input', renderCurrent);
  ui.searchHistory.addEventListener('input', renderHistory);
  ui.historyTypeFilter.addEventListener('change', renderHistory);
  ui.currentList.addEventListener('click', handleCardAction);
  ui.historyList.addEventListener('click', handleCardAction);
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
