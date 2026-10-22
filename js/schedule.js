// Calendar logic shared by the pages and the robot test (no browser APIs here).
//
// A "commitment" is one person praying one hour, on a pattern, for one month:
//   { name, hour: 0-23, month: 'YYYY-MM', kind: 'daily' | 'weekdays' | 'weekly' | 'dates',
//     weekdays: [0-6] (for 'weekly', 0 = domingo), dates: [1-31] (for 'dates'), cancelled }
// It is stored once and expanded into days here, so "todos los martes" is one record.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const MATUTINO = [5, 6];
// Every hour outside the Matutino takes at most this many people per day; the Matutino has no limit.
export const MAX_PER_HOUR = 3;
export const isLimited = (h) => !MATUTINO.includes(h);
export const GROUPS = [
  { id: 'matutino', title: '🌅 Matutino', hours: [5, 6] },
  { id: 'manana', title: '☀️ Mañana', hours: [7, 8, 9, 10, 11] },
  { id: 'tarde', title: '🌤️ Tarde', hours: [12, 13, 14, 15, 16, 17, 18] },
  { id: 'noche', title: '🌙 Noche', hours: [19, 20, 21, 22, 23] },
  { id: 'madrugada', title: '✨ Madrugada', hours: [0, 1, 2, 3, 4] },
];

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ─────────────── months and days ───────────────
export function monthKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
export function keyOf(date) { return monthKey(date.getFullYear(), date.getMonth()); }
export function parseMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return { y, m: m - 1 };
}
export function addMonths(key, n) {
  const { y, m } = parseMonth(key);
  return keyOf(new Date(y, m + n, 1));
}
export function daysInMonth(key) {
  const { y, m } = parseMonth(key);
  return new Date(y, m + 1, 0).getDate();
}
export function weekdayOf(key, day) {
  const { y, m } = parseMonth(key);
  return new Date(y, m, day).getDay();
}
export function monthLabel(key) {
  const { y, m } = parseMonth(key);
  return `${cap(MESES[m])} ${y}`;
}
export function dayLabel(key, day) {
  const { m } = parseMonth(key);
  return `${DIAS[weekdayOf(key, day)]} ${day} de ${MESES[m]}`;
}
export const isValidMonth = (key) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(key || '');

