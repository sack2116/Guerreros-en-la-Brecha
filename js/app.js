// Pages: inicio, apuntarme (step-by-step sign-up), calendario, mis horas, imprimir, admin.
// Everything is rendered from plain state into #app; clicks are handled by data-act buttons.
import * as S from './schedule.js';
import { openStore, friendlyError } from './store.js';
import { SITE_NAME, SITE_TAGLINE, OPEN_DAYS_BEFORE, COORDINATOR_WHATSAPP } from './config.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const NAME_KEY = 'brecha.name';
const SIZE_KEY = 'brecha.size';
const SIZES = [1, 1.15, 1.3];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const siteUrl = () => location.href.split('#')[0].split('?')[0];
const msgOpts = () => ({ siteName: `${SITE_NAME} — ${SITE_TAGLINE}`, url: siteUrl() });
const waLink = (text, phone = '') => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }

let store = null;
let isAdmin = false;

// "?hoy=2026-10-26" pretends today is another day, only in demo mode (for testing the sign-up window).
function today() {
  const fake = new URLSearchParams(location.search).get('hoy');
  if (store?.mode === 'demo' && /^\d{4}-\d{2}-\d{2}$/.test(fake || '')) {
    const [y, m, d] = fake.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}
const win = () => S.signupWindow(today(), OPEN_DAYS_BEFORE);

// ─────────────── live data per month ───────────────
const cache = new Map();
const subs = new Map();
function monthList(month) {
  if (!subs.has(month)) {
    subs.set(month, store.watchMonth(month, (list) => { cache.set(month, list); dataChanged(); },
      (e) => toast(friendlyError(e))));
  }
  return (cache.get(month) || []).filter(c => !c.cancelled);
}
const loaded = (month) => cache.has(month);

// Don't redraw under someone's fingers while they type; redraw when they leave the field.
// Updates are batched into one redraw on the next frame (data can arrive mid-render).
let pendingRender = false;
let frame = 0;
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
function dataChanged() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (typing()) { pendingRender = true; return; }
    render();
  });
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (pendingRender && !typing()) { pendingRender = false; render(); }
}, 50));

// ─────────────── little helpers ───────────────
let toastTimer;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}
function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  return { path: path || '', q: new URLSearchParams(query || '') };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function downloadICS(c) {
  const blob = new Blob([S.buildICS(c, msgOpts())], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mi-hora-de-oracion.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('✅ Copiado. Ahora pégalo en WhatsApp.'); } catch { toast('Mantén el dedo sobre el texto para copiarlo.'); }
}
const helpButton = () => (COORDINATOR_WHATSAPP
  ? `<a class="btn ghost" href="${waLink(`Hola, necesito ayuda con ${SITE_NAME}.`, COORDINATOR_WHATSAPP)}" target="_blank" rel="noopener">📞 ¿Necesitas ayuda? Escríbenos</a>`
  : '');
const peopleText = (n) => (n === 0 ? 'Libre' : n === 1 ? '1 persona' : `${n} personas`);
const FULL_TEXT = 'Ya hay suficientes Guerreros en esta hora';
const roomText = (n) => {
  const left = S.MAX_PER_HOUR - n;
  return left === 1 ? 'Queda 1 lugar' : `Quedan ${left} lugares`;
};
const daysText = (days) => `${days.length === 1 ? 'el día' : 'los días'} ${S.listLabel(days.map(String))}`;
// First day of a month that can still be signed up for (today, in the current month).
function firstOpenDay(month) {
  const t = today();
  if (month === S.keyOf(t)) return t.getDate();
  return month < S.keyOf(t) ? S.daysInMonth(month) + 1 : 1;
}
// Is there any day left this month with room at this hour?
function hourHasRoom(list, month, h) {
  const from = firstOpenDay(month);
  return S.fullDays(list, month, h, from).length < S.daysInMonth(month) - from + 1;
}
// Fit several new sign-ups one after another, so they also count against each other.
function fitAll(items, list) {
  const taken = [...list];
  const out = [];
  for (const item of items) {
    const { c } = S.fitToRoom(item, taken);
    if (!S.isComplete(c)) continue;
    out.push(c);
    taken.push({ ...c, cancelled: false });
  }
  return out;
}
const chips = (names) => names.map(n => `<span class="chip">${esc(n)}</span>`).join('');

