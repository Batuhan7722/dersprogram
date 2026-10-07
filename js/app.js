'use strict';

/* ============ sabitler ============ */
const DAYS = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const DAYS_SHORT = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const COLORS = ['#8ec5ff','#a5e3c0','#ffd9a0','#ffb3c1','#d4bbff','#a0e7e5','#f7d6e0','#c9d6a3'];
const STORE_KEY = 'dersprogram.v1';

/* ============ yardımcılar ============ */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, '0');
const fmtMin = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const todayIdx = (d = new Date()) => (d.getDay() + 6) % 7;      // Pazartesi = 0
const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
const isoDate = (d = new Date()) =>
  d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ============ veri ============ */
let state = load();

function emptyState() { return { version: 1, lessons: [], tasks: [] }; }

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    const d = JSON.parse(raw);
    return {
      version: 1,
      lessons: Array.isArray(d.lessons) ? d.lessons : [],
      tasks: Array.isArray(d.tasks) ? d.tasks : []
    };
  } catch (e) {
    console.warn('Kayıt okunamadı:', e);
    return emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Kaydedilemedi — depolama alanı dolu olabilir.');
    console.warn(e);
  }
}

const sortedLessons = () =>
  state.lessons.slice().sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
const lessonsOf = (day) =>
  state.lessons.filter((l) => l.day === day).sort((a, b) => toMin(a.start) - toMin(b.start));
const lessonById = (id) => state.lessons.find((l) => l.id === id) || null;
const tasksOf = (id) => state.tasks.filter((t) => t.lessonId === id);

/* ============ görünüm yönlendirme ============ */
const VIEWS = {
  today: { title: 'Bugün', render: renderToday },
  week:  { title: 'Hafta', render: renderWeek },
  tasks: { title: 'Ödevler', render: renderTasks },
  edit:  { title: 'Düzenle', render: renderEdit }
};
let current = 'today';

function show(name) {
  if (!VIEWS[name]) name = 'today';
  current = name;
  for (const k of Object.keys(VIEWS)) $('#view-' + k).hidden = k !== name;
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('is-active', t.dataset.view === name));
  $('#viewTitle').textContent = VIEWS[name].title;
  try { location.hash = name; } catch (e) {}
  VIEWS[name].render();
  window.scrollTo(0, 0);
}

function renderCurrent() { VIEWS[current].render(); }

/* ============ BUGÜN ============ */
function nextLesson() {
  const d = todayIdx(), n = nowMin();
  for (let off = 0; off < 8; off++) {
    const day = (d + off) % 7;
    for (const l of lessonsOf(day)) {
      if (off > 0 || toMin(l.start) > n) return { lesson: l, offset: off };
    }
  }
  return null;
}

function renderToday() {
  const now = new Date();
  $('#todayLabel').textContent =
    DAYS[todayIdx(now)] + ' · ' + now.getDate() + '.' + pad(now.getMonth() + 1);

  const list = lessonsOf(todayIdx(now));
  const n = nowMin(now);
  const live = list.find((l) => toMin(l.start) <= n && n < toMin(l.end));

  // üst kart: şu anki ya da sıradaki ders
  const card = $('#nowCard');
  if (live) {
    card.hidden = false;
    $('#nowKicker').textContent = 'Şu anki ders';
    $('#nowName').textContent = live.name;
    $('#nowMeta').textContent =
      live.start + '–' + live.end + ' · ' +
      (toMin(live.end) - n) + ' dk kaldı' + (live.room ? ' · ' + live.room : '');
  } else {
    const nx = nextLesson();
    if (nx) {
      card.hidden = false;
      $('#nowKicker').textContent = nx.offset === 0
        ? 'Sıradaki ders'
        : (nx.offset === 1 ? 'Yarın' : DAYS[nx.lesson.day]);
      $('#nowName').textContent = nx.lesson.name;
      let meta = nx.lesson.start + '–' + nx.lesson.end;
      if (nx.offset === 0) meta += ' · ' + (toMin(nx.lesson.start) - n) + ' dk sonra';
      if (nx.lesson.room) meta += ' · ' + nx.lesson.room;
      $('#nowMeta').textContent = meta;
    } else {
      card.hidden = true;
    }
  }

  // bugünün dersleri
  const box = $('#todayList');
  if (!list.length) {
    box.innerHTML = '<p class="empty">' +
      (state.lessons.length ? 'Bugün dersin yok. 🎉'
        : 'Henüz ders eklenmedi. <b>Düzenle</b> sekmesinden başla.') + '</p>';
  } else {
    box.innerHTML = list.map((l) => lessonRow(l, n)).join('');
  }

  // yaklaşan ödevler (bugün + 7 gün, tamamlanmamış)
  const today = isoDate(now);
  const limit = isoDate(new Date(now.getTime() + 7 * 864e5));
  const up = state.tasks
    .filter((t) => !t.done && t.due && t.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due));
  $('#todayTasksH').hidden = !up.length;
  $('#todayTasks').innerHTML = up.map((t) => taskRow(t, today)).join('');
}

