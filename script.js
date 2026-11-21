/* ==========================================================
   THE FINAL PROBLEM — a challenge from Moriarty
   ========================================================== */
(() => {
const SVGNS = 'http://www.w3.org/2000/svg';
const STORE = 'moriarty-case-v2';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = x => x * x * (3 - 2 * x);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ---------- seeded random ---------- */
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* ==========================================================
   INK-DROP IMAGE REVEAL
   An SVG mask made of growing circles, warped by turbulence,
   so the picture "bleeds" into existence like ink on paper.
   ========================================================== */
let inkCount = 0;
class InkImage {
  constructor(el) {
    this.el = el;
    this.id = ++inkCount;
    this.mode = el.dataset.mode || 'scroll';
    this.p = -1;
    this.done = false;
    const rand = rng(+el.dataset.seed || this.id * 7);

    // faint "pencil" ghost of the image underneath
    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.style.backgroundImage = `url(${el.dataset.src})`;
    el.appendChild(ghost);

    // build drops (fractional coords)
    this.drops = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const first = i === 0;
      const drop = {
        x: first ? 0.35 + rand() * 0.3 : 0.08 + rand() * 0.84,
        y: first ? 0.3 + rand() * 0.4 : 0.08 + rand() * 0.84,
        r: 0.28 + rand() * 0.22,
        t0: first ? 0 : 0.06 + i * 0.075 + rand() * 0.06,
        spat: []
      };
      const ns = 4 + Math.floor(rand() * 4);
      for (let k = 0; k < ns; k++) {
        const a = rand() * Math.PI * 2;
        const d = 0.04 + rand() * 0.11;
        drop.spat.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 0.004 + rand() * 0.016, lag: rand() * 0.06 });
      }
      this.drops.push(drop);
    }
    // the final flood that guarantees full coverage
    this.drops.push({ x: 0.5, y: 0.5, r: 0.85, t0: 0.5, spat: [] });

    // svg
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `
      <defs>
        <filter id="inkf${this.id}" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed="${this.id * 13}" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" xChannelSelector="R" yChannelSelector="G" result="d"/>
          <feGaussianBlur in="d" stdDeviation="1.2"/>
        </filter>
        <mask id="inkm${this.id}" maskUnits="userSpaceOnUse">
          <g filter="url(#inkf${this.id})" class="drops"></g>
        </mask>
      </defs>
      <image href="${el.dataset.src}" preserveAspectRatio="${el.dataset.pos || 'xMidYMid'} slice" mask="url(#inkm${this.id})"/>`;
    el.appendChild(svg);
    this.svg = svg;
    this.img = svg.querySelector('image');
    this.filter = svg.querySelector('filter');
    this.disp = svg.querySelector('feDisplacementMap');
    this.group = svg.querySelector('.drops');

    // circles
    this.circles = [];
    this.drops.forEach(d => {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('fill', '#fff');
      this.group.appendChild(c);
      d.el = c;
      d.spat.forEach(s => {
        const sc = document.createElementNS(SVGNS, 'circle');
        sc.setAttribute('fill', '#fff');
        this.group.appendChild(sc);
        s.el = sc;
      });
    });

    // natural aspect ratio for "wide" frames
    if (el.classList.contains('wide')) {
      el.style.aspectRatio = '3 / 2';
      const probe = new Image();
      probe.onload = () => {
        const r = probe.naturalWidth / probe.naturalHeight;
        el.style.aspectRatio = `${clamp(r, 0.75, 1.9)}`;
        this.layout(); this.render(true);
      };
      probe.src = el.dataset.src;
    }
    this.layout();
  }

  layout() {
    const W = this.el.clientWidth || 1, H = this.el.clientHeight || 1;
    this.W = W; this.H = H; this.D = Math.hypot(W, H);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.img.setAttribute('width', W);
    this.img.setAttribute('height', H);
    Object.entries({ x: -W * .25, y: -H * .25, width: W * 1.5, height: H * 1.5 })
      .forEach(([k, v]) => this.filter.setAttribute(k, v));
    this.disp.setAttribute('scale', Math.round(this.D * 0.07));
  }

  setProgress(p) {
    p = clamp(p);
    if (Math.abs(p - this.p) < 0.002) return;
    this.p = p;
    this.render();
  }

  render() {
    const p = this.p < 0 ? 0 : this.p;
    const { W, H, D } = this;
    // fully revealed: drop the mask for crispness & performance
    if (p >= 0.995) {
      if (!this.done) { this.img.removeAttribute('mask'); this.done = true; }
    } else if (this.done) {
      this.img.setAttribute('mask', `url(#inkm${this.id})`); this.done = false;
    }
    this.drops.forEach(d => {
      const local = clamp((p - d.t0) / Math.max(0.0001, 1 - d.t0));
      const r = d.r * D * easeOut(local);
      d.el.setAttribute('cx', d.x * W);
      d.el.setAttribute('cy', d.y * H);
      d.el.setAttribute('r', r.toFixed(1));
      d.spat.forEach(s => {
        const sl = clamp((p - d.t0 - s.lag) / 0.08);
        s.el.setAttribute('cx', (d.x + s.dx) * W);
        s.el.setAttribute('cy', (d.y + s.dy) * H);
        s.el.setAttribute('r', (s.r * D * easeOut(sl)).toFixed(1));
      });
    });
    // subtle settle: image drifts from slightly zoomed to rest
    this.svg.style.transform = `scale(${(1.08 - 0.08 * p).toFixed(4)})`;
  }
}