// ─────────────── inicio ───────────────
function viewHome() {
  const w = win();
  const now = today();
  const list = monthList(w.current);
  const hours = S.dayHours(list, w.current, now.getDate());
  const name = safeGet(NAME_KEY);
  const repeat = repeatCandidates();
  const nextStatus = w.nextOpen
    ? `<p class="status open">✅ Ya puedes apuntarte para <b>${S.monthLabel(w.next)}</b>.</p>`
    : `<p class="status">📅 Las inscripciones para <b>${S.monthLabel(w.next)}</b> abren el <b>${S.shortDate(w.opensOn)}</b>. Mientras tanto puedes apuntarte en ${S.monthLabel(w.current)}.</p>`;
  return `
    <figure class="banner">
      <img src="images/brecha.jpg" width="452" height="565" alt="¿Quién se pondrá en la brecha? Un hombre arrodillado orando en la brecha de un muro en llamas. Ezequiel 22:30">
      <figcaption>Arte: Luz Navy</figcaption>
    </figure>
    <section class="hero">
      <h1>${esc(SITE_NAME)}</h1>
      <p class="tagline">${esc(SITE_TAGLINE)}</p>
    </section>
    <section class="verses">
      <blockquote>
        <p>“Orando en todo tiempo con toda oración y súplica en el Espíritu, y velando en ello con toda perseverancia y súplica por todos los santos.”</p>
        <cite>Efesios 6:18</cite>
      </blockquote>
      <blockquote>
        <p>“Y busqué entre ellos hombre que hiciese vallado y que se pusiese en la brecha delante de mí, a favor de la tierra, para que yo no la destruyese; y no lo hallé.”</p>
        <cite>Ezequiel 22:30</cite>
      </blockquote>
    </section>
    ${name ? `<p class="hello">¡Bendiciones, <b>${esc(name)}</b>! 🙏</p>` : ''}
    ${nextStatus}
    <button class="btn primary big" data-act="start">🙏 Apuntarme para orar</button>
    ${repeat.length ? `<button class="btn gold big" data-act="repeat">🔁 Repetir mi horario en ${S.monthLabel(w.next)}</button>` : ''}
    <section class="card today">
      <h2>Hoy, ${esc(S.dayLabel(w.current, now.getDate()))}</h2>
      <h3>🌅 Matutino</h3>
      ${S.MATUTINO.map(h => `
        <div class="slot ${hours[h].length ? 'filled' : 'empty'} matutino">
          <div class="when">${S.hourLabel(h)}</div>
          <div class="who">${hours[h].length ? chips(hours[h]) : '<span class="free">Libre · ¡te esperamos!</span>'}</div>
        </div>`).join('')}
      <p class="muted">${hours.filter(n => n.length).length} de 24 horas cubiertas hoy.</p>
      <button class="btn ghost" data-act="go" data-to="#/calendario">📅 Ver el calendario completo</button>
    </section>
    ${helpButton()}`;
}

// Hours this phone signed up for itself (not the ones the coordinator added for other people).
const isMine = (c) => c.owner === store.uid && !c.addedBy;

// The hours this phone signed up for this month that aren't in next month yet.
function repeatCandidates() {
  const w = win();
  if (!w.nextOpen) return [];
  const mine = monthList(w.current).filter(isMine);
  const next = monthList(w.next);
  if (!loaded(w.next)) return [];
  return fitAll(mine.map(c => S.copyToMonth(c, w.next)).filter(c => !next.some(n => S.sameCommitment(n, c))), next);
}

// ─────────────── apuntarme (step by step) ───────────────
let wiz = null;
function newWizard(prefill = {}) {
  const w = win();
  return {
    step: 'name',
    name: safeGet(NAME_KEY) || '',
    month: prefill.month || (w.nextOpen ? w.next : w.current),
    hour: prefill.hour ?? null,
    kind: prefill.kind || null,
    weekdays: [],
    dates: prefill.dates || [],
    created: null,
  };
}
function startWizard(prefill) {
  wiz = newWizard(prefill);
  go('#/apuntarme');
}
const wizSteps = () => ['name', ...(win().nextOpen ? ['month'] : []), 'hour', 'days', 'confirm'];

function viewWizard() {
  if (!wiz) wiz = newWizard();
  if (wiz.step === 'done') return wizDone();
  const steps = wizSteps();
  const n = steps.indexOf(wiz.step) + 1;
  const back = n > 1 ? '<button class="btn back" data-act="wiz-back">← Atrás</button>' : '<button class="btn back" data-act="go" data-to="#/">← Inicio</button>';
  const body = { name: wizName, month: wizMonth, hour: wizHour, days: wizDays, confirm: wizConfirm }[wiz.step]();
  return `<div class="wizard">${back}<p class="progress">Paso ${n} de ${steps.length}</p>${body}</div>`;
}

function wizName() {
  return `
    <h1>¿Cómo te llamas?</h1>
    <p class="muted">Escribe tu nombre y apellido. Así aparecerá en el calendario.</p>
    <input class="big-input" id="wiz-name" data-bind="wiz.name" value="${esc(wiz.name)}" autocomplete="name" placeholder="Ej.: María González" maxlength="60">
    <button class="btn primary big" data-act="wiz-name">Siguiente →</button>`;
}

function wizMonth() {
  const w = win();
  return `
    <h1>¿Para qué mes?</h1>
    ${[w.next, w.current].map(m => `
      <button class="btn option ${wiz.month === m ? 'selected' : ''}" data-act="wiz-month" data-m="${m}">
        📅 ${S.monthLabel(m)}${m === w.next ? ' <small>(el próximo mes)</small>' : ' <small>(este mes)</small>'}
      </button>`).join('')}`;
}