function lessonRow(l, n) {
  const past = n >= toMin(l.end), live = toMin(l.start) <= n && n < toMin(l.end);
  const sub = [l.room, l.teacher].filter(Boolean).join(' · ');
  return '<button class="lesson' + (live ? ' is-now' : past ? ' is-past' : '') +
    '" data-lesson="' + esc(l.id) + '">' +
    '<span class="lesson-time">' + esc(l.start) + '<br>' + esc(l.end) + '</span>' +
    '<span class="lesson-bar" style="background:' + esc(l.color || COLORS[0]) + '"></span>' +
    '<span><span class="lesson-name">' + esc(l.name) + '</span>' +
      (sub ? '<br><span class="lesson-sub">' + esc(sub) + '</span>' : '') + '</span>' +
    (live ? '<span class="lesson-badge">ŞİMDİ</span>'
          : l.note ? '<span class="lesson-note-dot">📝</span>' : '<span></span>') +
    '</button>';
}

/* ============ HAFTA ============ */
function renderWeek() {
  const grid = $('#weekGrid');
  const all = state.lessons;
  $('#weekEmpty').hidden = all.length > 0;
  if (!all.length) { grid.innerHTML = ''; return; }

  // hafta sonu dersi yoksa göstermeyelim
  const lastDay = Math.max(4, ...all.map((l) => l.day));
  const startM = Math.min(...all.map((l) => toMin(l.start)));
  const endM = Math.max(...all.map((l) => toMin(l.end)));
  const top = Math.floor(startM / 60) * 60;
  const bottom = Math.ceil(endM / 60) * 60;
  const PX = 1.15;                                  // 1 dakika = 1.15px
  const H = Math.max(260, (bottom - top) * PX);
  const y = (m) => (m - top) * PX;
  const td = todayIdx();

  let html = '';
  // saat sütunu
  html += '<div class="wg-gutter"><div class="wg-head"></div><div class="wg-col" style="height:' + H + 'px">';
  for (let m = top; m <= bottom; m += 60) {
    html += '<span class="wg-hour" style="top:' + (y(m) - 6) + 'px">' + fmtMin(m) + '</span>';
  }
  html += '</div></div>';

  // gün sütunları
  for (let d = 0; d <= lastDay; d++) {
    html += '<div style="min-width:104px">' +
      '<div class="wg-head' + (d === td ? ' is-today' : '') + '">' + DAYS_SHORT[d] + '</div>' +
      '<div class="wg-col" style="height:' + H + 'px">';
    for (let m = top + 60; m < bottom; m += 60) {
      html += '<span class="wg-line" style="top:' + y(m) + 'px"></span>';
    }
    if (d === td) {
      const n = nowMin();
      if (n >= top && n <= bottom) html += '<span class="wg-now" style="top:' + y(n) + 'px"></span>';
    }
    for (const l of lessonsOf(d)) {
      const t = y(toMin(l.start));
      const h = Math.max(22, (toMin(l.end) - toMin(l.start)) * PX - 2);
      html += '<button class="wg-block" data-lesson="' + esc(l.id) + '" ' +
        'style="top:' + t + 'px;height:' + h + 'px;background:' + esc(l.color || COLORS[0]) + '">' +
        '<b>' + esc(l.name) + '</b><span>' + esc(l.start) + '</span></button>';
    }
    html += '</div></div>';
  }
  grid.innerHTML = html;
}