const inks = [];
function initInks(scope = document) {
  $$('.ink-img', scope).forEach(el => {
    if (el._ink) return;
    el._ink = new InkImage(el);
    inks.push(el._ink);
  });
}

/* ---------- hero title: split into letters ---------- */
function splitLetters(el, baseDelay, step) {
  const words = el.textContent.split(' ');
  el.textContent = '';
  let i = 0;
  words.forEach((w, wi) => {
    const wrap = document.createElement('span');
    wrap.className = 'word';
    [...w].forEach(ch => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      s.style.animationDelay = `${baseDelay + i++ * step}s`;
      wrap.appendChild(s);
    });
    el.appendChild(wrap);
    if (wi < words.length - 1) { el.appendChild(document.createTextNode(' ')); i++; }
  });
}
splitLetters($('.t-small'), 0.4, 0.08);
splitLetters($('.t-big'), 0.7, 0.07);

/* ---------- letter: split words ---------- */
const letterWords = [];
function splitWords(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === 3) {
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        letterWords.push(s);
        frag.appendChild(s);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === 1) splitWords(child);
  });
}
splitWords($('#letter-body'));

/* ==========================================================
   SCROLL LOOP
   ========================================================== */
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; update(); });
}
function update() {
  const vh = window.innerHeight;
  inks.forEach(ink => {
    if (ink.mode !== 'scroll') return;
    const r = ink.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) return;
    const cy = r.top + r.height * 0.5;
    ink.setProgress((vh * 0.92 - cy) / (vh * 0.52));
  });
  // letter words
  const lb = $('#letter-body').getBoundingClientRect();
  const lp = clamp((vh * 0.82 - lb.top) / (lb.height * 0.95));
  const on = Math.floor(lp * letterWords.length * 1.02);
  letterWords.forEach((w, i) => w.classList.toggle('on', i < on));
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { inks.forEach(i => { i.layout(); i.render(); }); update(); });

/* ---------- reveal-on-view ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.25 });
function observeReveals(scope = document) { $$('.reveal-up, .voucher', scope).forEach(el => io.observe(el)); }

/* ==========================================================
   THE ENVELOPE
   ========================================================== */