function hourButton(h, month, selected, act) {
  const list = monthList(month);
  const n = S.namesForHour(list, month, h).length;
  if (S.isLimited(h) && !hourHasRoom(list, month, h)) {
    return `<button class="btn hour full" data-act="hour-full" data-h="${h}">
      <span class="when">${S.hourLabel(h)}</span><span class="count">${FULL_TEXT}</span></button>`;
  }
  return `<button class="btn hour ${selected === h ? 'selected' : ''} ${n ? '' : 'nobody'}" data-act="${act}" data-h="${h}">
    <span class="when">${S.hourLabel(h)}</span><span class="count">${peopleText(n)}</span></button>`;
}

function wizHour() {
  return `
    <h1>¿A qué hora quieres orar?</h1>
    <p class="muted">Cada hora dura 60 minutos. En el Matutino caben todos; en las demás horas, hasta ${S.MAX_PER_HOUR} personas.</p>
    <section class="card matutino-card">
      <h2>🌅 Matutino</h2>
      <p>Nuestra hora especial: de 5 a 7 de la mañana. ¡Siempre hay lugar!</p>
      ${S.MATUTINO.map(h => hourButton(h, wiz.month, wiz.hour, 'wiz-hour')).join('')}
    </section>
    <h2 class="other-title">Otras horas</h2>
    ${S.GROUPS.filter(g => g.id !== 'matutino').map(g => `
      <h3>${g.title}</h3>
      <div class="hour-grid">${g.hours.map(h => hourButton(h, wiz.month, wiz.hour, 'wiz-hour')).join('')}</div>`).join('')}`;
}

// The "which days" chooser, shared by the sign-up steps and the admin form.
function daysPicker(state, target, { allowPast = false, list = monthList(state.month) } = {}) {
  const t = today();
  const full = S.fullDays(list, state.month, state.hour);
  const isCurrent = state.month === S.keyOf(t);
  const options = [
    ['daily', '📆 Todos los días del mes'],
    ['weekdays', '💼 De lunes a viernes'],
    ['weekly', '🗓️ Uno o varios días de la semana'],
    ['dates', '🔢 Fechas específicas'],
  ];
  let extra = '';
  if (state.kind === 'weekly') {
    extra = `<p class="muted">Toca los días que quieres:</p><div class="toggle-row">${[1, 2, 3, 4, 5, 6, 0].map(d => `
      <button class="btn toggle ${state.weekdays.includes(d) ? 'selected' : ''}" data-act="wd" data-target="${target}" data-d="${d}">${S.cap(S.DIAS[d])}</button>`).join('')}</div>`;
  } else if (state.kind === 'dates') {
    const lead = (S.weekdayOf(state.month, 1) + 6) % 7;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span></span>');
    for (let d = 1; d <= S.daysInMonth(state.month); d++) {
      const past = !allowPast && isCurrent && d < t.getDate();
      const isFull = full.includes(d);
      cells.push(`<button class="date ${state.dates.includes(d) ? 'selected' : ''} ${isFull ? 'full' : ''}" data-act="date" data-target="${target}" data-d="${d}" ${past || isFull ? 'disabled' : ''} ${isFull ? `title="${FULL_TEXT}"` : ''}>${d}</button>`);
    }
    extra = `<p class="muted">Toca las fechas que quieres${full.length ? ' (las grises ya están llenas)' : ''}:</p>
      <div class="mini-cal"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>${cells.join('')}</div>`;
  }
  let note = '';
  if (state.kind && state.hour !== null) {
    const fit = S.fitToRoom(S.copyToMonth(state, state.month), list);
    const picked = state.kind !== 'weekly' || state.weekdays.length;
    if (picked && !S.isComplete(fit.c)) note = `<p class="note full-note">⚠️ ${FULL_TEXT} esos días. Escoge otros días u otra hora.</p>`;
    else if (fit.skipped.length && state.kind !== 'dates') note = `<p class="note">ℹ️ ${FULL_TEXT} ${daysText(fit.skipped)}. Te apuntamos en los demás días.</p>`;
  }
  return `${options.map(([k, label]) => `
    <button class="btn option ${state.kind === k ? 'selected' : ''}" data-act="kind" data-target="${target}" data-k="${k}">${label}</button>
    ${state.kind === k ? extra : ''}`).join('')}${note}`;
}

// The sign-up as it will be saved: this month's days, minus the ones already full.
const wizFitted = () => S.fitToRoom({ ...S.copyToMonth(wiz, wiz.month), name: wiz.name }, monthList(wiz.month)).c;

function wizDays() {
  const ready = wiz.kind && S.isComplete(wizFitted());
  return `
    <h1>¿Qué días?</h1>
    <p class="muted">${S.monthLabel(wiz.month)} · ${S.hourLabel(wiz.hour)}</p>
    ${daysPicker(wiz, 'wiz')}
    <button class="btn primary big" data-act="wiz-days" ${ready ? '' : 'disabled'}>Siguiente →</button>`;
}