/* ============ ÖDEVLER ============ */
function taskRow(t, today) {
  const l = t.lessonId ? lessonById(t.lessonId) : null;
  const bits = [];
  if (l) bits.push(esc(l.name));
  if (t.due) {
    const late = !t.done && t.due < today;
    const d = t.due.split('-');
    bits.push('<span class="' + (late ? 'late' : '') + '">' +
      (t.due === today ? 'bugün' : d[2] + '.' + d[1]) + (late ? ' · geçti' : '') + '</span>');
  }
  if (t.note) bits.push(esc(t.note));
  return '<div class="task' + (t.done ? ' done' : '') + '">' +
    '<input type="checkbox" data-done="' + esc(t.id) + '"' + (t.done ? ' checked' : '') +
      ' aria-label="Tamamlandı">' +
    '<span class="task-body" data-task="' + esc(t.id) + '">' +
      '<span class="task-title">' + esc(t.title) + '</span>' +
      (bits.length ? '<br><span class="task-sub">' + bits.join(' · ') + '</span>' : '') +
    '</span></div>';
}

function renderTasks() {
  const today = isoDate();
  const showDone = $('#showDone').checked;
  const list = state.tasks
    .filter((t) => showDone || !t.done)
    .sort((a, b) => (a.done - b.done) ||
      ((a.due || '9999').localeCompare(b.due || '9999')) ||
      a.title.localeCompare(b.title, 'tr'));
  $('#taskList').innerHTML = list.length
    ? list.map((t) => taskRow(t, today)).join('')
    : '<p class="empty">Ödev yok. Keyfine bak. 😎</p>';
}

/* ============ DÜZENLE ============ */
function renderEdit() {
  const box = $('#editList');
  if (!state.lessons.length) {
    box.innerHTML = '<p class="empty">Henüz ders yok. Yukarıdaki butonla ilk dersini ekle.</p>';
    return;
  }
  const lastDay = Math.max(...state.lessons.map((l) => l.day));
  let html = '';
  for (let d = 0; d <= lastDay; d++) {
    const ls = lessonsOf(d);
    if (!ls.length) continue;
    html += '<div class="edit-day"><h3>' + DAYS[d] + '</h3>' +
      ls.map((l) => lessonRow(l, -1)).join('') + '</div>';
  }
  box.innerHTML = html;
}

/* ============ ders formu ============ */
const lessonDlg = $('#lessonDlg');
let editingLesson = null;
let pickedColor = COLORS[0];

function buildStaticSelects() {
  $('#daySelect').innerHTML = DAYS.map((d, i) => '<option value="' + i + '">' + d + '</option>').join('');
  $('#swatches').innerHTML = COLORS.map((c) =>
    '<button type="button" class="swatch" data-color="' + c + '" style="background:' + c +
    '" aria-pressed="false" aria-label="renk"></button>').join('');
  $('#swatches').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) { pickedColor = b.dataset.color; paintSwatches(); }
  });
}

function paintSwatches() {
  document.querySelectorAll('.swatch').forEach((s) =>
    s.setAttribute('aria-pressed', String(s.dataset.color === pickedColor)));
}

function openLesson(lesson, defaultDay) {
  editingLesson = lesson || null;
  const f = $('#lessonForm');
  $('#lessonDlgTitle').textContent = lesson ? 'Dersi düzenle' : 'Ders ekle';
  $('#lessonDelete').hidden = !lesson;
  $('#lessonErr').hidden = true;
  f.name.value = lesson ? lesson.name : '';
  f.day.value = String(lesson ? lesson.day : (defaultDay != null ? defaultDay : todayIdx()));
  f.start.value = lesson ? lesson.start : '09:00';
  f.end.value = lesson ? lesson.end : '09:50';
  f.room.value = lesson ? (lesson.room || '') : '';
  f.teacher.value = lesson ? (lesson.teacher || '') : '';
  pickedColor = lesson ? (lesson.color || COLORS[0])
                       : COLORS[state.lessons.length % COLORS.length];
  paintSwatches();
  lessonDlg.showModal();
}