function playHero() {
  const hero = inks.find(i => i.mode === 'time');
  if (!hero) return;
  const t0 = performance.now(), dur = 4200;
  (function step(t) {
    const p = clamp((t - t0) / dur);
    hero.setProgress(p);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

$('#seal').addEventListener('click', () => {
  $('#seal').classList.add('broken');
  $('.envelope').classList.add('open');
  setTimeout(() => {
    $('#envelope-screen').classList.add('gone');
    document.body.classList.remove('locked');
    document.body.classList.add('started');
    inks.forEach(i => { i.layout(); i.render(); });
    $$('.hero .reveal-up').forEach(el => el.classList.add('in'));
    playHero();
    update();
  }, 1300);
}, { once: true });

/* ==========================================================
   CLUES
   ========================================================== */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const solved = new Set(JSON.parse(localStorage.getItem(STORE) || '[]'));
const canonical = { 1: 'Footsteps', 2: 'A keyboard', 3: 'A map' };
const insults = [
  'Tsk. Dull, Klajming. Very dull.',
  'Wrong. I expected rather more of you.',
  'Is that truly your deduction? How disappointing.',
  'Even Inspector Lestrade would blush at that answer.',
  'No. Think, man. Observe!',
  'I am yawning, Klajming. Audibly.'
];
const praises = [
  'Correct\u2026 annoyingly so.',
  'Hm. Correct. Do not let it go to your head.',
  'Right again. How tiresome of you.'
];

function markSolved(n, animate) {
  const sec = $(`.clue[data-clue="${n}"]`);
  sec.classList.add('solved');
  const input = $('input', sec);
  input.value = canonical[n];
  input.disabled = true;
  $('button[type=submit]', sec).disabled = true;
  if (!animate) $('.solved-stamp', sec).style.animation = 'none', $('.solved-stamp', sec).style.opacity = .85, $('.solved-stamp', sec).style.transform = 'rotate(-14deg)';
  $(`.tracker-dot[data-dot="${n}"]`).classList.add('on');
  updateDoor(animate);
}

function updateDoor(animate) {
  const left = 3 - solved.size;
  const words = ['No clues', 'One clue', 'Two clues', 'Three clues'];
  $('#remaining').textContent = words[left];
  if (left === 0) openDoor(animate);
}

function openDoor(animate) {
  const finale = $('#finale');
  if (!finale.hidden) return;
  const go = () => {
    $('#door').classList.add('open');
    finale.hidden = false;
    initInks(finale);
    inks.forEach(i => { i.layout(); i.render(); });
    observeReveals(finale);
    update();
    if (animate) setTimeout(() => finale.scrollIntoView({ behavior: 'smooth' }), 150);
  };
  if (animate) {
    $('.door-locked p').textContent = 'Click.';
    $('.door-sub').textContent = 'Somewhere, a lock gives way\u2026';
    setTimeout(go, 1800);
  } else go();
}

$$('.clue').forEach(sec => {
  const n = +sec.dataset.clue;
  const form = $('form', sec);
  const input = $('input', sec);
  const fb = $('.feedback', sec);
  const answers = form.dataset.answers.split(',');
  let tries = 0;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = norm(input.value);
    if (!v) return;
    if (answers.includes(v)) {
      solved.add(n);
      localStorage.setItem(STORE, JSON.stringify([...solved]));
      fb.textContent = praises[Math.floor(Math.random() * praises.length)];
      fb.classList.add('good');
      markSolved(n, true);
    } else {
      fb.textContent = insults[tries++ % insults.length];
      fb.classList.remove('good');
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    }
  });

  // hints
  const hb = $('.hint-btn', sec);
  const hints = hb.dataset.hints.split('|');
  let h = 0;
  hb.textContent = 'Need a hint? (Moriarty will judge you)';
  hb.addEventListener('click', () => {
    if (h >= hints.length) return;
    const p = document.createElement('p');
    p.className = 'hint-text';
    p.innerHTML = hints[h++];
    hb.before(p);
    hb.textContent = h < hints.length ? 'Still lost? Another hint\u2026' : '';
    if (h >= hints.length) hb.remove();
  });

  if (solved.has(n)) markSolved(n, false);
});

/* ---------- invisible ink lens ---------- */
const sp = $('#secret-paper');
const moveLens = e => {
  const r = sp.getBoundingClientRect();
  sp.style.setProperty('--x', `${e.clientX - r.left}px`);
  sp.style.setProperty('--y', `${e.clientY - r.top}px`);
};
sp.addEventListener('pointermove', moveLens);
sp.addEventListener('pointerdown', moveLens);
sp.addEventListener('pointerleave', () => {
  sp.style.setProperty('--x', '-200px');
  sp.style.setProperty('--y', '-200px');
});

/* ---------- voucher actions ---------- */
$('#copy-code').addEventListener('click', async e => {
  const code = $('#voucher-code').textContent.trim();
  try { await navigator.clipboard.writeText(code); }
  catch {
    const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove();
  }
  e.target.textContent = 'Copied \u2713';
  setTimeout(() => (e.target.textContent = 'Copy voucher number'), 2000);
});
$('#print').addEventListener('click', () => window.print());
$('#reset').addEventListener('click', () => {
  localStorage.removeItem(STORE);
  location.reload();
});

/* ---------- go ---------- */
initInks();
observeReveals();
update();
})();