function wizConfirm() {
  const others = S.namesForHour(monthList(wiz.month), wiz.month, wiz.hour)
    .filter(n => n.toLocaleLowerCase('es') !== wiz.name.trim().toLocaleLowerCase('es'));
  return `
    <h1>¿Está todo bien?</h1>
    <section class="card summary">
      <p class="who-big">🙏 ${esc(wiz.name)}</p>
      <p>🕔 ${S.hourLabel(wiz.hour)}</p>
      <p>📅 ${S.patternLabel(wizFitted())}</p>
      <p>🗓️ ${S.monthLabel(wiz.month)}</p>
      ${others.length ? `<p class="together">🤝 A esta hora también oran: ${chips(others)}</p>` : '<p class="together">⭐ ¡Serás la primera persona en esta hora!</p>'}
    </section>
    <button class="btn primary big" data-act="wiz-save">✅ Sí, apuntarme</button>
    <button class="btn ghost" data-act="wiz-back">✏️ Cambiar algo</button>`;
}

function wizDone() {
  const c = wiz.created;
  return `
    <div class="wizard done">
      <div class="flame" aria-hidden="true">🙌</div>
      <h1>¡Gracias, ${esc(c.name.split(' ')[0])}!</h1>
      <p class="big-text">${wiz.already ? 'Ya estabas apuntado(a) en esta hora.' : 'Quedaste apuntado(a):'}</p>
      <section class="card summary"><p>🕔 ${S.hourLabel(c.hour)}</p><p>📅 ${S.patternLabel(c)} · ${S.monthLabel(c.month)}</p></section>
      <button class="btn gold big" data-act="ics-new">⏰ Poner alarma en mi teléfono</button>
      <p class="muted">Agrega tus horas al calendario del teléfono con un aviso 10 minutos antes.</p>
      <a class="btn ghost" href="${waLink(`Me apunté para orar con ${SITE_NAME} 🙏 ¡Apúntate tú también! ${siteUrl()}`)}" target="_blank" rel="noopener">💬 Invitar a alguien por WhatsApp</a>
      <button class="btn ghost" data-act="start">➕ Apuntarme en otra hora</button>
      <button class="btn ghost" data-act="go" data-to="#/calendario?m=${c.month}">📅 Ver el calendario</button>
    </div>`;
}

// ─────────────── calendario ───────────────
function viewCalendar(q) {
  const t = today();
  const month = S.isValidMonth(q.get('m')) ? q.get('m') : S.keyOf(t);
  const days = S.daysInMonth(month);
  let day = Number(q.get('d')) || (month === S.keyOf(t) ? t.getDate() : 1);
  day = Math.min(Math.max(day, 1), days);
  const list = monthList(month);
  const lead = (S.weekdayOf(month, 1) + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    const cov = S.dayCoverage(list, month, d);
    const isToday = month === S.keyOf(t) && d === t.getDate();
    cells.push(`<button class="cal-day ${cov.full ? 'full' : 'open'} ${d === day ? 'selected' : ''} ${isToday ? 'today' : ''}" data-act="go" data-to="#/calendario?m=${month}&d=${d}" aria-label="${S.dayLabel(month, d)}, ${cov.full ? 'lleno' : 'hay lugar'}">
      <span class="num">${d}</span><span class="sun">${cov.matutino ? '🌅' : ''}</span></button>`);
  }
  const hours = S.dayHours(list, month, day);
  const covered = hours.filter(n => n.length).length;
  const row = (h) => {
    const n = hours[h].length;
    const full = S.isLimited(h) && n >= S.MAX_PER_HOUR;
    let hint = '<span class="free">Libre · toca para apuntarte</span>';
    if (full) hint = `<span class="room">${FULL_TEXT}</span>`;
    else if (n && S.isLimited(h)) hint = `<span class="room open">${roomText(n)} · toca para unirte</span>`;
    else if (n) hint = '<span class="room open">Siempre hay lugar · toca para unirte</span>';
    return `
    <button class="slot ${full ? 'full' : n ? 'filled' : 'empty'} ${S.MATUTINO.includes(h) ? 'matutino' : ''}" data-act="${full ? 'hour-full' : 'slot'}" data-m="${month}" data-d="${day}" data-h="${h}">
      <div class="when">${S.hourLabel(h)}</div>
      ${n ? `<div class="who">${chips(hours[h])}</div>` : ''}
      <div>${hint}</div>
    </button>`;
  };
  const prev = day > 1 ? `#/calendario?m=${month}&d=${day - 1}` : `#/calendario?m=${S.addMonths(month, -1)}&d=${S.daysInMonth(S.addMonths(month, -1))}`;
  const next = day < days ? `#/calendario?m=${month}&d=${day + 1}` : `#/calendario?m=${S.addMonths(month, 1)}&d=1`;
  return `
    <div class="month-head">
      <button class="btn icon" data-act="go" data-to="#/calendario?m=${S.addMonths(month, -1)}" aria-label="Mes anterior">◀</button>
      <h1>${S.monthLabel(month)}</h1>
      <button class="btn icon" data-act="go" data-to="#/calendario?m=${S.addMonths(month, 1)}" aria-label="Mes siguiente">▶</button>
    </div>
    <div class="cal"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>${cells.join('')}</div>
    <p class="legend"><span class="dot open"></span>Hay lugar <span class="dot full"></span>Lleno · 🌅 Matutino cubierto</p>
    <section class="day-detail">
      <div class="day-head">
        <button class="btn icon" data-act="go" data-to="${prev}" aria-label="Día anterior">◀</button>
        <div><h2>${S.cap(S.dayLabel(month, day))}</h2><p class="muted">${covered} de 24 horas cubiertas</p></div>
        <button class="btn icon" data-act="go" data-to="${next}" aria-label="Día siguiente">▶</button>
      </div>
      ${!loaded(month) ? '<p class="muted">Cargando…</p>' : ''}
      <h3>🌅 Matutino</h3>
      ${S.MATUTINO.map(row).join('')}
      <h3>⏰ Las demás horas</h3>
      ${Array.from({ length: 24 }, (_, h) => h).filter(h => !S.MATUTINO.includes(h)).map(row).join('')}
      <a class="btn ghost" href="${waLink(S.dailyMessage(list, month, day, msgOpts()))}" target="_blank" rel="noopener">💬 Compartir este día por WhatsApp</a>
      <button class="btn ghost" data-act="go" data-to="#/imprimir?m=${month}">🖨️ Versión para imprimir</button>
    </section>`;
}

