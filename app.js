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
let currentView = 'all';
let statusFilter = null;
let assigneeFilter = null;
let collapsedCats = new Set();

// ─── DOM Cache ─────────────────────────────────────────────────────────────
const DOM = {};
function cacheDom() {
  const ids = [
    'search-input', 'filter-category', 'filter-assignee', 'task-groups',
    'stats-bar', 'pct-num', 'full-fill', 'cnt-all', 'cnt-mine',
    'assignee-list', 'assignee-datalist', 'category-datalist',
    'task-modal', 'modal-title', 'edit-id', 'edit-parent',
    'f-name', 'f-status', 'f-assigned', 'f-category', 'f-priority', 'f-desc', 'f-due',
    'detail-panel', 'detail-title', 'detail-badges', 'detail-body', 'toast'
  ];
  ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// ─── Fallback Config (used when tasks.json can't be fetched, e.g. file://) ─
const FALLBACK_CONFIG = {
  assigneeColors: { Junaith: '#5b6af0', Naveen: '#22c55e', Madhavan: '#f59e0b' },
  avatarColorPool: ['#5b6af0','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316'],
  categoryColors: ['#5b6af0','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#ef4444','#a855f7','#06b6d4','#84cc16'],
  defaultAssignee: 'Junaith', defaultStatus: 'Task', defaultPriority: 'Normal'
};

// ─── Fallback Seed Data (mirrors tasks.json for offline/file:// use) ───────
const FALLBACK_SEED = [
  { id:1,  name:'Item In Hand',                      assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:2,  name:'Item Throw',                        assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:3,  name:'Item Drop',                         assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:4,  name:'Item Pickup',                       assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:5,  name:'Item 3D Inspect',                   assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:6,  name:'Item Image Inspect',                assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:7,  name:'Item Look Inspect',                 assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:8,  name:'Item Drop Rotate',                  assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:9,  name:'Item Place',                        assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:10, name:'Item Placable Volume',              assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:11, name:'Item Opening and Closing',          assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:12, name:'Item Look Reading',                 assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:13, name:'Player Chair Sitting and Standing', assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:14, name:'Table Drawer Inventory Setup',      assigned:'Junaith', status:'Completed', category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:15, name:'Main Door Interaction',             assigned:'Junaith', status:'Progress',  category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:16, name:'Main Door Hole View',               assigned:'Junaith', status:'Task',      category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:17, name:'Ladder Climb Up and Down',          assigned:'Junaith', status:'Task',      category:'Interaction Object', priority:'Normal', description:'', due:'', parentId:null },
  { id:18, name:'In Hand Inventory Widgets',         assigned:'Junaith', status:'Completed', category:'Inventory System',   priority:'Normal', description:'', due:'', parentId:null },
  { id:19, name:'In Hand Inventory Item Select',     assigned:'Junaith', status:'Completed', category:'Inventory System',   priority:'Normal', description:'', due:'', parentId:null },
  { id:20, name:'Inventory Widgets',                 assigned:'Junaith', status:'Completed', category:'Inventory System',   priority:'Normal', description:'', due:'', parentId:null },
  { id:21, name:'Inventory Item Select',             assigned:'Junaith', status:'Completed', category:'Inventory System',   priority:'Normal', description:'', due:'', parentId:null },
  { id:22, name:'In Hand Item and Inventory Item Swap', assigned:'Junaith', status:'Completed', category:'Inventory System', priority:'Normal', description:'', due:'', parentId:null },
  { id:23, name:'Jump Effects',                      assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:24, name:'Sprint Effects',                    assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:25, name:'Stamina Widget',                    assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:26, name:'Stamina Attribute',                 assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:27, name:'Crouch Effect',                     assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:28, name:'Focus Effect',                      assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:29, name:'Player Blob Effect',                assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:30, name:'Foot Step Sound',                   assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:31, name:'Item Interaction Sound',            assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:32, name:'Player Inspect Sway',               assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:33, name:'Player Action Effect',              assigned:'Junaith', status:'Completed', category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:34, name:'Sliping',                           assigned:'Junaith', status:'Paused',    category:'Player',             priority:'Normal', description:'', due:'', parentId:null },
  { id:35, name:'Interaction Input Widget',          assigned:'Junaith', status:'Completed', category:'Widgets',            priority:'Normal', description:'', due:'', parentId:null },
  { id:36, name:'Inspect Widget',                    assigned:'Junaith', status:'Completed', category:'Widgets',            priority:'Normal', description:'', due:'', parentId:null },
  { id:37, name:'Item Throw Widget',                 assigned:'Junaith', status:'Completed', category:'Widgets',            priority:'Normal', description:'', due:'', parentId:null },
  { id:38, name:'Mission Widgets',                   assigned:'Junaith', status:'Completed', category:'Widgets',            priority:'Normal', description:'', due:'', parentId:null },
  { id:39, name:'Day SetUp Editor Widget',           assigned:'Junaith', status:'Completed', category:'Widgets',            priority:'Normal', description:'', due:'', parentId:null },
  { id:40, name:'CCTV Camera',                       assigned:'Junaith', status:'Completed', category:'CCTV',               priority:'Normal', description:'', due:'', parentId:null },
  { id:41, name:'Changing CCTV Camera',              assigned:'Junaith', status:'Completed', category:'CCTV',               priority:'Normal', description:'', due:'', parentId:null },
  { id:42, name:'CCTV Camera Rotate',                assigned:'Junaith', status:'Paused',    category:'CCTV',               priority:'Normal', description:'', due:'', parentId:null },
  { id:43, name:'CCTV Placeable Volume',             assigned:'Junaith', status:'Completed', category:'CCTV',               priority:'Normal', description:'', due:'', parentId:null },
  { id:44, name:'Changing Channels',                 assigned:'Junaith', status:'Task',      category:'TV',                 priority:'Normal', description:'', due:'', parentId:null },
  { id:45, name:'TV PowerCut',                       assigned:'Junaith', status:'Planning',  category:'TV',                 priority:'Normal', description:'', due:'', parentId:null },
  { id:46, name:'TV Remote Interaction',             assigned:'Junaith', status:'Task',      category:'TV',                 priority:'Normal', description:'', due:'', parentId:null },
  { id:47, name:'Computer Password Widgets and Sound', assigned:'Junaith', status:'Completed', category:'Computer',         priority:'Normal', description:'', due:'', parentId:null },
  { id:48, name:'Computer Mouse Move',               assigned:'Junaith', status:'Completed', category:'Computer',           priority:'Normal', description:'', due:'', parentId:null },
  { id:49, name:'Computer Setup',                    assigned:'Junaith', status:'Completed', category:'Computer',           priority:'Normal', description:'', due:'', parentId:null },
  { id:50, name:'Day Start',                         assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:51, name:'Alarm UI Interaction Widget',       assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:52, name:'Player Wake Up',                    assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:53, name:'Day 1 Manager Setup',               assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:54, name:'Alarm Mission',                     assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:55, name:'Post Letter Mission',               assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:56, name:'Alarm Ring',                        assigned:'Junaith', status:'Completed', category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:57, name:'Player Sleep',                      assigned:'Junaith', status:'Task',      category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:58, name:'Day 1 Cutscenes Based On State',    assigned:'Junaith', status:'Task',      category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:59, name:'Day States',                        assigned:'Junaith', status:'Task',      category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:60, name:'World Day and Night',               assigned:'Junaith', status:'Task',      category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:61, name:'Day 1 Interaction Item',            assigned:'Junaith', status:'Planning',  category:'Day 1',              priority:'Normal', description:'', due:'', parentId:null },
  { id:62, name:'Window Interaction',                assigned:'Junaith', status:'Task',      category:'Window',             priority:'Normal', description:'', due:'', parentId:null },
  { id:63, name:'Window Escape',                     assigned:'Junaith', status:'Task',      category:'Window',             priority:'Normal', description:'', due:'', parentId:null },
  { id:64, name:'Money System',                      assigned:'Junaith', status:'Planning',  category:'Gameplay Systems',   priority:'Normal', description:'', due:'', parentId:null },
  { id:65, name:'Radio System',                      assigned:'Junaith', status:'Planning',  category:'Gameplay Systems',   priority:'Normal', description:'', due:'', parentId:null },
  { id:66, name:'Player Get Ready',                  assigned:'Junaith', status:'Planning',  category:'Gameplay Systems',   priority:'Normal', description:'', due:'', parentId:null },
  { id:67, name:'Mini Game',                         assigned:'Junaith', status:'Planning',  category:'Gameplay Systems',   priority:'Normal', description:'', due:'', parentId:null },
];

// ─── Firestore: Save single task ───────────────────────────────────────────
async function saveTaskToDb(task) {
  try {
    await setDoc(doc(db, TASKS_COL, String(task.id)), task);
  } catch (e) { console.error('Firestore save failed:', e); }
}

// ─── Firestore: Save all tasks (batch) ─────────────────────────────────────
async function save() {
  try {
    const batch = writeBatch(db);
    tasks.forEach(t => batch.set(doc(db, TASKS_COL, String(t.id)), t));
    // Store nextId in a meta document
    batch.set(doc(db, TASKS_COL, '_meta'), { nextId });
    await batch.commit();
  } catch (e) { console.error('Firestore batch save failed:', e); }
}

// ─── Firestore: Delete a task doc ──────────────────────────────────────────
async function deleteTaskFromDb(id) {
  try {
    await deleteDoc(doc(db, TASKS_COL, String(id)));
  } catch (e) { console.error('Firestore delete failed:', e); }
}

// ─── Load from Firestore or seed ───────────────────────────────────────────
async function load() {
  APP_CONFIG = { ...FALLBACK_CONFIG };
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
      showToast(`Loaded ${tasks.length} tasks from cloud.`);
      return;
    }
  } catch (e) {
    console.warn('Firestore read failed, using seed data.', e);
  }

  // No Firestore data — seed from embedded data and upload
  tasks = FALLBACK_SEED.map((t, i) => ({
    ...t, subtasks: t.subtasks || [],
    createdAt: t.createdAt || Date.now() - (FALLBACK_SEED.length - i) * 3600000
  }));
  nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
  await save();
  showToast('Seed data uploaded to cloud.');
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getStatusKey(s) {
  return s.toLowerCase().replace(/ /g, '').replace('bugfixing', 'bugfix');
}

