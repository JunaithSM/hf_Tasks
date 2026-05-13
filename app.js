// ═══════════════════════════════════════════════════════════════════════════
//  HF Task Manager — Application Logic (Firebase Firestore)
// ═══════════════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, writeBatch }
  from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ─── Firebase Init ─────────────────────────────────────────────────────────
const firebaseApp = initializeApp({
  apiKey: "AIzaSyB5dckKXsRoX1FbGpGq9SfZ_V1qjVdMVto",
  authDomain: "tasks-hf.firebaseapp.com",
  projectId: "tasks-hf",
  storageBucket: "tasks-hf.firebasestorage.app",
  messagingSenderId: "304147421803",
  appId: "1:304147421803:web:fc324335e93186fbbfaf2e",
  measurementId: "G-0EQYF4LY86"
});
const db = getFirestore(firebaseApp);
const TASKS_COL = 'tasks';

// ─── State ─────────────────────────────────────────────────────────────────
let APP_CONFIG = {};
let tasks = [];
let nextId = 1;
let statusFilter = null;
let assigneeFilter = null;
let collapsedCats = new Set();
let currentTab = 'tasks';
let currentUser = localStorage.getItem('hf_current_user') || '';
let sortState = { column: null, direction: 'asc' };

// ─── DOM Cache ─────────────────────────────────────────────────────────────
const DOM = {};
function cacheDom() {
  const ids = [
    'search-input', 'filter-category', 'filter-assignee', 'task-groups',
    'cnt-all', 'status-list', 'user-switcher',
    'assignee-list', 'assignee-datalist', 'category-datalist',
    'task-modal', 'modal-title', 'edit-id', 'edit-parent',
    'f-name', 'f-status', 'f-assigned', 'f-category', 'f-priority', 'f-desc', 'f-due',
    'detail-panel', 'detail-title', 'detail-badges', 'detail-body', 'toast',
    'dashboard-view', 'tasks-view', 'tab-dashboard', 'tab-tasks',
    'sidebar', 'sidebar-overlay', 'icon-moon', 'icon-sun'
  ];
  ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// ─── Default Config ────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  assigneeColors: { Junaith: '#5b6af0', Naveen: '#22c55e', Madhavan: '#f59e0b' },
  avatarColorPool: ['#5b6af0','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316'],
  categoryColors: ['#5b6af0','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#ef4444','#a855f7','#06b6d4','#84cc16'],
  defaultAssignee: 'Junaith', defaultStatus: 'Task', defaultPriority: 'Normal'
};

// ─── Local Cache Keys ──────────────────────────────────────────────────────
const CACHE_TASKS_KEY = 'hf_cached_tasks';
const CACHE_NEXTID_KEY = 'hf_cached_nextId';



// ─── Local Cache ───────────────────────────────────────────────────────────
function cacheToLocal() {
  try {
    localStorage.setItem(CACHE_TASKS_KEY, JSON.stringify(tasks));
    localStorage.setItem(CACHE_NEXTID_KEY, String(nextId));
  } catch (e) { console.warn('localStorage cache failed:', e); }
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_TASKS_KEY);
    if (!raw) return false;
    tasks = JSON.parse(raw);
    nextId = parseInt(localStorage.getItem(CACHE_NEXTID_KEY) || '1', 10);
    return tasks.length > 0;
  } catch (e) { return false; }
}

// ─── Loading / Offline UI ──────────────────────────────────────────────────
function showLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.add('show');
}
function hideLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.remove('show');
}
function showOfflineBanner() {
  const el = document.getElementById('offline-banner');
  if (el) el.classList.add('show');
}
function hideOfflineBanner() {
  const el = document.getElementById('offline-banner');
  if (el) el.classList.remove('show');
}

// ─── Firestore: Save all tasks (batch) ─────────────────────────────────────
async function save() {
  // Always cache locally first
  cacheToLocal();
  try {
    const batch = writeBatch(db);
    tasks.forEach(t => batch.set(doc(db, TASKS_COL, String(t.id)), t));
    batch.set(doc(db, TASKS_COL, '_meta'), { nextId });
    await batch.commit();
    hideOfflineBanner();
  } catch (e) {
    console.error('Firestore batch save failed:', e);
    showOfflineBanner();
  }
}

