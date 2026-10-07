'use strict';

/* ═══════════ sabitler ═══════════ */
const STORE_KEY = 'calismaplani.v2';

const UNITS = {
  sayfa: { label: 'sayfa', perBlock: 20 },
  test:  { label: 'test',  perBlock: 3  },
  soru:  { label: 'soru',  perBlock: 20 },
  konu:  { label: 'konu',  perBlock: 1  },
  dk:    { label: 'dakika', perBlock: 45 }
};

const PRIORITY = ['Normal', 'Yüksek', 'Acil'];

/* deneme ders listeleri ve ham puan tavanları */
const EXAM_SUBJECTS = {
  TYT: [
    { key: 'turkce', name: 'Türkçe', max: 40 },
    { key: 'sosyal', name: 'Sosyal', max: 20 },
    { key: 'mat',    name: 'Matematik', max: 40 },
    { key: 'fen',    name: 'Fen', max: 20 }
  ],
  AYT: [
    { key: 'mat',  name: 'Matematik', max: 40 },
    { key: 'fiz',  name: 'Fizik', max: 14 },
    { key: 'kim',  name: 'Kimya', max: 13 },
    { key: 'biy',  name: 'Biyoloji', max: 13 }
  ]
};

/* deneme dersi → görev havuzundaki ders adı */
const EXAM_TO_SUBJECT = {
  turkce: 'Türkçe', sosyal: 'Sosyal', mat: 'Matematik', fen: 'Fen',
  fiz: 'Fizik', kim: 'Kimya', biy: 'Biyoloji'
};

const PALETTE = [
  '#6ea8fe', '#5ee7c2', '#ffd166', '#ff8fa3',
  '#c3a6ff', '#7ee8e0', '#ffb088', '#a8d672'
];

/* ═══════════ yardımcılar ═══════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => { const a = String(t).split(':'); return (+a[0]) * 60 + (+a[1]); };
const fmtMin = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
const isoDate = (d = new Date()) =>
  d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};
const trDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const gun = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][dt.getDay()];
  const ay = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
              'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][m - 1];
  return d + ' ' + ay + ' ' + gun;
};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtNet = (n) => n.toFixed(2).replace('.', ',');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

/* ═══════════ varsayılan durum ═══════════ */
function defaultState() {
  const names = ['Türkçe', 'Matematik', 'Geometri', 'Problem', 'Fizik', 'Kimya', 'Biyoloji'];
  return {
    version: 2,
    subjects: names.map((n, i) => ({ id: uid() + i, name: n, color: PALETTE[i % PALETTE.length] })),
    tasks: [],
    plans: {},
    exams: [],
    streak: { count: 0, last: '' },
    settings: {
      blockLen: 45,
      breakLen: 15,
      mealLen: 45,
      mealTime: '19:00',
      okul: { start: '17:00', end: '23:30' },
      bos:  { start: '09:00', end: '23:30' },
      rates: Object.fromEntries(Object.keys(UNITS).map((k) => [k, UNITS[k].perBlock]))
    }
  };
}

let state = loadState();

function loadState() {
  const def = defaultState();
  let raw;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return def; }
  if (!raw) return def;
  try {
    const d = JSON.parse(raw);
    return {
      version: 2,
      subjects: Array.isArray(d.subjects) && d.subjects.length ? d.subjects : def.subjects,
      tasks: Array.isArray(d.tasks) ? d.tasks : [],
      plans: (d.plans && typeof d.plans === 'object') ? d.plans : {},
      exams: Array.isArray(d.exams) ? d.exams : [],
      streak: d.streak && typeof d.streak === 'object' ? d.streak : def.streak,
      settings: Object.assign({}, def.settings, d.settings, {
        okul: Object.assign({}, def.settings.okul, d.settings && d.settings.okul),
        bos: Object.assign({}, def.settings.bos, d.settings && d.settings.bos),
        rates: Object.assign({}, def.settings.rates, d.settings && d.settings.rates)
      })
    };
  } catch (e) {
    console.warn('Kayıt okunamadı', e);
    return def;
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Kaydedilemedi — depolama dolu olabilir.');
    console.warn(e);
  }
}

/* ═══════════ seçiciler ═══════════ */
const subjectById = (id) => state.subjects.find((s) => s.id === id) || null;
const subjectName = (id) => { const s = subjectById(id); return s ? s.name : 'Ders'; };
const subjectColor = (id) => { const s = subjectById(id); return s ? s.color : PALETTE[0]; };
const subjectByName = (n) =>
  state.subjects.find((s) => s.name.toLocaleLowerCase('tr') === String(n).toLocaleLowerCase('tr')) || null;

const taskById = (id) => state.tasks.find((t) => t.id === id) || null;
const taskRemaining = (t) => Math.max(0, num(t.amount) - num(t.done));
const openTasks = () => state.tasks.filter((t) => taskRemaining(t) > 0);

/** Bir görevin kaç bloğa sığacağı (ayarlardaki hıza göre). */
function blocksFor(t, settings) {
  const per = num((settings || state.settings).rates[t.unit]) || UNITS[t.unit].perBlock;
  return Math.max(1, Math.ceil(taskRemaining(t) / per));
}

const planFor = (date) => state.plans[date] || null;