function saveLesson() {
  const f = $('#lessonForm');
  const name = f.name.value.trim();
  const err = $('#lessonErr');
  if (!name) { err.textContent = 'Ders adı gerekli.'; err.hidden = false; return; }
  if (!f.start.value || !f.end.value) {
    err.textContent = 'Başlangıç ve bitiş saati gerekli.'; err.hidden = false; return;
  }
  if (toMin(f.end.value) <= toMin(f.start.value)) {
    err.textContent = 'Bitiş saati başlangıçtan sonra olmalı.'; err.hidden = false; return;
  }
  const data = {
    name,
    day: Number(f.day.value),
    start: f.start.value,
    end: f.end.value,
    room: f.room.value.trim(),
    teacher: f.teacher.value.trim(),
    color: pickedColor
  };
  if (editingLesson) {
    Object.assign(editingLesson, data);
  } else {
    state.lessons.push(Object.assign({ id: uid(), note: '' }, data));
  }
  save();
  lessonDlg.close();
  renderCurrent();
  toast(editingLesson ? 'Ders güncellendi' : 'Ders eklendi');
}

function deleteLesson() {
  if (!editingLesson) return;
  if (!confirm('"' + editingLesson.name + '" dersi silinsin mi?')) return;
  state.lessons = state.lessons.filter((l) => l.id !== editingLesson.id);
  state.tasks.forEach((t) => { if (t.lessonId === editingLesson.id) t.lessonId = null; });
  save();
  lessonDlg.close();
  renderCurrent();
  toast('Ders silindi');
}

/* ============ ödev formu ============ */
const taskDlg = $('#taskDlg');
let editingTask = null;

function openTask(task, lessonId) {
  editingTask = task || null;
  const f = $('#taskForm');
  $('#taskDlgTitle').textContent = task ? 'Ödevi düzenle' : 'Ödev ekle';
  $('#taskDelete').hidden = !task;
  $('#taskLessonSelect').innerHTML = '<option value="">(ders seçme)</option>' +
    sortedLessons().map((l) =>
      '<option value="' + esc(l.id) + '">' + esc(l.name) + ' — ' + DAYS_SHORT[l.day] + '</option>'
    ).join('');
  f.title.value = task ? task.title : '';
  f.lessonId.value = task ? (task.lessonId || '') : (lessonId || '');
  f.due.value = task ? (task.due || '') : '';
  f.note.value = task ? (task.note || '') : '';
  taskDlg.showModal();
}

function saveTask() {
  const f = $('#taskForm');
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  const data = {
    title,
    lessonId: f.lessonId.value || null,
    due: f.due.value || '',
    note: f.note.value.trim()
  };
  if (editingTask) Object.assign(editingTask, data);
  else state.tasks.push(Object.assign({ id: uid(), done: false }, data));
  save();
  taskDlg.close();
  renderCurrent();
  if (detailDlg.open) renderDetail();
  toast(editingTask ? 'Ödev güncellendi' : 'Ödev eklendi');
}

function deleteTask() {
  if (!editingTask) return;
  state.tasks = state.tasks.filter((t) => t.id !== editingTask.id);
  save();
  taskDlg.close();
  renderCurrent();
  if (detailDlg.open) renderDetail();
  toast('Ödev silindi');
}

/* ============ ders detay ============ */
const detailDlg = $('#detailDlg');
let detailId = null;

function openDetail(id) {
  detailId = id;
  renderDetail();
  detailDlg.showModal();
}

function renderDetail() {
  const l = lessonById(detailId);
  if (!l) { detailDlg.close(); return; }
  $('#detailName').textContent = l.name;
  $('#detailMeta').textContent = [
    DAYS[l.day] + ' ' + l.start + '–' + l.end, l.room, l.teacher
  ].filter(Boolean).join(' · ');
  $('#detailNote').value = l.note || '';
  const ts = tasksOf(l.id);
  $('#detailTasksH').hidden = !ts.length;
  $('#detailTasks').innerHTML = ts.map((t) => taskRow(t, isoDate())).join('');
}