// ─── Firestore: Delete a task doc ──────────────────────────────────────────
async function deleteTaskFromDb(id) {
  try {
    await deleteDoc(doc(db, TASKS_COL, String(id)));
  } catch (e) { console.error('Firestore delete failed:', e); }
}

// ─── Load from Firestore → cache → empty ───────────────────────────────────
async function load() {
  APP_CONFIG = { ...DEFAULT_CONFIG };
  showLoading();

  try {
    const snapshot = await getDocs(collection(db, TASKS_COL));
    const docs = [];
    let metaDoc = null;
    snapshot.forEach(d => {
      if (d.id === '_meta') { metaDoc = d.data(); }
      else { docs.push(d.data()); }
    });

    if (docs.length > 0) {
      tasks = docs;
      nextId = metaDoc ? metaDoc.nextId : (Math.max(...tasks.map(t => t.id)) + 1);
      cacheToLocal();
      hideOfflineBanner();
      hideLoading();
      showToast(`Loaded ${tasks.length} tasks from cloud.`);
      return;
    }
  } catch (e) {
    console.warn('Firestore unavailable:', e);
  }

  // Firestore failed or empty — try local cache
  if (loadFromCache()) {
    hideLoading();
    showOfflineBanner();
    showToast(`Offline — showing ${tasks.length} cached tasks.`);
    return;
  }

  // No data anywhere
  tasks = [];
  nextId = 1;
  hideLoading();
  showOfflineBanner();
  showToast('No tasks found. Create one to get started!');
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getStatusKey(s) {
  return s.toLowerCase().replace(/ /g, '').replace('bugfixing', 'bugfix');
}

// ─── Status Icons (inline SVG) ─────────────────────────────────────────────
const STATUS_ICONS = {
  completed: '<svg viewBox="0 0 16 16" class="status-icon"><polyline points="3 8 6.5 11.5 13 5"/></svg>',
  progress:  '<svg viewBox="0 0 16 16" class="status-icon"><path d="M8 3v5l3 3"/><circle cx="8" cy="8" r="5.5" fill="none"/></svg>',
  task:      '<svg viewBox="0 0 16 16" class="status-icon"><circle cx="8" cy="8" r="5.5" fill="none"/></svg>',
  bugs:      '<svg viewBox="0 0 16 16" class="status-icon"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="2" y1="6" x2="5" y2="7"/><line x1="11" y1="7" x2="14" y2="6"/><line x1="2" y1="10" x2="5" y2="9"/><line x1="11" y1="9" x2="14" y2="10"/></svg>',
  bugfix:    '<svg viewBox="0 0 16 16" class="status-icon"><path d="M5.5 5.5L3 3M10.5 5.5L13 3"/><path d="M4 8h8M4 11h8"/><rect x="4" y="5" width="8" height="8" rx="2" fill="none"/></svg>',
  paused:    '<svg viewBox="0 0 16 16" class="status-icon"><rect x="4" y="3" width="2.5" height="10" rx="0.5"/><rect x="9.5" y="3" width="2.5" height="10" rx="0.5"/></svg>',
  planning:  '<svg viewBox="0 0 16 16" class="status-icon"><polygon points="8,2 9.5,6 14,6.5 10.5,9.5 11.5,14 8,11.5 4.5,14 5.5,9.5 2,6.5 6.5,6" fill="none"/></svg>',
  cancelled: '<svg viewBox="0 0 16 16" class="status-icon"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>',
};

function badgeHtml(status) {
  const key = getStatusKey(status);
  const icon = STATUS_ICONS[key] || STATUS_ICONS.task;
  return `<span class="badge badge-${key}">${icon}${status}</span>`;
}

function priorityDot(p) {
  const colors = { Critical: '#ef4444', High: '#f59e0b', Normal: 'var(--text-muted)', Low: 'var(--text-dim)' };
  return `<span style="color:${colors[p] || 'var(--text-muted)'}; font-size:14px; line-height:1;">●</span>`;
}

function avatarHtml(name) {
  const assigneeColors = APP_CONFIG.assigneeColors || {};
  const pool = APP_CONFIG.avatarColorPool || ['#5b6af0'];
  const c = assigneeColors[name] || pool[name.charCodeAt(0) % pool.length];
  const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="avatar" style="background:${c}22;color:${c};border:1px solid ${c}44">${initials}</span>`;
}

// ─── Multi-Assignee Helpers ────────────────────────────────────────────────
function taskAssignees(t) {
  if (!t.assigned) return [];
  return t.assigned.split(',').map(s => s.trim()).filter(Boolean);
}

function taskHasAssignee(t, name) {
  return taskAssignees(t).includes(name);
}

function getAssignees() {
  const set = new Set();
  tasks.forEach(t => taskAssignees(t).forEach(a => set.add(a)));
  return [...set];
}

function getCategories() {
  return [...new Set(tasks.map(t => t.category).filter(Boolean))];
}

function getRootTasks() {
  let roots = tasks.filter(t => !t.parentId);
  if (currentUser) roots = roots.filter(t => taskHasAssignee(t, currentUser));
  return roots;
}

function getSubtasks(parentId) {
  return tasks.filter(t => t.parentId === parentId);
}

// ─── Filtering ─────────────────────────────────────────────────────────────
function filteredTasks() {
  const search = DOM['search-input'].value.toLowerCase();
  const catF = DOM['filter-category'].value;
  const assF = DOM['filter-assignee'].value;

  return tasks.filter(t => {
    if (t.parentId) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (currentUser && !taskHasAssignee(t, currentUser)) return false;
    if (assigneeFilter && !taskHasAssignee(t, assigneeFilter)) return false;
    if (assF && !taskHasAssignee(t, assF)) return false;
    if (catF && t.category !== catF) return false;
    if (search && !t.name.toLowerCase().includes(search) && !(t.category || '').toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
}

// ─── View / Filter Setters ─────────────────────────────────────────────────


function setStatusFilter(s, el) {
  statusFilter = statusFilter === s ? null : s;
  document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
  if (statusFilter) el.classList.add('active');
  if (currentTab !== 'tasks') switchTab('tasks');
  renderAll();
}

function filterByAssignee(name, el) {
  assigneeFilter = assigneeFilter === name ? null : name;
  document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
  if (assigneeFilter) el.classList.add('active');
  if (currentTab !== 'tasks') switchTab('tasks');
  renderAll();
}

// ─── Render Pipeline ───────────────────────────────────────────────────────
function renderBreadcrumb() { /* placeholder for future breadcrumb UI */ }
function updateBulkBar() { /* placeholder for future bulk-action bar */ }

function renderAll() {
  updateCounts();
  updateFilters();
  renderBreadcrumb();
  renderGroups();
  updateBulkBar();
  if (currentTab === 'dashboard') renderDashboard();
}

function getStatuses() {
  return [...new Set(tasks.map(t => t.status).filter(Boolean))];
}

function updateCounts() {
  const roots = getRootTasks();
  DOM['cnt-all'].textContent = roots.length;

  // Dynamic status sidebar
  const statuses = getStatuses();
  DOM['status-list'].innerHTML = statuses.map(s => {
    const k = getStatusKey(s);
    const cnt = roots.filter(t => t.status === s).length;
    const active = statusFilter === s ? ' active' : '';
    return `<div class="sidebar-item${active}" onclick="setStatusFilter('${s}', this)">
      <span class="dot" style="background:var(--${k})"></span> ${s} <span class="count">${cnt}</span>
    </div>`;
  }).join('');

  // Assignee sidebar
  DOM['assignee-list'].innerHTML = getAssignees().map(a => {
    const active = assigneeFilter === a ? ' active' : '';
    return `<div class="sidebar-item${active}" onclick="filterByAssignee('${a}',this)">
      ${avatarHtml(a)} ${a} <span class="count">${roots.filter(t => taskHasAssignee(t, a)).length}</span>
    </div>`;
  }).join('');

  // User switcher
  const users = getAssignees();
  const sel = DOM['user-switcher'];
  const prev = sel.value || currentUser;
  sel.innerHTML = '<option value="">All Users</option>' + users.map(u =>
    `<option ${prev === u ? 'selected' : ''}>${u}</option>`
  ).join('');
  if (!currentUser && users.length > 0) {
    // Auto-select first user if none set
  }
}

function updateFilters() {
  const cats = getCategories();
  const asss = getAssignees();
  const catSel = DOM['filter-category'];
  const assSel = DOM['filter-assignee'];
  const cv = catSel.value, av = assSel.value;
  catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option ${cv === c ? 'selected' : ''}>${c}</option>`).join('');
  assSel.innerHTML = '<option value="">All Assignees</option>' + asss.map(a => `<option ${av === a ? 'selected' : ''}>${a}</option>`).join('');
  DOM['assignee-datalist'].innerHTML = getAssignees().map(a => `<option value="${a}">`).join('');
  DOM['category-datalist'].innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

// renderStats moved into renderDashboard

function renderGroups() {
  const ft = filteredTasks();
  const cats = [...new Set(ft.map(t => t.category || 'Uncategorized'))];
  const container = DOM['task-groups'];
  container.innerHTML = '';

  if (cats.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);font-family:JetBrains Mono,monospace;font-size:13px;">No tasks match filters.</div>';
    return;
  }

  const catColors = APP_CONFIG.categoryColors || ['#5b6af0'];

  cats.forEach((cat, ci) => {
    const catTasks = ft.filter(t => (t.category || 'Uncategorized') === cat);
    const done = catTasks.filter(t => t.status === 'Completed').length;
    const pct = catTasks.length ? Math.round(done / catTasks.length * 100) : 0;
    const color = catColors[ci % catColors.length];
    const isCollapsed = collapsedCats.has(cat);

    const sec = document.createElement('div');
    sec.className = 'category-section';
    sec.innerHTML = `
      <div class="category-header ${isCollapsed ? 'collapsed' : ''}" onclick="toggleCat('${cat.replace(/'/g, "\\'")}')">
        <span class="cat-dot" style="background:${color}"></span>
        <span class="cat-name">${cat}</span>
        <span class="cat-count">${catTasks.length}</span>
        <div class="cat-progress">
          <div class="mini-bar"><div class="mini-fill" style="width:${pct}%;background:${color}"></div></div>
          ${pct}%
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-left:8px;z-index:1" onclick="event.stopPropagation();openNewTaskModal('',\`${cat}\`)">+</button>
        <span class="cat-chevron ${isCollapsed ? '' : 'open'}">▶</span>
      </div>
      ${isCollapsed ? '' : buildTaskTable(catTasks)}
    `;
    container.appendChild(sec);
  });
}