// Sign-up for a month opens OPEN_DAYS_BEFORE days before it starts.
// The current month is always open, so gaps can be filled at any time.
export function signupWindow(today, openDaysBefore = 7) {
  const current = keyOf(today);
  const next = addMonths(current, 1);
  const { y, m } = parseMonth(next);
  const opensOn = new Date(y, m, 1 - openDaysBefore);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { current, next, nextOpen: start >= opensOn, opensOn };
}
export function shortDate(date) {
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

// ─────────────── hours ───────────────
const clock = (h) => `${h % 12 || 12}:00`;
function period(h) {
  if (h === 24) return 'de la noche';
  if (h < 5) return 'de la madrugada';
  if (h < 12) return 'de la mañana';
  if (h === 12) return 'del mediodía';
  if (h < 19) return 'de la tarde';
  return 'de la noche';
}
// "5:00 a 6:00 de la mañana", "11:00 de la mañana a 12:00 del mediodía"
export function hourLabel(h) {
  const a = period(h), b = period(h + 1);
  return a === b ? `${clock(h)} a ${clock(h + 1)} ${a}` : `${clock(h)} ${a} a ${clock(h + 1)} ${b}`;
}
const ap = (h) => (h % 24 < 12 ? 'am' : 'pm');
// "5–6 am", "11 am–12 pm" (for WhatsApp messages and tight spaces)
export function shortHour(h) {
  const a = h % 12 || 12, b = (h + 1) % 12 || 12;
  return ap(h) === ap(h + 1) ? `${a}–${b} ${ap(h)}` : `${a} ${ap(h)}–${b} ${ap(h + 1)}`;
}

// ─────────────── patterns ───────────────
export function listLabel(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
function basePattern(c) {
  if (c.kind === 'daily') return 'todos los días';
  if (c.kind === 'weekdays') return 'de lunes a viernes';
  if (c.kind === 'weekly') {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = order.filter(d => (c.weekdays || []).includes(d)).map(d => DIAS_PLURAL[d]);
    return `todos los ${listLabel(days)}`;
  }
  const dates = [...(c.dates || [])].sort((a, b) => a - b);
  return dates.length === 1 ? `el día ${dates[0]}` : `los días ${listLabel(dates.map(String))}`;
}
// "todos los días (menos el 3 y el 10)" when some days were already full.
export function patternLabel(c) {
  const base = basePattern(c);
  const skip = c.kind === 'dates' ? [] : [...(c.skip || [])].sort((a, b) => a - b);
  if (!skip.length) return base;
  return `${base} (menos ${skip.length === 1 ? 'el día' : 'los días'} ${listLabel(skip.map(String))})`;
}
export function sentence(c) {
  return `${c.name}, ${patternLabel(c)} de ${hourLabel(c.hour)}`;
}
// A commitment is usable when its pattern actually picks at least one day
// (and, once full days are skipped, at least one day is left).
export function isComplete(c) {
  let picked = c.kind === 'daily' || c.kind === 'weekdays';
  if (c.kind === 'weekly') picked = (c.weekdays || []).length > 0;
  if (c.kind === 'dates') picked = (c.dates || []).length > 0;
  return picked && (!isValidMonth(c.month) || coveredDays({ ...c, cancelled: false }, c.month).length > 0);
}

export function coversDay(c, key, day) {
  if (c.cancelled || c.month !== key) return false;
  if (c.kind !== 'dates' && (c.skip || []).includes(day)) return false;
  const wd = weekdayOf(key, day);
  switch (c.kind) {
    case 'daily': return true;
    case 'weekdays': return wd >= 1 && wd <= 5;
    case 'weekly': return (c.weekdays || []).includes(wd);
    case 'dates': return (c.dates || []).includes(day);
    default: return false;
  }
}
export function coveredDays(c, key) {
  const days = [];
  for (let d = 1; d <= daysInMonth(key); d++) if (coversDay(c, key, d)) days.push(d);
  return days;
}

const norm = (name) => name.trim().toLocaleLowerCase('es');
function uniqueNames(list) {
  const seen = new Map();
  for (const c of list) if (!seen.has(norm(c.name))) seen.set(norm(c.name), c.name.trim());
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

// Names praying at one hour of one day.
export function peopleAt(list, key, day, hour) {
  return uniqueNames(list.filter(c => c.hour === hour && coversDay(c, key, day)));
}
// [24 lists of names] for one day.
export function dayHours(list, key, day) {
  return Array.from({ length: 24 }, (_, h) => peopleAt(list, key, day, h));
}
// How full one day is: hours with at least one person, whether the Matutino is covered,
// and whether every limited hour already has MAX_PER_HOUR people (the day is "full").
export function dayCoverage(list, key, day) {
  const hours = dayHours(list, key, day);
  return {
    covered: hours.filter(n => n.length).length,
    matutino: MATUTINO.every(h => hours[h].length > 0),
    full: hours.every((n, h) => !isLimited(h) || n.length >= MAX_PER_HOUR),
  };
}
export function isFull(list, key, day, hour) {
  return isLimited(hour) && peopleAt(list, key, day, hour).length >= MAX_PER_HOUR;
}
// Days of the month (from fromDay on) where this hour has no room left.
export function fullDays(list, key, hour, fromDay = 1) {
  const days = [];
  if (!isLimited(hour)) return days;
  for (let d = fromDay; d <= daysInMonth(key); d++) if (isFull(list, key, d, hour)) days.push(d);
  return days;
}
// Fit a new sign-up around full days: specific dates lose the full ones, a pattern skips them.
// Returns the adjusted sign-up and the days that were left out.
export function fitToRoom(c, list) {
  const full = new Set(fullDays(list, c.month, c.hour));
  if (c.kind === 'dates') {
    const dates = (c.dates || []).filter(d => !full.has(d));
    return { c: { ...c, dates, skip: [] }, skipped: (c.dates || []).filter(d => full.has(d)) };
  }
  const base = { ...c, skip: [] };
  const skipped = coveredDays(base, c.month).filter(d => full.has(d));
  return { c: { ...c, skip: skipped }, skipped };
}
// Distinct people who signed up for an hour anywhere in the month.
export function namesForHour(list, key, hour) {
  return uniqueNames(list.filter(c => !c.cancelled && c.month === key && c.hour === hour));
}

// Does `list` already have the same person, hour and pattern? (used to avoid double sign-ups)
export function sameCommitment(a, b) {
  const sameList = (x = [], y = []) => x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
  return norm(a.name) === norm(b.name) && a.hour === b.hour && a.month === b.month && a.kind === b.kind
    && sameList(a.weekdays, b.weekdays) && sameList(a.dates, b.dates);
}

// Copy a commitment into another month. Specific dates that don't exist there are dropped.
export function copyToMonth(c, key) {
  const dates = (c.dates || []).filter(d => d <= daysInMonth(key));
  return { name: c.name, hour: c.hour, month: key, kind: c.kind, weekdays: [...(c.weekdays || [])], dates, skip: [] };
}

// ─────────────── messages and files ───────────────
export function dailyMessage(list, key, day, { siteName, url }) {
  const hours = dayHours(list, key, day);
  const line = (h) => `${shortHour(h)}: ${hours[h].length ? hours[h].join(', ') : '— libre —'}`;
  const others = [];
  for (let h = 0; h < 24; h++) if (!MATUTINO.includes(h)) others.push(line(h));
  const empty = hours.map((n, h) => (n.length ? null : shortHour(h))).filter(Boolean);
  return [
    `🙏 *${siteName}*`,
    `📅 ${cap(dayLabel(key, day))}`,
    '',
    '🌅 *Matutino*',
    ...MATUTINO.map(line),
    '',
    '⏰ *Las demás horas*',
    ...others,
    '',
    empty.length ? `🔥 Horas sin cubrir: ${empty.length}. ¿Puedes tomar una?` : '🔥 ¡Las 24 horas están cubiertas! Gloria a Dios.',
    url ? `👉 ${url}` : '',
  ].join('\n').trim();
}

export function inviteMessage(key, { siteName, url }) {
  return [
    `🙏 *${siteName}*`,
    '',
    `Ya puedes apuntarte para orar en *${monthLabel(key)}*.`,
    'Escoge tu hora (24 horas, todos los días). Necesitamos especialmente el 🌅 *Matutino* (5 a 7 de la mañana).',
    '',
    `👉 ${url}`,
  ].join('\n');
}

const pad = (n) => String(n).padStart(2, '0');
const icsText = (s) => s.replace(/[\\;,]/g, (ch) => `\\${ch}`).replace(/\n/g, '\\n');
// A calendar file with one event per prayer hour and a 10-minute reminder.
// Times are "floating" (no time zone), which is right because everyone is in the same one.
export function buildICS(c, { siteName, url }) {
  const { y, m } = parseMonth(c.month);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Guerreros en la Brecha//ES', 'CALSCALE:GREGORIAN'];
  for (const day of coveredDays(c, c.month)) {
    const start = new Date(y, m, day, c.hour);
    const end = new Date(y, m, day, c.hour + 1);
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}0000`;
    lines.push('BEGIN:VEVENT',
      `UID:${c.month}-${day}-${c.hour}-${norm(c.name).replace(/\W+/g, '')}@guerreros-en-la-brecha`,
      `DTSTAMP:${stamp}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${icsText(`🙏 Oración — ${siteName}`)}`,
      `DESCRIPTION:${icsText(`Tu hora de oración: ${hourLabel(c.hour)}.${url ? `\n${url}` : ''}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', `DESCRIPTION:${icsText('Tu hora de oración empieza en 10 minutos')}`, 'END:VALARM',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