// ─────────────── mis horas ───────────────
function viewMine() {
  const w = win();
  const months = [w.current, w.next];
  const mine = months.flatMap(m => monthList(m).filter(isMine));
  const repeat = repeatCandidates();
  return `
    <h1>⭐ Mis horas</h1>
    ${mine.length ? '' : '<p class="big-text">Todavía no tienes horas apuntadas en este teléfono.</p>'}
    ${months.map(m => {
      const items = mine.filter(c => c.month === m).sort((a, b) => a.hour - b.hour);
      if (!items.length) return '';
      return `<h2>${S.monthLabel(m)}</h2>${items.map(c => `
        <section class="card mine">
          <p class="who-big">🕔 ${S.hourLabel(c.hour)}</p>
          <p>📅 ${S.patternLabel(c)}</p>
          <p class="muted">A nombre de ${esc(c.name)}</p>
          <div class="row">
            <button class="btn gold" data-act="ics" data-id="${c.id}" data-m="${m}">⏰ Poner alarma</button>
            <button class="btn danger" data-act="cancel" data-id="${c.id}">Ya no puedo</button>
          </div>
        </section>`).join('')}`;
    }).join('')}
    ${repeat.length ? `<button class="btn gold big" data-act="repeat">🔁 Repetir mi horario en ${S.monthLabel(w.next)}</button>` : ''}
    <button class="btn primary big" data-act="start">🙏 Apuntarme en una hora</button>
    <p class="muted">¿Te apuntaron desde otro teléfono o el coordinador? Esas horas no salen aquí, pero sí en el calendario.</p>
    ${helpButton()}`;
}

