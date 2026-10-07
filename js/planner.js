'use strict';

/**
 * Plan motoru.
 *
 * Kurallar (elle yapılan programların mantığı):
 *  1. Teslim tarihi yakın ve önceliği yüksek görev öne gelir.
 *  2. Büyük görev parçalara bölünür; hepsi arka arkaya konmaz, güne yayılır.
 *  3. Aynı ders üst üste iki blok olmaz — başka seçenek kalmadıysa olur.
 *  4. Her bloktan sonra kısa mola, yemek saatinde uzun mola.
 *  5. Gün bitince sığmayan parçalar "yarına kaldı" olarak işaretlenir.
 */

function generatePlan(opts) {
  const st = opts.settings;
  const BLOCK = Math.max(20, num(st.blockLen) || 45);
  const BREAK = Math.max(5, num(st.breakLen) || 15);
  const MEAL = Math.max(15, num(st.mealLen) || 45);
  const mealAt = toMin(st.mealTime || '19:00');
  const MIN_TAIL = 20;                       // son blok en az bu kadar sürsün

  // ── 1) kapasite: güne kaç çalışma bloğu sığar? ───────────────
  let avail = opts.endMin - opts.startMin;
  if (mealAt > opts.startMin && mealAt < opts.endMin) avail -= (MEAL - BREAK);
  // +1: günün kuyruğunda kalan kısa süreyi de değerlendirebilelim
  let capacity = Math.max(1, Math.floor((avail + BREAK) / (BLOCK + BREAK)) + 1);

  // ── 2) görevleri sırala ve blokları paylaştır ────────────────
  // Amaç: acil işler yetişsin AMA gün tek derse kilitlenmesin.
  const order = opts.tasks.slice().sort((a, b) =>
    (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31') ||
    num(b.priority) - num(a.priority));

  const need = new Map();   // görev → gereken blok
  const give = new Map();   // görev → verilen blok
  for (const t of order) {
    const per = num(st.rates[t.unit]) || UNITS[t.unit].perBlock;
    need.set(t.id, Math.max(1, Math.ceil(taskRemaining(t) / per)));
    give.set(t.id, 0);
  }

  // 2a) acil olanlar (bugün/yarın teslim ya da "Acil") günün en çok %60'ını kapar
  const tomorrow = addDays(opts.date, 1);
  const isUrgent = (t) => (t.due && t.due <= tomorrow) || num(t.priority) >= 2;
  let reserve = Math.ceil(capacity * 0.6);
  for (const t of order) {
    if (capacity <= 0 || reserve <= 0) break;
    if (!isUrgent(t)) continue;
    const take = Math.min(need.get(t.id), reserve, capacity);
    give.set(t.id, take);
    reserve -= take;
    capacity -= take;
  }

  // 2b) kalan bloklar sırayla herkese birer birer — çeşitlilik için
  let guard0 = 0;
  while (capacity > 0 && guard0++ < 300) {
    let placed = false;
    for (const t of order) {
      if (capacity <= 0) break;
      if (give.get(t.id) >= need.get(t.id)) continue;
      give.set(t.id, give.get(t.id) + 1);
      capacity--;
      placed = true;
    }
    if (!placed) break;
  }

  // ── 3) verilen blokları parçalara çevir ──────────────────────
  const chunks = [];
  const skipped = [];
  for (const t of order) {
    const per = num(st.rates[t.unit]) || UNITS[t.unit].perBlock;
    const n = give.get(t.id);
    let left = taskRemaining(t);
    for (let i = 0; i < n && left > 0; i++) {
      const take = Math.min(per, left);
      chunks.push({
        taskId: t.id, subjectId: t.subjectId, title: t.title,
        amount: take, unit: t.unit,
        due: t.due || '9999-12-31', priority: num(t.priority), seq: i
      });
      left -= take;
    }
    if (left > 0) skipped.push({ taskId: t.id, amount: left, unit: t.unit });
  }

  // Sıralama: önce herkesin 1. parçası, sonra 2. parçalar…
  // Böylece büyük görev güne yayılır, gün tek derse dönmez.
  chunks.sort((a, b) =>
    a.seq - b.seq ||
    a.due.localeCompare(b.due) ||
    b.priority - a.priority);

  // ── 4) zaman dilimlerini doldur ──────────────────────────────
  const blocks = [];
  const trimmed = [];          // kısa bloğa sığmayıp kırpılan miktarlar
  let cur = opts.startMin;
  const end = opts.endMin;
  let lastSubject = null;
  let mealDone = mealAt < opts.startMin || mealAt > end;
  let guard = 0;

  while (cur < end && chunks.length && guard++ < 60) {
    const left = end - cur;
    if (left < MIN_TAIL) break;
    const len = Math.min(BLOCK, left);

    // aynı dersi arka arkaya koyma; mecbur kalırsan koy
    let idx = chunks.findIndex((c) => c.subjectId !== lastSubject);
    if (idx === -1) idx = 0;
    const c = chunks.splice(idx, 1)[0];

    // blok tam süre değilse işi de orantılı küçült
    let amount = c.amount;
    if (len < BLOCK) {
      amount = Math.max(1, Math.round(c.amount * len / BLOCK));
      if (amount < c.amount) trimmed.push({ taskId: c.taskId, amount: c.amount - amount, unit: c.unit });
    }

    blocks.push({
      id: uid(),
      type: 'work',
      start: cur,
      end: cur + len,
      subjectId: c.subjectId,
      taskId: c.taskId,
      title: c.title,
      amount: amount,
      unit: c.unit,
      short: len < BLOCK,
      done: false
    });
    lastSubject = c.subjectId;
    cur += len;

    if (cur >= end || !chunks.length) break;

    // mola — yemek saatini geçtiysek uzun mola
    const isMeal = !mealDone && cur >= mealAt - BLOCK / 2;
    const bl = Math.min(isMeal ? MEAL : BREAK, end - cur);
    if (bl >= 5) {
      blocks.push({
        id: uid(),
        type: isMeal ? 'meal' : 'break',
        start: cur,
        end: cur + bl,
        title: isMeal ? 'Yemek ve mola' : 'Mola',
        done: false
      });
      cur += bl;
    }
    if (isMeal) mealDone = true;
  }

  // son eleman mola ise at
  while (blocks.length && blocks[blocks.length - 1].type !== 'work') blocks.pop();

  // ── 5) sığmayanlar: hiç yerleştirilemeyen + plana girmeyen parçalar ──
  const leftMap = new Map();
  const addLeft = (taskId, amount, unit) => {
    const e = leftMap.get(taskId) || { taskId, amount: 0, unit };
    e.amount += amount;
    leftMap.set(taskId, e);
  };
  for (const c of chunks) addLeft(c.taskId, c.amount, c.unit);     // zamana sığmayanlar
  for (const s2 of skipped) addLeft(s2.taskId, s2.amount, s2.unit); // kapasiteye girmeyenler
  for (const s3 of trimmed) addLeft(s3.taskId, s3.amount, s3.unit);  // kısa blokta kırpılanlar

  return {
    date: opts.date,
    dayType: opts.dayType,
    start: opts.startMin,
    end: opts.endMin,
    createdAt: Date.now(),
    blocks,
    leftover: Array.from(leftMap.values())
  };
}

/* ═══════════ deneme analizi ═══════════ */

const examNet = (e, key) => num(e.nets[key] && e.nets[key].d) - num(e.nets[key] && e.nets[key].y) / 4;
const examTotal = (e) =>
  EXAM_SUBJECTS[e.kind].reduce((s, sub) => s + examNet(e, sub.key), 0);

/**
 * Netlerden kurallı tavsiye üretir. Yapay zekâ yok — veri karşılaştırması.
 */
function buildAdvice(exams) {
  const out = [];
  if (!exams.length) {
    out.push({ tone: 'tip', text: 'Henüz deneme yok. İlk denemeni ekleyince zayıf derslerini çıkarıp görev önerisi yaparım.' });
    return out;
  }

  const sorted = exams.slice().sort((a, b) => a.date.localeCompare(b.date));

  for (const kind of ['TYT', 'AYT']) {
    const list = sorted.filter((e) => e.kind === kind);
    if (!list.length) continue;
    const last = list[list.length - 1];

    // toplam net eğilimi
    if (list.length >= 2) {
      const prev = list[list.length - 2];
      const d = examTotal(last) - examTotal(prev);
      if (d >= 2) {
        out.push({ tone: 'good', text: kind + ' toplam netin son denemede ' + fmtNet(d) + ' arttı. Çalışma düzenin tutuyor, bozma.' });
      } else if (d <= -2) {
        out.push({ tone: 'warn', text: kind + ' toplam netin ' + fmtNet(Math.abs(d)) + ' düştü. Son denemede en çok kaybettiğin derse bu hafta bir blok fazla ver.' });
      } else {
        out.push({ tone: 'tip', text: kind + ' netin son iki denemede yatay (' + fmtNet(examTotal(last)) + '). Konu tekrarından soru çözümüne ağırlık kaydır.' });
      }
    } else {
      out.push({ tone: 'tip', text: kind + ' ilk denemen: ' + fmtNet(examTotal(last)) + ' net. İkinciyi ekleyince gelişimini karşılaştırırım.' });
    }

    // ders bazında en zayıf ve en çok düşen
    const rows = EXAM_SUBJECTS[kind].map((sub) => {
      const net = examNet(last, sub.key);
      const ratio = sub.max ? net / sub.max : 0;
      const prevList = list.slice(0, -1);
      const avg = prevList.length
        ? prevList.reduce((s, e) => s + examNet(e, sub.key), 0) / prevList.length
        : null;
      return { sub, net, ratio, delta: avg === null ? null : net - avg };
    });

    const weakest = rows.slice().sort((a, b) => a.ratio - b.ratio)[0];
    if (weakest && weakest.ratio < 0.6) {
      out.push({
        tone: 'warn',
        subjectName: EXAM_TO_SUBJECT[weakest.sub.key],
        text: kind + ' içinde en zayıf dersin ' + weakest.sub.name + ': ' +
          fmtNet(weakest.net) + '/' + weakest.sub.max +
          ' (%' + Math.round(weakest.ratio * 100) + '). Günlük plana bu dersten düzenli test koy.'
      });
    }

    const dropping = rows.filter((r) => r.delta !== null && r.delta <= -1.5)
      .sort((a, b) => a.delta - b.delta)[0];
    if (dropping) {
      out.push({
        tone: 'warn',
        subjectName: EXAM_TO_SUBJECT[dropping.sub.key],
        text: dropping.sub.name + ' netin ortalamanın ' + fmtNet(Math.abs(dropping.delta)) +
          ' altına düştü. Yanlışlarını konu konu ayırmadan yeni test çözme.'
      });
    }

    const rising = rows.filter((r) => r.delta !== null && r.delta >= 1.5)
      .sort((a, b) => b.delta - a.delta)[0];
    if (rising) {
      out.push({
        tone: 'good',
        text: rising.sub.name + ' ortalamanın ' + fmtNet(rising.delta) + ' üstünde. Buradaki tempoyu koru.'
      });
    }

    // yanlış oranı uyarısı
    const totD = EXAM_SUBJECTS[kind].reduce((s, sub) => s + num(last.nets[sub.key] && last.nets[sub.key].d), 0);
    const totY = EXAM_SUBJECTS[kind].reduce((s, sub) => s + num(last.nets[sub.key] && last.nets[sub.key].y), 0);
    if (totD + totY > 0 && totY / (totD + totY) > 0.3) {
      out.push({
        tone: 'warn',
        text: 'Son ' + kind + ' denemende işaretlediklerinin %' + Math.round(totY / (totD + totY) * 100) +
          "'i yanlış. Emin olmadığını boş bırakmak netini yükseltir."
      });
    }
  }

  return out;
}
