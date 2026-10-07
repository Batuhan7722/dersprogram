'use strict';

/* ═══════════ görünümler ═══════════ */
const VIEWS = {
  today:    { title: 'Bugün',     render: renderToday },
  tasks:    { title: 'Görevler',  render: renderTasks },
  exams:    { title: 'Denemeler', render: renderExams },
  settings: { title: 'Ayarlar',   render: renderSettings }
};
let current = 'today';
let planDayType = 'bos';

function show(name) {
  if (!VIEWS[name]) name = 'today';
  current = name;
  for (const k of Object.keys(VIEWS)) $('#view-' + k).hidden = k !== name;
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
  $('#viewTitle').textContent = VIEWS[name].title;
  try { location.hash = name; } catch (e) {}
  VIEWS[name].render();
  scrollTo(0, 0);
}
const rerender = () => VIEWS[current].render();

/* ═══════════ BUGÜN ═══════════ */
function renderToday() {
  const today = isoDate();
  const plan = planFor(today);
  $('#viewSub').textContent = trDate(today);
  $('#streakNum').textContent = state.streak.count;
  $('#streakChip').classList.toggle('hot', state.streak.count > 0);

  const hasPlan = !!(plan && plan.blocks.length);
  $('#setupCard').hidden = hasPlan;
  $('#heroCard').hidden = !hasPlan;
  $('#planActions').hidden = !hasPlan;

  if (!hasPlan) {
    $('#timeline').innerHTML = '';
    $('#leftoverCard').hidden = true;
    const pool = openTasks();
    const blocks = pool.reduce((s, t) => s + blocksFor(t), 0);
    $('#poolInfo').innerHTML = pool.length
      ? 'Havuzda <b>' + pool.length + '</b> görev var, yaklaşık <b>' + blocks + ' blok</b> iş.'
      : 'Havuzda görev yok. Önce <b>Görevler</b> sekmesinden ne çalışacağını ekle.';
    $('#genBtn').disabled = !pool.length;
    syncSetupTimes();
    return;
  }

  const work = plan.blocks.filter((b) => b.type === 'work');
  const done = work.filter((b) => b.done).length;
  const pct = work.length ? Math.round(done / work.length * 100) : 0;

  // ilerleme halkası
  const C = 2 * Math.PI * 52;
  const ring = $('#ringFg');
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - pct / 100);
  $('#heroPct').textContent = pct + '%';
  $('#heroSub').textContent = done + ' / ' + work.length + ' blok tamam';

  const n = nowMin();
  const live = plan.blocks.find((b) => b.start <= n && n < b.end);
  const nextW = work.find((b) => !b.done && b.end > n) || work.find((b) => !b.done);
  $('#heroNote').textContent = pct === 100
    ? 'Gün bitti, helal olsun 👏'
    : live && live.type !== 'work' ? 'Mola — ' + (live.end - n) + ' dk kaldı'
    : live ? 'Şu an: ' + subjectName(live.subjectId) + ' · ' + (live.end - n) + ' dk kaldı'
    : nextW ? 'Sırada: ' + fmtMin(nextW.start) + ' ' + subjectName(nextW.subjectId)
    : '';

  // zaman çizelgesi
  $('#timeline').innerHTML = plan.blocks.map((b) => blockRow(b, n)).join('');

  // sığmayanlar
  const lo = (plan.leftover || []).filter((l) => taskById(l.taskId));
  $('#leftoverCard').hidden = !lo.length;
  if (lo.length) {
    $('#leftoverList').innerHTML = lo.map((l) => {
      const t = taskById(l.taskId);
      return '<div class="lo-row"><span class="dot" style="background:' + esc(subjectColor(t.subjectId)) + '"></span>' +
        '<span>' + esc(subjectName(t.subjectId)) + ' — ' + esc(t.title) + '</span>' +
        '<b>' + l.amount + ' ' + esc(UNITS[l.unit].label) + '</b></div>';
    }).join('');
  }
}