// ─────────────── imprimir ───────────────
function viewPrint(q) {
  const month = S.isValidMonth(q.get('m')) ? q.get('m') : S.keyOf(today());
  const list = monthList(month);
  const order = [...S.MATUTINO, ...Array.from({ length: 24 }, (_, h) => h).filter(h => !S.MATUTINO.includes(h))];
  const emptyDays = [];
  for (let d = 1; d <= S.daysInMonth(month); d++) {
    const cov = S.dayCoverage(list, month, d);
    if (cov.covered < 24) emptyDays.push(`${d} (${24 - cov.covered})`);
  }
  return `
    <div class="print">
      <div class="no-print row"><button class="btn primary" data-act="print">🖨️ Imprimir</button><button class="btn ghost" data-act="go" data-to="#/calendario?m=${month}">← Volver</button></div>
      <div class="print-church"><img src="images/logo.png" alt="" width="56" height="56"><div><b>Iglesia El Refugio</b><br>Ministerio de Dios Jesús Faro de Luz</div></div>
      <h1>🔥 ${esc(SITE_NAME)}</h1>
      <p class="tagline">${esc(SITE_TAGLINE)} · ${S.monthLabel(month)}</p>
      <table>
        <thead><tr><th>Hora</th><th>Guerreros</th></tr></thead>
        <tbody>${order.map(h => {
          const items = list.filter(c => c.hour === h).sort((a, b) => a.name.localeCompare(b.name, 'es'));
          return `<tr class="${S.MATUTINO.includes(h) ? 'matutino' : ''}"><td>${S.MATUTINO.includes(h) ? '🌅 ' : ''}${S.hourLabel(h)}</td>
            <td>${items.length ? items.map(c => `<b>${esc(c.name)}</b> — ${S.patternLabel(c)}`).join('<br>') : '<i>libre</i>'}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <p><b>Días con horas sin cubrir</b> (horas libres): ${emptyDays.length ? emptyDays.join(', ') : '¡ninguno! 🙌'}</p>
      <p class="muted">Apúntate en: ${esc(siteUrl())}</p>
    </div>`;
}

// ─────────────── admin ───────────────
let af = null;   // admin form state
const blankForm = (month) => ({ editId: null, name: '', hour: 5, month, kind: 'daily', weekdays: [], dates: [] });

function viewAdmin(q) {
  if (!isAdmin) {
    return `
      <h1>🔐 Coordinador</h1>
      <p class="muted">Solo para quien organiza el calendario.</p>
      <label>Usuario<input class="big-input" id="adm-user" autocomplete="username" autocapitalize="none"></label>
      <label>PIN<input class="big-input" id="adm-pin" type="password" autocomplete="current-password" autocapitalize="characters"></label>
      <button class="btn primary big" data-act="admin-login">Entrar</button>
      ${store.mode === 'demo' ? '<p class="muted">Modo de prueba: usuario <b>admin</b>, PIN <b>DEMO</b>.</p>' : ''}`;
  }
  const w = win();
  const month = S.isValidMonth(q.get('m')) ? q.get('m') : (w.nextOpen ? w.next : w.current);
  if (!af || af.month !== month) af = blankForm(month);
  const list = monthList(month);
  const prev = S.addMonths(month, -1);
  const prevList = monthList(prev);
  const toCopy = fitAll(prevList.map(c => S.copyToMonth(c, month)).filter(c => !list.some(x => S.sameCommitment(x, c))), list);
  const t = today();
  const msgDay = Number(q.get('d')) || (month === S.keyOf(t) ? Math.min(t.getDate() + 1, S.daysInMonth(month)) : 1);
  const daily = S.dailyMessage(list, month, msgDay, msgOpts());
  const invite = S.inviteMessage(month, msgOpts());
  const covered = Array.from({ length: S.daysInMonth(month) }, (_, i) => S.dayCoverage(list, month, i + 1));
  const matDays = covered.filter(c => c.matutino).length;
  const fullDays = covered.filter(c => c.covered === 24).length;

  return `
    <div class="admin">
      <div class="month-head">
        <button class="btn icon" data-act="go" data-to="#/admin?m=${prev}" aria-label="Mes anterior">◀</button>
        <h1>${S.monthLabel(month)}</h1>
        <button class="btn icon" data-act="go" data-to="#/admin?m=${S.addMonths(month, 1)}" aria-label="Mes siguiente">▶</button>
      </div>
      <div class="stats">
        <div><b>${new Set(list.map(c => c.name.trim().toLowerCase())).size}</b><span>guerreros</span></div>
        <div><b>${matDays}/${covered.length}</b><span>días con Matutino</span></div>
        <div><b>${fullDays}/${covered.length}</b><span>días 24 horas</span></div>
      </div>

      <section class="card">
        <h2>${af.editId ? '✏️ Cambiar inscripción' : '➕ Apuntar a alguien'}</h2>
        <label>Nombre completo<input class="big-input" data-bind="af.name" value="${esc(af.name)}" maxlength="60"></label>
        <label>Hora<select class="big-input" data-bind="af.hour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${af.hour === h ? 'selected' : ''}>${S.MATUTINO.includes(h) ? '🌅 ' : ''}${S.hourLabel(h)}</option>`).join('')}</select></label>
        ${daysPicker(af, 'af', { allowPast: true, list: list.filter(c => c.id !== af.editId) })}
        <div class="row">
          <button class="btn primary" data-act="af-save">${af.editId ? 'Guardar cambios' : 'Apuntar'}</button>
          ${af.editId ? '<button class="btn ghost" data-act="af-cancel">Cancelar</button>' : ''}
        </div>
      </section>

      <section class="card">
        <h2>📋 Inscritos (${list.length})</h2>
        ${list.length ? '' : '<p class="muted">Nadie todavía este mes.</p>'}
        ${[...S.MATUTINO, ...Array.from({ length: 24 }, (_, h) => h).filter(h => !S.MATUTINO.includes(h))].map(h => {
          const items = list.filter(c => c.hour === h).sort((a, b) => a.name.localeCompare(b.name, 'es'));
          if (!items.length) return '';
          return `<h3>${S.MATUTINO.includes(h) ? '🌅 ' : ''}${S.hourLabel(h)}</h3>${items.map(c => `
            <div class="admin-row">
              <div><b>${esc(c.name)}</b><br><span class="muted">${S.patternLabel(c)}${c.addedBy ? ' · apuntado por coordinador' : ''}</span></div>
              <div class="row"><button class="btn small" data-act="af-edit" data-id="${c.id}">Cambiar</button><button class="btn small danger" data-act="af-remove" data-id="${c.id}">Quitar</button></div>
            </div>`).join('')}`;
        }).join('')}
        ${toCopy.length ? `<button class="btn gold" data-act="copy-prev" data-m="${month}">🔁 Copiar ${toCopy.length} inscripciones de ${S.monthLabel(prev)}</button>` : ''}
      </section>

      <section class="card">
        <h2>💬 Mensaje del día para WhatsApp</h2>
        <label>Día<select class="big-input" data-act-change="msg-day" data-m="${month}">${Array.from({ length: S.daysInMonth(month) }, (_, i) => `<option value="${i + 1}" ${msgDay === i + 1 ? 'selected' : ''}>${S.cap(S.dayLabel(month, i + 1))}</option>`).join('')}</select></label>
        <textarea readonly rows="10">${esc(daily)}</textarea>
        <div class="row">
          <button class="btn primary" data-act="copy" data-text="${esc(daily)}">📋 Copiar</button>
          <a class="btn ghost" href="${waLink(daily)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        </div>
      </section>

      <section class="card">
        <h2>📣 Invitación para apuntarse</h2>
        <textarea readonly rows="6">${esc(invite)}</textarea>
        <div class="row">
          <button class="btn primary" data-act="copy" data-text="${esc(invite)}">📋 Copiar</button>
          <a class="btn ghost" href="${waLink(invite)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        </div>
      </section>

      <div class="row">
        <button class="btn ghost" data-act="go" data-to="#/imprimir?m=${month}">🖨️ Imprimir el mes</button>
        <button class="btn ghost" data-act="admin-logout">Salir del modo coordinador</button>
      </div>
    </div>`;
}

// ─────────────── actions ───────────────
const stateOf = (target) => (target === 'af' ? af : wiz);
const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

const actions = {
  go: (d) => go(d.to),
  start: () => startWizard(),
  'wiz-back': () => {
    const steps = wizSteps();
    wiz.step = steps[Math.max(0, steps.indexOf(wiz.step) - 1)];
    render();
  },
  'wiz-name': () => {
    wiz.name = (document.getElementById('wiz-name')?.value || '').trim().replace(/\s+/g, ' ');
    if (wiz.name.length < 2) { toast('Escribe tu nombre, por favor.'); return; }
    safeSet(NAME_KEY, wiz.name);
    wiz.step = wizSteps()[1];
    render();
  },
  'wiz-month': (d) => {
    if (wiz.month !== d.m) { wiz.month = d.m; wiz.dates = []; }
    wiz.step = 'hour';
    render();
  },
  'hour-full': () => toast(`${FULL_TEXT}. ¡Escoge otra hora, por favor! 🙏`),
  'wiz-hour': (d) => { wiz.hour = Number(d.h); wiz.step = 'days'; render(); },
  kind: (d) => { const s = stateOf(d.target); s.kind = d.k; render(); },
  wd: (d) => { const s = stateOf(d.target); s.weekdays = toggle(s.weekdays, Number(d.d)); render(); },
  date: (d) => { const s = stateOf(d.target); s.dates = toggle(s.dates, Number(d.d)); render(); },
  'wiz-days': () => { if (S.isComplete(wiz)) { wiz.step = 'confirm'; render(); } },
  'wiz-save': async (_, el) => {
    el.disabled = true;
    const c = wizFitted();
    if (!S.isComplete(c)) { el.disabled = false; toast(`${FULL_TEXT}. Escoge otra hora u otros días.`); wiz.step = 'days'; render(); return; }
    try {
      wiz.already = monthList(wiz.month).some(x => S.sameCommitment(x, c));
      if (!wiz.already) await store.add(c);
      wiz.created = c;
      wiz.step = 'done';
      render();
      window.scrollTo(0, 0);
    } catch (e) { el.disabled = false; toast(friendlyError(e)); }
  },
  'ics-new': () => downloadICS(wiz.created),
  ics: (d) => { const c = monthList(d.m).find(x => x.id === d.id); if (c) downloadICS(c); },
  slot: (d) => {
    const t = today();
    const { y, m } = S.parseMonth(d.m);
    if (new Date(y, m, Number(d.d)) < new Date(t.getFullYear(), t.getMonth(), t.getDate())) { toast('Ese día ya pasó. Escoge otro día.'); return; }
    startWizard({ month: d.m, hour: Number(d.h), kind: 'dates', dates: [Number(d.d)] });
  },
  cancel: async (d) => {
    if (!confirm('¿Quitar esta hora de oración? Tu nombre ya no saldrá en el calendario.')) return;
    try { await store.cancel(d.id); toast('Listo. Quitamos esa hora.'); } catch (e) { toast(friendlyError(e)); }
  },
  repeat: async () => {
    const items = repeatCandidates();
    try {
      for (const c of items) await store.add(c);
      toast(`✅ Repetimos ${items.length === 1 ? 'tu hora' : `tus ${items.length} horas`} en ${S.monthLabel(win().next)}.`);
      go('#/mis-horas');
    } catch (e) { toast(friendlyError(e)); }
  },
  print: () => window.print(),
  copy: (d) => copyText(d.text),

  'admin-login': async (_, el) => {
    const user = document.getElementById('adm-user').value;
    const pin = document.getElementById('adm-pin').value;
    el.disabled = true;
    try {
      isAdmin = await store.adminLogin(user, pin);
      if (isAdmin) { render(); return; }
      el.disabled = false;
      toast('Usuario o PIN incorrecto.');
    } catch (e) { el.disabled = false; toast(friendlyError(e)); }
  },
  'admin-logout': async () => {
    try { await store.adminLogout(); } catch { /* already out */ }
    isAdmin = false;
    go('#/');
  },
  'af-save': async (_, el) => {
    const others = monthList(af.month).filter(x => x.id !== af.editId);
    const { c, skipped } = S.fitToRoom({ ...S.copyToMonth(af, af.month), name: af.name.trim() }, others);
    if (c.name.length < 2) { toast('Escribe el nombre.'); return; }
    if (!S.isComplete(c)) { toast(af.kind ? `${FULL_TEXT} esos días.` : 'Escoge los días.'); return; }
    if (skipped.length && c.kind !== 'dates') toast(`${FULL_TEXT} ${daysText(skipped)}; esos días no se incluyen.`);
    el.disabled = true;
    try {
      if (af.editId) await store.adminUpdate(af.editId, c);
      else await store.add(c, { asAdmin: true });
      toast(af.editId ? '✅ Cambios guardados.' : `✅ ${c.name} quedó apuntado(a).`);
      af = blankForm(af.month);
      render();
    } catch (e) { el.disabled = false; toast(friendlyError(e)); }
  },
  'af-edit': (d) => {
    const c = monthList(af.month).find(x => x.id === d.id);
    if (!c) return;
    af = { editId: c.id, name: c.name, hour: c.hour, month: c.month, kind: c.kind, weekdays: [...(c.weekdays || [])], dates: [...(c.dates || [])] };
    render();
    window.scrollTo(0, 0);
  },
  'af-cancel': () => { af = blankForm(af.month); render(); },
  'af-remove': async (d) => {
    const c = monthList(af.month).find(x => x.id === d.id);
    if (!c || !confirm(`¿Quitar a ${c.name} (${S.hourLabel(c.hour)}, ${S.patternLabel(c)})?`)) return;
    try { await store.adminRemove(d.id); toast('Quitado.'); } catch (e) { toast(friendlyError(e)); }
  },
  'copy-prev': async (d) => {
    const month = d.m;
    const list = monthList(month);
    const items = fitAll(monthList(S.addMonths(month, -1)).map(c => S.copyToMonth(c, month))
      .filter(c => !list.some(x => S.sameCommitment(x, c))), list);
    if (!confirm(`¿Copiar ${items.length} inscripciones a ${S.monthLabel(month)}?`)) return;
    try {
      for (const c of items) await store.add(c, { asAdmin: true });
      toast(`✅ Copiadas ${items.length} inscripciones.`);
    } catch (e) { toast(friendlyError(e)); }
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  actions[el.dataset.act]?.(el.dataset, el);
});
app.addEventListener('input', (e) => {
  const bind = e.target.dataset.bind;
  if (!bind) return;
  const [obj, field] = bind.split('.');
  const s = obj === 'af' ? af : wiz;
  s[field] = field === 'hour' ? Number(e.target.value) : e.target.value;
  if (field === 'hour') render();   // which days are full depends on the hour
});
app.addEventListener('change', (e) => {
  if (e.target.dataset.actChange === 'msg-day') go(`#/admin?m=${e.target.dataset.m}&d=${e.target.value}`);
});
app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'wiz-name') actions['wiz-name']();
  if (e.target.id === 'adm-pin') app.querySelector('[data-act="admin-login"]')?.click();
});