function badgeHtml(status) {
  return `<span class="badge badge-${getStatusKey(status)}">${status}</span>`;
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

function getAssignees() {
  return [...new Set(tasks.map(t => t.assigned).filter(Boolean))];
}

function getCategories() {
  return [...new Set(tasks.map(t => t.category).filter(Boolean))];
}

function getRootTasks() {
  return tasks.filter(t => !t.parentId);
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
    if (currentView === 'mine' && t.assigned !== (APP_CONFIG.defaultAssignee || 'Junaith')) return false;
    if (assigneeFilter && t.assigned !== assigneeFilter) return false;
    if (assF && t.assigned !== assF) return false;
    if (catF && t.category !== catF) return false;
    if (search && !t.name.toLowerCase().includes(search) && !(t.category || '').toLowerCase().includes(search)) return false;
    return true;
  });
}

// ─── View / Filter Setters ─────────────────────────────────────────────────
function setView(v, el) {
  currentView = v; statusFilter = null; assigneeFilter = null;
  document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  renderAll();
}

function setStatusFilter(s, el) {
  statusFilter = statusFilter === s ? null : s;
  document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
  if (statusFilter) el.classList.add('active');
  renderAll();
}

function filterByAssignee(name, el) {
  assigneeFilter = assigneeFilter === name ? null : name;
  document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
  if (assigneeFilter) el.classList.add('active');
  renderAll();
}