function blockRow(b, n) {
  const past = n >= b.end;
  if (b.type !== 'work') {
    return '<div class="blk rest' + (past ? ' past' : '') + '">' +
      '<span class="blk-time">' + fmtMin(b.start) + '</span>' +
      '<span class="blk-rest-txt">' + (b.type === 'meal' ? '🍽️ ' : '☕ ') + esc(b.title) +
      ' · ' + (b.end - b.start) + ' dk</span></div>';
  }
  const live = b.start <= n && n < b.end;
  const col = subjectColor(b.subjectId);
  return '<button class="blk work' + (b.done ? ' done' : '') + (live ? ' live' : '') +
      (past && !b.done ? ' missed' : '') + '" data-blk="' + esc(b.id) + '" style="--c:' + esc(col) + '">' +
    '<span class="blk-time">' + fmtMin(b.start) + '<em>' + fmtMin(b.end) + '</em></span>' +
    '<span class="check" aria-hidden="true"></span>' +
    '<span class="blk-body">' +
      '<span class="blk-subj">' + esc(subjectName(b.subjectId)) + (live ? ' <i class="live-dot"></i>' : '') + '</span>' +
      '<span class="blk-title">' + esc(b.title) + ' · ' + b.amount + ' ' + esc(UNITS[b.unit].label) + '</span>' +
    '</span></button>';
}