function sortIcon(col) {
  if (sortState.column !== col) return '<span class="sort-icon">&#9650;</span>';
  return `<span class="sort-icon">${sortState.direction === 'asc' ? '&#9650;' : '&#9660;'}</span>`;
}

function sortTasks(col) {
  if (sortState.column === col) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = col;
    sortState.direction = 'asc';
  }
  renderGroups();
}

function applySorting(list) {
  if (!sortState.column) return list;
  const dir = sortState.direction === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let va = a[sortState.column] || '', vb = b[sortState.column] || '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return va < vb ? -dir : va > vb ? dir : 0;
  });
}

function buildTaskTable(catTasks) {
  if (catTasks.length === 0) return `<div class="empty-cat">No tasks in this category.</div>`;
  const sorted = applySorting(catTasks);
  let rows = '';
  sorted.forEach(t => {
    rows += taskRow(t, false);
    getSubtasks(t.id).forEach(s => rows += taskRow(s, true));
  });
  const th = (col, label, w) => {
    const cls = sortState.column === col ? 'sorted' : '';
    return `<th style="width:${w}" class="${cls}" onclick="sortTasks('${col}')">${label}${sortIcon(col)}</th>`;
  };
  return `<div class="task-table">
    <table>
      <thead><tr>
        ${th('name','Task','40%')}
        ${th('status','Status','12%')}
        ${th('assigned','Assigned','12%')}
        ${th('priority','Priority','8%')}
        ${th('due','Due','10%')}
        <th style="width:18%">Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function dueInfo(dateStr) {
  if (!dateStr) return { label: '—', cls: '' };
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  const diff = Math.round((due - now) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'due-overdue' };
  if (diff === 0) return { label: 'Today', cls: 'due-today' };
  if (diff <= 3) return { label: `${diff}d left`, cls: 'due-soon' };
  if (diff <= 7) return { label: `${diff}d left`, cls: 'due-week' };
  return { label: dateStr, cls: '' };
}

function highlightSearch(text) {
  const q = DOM['search-input'].value.trim();
  if (!q) return text;
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="search-hl">$1</mark>');
}

function taskRow(t, isSub) {
  const subs = getSubtasks(t.id);
  const subInfo = subs.length ? (() => {
    const done = subs.filter(s => s.status === 'Completed').length;
    return `<span class="subtask-progress">${done}/${subs.length} sub</span>`;
  })() : '';
  const due = dueInfo(t.due);
  return `<tr class="task-row" onclick="openDetail(${t.id})">
    <td class="${isSub ? 'task-indent' : ''}">
      <div class="task-name">
        ${isSub ? '<span class="subtask-icon">↳</span>' : ''}
        ${priorityDot(t.priority || 'Normal')}
        <span>${highlightSearch(t.name)}</span>${subInfo}
      </div>
    </td>
    <td>${badgeHtml(t.status)}</td>
    <td><div class="assignee-chip">${taskAssignees(t).map(a => avatarHtml(a)).join('')} ${t.assigned || '—'}</div></td>
    <td><span style="font-size:11px;color:var(--text-dim);font-family:JetBrains Mono,monospace">${t.priority || 'Normal'}</span></td>
    <td><span class="due-label ${due.cls}">${due.label}</span></td>
    <td onclick="event.stopPropagation()">
      <div class="task-actions">
        <button class="act-btn" onclick="openEditModal(${t.id})" title="Edit"><svg viewBox="0 0 16 16" class="act-icon"><path d="M11.5 2.5l2 2L5 13H3v-2z"/></svg></button>
        <button class="act-btn" onclick="duplicateTask(${t.id})" title="Duplicate"><svg viewBox="0 0 16 16" class="act-icon"><rect x="5" y="5" width="8" height="8" rx="1" fill="none"/><path d="M3 11V3h8" fill="none"/></svg></button>
        <button class="act-btn" onclick="openNewTaskModal(${t.id})" title="Add subtask"><svg viewBox="0 0 16 16" class="act-icon"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg></button>
        <button class="act-btn del" onclick="deleteTask(${t.id})" title="Delete"><svg viewBox="0 0 16 16" class="act-icon"><polyline points="3 5 4 14 12 14 13 5"/><line x1="2" y1="5" x2="14" y2="5"/><path d="M6 5V3h4v2"/></svg></button>
      </div>
    </td>
  </tr>`;
}

// ─── Category Collapse ─────────────────────────────────────────────────────
function toggleCat(cat) {
  if (collapsedCats.has(cat)) collapsedCats.delete(cat);
  else collapsedCats.add(cat);
  renderGroups();
}

function expandAll() { collapsedCats.clear(); renderGroups(); }

function collapseAll() {
  filteredTasks().forEach(t => collapsedCats.add(t.category || 'Uncategorized'));
  renderGroups();
}

// ─── Modal: New / Edit Task ────────────────────────────────────────────────
function populateStatusDropdown() {
  const sel = DOM['f-status'];
  const existing = getStatuses();
  const defaults = ['Task','Progress','Completed','Bugs','Bug Fixing','Paused','Planning','Cancelled'];
  const all = [...new Set([...defaults, ...existing])];
  sel.innerHTML = all.map(s => `<option>${s}</option>`).join('');
}

function openNewTaskModal(parentId = '', category = '') {
  populateStatusDropdown();
  DOM['modal-title'].textContent = parentId ? 'New Subtask' : 'New Task';
  DOM['edit-id'].value = '';
  DOM['edit-parent'].value = parentId;
  DOM['f-name'].value = '';
  DOM['f-status'].value = APP_CONFIG.defaultStatus || 'Task';
  DOM['f-assigned'].value = currentUser || APP_CONFIG.defaultAssignee || '';
  DOM['f-category'].value = category;
  DOM['f-priority'].value = APP_CONFIG.defaultPriority || 'Normal';
  DOM['f-desc'].value = '';
  DOM['f-due'].value = '';
  DOM['task-modal'].classList.add('open');
}

function openEditModal(id) {
  populateStatusDropdown();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  DOM['modal-title'].textContent = 'Edit Task';
  DOM['edit-id'].value = id;
  DOM['edit-parent'].value = t.parentId || '';
  DOM['f-name'].value = t.name;
  DOM['f-status'].value = t.status;
  DOM['f-assigned'].value = t.assigned;
  DOM['f-category'].value = t.category;
  DOM['f-priority'].value = t.priority || 'Normal';
  DOM['f-desc'].value = t.description || '';
  DOM['f-due'].value = t.due || '';
  DOM['task-modal'].classList.add('open');
}

function closeModal() {
  DOM['task-modal'].classList.remove('open');
}

function saveTask() {
  const name = DOM['f-name'].value.trim();
  if (!name) { showToast('Task name is required.'); return; }

  const editId = DOM['edit-id'].value;
  const parentId = DOM['edit-parent'].value ? parseInt(DOM['edit-parent'].value) : null;
  const data = {
    name,
    status: DOM['f-status'].value,
    assigned: DOM['f-assigned'].value,
    category: DOM['f-category'].value,
    priority: DOM['f-priority'].value,
    description: DOM['f-desc'].value,
    due: DOM['f-due'].value,
    parentId,
  };

  if (editId) {
    const idx = tasks.findIndex(t => t.id === parseInt(editId));
    if (idx >= 0) Object.assign(tasks[idx], data);
    showToast('Task updated.');
  } else {
    tasks.push({ id: nextId++, ...data, subtasks: [], createdAt: Date.now() });
    showToast('Task created.');
  }

  save();
  closeModal();
  renderAll();
}

// ─── Delete (with undo) ─────────────────────────────────────────────────────
let deleteTimeout = null;
async function deleteTask(id) {
  const deleted = tasks.filter(t => t.id === id || t.parentId === id);
  tasks = tasks.filter(t => t.id !== id && t.parentId !== id);
  renderAll();
  closeDetail();

  clearTimeout(deleteTimeout);
  DOM['toast'].innerHTML = `Task deleted. <button class="undo-btn" onclick="undoDelete()">Undo</button>`;
  DOM['toast'].classList.add('show');
  window._deletedTasks = deleted;

  deleteTimeout = setTimeout(async () => {
    DOM['toast'].classList.remove('show');
    for (const t of deleted) await deleteTaskFromDb(t.id);
    await save();
    window._deletedTasks = null;
  }, 5000);
}

function undoDelete() {
  if (!window._deletedTasks) return;
  clearTimeout(deleteTimeout);
  tasks.push(...window._deletedTasks);
  window._deletedTasks = null;
  DOM['toast'].classList.remove('show');
  renderAll();
  showToast('Task restored.');
}

// ─── Duplicate Task ─────────────────────────────────────────────────────────
function duplicateTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const dup = { ...t, id: nextId++, name: t.name + ' (copy)', createdAt: Date.now() };
  tasks.push(dup);
  save();
  renderAll();
  showToast('Task duplicated.');
}

// ─── Detail Panel ──────────────────────────────────────────────────────────
function openDetail(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  DOM['detail-title'].textContent = t.name;
  DOM['detail-badges'].innerHTML = badgeHtml(t.status) + ' ' +
    (t.priority !== 'Normal' ? `<span class="badge" style="background:rgba(245,158,11,0.1);color:#f59e0b">${t.priority}</span>` : '');

  const subs = getSubtasks(t.id);
  const escapedCat = (t.category || '').replace(/'/g, "\\'");

  DOM['detail-body'].innerHTML = `
    <div class="detail-section">
      <div class="detail-key">Assigned To</div>
      <div class="detail-val" style="display:flex;align-items:center;gap:8px">${avatarHtml(t.assigned || '?')} ${t.assigned || '—'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-key">Category</div>
      <div class="detail-val">${t.category || '—'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-key">Due Date</div>
      <div class="detail-val" style="font-family:JetBrains Mono,monospace;font-size:12px">${t.due || 'Not set'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-key">Description</div>
      <div class="desc-box">${t.description || '<span style="color:var(--text-muted)">No description.</span>'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-key" style="margin-bottom:10px">Subtasks (${subs.length})
        <button class="act-btn" style="margin-left:8px" onclick="openNewTaskModal(${t.id},'${escapedCat}')">+ Add</button>
      </div>
      <div class="subtask-list">
        ${subs.length ? subs.map(s => `
          <div class="subtask-item">
            ${avatarHtml(s.assigned || '?')}
            <span style="flex:1;font-size:12px">${s.name}</span>
            ${badgeHtml(s.status)}
            <button class="act-btn" onclick="openEditModal(${s.id})">Edit</button>
            <button class="act-btn del" onclick="deleteTask(${s.id})">✕</button>
          </div>
        `).join('') : '<div style="color:var(--text-muted);font-size:12px;font-family:JetBrains Mono,monospace">No subtasks.</div>'}
      </div>
    </div>
    <div style="margin-top:20px;display:flex;gap:10px">
      <button class="btn btn-primary btn-sm" onclick="openEditModal(${t.id})">Edit Task</button>
      <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">Delete</button>
    </div>
  `;

  DOM['detail-panel'].classList.add('open');
  document.querySelector('.main').style.marginRight = '380px';
}

function closeDetail() {
  DOM['detail-panel'].classList.remove('open');
  document.querySelector('.main').style.marginRight = '';
}

// ─── Export ────────────────────────────────────────────────────────────────
function exportData() {
  const roots = getRootTasks();
  let csv = 'Task,Assigned,Status,Category,Priority,Due,Description\n';
  roots.forEach(t => {
    csv += `"${t.name}","${t.assigned}","${t.status}","${t.category}","${t.priority || 'Normal'}","${t.due || ''}","${(t.description || '').replace(/"/g, "'")}"\n`;
    getSubtasks(t.id).forEach(s => {
      csv += `"  ↳ ${s.name}","${s.assigned}","${s.status}","${t.category}","${s.priority || 'Normal'}","${s.due || ''}","${(s.description || '').replace(/"/g, "'")}"\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hf_tasks.csv';
  a.click();
  showToast('Exported as CSV.');
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg) {
  DOM['toast'].textContent = msg;
  DOM['toast'].classList.add('show');
  setTimeout(() => DOM['toast'].classList.remove('show'), 2500);
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  DOM['icon-moon'].style.display = isDark ? 'none' : '';
  DOM['icon-sun'].style.display = isDark ? '' : 'none';
  localStorage.setItem('hf_theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
  const saved = localStorage.getItem('hf_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    if (saved === 'light') {
      DOM['icon-moon'].style.display = 'none';
      DOM['icon-sun'].style.display = '';
    }
  }
}

// ─── Mobile Sidebar ────────────────────────────────────────────────────────
function toggleSidebar() {
  DOM['sidebar'].classList.toggle('open');
  DOM['sidebar-overlay'].classList.toggle('open');
}

// ─── Tab Switch ────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  DOM['tab-dashboard'].classList.toggle('active', tab === 'dashboard');
  DOM['tab-tasks'].classList.toggle('active', tab === 'tasks');
  DOM['dashboard-view'].classList.toggle('active', tab === 'dashboard');
  DOM['tasks-view'].classList.toggle('hidden', tab === 'dashboard');
  // Close mobile sidebar on tab switch
  DOM['sidebar'].classList.remove('open');
  DOM['sidebar-overlay'].classList.remove('open');
  if (tab === 'dashboard') renderDashboard();
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const roots = getRootTasks();
  const total = roots.length;
  const done = roots.filter(t => t.status === 'Completed').length;
  const pct = total ? Math.round(done / total * 100) : 0;

  // Progress bar
  let html = `<div class="progress-section"><div><div class="pct">${pct}%</div><div class="pct-label">Completed</div></div>
    <div class="full-bar"><div class="full-fill" style="width:${pct}%"></div></div></div>`;

  // Dynamic overview cards from data
  const statuses = getStatuses();
  html += `<div class="dash-grid">
    <div class="dash-card"><div class="dash-card-label">Total Tasks</div><div class="dash-card-value" style="color:var(--text)">${total}</div></div>`;
  statuses.forEach(s => {
    const cnt = roots.filter(t => t.status === s).length;
    const k = getStatusKey(s);
    html += `<div class="dash-card"><div class="dash-card-label">${s}</div><div class="dash-card-value" style="color:var(--${k})">${cnt}</div></div>`;
  });
  html += `</div>`;

  // Category breakdown
  const cats = getCategories();
  const catColors = APP_CONFIG.categoryColors || ['#5b6af0'];
  html += `<div class="dash-section"><div class="dash-section-title">Category Progress</div>`;
  cats.forEach((cat, i) => {
    const ct = roots.filter(t => t.category === cat);
    const cd = ct.filter(t => t.status === 'Completed').length;
    const cp = ct.length ? Math.round(cd / ct.length * 100) : 0;
    const color = catColors[i % catColors.length];
    html += `<div class="dash-bar-row">
      <div class="dash-bar-label">${cat} (${cd}/${ct.length})</div>
      <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${cp}%;background:${color}"></div></div>
      <div class="dash-bar-pct">${cp}%</div>
    </div>`;
  });
  html += `</div>`;

  // Assignee workload
  html += `<div class="dash-section"><div class="dash-section-title">Team Workload</div><div class="dash-workload-grid">`;
  getAssignees().forEach(a => {
    const at = roots.filter(t => taskHasAssignee(t, a));
    const ad = at.filter(t => t.status === 'Completed').length;
    html += `<div class="dash-workload-card">
      <div class="dash-workload-name">${avatarHtml(a)} ${a}</div>
      <div class="dash-workload-stats">
        <span class="badge badge-completed">${ad} done</span>
        <span class="badge badge-progress">${at.filter(t=>t.status==='Progress').length} wip</span>
        <span class="badge badge-task">${at.filter(t=>t.status==='Task').length} todo</span>
        <span class="badge badge-bugs">${at.filter(t=>t.status==='Bugs').length} bugs</span>
      </div>
    </div>`;
  });
  html += `</div></div>`;

  // Recent activity (last 10 by createdAt)
  const recent = [...roots].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
  html += `<div class="dash-section"><div class="dash-section-title">Recent Tasks</div><div class="dash-activity">`;
  recent.forEach(t => {
    html += `<div class="dash-activity-item" onclick="switchTab('tasks');openDetail(${t.id})" style="cursor:pointer">
      ${avatarHtml(t.assigned || '?')}
      <span style="flex:1">${t.name}</span>
      ${badgeHtml(t.status)}
      <span style="font-size:10px;color:var(--text-muted);font-family:JetBrains Mono,monospace">${t.category || ''}</span>
    </div>`;
  });
  html += `</div></div>`;

  DOM['dashboard-view'].innerHTML = html;
}

// ─── User Switcher ─────────────────────────────────────────────────────────
function switchUser(name) {
  currentUser = name;
  localStorage.setItem('hf_current_user', name);
  renderAll();
  showToast(name ? `Switched to ${name}` : 'Viewing all users');
}

// ─── Expose to window (required for type="module" onclick handlers) ────────
Object.assign(window, {
  setStatusFilter, filterByAssignee, renderAll,
  expandAll, collapseAll, toggleCat, sortTasks,
  openNewTaskModal, openEditModal, closeModal, saveTask,
  deleteTask, undoDelete, duplicateTask,
  openDetail, closeDetail, exportData,
  toggleTheme, toggleSidebar, switchTab, switchUser
});

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  loadTheme();

  DOM['task-modal'].addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Skip if user is typing in an input/textarea/select
    const tag = document.activeElement.tagName;
    if (['INPUT','TEXTAREA','SELECT'].includes(tag)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    switch(e.key) {
      case 'n': case 'N': e.preventDefault(); openNewTaskModal(); break;
      case 'Escape': closeModal(); closeDetail(); break;
      case '/': e.preventDefault(); DOM['search-input'].focus(); break;
      case 'd': case 'D': e.preventDefault(); switchTab(currentTab === 'dashboard' ? 'tasks' : 'dashboard'); break;
      case 't': e.preventDefault(); toggleTheme(); break;
    }
  });

  await load();
  renderAll();
});