// ─── Render Pipeline ───────────────────────────────────────────────────────
function renderAll() {
  updateCounts();
  updateFilters();
  renderGroups();
  renderStats();
}

function updateCounts() {
  const roots = getRootTasks();
  DOM['cnt-all'].textContent = roots.length;
  DOM['cnt-mine'].textContent = roots.filter(t => t.assigned === (APP_CONFIG.defaultAssignee || 'Junaith')).length;

  ['completed', 'task', 'progress', 'bugs', 'planning', 'paused'].forEach(s => {
    const el = document.getElementById('cnt-' + s);
    if (el) el.textContent = roots.filter(t => getStatusKey(t.status) === s).length;
  });

  // Assignee sidebar
  DOM['assignee-list'].innerHTML = getAssignees().map(a => {
    const active = assigneeFilter === a ? 'background:var(--surface3)' : '';
    return `<div class="sidebar-item" onclick="filterByAssignee('${a}',this)" style="${active}">
      ${avatarHtml(a)} ${a} <span class="count">${roots.filter(t => t.assigned === a).length}</span>
    </div>`;
  }).join('');
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

function renderStats() {
  const roots = getRootTasks();
  const total = roots.length;
  const done = roots.filter(t => t.status === 'Completed').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  DOM['pct-num'].textContent = pct + '%';
  DOM['full-fill'].style.width = pct + '%';

  const statusList = ['Completed', 'Task', 'Progress', 'Bugs', 'Paused', 'Planning'];
  DOM['stats-bar'].innerHTML = statusList.map(s => {
    const cnt = roots.filter(t => t.status === s).length;
    const k = getStatusKey(s);
    return `<div class="stat-card">
      <div>
        <div class="stat-num" style="color:var(--${k})">${cnt}</div>
        <div class="stat-label">${s}</div>
      </div>
    </div>`;
  }).join('');
}

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

function buildTaskTable(catTasks) {
  if (catTasks.length === 0) return `<div class="empty-cat">No tasks in this category.</div>`;
  let rows = '';
  catTasks.forEach(t => {
    rows += taskRow(t, false);
    getSubtasks(t.id).forEach(s => rows += taskRow(s, true));
  });
  return `<div class="task-table">
    <table>
      <thead><tr>
        <th style="width:40%">Task</th>
        <th style="width:12%">Status</th>
        <th style="width:12%">Assigned</th>
        <th style="width:8%">Priority</th>
        <th style="width:10%">Due</th>
        <th style="width:18%">Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function taskRow(t, isSub) {
  const subs = getSubtasks(t.id);
  const subCnt = subs.length ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;font-family:JetBrains Mono,monospace;">[${subs.length} sub]</span>` : '';
  return `<tr class="task-row" onclick="openDetail(${t.id})">
    <td class="${isSub ? 'task-indent' : ''}">
      <div class="task-name">
        ${isSub ? '<span class="subtask-icon">↳</span>' : ''}
        ${priorityDot(t.priority || 'Normal')}
        <span>${t.name}</span>${subCnt}
      </div>
    </td>
    <td>${badgeHtml(t.status)}</td>
    <td><div class="assignee-chip">${avatarHtml(t.assigned || '?')} ${t.assigned || '—'}</div></td>
    <td><span style="font-size:11px;color:var(--text-dim);font-family:JetBrains Mono,monospace">${t.priority || 'Normal'}</span></td>
    <td><span style="font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text-muted)">${t.due || '—'}</span></td>
    <td onclick="event.stopPropagation()">
      <div class="task-actions">
        <button class="act-btn" onclick="openEditModal(${t.id})">Edit</button>
        <button class="act-btn" onclick="openNewTaskModal(${t.id})">+ Sub</button>
        <button class="act-btn del" onclick="deleteTask(${t.id})">Del</button>
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
function openNewTaskModal(parentId = '', category = '') {
  DOM['modal-title'].textContent = parentId ? 'New Subtask' : 'New Task';
  DOM['edit-id'].value = '';
  DOM['edit-parent'].value = parentId;
  DOM['f-name'].value = '';
  DOM['f-status'].value = APP_CONFIG.defaultStatus || 'Task';
  DOM['f-assigned'].value = APP_CONFIG.defaultAssignee || 'Junaith';
  DOM['f-category'].value = category;
  DOM['f-priority'].value = APP_CONFIG.defaultPriority || 'Normal';
  DOM['f-desc'].value = '';
  DOM['f-due'].value = '';
  DOM['task-modal'].classList.add('open');
}

function openEditModal(id) {
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

// ─── Delete ────────────────────────────────────────────────────────────────
async function deleteTask(id) {
  if (!confirm('Delete this task and all its subtasks?')) return;
  const subtaskIds = tasks.filter(t => t.parentId === id).map(t => t.id);
  tasks = tasks.filter(t => t.id !== id && t.parentId !== id);
  // Delete from Firestore
  await deleteTaskFromDb(id);
  for (const sid of subtaskIds) await deleteTaskFromDb(sid);
  await save();
  showToast('Task deleted.');
  closeDetail();
  renderAll();
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

// ─── Expose to window (required for type="module" onclick handlers) ────────
Object.assign(window, {
  setView, setStatusFilter, filterByAssignee, renderAll,
  expandAll, collapseAll, toggleCat,
  openNewTaskModal, openEditModal, closeModal, saveTask,
  deleteTask, openDetail, closeDetail, exportData
});

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();

  DOM['task-modal'].addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  await load();
  renderAll();
});