function syncSetupTimes() {
  const d = state.settings[planDayType];
  $('#planStart').value = d.start;
  $('#planEnd').value = d.end;
  $$('#dayTypeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.type === planDayType));
}

function makePlan() {
  const today = isoDate();
  const s = toMin($('#planStart').value || '09:00');
  let e = toMin($('#planEnd').value || '23:30');
  if (e <= s) e = s + 60;

  const pool = openTasks().slice().sort((a, b) =>
    (a.due || '9999').localeCompare(b.due || '9999') || num(b.priority) - num(a.priority));
  if (!pool.length) { toast('Önce görev ekle.'); return; }

  state.plans[today] = generatePlan({
    date: today, dayType: planDayType,
    startMin: s, endMin: e,
    tasks: pool, settings: state.settings
  });
  save();
  rerender();
  const w = state.plans[today].blocks.filter((b) => b.type === 'work').length;
  toast(w + ' çalışma bloğu hazır 💪');
  buzz(12);
}

function toggleBlock(id, el) {
  const plan = planFor(isoDate());
  if (!plan) return;
  const b = plan.blocks.find((x) => x.id === id);
  if (!b || b.type !== 'work') return;
  const t = taskById(b.taskId);

  b.done = !b.done;
  if (t) {
    // görevin tamamlanan miktarını blokla birlikte güncelle
    t.done = Math.max(0, Math.min(num(t.amount), num(t.done) + (b.done ? b.amount : -b.amount)));
  }

  const work = plan.blocks.filter((x) => x.type === 'work');
  const allDone = work.length && work.every((x) => x.done);

  if (b.done) { FX.burst(el); buzz(14); }
  if (allDone) bumpStreak();

  save();
  rerender();

  if (allDone) {
    const total = work.reduce((s, x) => s + (x.end - x.start), 0);
    $('#winText').textContent =
      'Bugün ' + work.length + ' blokta ' + Math.round(total / 60 * 10) / 10 +
      ' saat çalıştın. Seri: ' + state.streak.count + ' gün 🔥';
    $('#winDlg').showModal();
    FX.celebrate();
    buzz([20, 60, 20]);
  }
}

function bumpStreak() {
  const today = isoDate();
  if (state.streak.last === today) return;
  state.streak.count = state.streak.last === addDays(today, -1) ? state.streak.count + 1 : 1;
  state.streak.last = today;
}

/* ═══════════ GÖREVLER ═══════════ */
function renderTasks() {
  $('#viewSub').textContent = openTasks().length + ' açık görev';
  const list = state.tasks.slice().sort((a, b) => {
    const ar = taskRemaining(a) > 0, br = taskRemaining(b) > 0;
    if (ar !== br) return ar ? -1 : 1;
    return (a.due || '9999').localeCompare(b.due || '9999') || num(b.priority) - num(a.priority);
  });

  $('#taskPool').innerHTML = list.length ? list.map((t) => {
    const rem = taskRemaining(t);
    const pct = num(t.amount) ? Math.round(num(t.done) / num(t.amount) * 100) : 0;
    const overdue = t.due && rem > 0 && t.due < isoDate();
    const due = t.due
      ? (t.due === isoDate() ? 'bugün' : t.due === addDays(isoDate(), 1) ? 'yarın'
         : t.due.split('-').reverse().slice(0, 2).join('.'))
      : '';
    return '<div class="card task' + (rem ? '' : ' finished') + '" data-task="' + esc(t.id) + '">' +
      '<div class="task-top">' +
        '<span class="dot" style="background:' + esc(subjectColor(t.subjectId)) + '"></span>' +
        '<b>' + esc(subjectName(t.subjectId)) + '</b>' +
        (num(t.priority) ? '<span class="pill p' + num(t.priority) + '">' + PRIORITY[num(t.priority)] + '</span>' : '') +
        (due ? '<span class="pill' + (overdue ? ' late' : '') + '">' + esc(due) + (overdue ? ' · geçti' : '') + '</span>' : '') +
        (rem ? '' : '<span class="pill ok">bitti ✓</span>') +
      '</div>' +
      '<div class="task-title">' + esc(t.title) + '</div>' +
      '<div class="bar"><i style="width:' + pct + '%;background:' + esc(subjectColor(t.subjectId)) + '"></i></div>' +
      '<div class="task-foot"><span>' + num(t.done) + ' / ' + num(t.amount) + ' ' + esc(UNITS[t.unit].label) + '</span>' +
        '<span>' + (rem ? '≈ ' + blocksFor(t) + ' blok kaldı' : '') + '</span></div>' +
    '</div>';
  }).join('') : '<p class="empty">Görev havuzu boş.<br>Planlayıcındaki işleri buraya gir — uygulama günlere kendisi böler.</p>';
}

/* ═══════════ DENEMELER ═══════════ */
function renderExams() {
  $('#viewSub').textContent = state.exams.length + ' deneme';
  const exams = state.exams.slice().sort((a, b) => b.date.localeCompare(a.date));

  $('#adviceBox').innerHTML = buildAdvice(state.exams).map((a) => {
    const s = a.subjectName ? subjectByName(a.subjectName) : null;
    return '<div class="card advice ' + a.tone + '">' +
      '<span class="adv-ico">' + (a.tone === 'warn' ? '⚠️' : a.tone === 'good' ? '✅' : '💡') + '</span>' +
      '<div><p>' + esc(a.text) + '</p>' +
      (s ? '<button class="btn tiny" data-advice-subj="' + esc(s.id) + '">' +
            esc(s.name) + ' için görev ekle</button>' : '') +
      '</div></div>';
  }).join('');

  drawChart();

  $('#examList').innerHTML = exams.length ? exams.map((e) => {
    const rows = EXAM_SUBJECTS[e.kind].map((sub) =>
      '<span class="net-chip">' + esc(sub.name) + ' <b>' + fmtNet(examNet(e, sub.key)) + '</b></span>').join('');
    return '<div class="card exam" data-exam="' + esc(e.id) + '">' +
      '<div class="exam-top"><span class="pill kind">' + esc(e.kind) + '</span>' +
        '<b>' + esc(e.name || 'Deneme') + '</b>' +
        '<span class="exam-date">' + esc(e.date.split('-').reverse().join('.')) + '</span></div>' +
      '<div class="exam-total">' + fmtNet(examTotal(e)) + ' <span>net</span></div>' +
      '<div class="net-chips">' + rows + '</div></div>';
  }).join('') : '<p class="empty">Deneme eklenmedi.</p>';
}

function drawChart() {
  const box = $('#chart');
  const series = ['TYT', 'AYT'].map((kind) => ({
    kind,
    pts: state.exams.filter((e) => e.kind === kind)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => examTotal(e))
  })).filter((s) => s.pts.length >= 2);

  $('#chartCard').hidden = !series.length;
  if (!series.length) { box.innerHTML = ''; return; }

  const W = 320, H = 130, P = 14;
  const all = series.flatMap((s) => s.pts);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = (hi - lo) || 1;
  const COL = { TYT: '#6ea8fe', AYT: '#5ee7c2' };

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="spark" role="img" aria-label="Net gelişim grafiği">';
  for (let i = 0; i <= 2; i++) {
    const y = P + (H - P * 2) * i / 2;
    svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" class="grid"/>';
  }
  for (const s of series) {
    const n = s.pts.length;
    const pts = s.pts.map((v, i) => {
      const x = P + (W - P * 2) * (n === 1 ? 0.5 : i / (n - 1));
      const y = H - P - (H - P * 2) * ((v - lo) / span);
      return [x, y];
    });
    svg += '<polyline class="line" stroke="' + COL[s.kind] + '" points="' +
      pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
    svg += pts.map((p) => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
      '" r="3.5" fill="' + COL[s.kind] + '"/>').join('');
  }
  svg += '</svg>';
  svg += '<div class="legend">' + series.map((s) =>
    '<span><i style="background:' + COL[s.kind] + '"></i>' + s.kind + ' · son ' +
    fmtNet(s.pts[s.pts.length - 1]) + ' net</span>').join('') + '</div>';
  box.innerHTML = svg;
}