/* ============ yedek al / geri yükle ============ */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ders-programi-' + isoDate() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.lessons)) throw new Error('lessons yok');
      if (!confirm('Mevcut program bu yedekle değiştirilecek. Devam?')) return;
      state = {
        version: 1,
        lessons: d.lessons,
        tasks: Array.isArray(d.tasks) ? d.tasks : []
      };
      state.lessons.forEach((l) => { if (!l.id) l.id = uid(); });
      state.tasks.forEach((t) => { if (!t.id) t.id = uid(); });
      save();
      renderCurrent();
      toast('Yedek geri yüklendi');
    } catch (e) {
      toast('Dosya okunamadı — geçerli bir yedek değil.');
      console.warn(e);
    }
  };
  r.readAsText(file);
}

/* ============ olaylar ============ */
function wire() {
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => show(t.dataset.view)));

  // listelerde tıklama (ders / ödev)
  $('#main').addEventListener('click', (e) => {
    const lb = e.target.closest('[data-lesson]');
    if (lb) { openDetail(lb.dataset.lesson); return; }
    const tb = e.target.closest('[data-task]');
    if (tb) {
      const t = state.tasks.find((x) => x.id === tb.dataset.task);
      if (t) openTask(t);
    }
  });
  $('#main').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-done]');
    if (!cb) return;
    const t = state.tasks.find((x) => x.id === cb.dataset.done);
    if (t) { t.done = cb.checked; save(); renderCurrent(); }
  });

  $('#addLessonBtn').addEventListener('click', () => openLesson(null));
  $('#addTaskBtn').addEventListener('click', () => openTask(null));
  $('#showDone').addEventListener('change', renderTasks);

  $('#lessonSave').addEventListener('click', saveLesson);
  $('#lessonCancel').addEventListener('click', () => lessonDlg.close());
  $('#lessonDelete').addEventListener('click', deleteLesson);
  $('#lessonForm').addEventListener('submit', (e) => { e.preventDefault(); saveLesson(); });

  $('#taskSave').addEventListener('click', saveTask);
  $('#taskCancel').addEventListener('click', () => taskDlg.close());
  $('#taskDelete').addEventListener('click', deleteTask);
  $('#taskForm').addEventListener('submit', (e) => { e.preventDefault(); saveTask(); });

  // detay penceresi
  $('#detailClose').addEventListener('click', () => detailDlg.close());
  $('#detailEdit').addEventListener('click', () => {
    const l = lessonById(detailId);
    detailDlg.close();
    if (l) openLesson(l);
  });
  $('#detailNote').addEventListener('input', (e) => {
    const l = lessonById(detailId);
    if (!l) return;
    l.note = e.target.value;
    clearTimeout(wire._noteT);
    wire._noteT = setTimeout(() => { save(); renderCurrent(); }, 400);
  });
  $('#detailTasks').addEventListener('click', (e) => {
    const tb = e.target.closest('[data-task]');
    if (tb) {
      const t = state.tasks.find((x) => x.id === tb.dataset.task);
      if (t) { detailDlg.close(); openTask(t); }
    }
  });
  $('#detailTasks').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-done]');
    if (!cb) return;
    const t = state.tasks.find((x) => x.id === cb.dataset.done);
    if (t) { t.done = cb.checked; save(); renderDetail(); }
  });

  // veri
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Tüm dersler ve ödevler silinecek. Emin misin?')) return;
    state = emptyState();
    save();
    renderCurrent();
    toast('Program sıfırlandı');
  });

  // dakika başı tazele (saat çizgisi, "şimdi" vurgusu)
  setInterval(() => { if (current === 'today' || current === 'week') renderCurrent(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderCurrent();
  });
}

/* ============ başlat ============ */
buildStaticSelects();
wire();
show((location.hash || '').replace('#', '') || 'today');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e)));
}
