'use strict';

/* Hafif konfeti — dış kütüphane yok, çevrimdışı çalışır. */
const FX = (function () {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  let parts = [];
  let raf = 0;
  let dpr = 1;

  const COLORS = ['#6ea8fe', '#5ee7c2', '#ffd166', '#ff8fa3', '#c3a6ff', '#ffb088', '#ffffff'];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(innerWidth * dpr);
    cv.height = Math.floor(innerHeight * dpr);
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function spawn(x, y, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * power;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - power * 0.6,
        w: 5 + Math.random() * 6,
        h: 7 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32;            // yerçekimi
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.009;
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.cos(p.rot)) * 0.6));
      ctx.restore();
    }
    parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 60);
    if (parts.length) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      raf = 0;
    }
  }

  return {
    /** Bir elemanın üstünden küçük patlama. */
    burst(el) {
      if (reduced) return;
      const r = el ? el.getBoundingClientRect()
                   : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
      spawn(r.left + r.width / 2, r.top + r.height / 2, 26, 7);
    },
    /** Gün bitince büyük kutlama. */
    celebrate() {
      if (reduced) return;
      const y = innerHeight * 0.32;
      spawn(innerWidth * 0.2, y, 60, 11);
      setTimeout(() => spawn(innerWidth * 0.8, y, 60, 11), 140);
      setTimeout(() => spawn(innerWidth * 0.5, y * 0.8, 70, 13), 280);
    }
  };
})();