/* ═══════════ AYARLAR ═══════════ */
function renderSettings() {
  $('#viewSub').textContent = '';
  const st = state.settings;
  $('#subjList').innerHTML = state.subjects.map((s) =>
    '<div class="subj"><input type="color" value="' + esc(s.color) + '" data-subj-color="' + esc(s.id) + '">' +
    '<input class="subj-name" value="' + esc(s.name) + '" maxlength="24" data-subj-name="' + esc(s.id) + '">' +
    '<button class="btn tiny danger" data-subj-del="' + esc(s.id) + '">Sil</button></div>').join('');

  $('#setBlock').value = st.blockLen;
  $('#setBreak').value = st.breakLen;
  $('#setMeal').value = st.mealLen;
  $('#setMealTime').value = st.mealTime;
  $('#setOkulStart').value = st.okul.start;
  $('#setOkulEnd').value = st.okul.end;
  $('#setBosStart').value = st.bos.start;
  $('#setBosEnd').value = st.bos.end;

  $('#rateBox').innerHTML = Object.keys(UNITS).map((k) =>
    '<label>' + esc(UNITS[k].label) + ' / blok <input type="number" min="1" max="500" ' +
    'data-rate="' + k + '" value="' + num(st.rates[k]) + '"></label>').join('');
}

/* ═══════════ görev formu ═══════════ */
let editingTask = null;

function openTaskDlg(task, presetSubject) {
  editingTask = task || null;
  const f = $('#taskForm');
  $('#taskDlgTitle').textContent = task ? 'Görevi düzenle' : 'Görev ekle';
  $('#taskDelete').hidden = !task;
  $('#taskErr').hidden = true;
  $('#taskSubj').innerHTML = state.subjects.map((s) =>
    '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');
  $('#taskUnit').innerHTML = Object.keys(UNITS).map((k) =>
    '<option value="' + k + '">' + esc(UNITS[k].label) + '</option>').join('');

  f.subjectId.value = task ? task.subjectId : (presetSubject || (state.subjects[0] || {}).id || '');
  f.title.value = task ? task.title : '';
  f.amount.value = task ? task.amount : 3;
  f.unit.value = task ? task.unit : 'test';
  f.due.value = task ? (task.due || '') : '';
  f.priority.value = task ? String(num(task.priority)) : '0';
  updateEstimate();
  $('#taskDlg').showModal();
}