// ─────────────── shell ───────────────
function applySize() {
  const i = Number(safeGet(SIZE_KEY)) || 0;
  document.documentElement.style.fontSize = `${SIZES[i % SIZES.length] * 100}%`;
}
document.getElementById('size').addEventListener('click', () => {
  safeSet(SIZE_KEY, String(((Number(safeGet(SIZE_KEY)) || 0) + 1) % SIZES.length));
  applySize();
});

let lastPath = null;
function render() {
  if (!store) return;
  const { path, q } = route();
  const views = { '': viewHome, apuntarme: viewWizard, calendario: viewCalendar, 'mis-horas': viewMine, imprimir: viewPrint, admin: viewAdmin };
  const view = views[path] || viewHome;
  const y = window.scrollY;
  app.innerHTML = view(q);
  document.body.classList.toggle('printing', path === 'imprimir');
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.path === path));
  // Same page redrawn with new data: keep the scroll position. New page or wizard step: start at the top.
  const key = path === 'apuntarme' ? `${path}:${wiz?.step}` : path;
  window.scrollTo(0, key === lastPath ? y : 0);
  lastPath = key;
}
window.addEventListener('hashchange', () => {
  if (route().path !== 'apuntarme') wiz = null;
  render();
});

async function boot() {
  applySize();
  try {
    store = await openStore();
    isAdmin = await store.isAdmin();
    if (store.mode === 'demo') document.getElementById('demo').hidden = false;
  } catch (e) {
    app.innerHTML = `<p class="big-text">😔 ${esc(friendlyError(e))}</p><button class="btn primary big" onclick="location.reload()">Intentar otra vez</button>`;
    return;
  }
  render();
}
boot();