function updateEstimate() {
  const f = $('#taskForm');
  const per = num(state.settings.rates[f.unit.value]) || 1;
  const blocks = Math.max(1, Math.ceil(num(f.amount.value) / per));
  $('#taskEstimate').textContent =
    '≈ ' + blocks + ' blok (' + blocks * num(state.settings.blockLen) + ' dk) sürer.';
}

function saveTask() {
  const f = $('#taskForm');
  const title = f.title.value.trim();
  const err = $('#taskErr');
  if (!title) { err.textContent = 'Ne çalışacağını yaz.'; err.hidden = false; return; }
  if (num(f.amount.value) < 1) { err.textContent = 'Miktar en az 1 olmalı.'; err.hidden = false; return; }

  const data = {
    subjectId: f.subjectId.value,
    title,
    amount: num(f.amount.value),
    unit: f.unit.value,
    due: f.due.value || '',
    priority: num(f.priority.value)
  };
  if (editingTask) Object.assign(editingTask, data);
  else state.tasks.push(Object.assign({ id: uid(), done: 0 }, data));
  save();
  $('#taskDlg').close();
  rerender();
  toast(editingTask ? 'Görev güncellendi' : 'Görev eklendi');
}

/* ═══════════ deneme formu ═══════════ */
let editingExam = null;

function openExamDlg(exam) {
  editingExam = exam || null;
  const f = $('#examForm');
  $('#examDlgTitle').textContent = exam ? 'Denemeyi düzenle' : 'Deneme ekle';
  $('#examDelete').hidden = !exam;
  f.date.value = exam ? exam.date : isoDate();
  f.kind.value = exam ? exam.kind : 'TYT';
  f.name.value = exam ? (exam.name || '') : '';
  buildNetRows(exam);
  $('#examDlg').showModal();
}

function buildNetRows(exam) {
  const kind = $('#examKind').value;
  $('#netRows').innerHTML = EXAM_SUBJECTS[kind].map((s) => {
    const v = exam && exam.nets && exam.nets[s.key] ? exam.nets[s.key] : { d: '', y: '' };
    return '<tr data-key="' + s.key + '"><th>' + esc(s.name) + '<em>/' + s.max + '</em></th>' +
      '<td><input type="number" min="0" max="' + s.max + '" inputmode="numeric" class="nd" value="' + esc(v.d) + '"></td>' +
      '<td><input type="number" min="0" max="' + s.max + '" inputmode="numeric" class="ny" value="' + esc(v.y) + '"></td>' +
      '<td class="nnet">0,00</td></tr>';
  }).join('');
  recalcNets();
}

function recalcNets() {
  let total = 0;
  $$('#netRows tr').forEach((tr) => {
    const d = num($('.nd', tr).value), y = num($('.ny', tr).value);
    const net = d - y / 4;
    $('.nnet', tr).textContent = fmtNet(net);
    total += net;
  });
  $('#examTotal').textContent = fmtNet(total);
}

function saveExam() {
  const f = $('#examForm');
  const nets = {};
  $$('#netRows tr').forEach((tr) => {
    nets[tr.dataset.key] = { d: num($('.nd', tr).value), y: num($('.ny', tr).value) };
  });
  const data = { date: f.date.value || isoDate(), kind: f.kind.value, name: f.name.value.trim(), nets };
  if (editingExam) Object.assign(editingExam, data);
  else state.exams.push(Object.assign({ id: uid() }, data));
  save();
  $('#examDlg').close();
  rerender();
  toast('Deneme kaydedildi 📈');
}

/* ═══════════ haftanın planlayıcısı ═══════════ */
/**
 * data/hafta.json içindeki haftalık işleri görev havuzuna ekler.
 * Aynı ders + başlık + tarih üçlüsü zaten varsa tekrar eklenmez.
 */
async function loadWeek() {
  const btn = $('#loadWeekBtn');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = 'Yükleniyor…';
  try {
    const res = await fetch('data/hafta.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data.gorevler)) throw new Error('biçim');

    let added = 0, skipped = 0;
    for (const g of data.gorevler) {
      let subj = subjectByName(g.ders);
      if (!subj) {                                   // defterdeki ders yoksa oluştur
        subj = { id: uid(), name: g.ders, color: PALETTE[state.subjects.length % PALETTE.length] };
        state.subjects.push(subj);
      }
      const unit = UNITS[g.birim] ? g.birim : 'test';
      const dup = state.tasks.some((t) =>
        t.subjectId === subj.id && t.title === g.baslik && (t.due || '') === (g.tarih || ''));
      if (dup) { skipped++; continue; }
      state.tasks.push({
        id: uid(), subjectId: subj.id, title: g.baslik,
        amount: Math.max(1, num(g.miktar)), unit,
        due: g.tarih || '', priority: num(g.oncelik), done: 0
      });
      added++;
    }
    save();
    rerender();
    toast(added + ' görev eklendi' + (skipped ? ', ' + skipped + ' zaten vardı' : '') + ' ✅');
    if (added) show('tasks');
  } catch (e) {
    console.warn(e);
    toast('Planlayıcı dosyası okunamadı. İnternet kapalıysa açıp tekrar dene.');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

/* ═══════════ yedekleme ═══════════ */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'calisma-plani-' + isoDate() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.subjects) || !Array.isArray(d.tasks)) throw new Error('biçim');
      if (!confirm('Mevcut tüm veriler bu yedekle değiştirilecek. Devam?')) return;
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      state = loadState();
      rerender();
      toast('Yedek geri yüklendi');
    } catch (e) {
      toast('Dosya okunamadı — geçerli bir yedek değil.');
      console.warn(e);
    }
  };
  r.readAsText(file);
}

/* ═══════════ olaylar ═══════════ */
function wire() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  /* — bugün — */
  $('#dayTypeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-type]');
    if (!b) return;
    planDayType = b.dataset.type;
    syncSetupTimes();
  });
  $('#genBtn').addEventListener('click', makePlan);
  $('#regenBtn').addEventListener('click', () => {
    if (!confirm('Plan baştan kurulacak. İşaretlediklerin silinir. Devam?')) return;
    const p = planFor(isoDate());
    // işaretli blokların görev ilerlemesini geri al
    if (p) p.blocks.forEach((b) => {
      if (b.type === 'work' && b.done) {
        const t = taskById(b.taskId);
        if (t) t.done = Math.max(0, num(t.done) - b.amount);
      }
    });
    delete state.plans[isoDate()];
    save();
    rerender();
  });
  $('#clearPlanBtn').addEventListener('click', () => {
    if (!confirm('Bugünün planı silinsin mi?')) return;
    delete state.plans[isoDate()];
    save();
    rerender();
  });
  $('#timeline').addEventListener('click', (e) => {
    const b = e.target.closest('[data-blk]');
    if (b) toggleBlock(b.dataset.blk, b);
  });

  /* — görevler — */
  $('#addTaskBtn').addEventListener('click', () => openTaskDlg(null));
  $('#taskPool').addEventListener('click', (e) => {
    const c = e.target.closest('[data-task]');
    if (c) openTaskDlg(taskById(c.dataset.task));
  });
  $('#taskSave').addEventListener('click', saveTask);
  $('#taskCancel').addEventListener('click', () => $('#taskDlg').close());
  $('#taskDelete').addEventListener('click', () => {
    if (!editingTask || !confirm('"' + editingTask.title + '" silinsin mi?')) return;
    state.tasks = state.tasks.filter((t) => t.id !== editingTask.id);
    for (const d of Object.keys(state.plans)) {
      state.plans[d].blocks = state.plans[d].blocks.filter((b) => b.taskId !== editingTask.id);
      state.plans[d].leftover = (state.plans[d].leftover || []).filter((l) => l.taskId !== editingTask.id);
    }
    save();
    $('#taskDlg').close();
    rerender();
    toast('Görev silindi');
  });
  $('#taskForm').addEventListener('input', updateEstimate);
  $('#taskForm').addEventListener('submit', (e) => { e.preventDefault(); saveTask(); });

  /* — denemeler — */
  $('#addExamBtn').addEventListener('click', () => openExamDlg(null));
  $('#examList').addEventListener('click', (e) => {
    const c = e.target.closest('[data-exam]');
    if (c) openExamDlg(state.exams.find((x) => x.id === c.dataset.exam));
  });
  $('#adviceBox').addEventListener('click', (e) => {
    const b = e.target.closest('[data-advice-subj]');
    if (b) { show('tasks'); openTaskDlg(null, b.dataset.adviceSubj); }
  });
  $('#examKind').addEventListener('change', () => buildNetRows(null));
  $('#netRows').addEventListener('input', recalcNets);
  $('#examSave').addEventListener('click', saveExam);
  $('#examCancel').addEventListener('click', () => $('#examDlg').close());
  $('#examDelete').addEventListener('click', () => {
    if (!editingExam || !confirm('Bu deneme silinsin mi?')) return;
    state.exams = state.exams.filter((x) => x.id !== editingExam.id);
    save();
    $('#examDlg').close();
    rerender();
  });
  $('#examForm').addEventListener('submit', (e) => { e.preventDefault(); saveExam(); });

  /* — ayarlar — */
  const S = () => state.settings;
  $('#subjList').addEventListener('input', (e) => {
    const t = e.target;
    const s = subjectById(t.dataset.subjColor || t.dataset.subjName);
    if (!s) return;
    if (t.dataset.subjColor) s.color = t.value;
    else s.name = t.value.trim() || s.name;
    save();
  });
  $('#subjList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-subj-del]');
    if (!b) return;
    const s = subjectById(b.dataset.subjDel);
    if (!s) return;
    if (state.tasks.some((t) => t.subjectId === s.id)) {
      toast('Bu derse bağlı görevler var, önce onları sil.');
      return;
    }
    state.subjects = state.subjects.filter((x) => x.id !== s.id);
    save();
    renderSettings();
  });
  $('#addSubjBtn').addEventListener('click', () => {
    const n = $('#newSubj').value.trim();
    if (!n) return;
    state.subjects.push({ id: uid(), name: n, color: PALETTE[state.subjects.length % PALETTE.length] });
    $('#newSubj').value = '';
    save();
    renderSettings();
  });

  const bindNum = (sel, apply) => $(sel).addEventListener('change', (e) => {
    apply(num(e.target.value)); save(); toast('Ayar kaydedildi');
  });
  bindNum('#setBlock', (v) => S().blockLen = Math.min(90, Math.max(20, v)));
  bindNum('#setBreak', (v) => S().breakLen = Math.min(30, Math.max(5, v)));
  bindNum('#setMeal', (v) => S().mealLen = Math.min(90, Math.max(15, v)));
  $('#setMealTime').addEventListener('change', (e) => { S().mealTime = e.target.value; save(); });
  $('#setOkulStart').addEventListener('change', (e) => { S().okul.start = e.target.value; save(); });
  $('#setOkulEnd').addEventListener('change', (e) => { S().okul.end = e.target.value; save(); });
  $('#setBosStart').addEventListener('change', (e) => { S().bos.start = e.target.value; save(); });
  $('#setBosEnd').addEventListener('change', (e) => { S().bos.end = e.target.value; save(); });
  $('#rateBox').addEventListener('change', (e) => {
    const k = e.target.dataset.rate;
    if (!k) return;
    S().rates[k] = Math.max(1, num(e.target.value));
    save();
    toast('Hız güncellendi');
  });

  $('#loadWeekBtn').addEventListener('click', loadWeek);
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Tüm görevler, planlar ve denemeler silinecek. Emin misin?')) return;
    state = defaultState();
    save();
    rerender();
    toast('Sıfırlandı');
  });

  $('#winClose').addEventListener('click', () => $('#winDlg').close());

  /* dakika başı tazele */
  setInterval(() => { if (current === 'today') renderToday(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rerender(); });
}

/* ═══════════ başlat ═══════════ */
wire();
show((location.hash || '').replace('#', '') || 'today');

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
}
