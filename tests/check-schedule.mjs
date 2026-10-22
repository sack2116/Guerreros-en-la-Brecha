// Robot test for the calendar logic. Run: node tests/check-schedule.mjs
import assert from 'node:assert/strict';
import * as S from '../js/schedule.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`✓ ${name}`); };
const c = (over) => ({ name: 'María González', hour: 5, month: '2026-11', kind: 'daily', weekdays: [], dates: [], cancelled: false, ...over });

test('month helpers', () => {
  assert.equal(S.daysInMonth('2026-11'), 30);
  assert.equal(S.daysInMonth('2028-02'), 29);
  assert.equal(S.addMonths('2026-12', 1), '2027-01');
  assert.equal(S.addMonths('2026-01', -1), '2025-12');
  assert.equal(S.monthLabel('2026-11'), 'Noviembre 2026');
  assert.equal(S.dayLabel('2026-11', 1), 'domingo 1 de noviembre');
  assert.ok(S.isValidMonth('2026-11') && !S.isValidMonth('2026-13') && !S.isValidMonth('x'));
});

test('sign-up window opens 7 days before the month', () => {
  const w1 = S.signupWindow(new Date(2026, 9, 24, 20, 0));
  assert.equal(w1.current, '2026-10');
  assert.equal(w1.next, '2026-11');
  assert.equal(w1.nextOpen, false);
  assert.equal(S.shortDate(w1.opensOn), 'domingo 25 de octubre');
  assert.equal(S.signupWindow(new Date(2026, 9, 25, 0, 1)).nextOpen, true);
  assert.equal(S.signupWindow(new Date(2026, 11, 28)).next, '2027-01');
  // a month opened early by hand
  assert.equal(S.signupWindow(new Date(2026, 9, 22), 7, ['2026-11']).nextOpen, true);
  assert.equal(S.signupWindow(new Date(2026, 10, 2), 7, ['2026-11']).nextOpen, false); // December keeps its usual day
});

test('hour labels read naturally in Spanish', () => {
  assert.equal(S.hourLabel(5), '5:00 a 6:00 de la mañana');
  assert.equal(S.hourLabel(0), '12:00 a 1:00 de la madrugada');
  assert.equal(S.hourLabel(4), '4:00 de la madrugada a 5:00 de la mañana');
  assert.equal(S.hourLabel(11), '11:00 de la mañana a 12:00 del mediodía');
  assert.equal(S.hourLabel(12), '12:00 del mediodía a 1:00 de la tarde');
  assert.equal(S.hourLabel(18), '6:00 de la tarde a 7:00 de la noche');
  assert.equal(S.hourLabel(23), '11:00 a 12:00 de la noche');
  assert.equal(S.shortHour(5), '5–6 am');
  assert.equal(S.shortHour(11), '11 am–12 pm');
  assert.equal(S.shortHour(23), '11 pm–12 am');
  // every hour appears in exactly one group
  assert.deepEqual(S.GROUPS.flatMap(g => g.hours).sort((a, b) => a - b), Array.from({ length: 24 }, (_, h) => h));
});

test('patterns pick the right days', () => {
  // November 2026 starts on a Sunday
  assert.equal(S.coveredDays(c({ kind: 'daily' }), '2026-11').length, 30);
  assert.equal(S.coveredDays(c({ kind: 'weekdays' }), '2026-11').length, 21);
  assert.deepEqual(S.coveredDays(c({ kind: 'weekly', weekdays: [2] }), '2026-11'), [3, 10, 17, 24]);
  assert.deepEqual(S.coveredDays(c({ kind: 'dates', dates: [30, 1] }), '2026-11'), [1, 30]);
  assert.deepEqual(S.coveredDays(c({ cancelled: true }), '2026-11'), []);
  assert.deepEqual(S.coveredDays(c({ month: '2026-12' }), '2026-11'), []);
  assert.ok(!S.isComplete(c({ kind: 'weekly' })) && !S.isComplete(c({ kind: 'dates' })));
});

test('pattern sentences', () => {
  assert.equal(S.patternLabel(c({ kind: 'weekly', weekdays: [0, 2, 4] })), 'todos los martes, jueves y domingos');
  assert.equal(S.patternLabel(c({ kind: 'dates', dates: [17, 3, 10] })), 'los días 3, 10 y 17');
  assert.equal(S.patternLabel(c({ kind: 'dates', dates: [8] })), 'el día 8');
  assert.equal(S.sentence(c()), 'María González, todos los días de 5:00 a 6:00 de la mañana');
});

test('pairings and coverage', () => {
  const list = [
    c({ name: 'María González' }),
    c({ name: 'José Pérez', kind: 'weekly', weekdays: [2] }),
    c({ name: 'maría gonzález ', kind: 'dates', dates: [3] }), // same person twice: shown once
    c({ name: 'Ana Ruiz', hour: 6, kind: 'weekdays' }),
  ];
  assert.deepEqual(S.peopleAt(list, '2026-11', 3, 5), ['José Pérez', 'María González']);
  assert.deepEqual(S.peopleAt(list, '2026-11', 4, 5), ['María González']);
  assert.deepEqual(S.dayCoverage(list, '2026-11', 3), { covered: 2, matutino: true, full: false });
  assert.deepEqual(S.dayCoverage(list, '2026-11', 1), { covered: 1, matutino: false, full: false }); // Sunday, no Ana
  assert.deepEqual(S.namesForHour(list, '2026-11', 5), ['José Pérez', 'María González']);
});

test('duplicates and copying to the next month', () => {
  assert.ok(S.sameCommitment(c({ kind: 'weekly', weekdays: [1, 3] }), c({ name: ' maría gonzález', kind: 'weekly', weekdays: [3, 1] })));
  assert.ok(!S.sameCommitment(c(), c({ hour: 6 })));
  const copied = S.copyToMonth(c({ month: '2027-01', kind: 'dates', dates: [15, 30, 31] }), '2027-02');
  assert.deepEqual(copied, { name: 'María González', hour: 5, month: '2027-02', kind: 'dates', weekdays: [], dates: [15], skip: [] });
});

test('3 people per hour, except the Matutino', () => {
  const three = ['Ana', 'Beto', 'Caro'].map(name => c({ name, hour: 21, kind: 'weekly', weekdays: [2] })); // Tuesdays 9 pm
  assert.ok(S.isFull(three, '2026-11', 3, 21));
  assert.ok(!S.isFull(three, '2026-11', 4, 21));
  assert.deepEqual(S.fullDays(three, '2026-11', 21), [3, 10, 17, 24]);
  assert.deepEqual(S.fullDays(three, '2026-11', 21, 11), [17, 24]);
  // the Matutino never fills up
  const many = ['A', 'B', 'C', 'D', 'E'].map(name => c({ name }));
  assert.ok(!S.isFull(many, '2026-11', 3, 5));
  assert.deepEqual(S.fullDays(many, '2026-11', 5), []);
  // a daily sign-up skips the full Tuesdays and says so
  const fit = S.fitToRoom(c({ name: 'Dani', hour: 21 }), three);
  assert.deepEqual(fit.skipped, [3, 10, 17, 24]);
  assert.equal(S.coveredDays(fit.c, '2026-11').length, 26);
  assert.equal(S.patternLabel(fit.c), 'todos los días (menos los días 3, 10, 17 y 24)');
  // specific dates just lose the full ones; a pattern with only full days is not usable
  assert.deepEqual(S.fitToRoom(c({ hour: 21, kind: 'dates', dates: [3, 4] }), three).c.dates, [4]);
  assert.ok(!S.isComplete(S.fitToRoom(c({ hour: 21, kind: 'weekly', weekdays: [2] }), three).c));
  // a day is full when all 22 limited hours have 3 people
  const allFull = [];
  for (let h = 0; h < 24; h++) if (S.isLimited(h)) for (const name of ['A', 'B', 'C']) allFull.push(c({ name, hour: h }));
  assert.ok(S.dayCoverage(allFull, '2026-11', 8).full);
  assert.ok(!S.dayCoverage(allFull.slice(1), '2026-11', 8).full);
});

test('WhatsApp messages and calendar file', () => {
  const list = [c(), c({ name: 'José Pérez', hour: 6 })];
  const msg = S.dailyMessage(list, '2026-11', 3, { siteName: 'Guerreros', url: 'https://x.test/' });
  assert.match(msg, /Martes 3 de noviembre/);
  assert.match(msg, /5–6 am: María González/);
  assert.match(msg, /6–7 am: José Pérez/);
  assert.match(msg, /Horas sin cubrir: 22/);
  assert.match(S.inviteMessage('2026-11', { siteName: 'G', url: 'u' }), /Noviembre 2026/);
  const ics = S.buildICS(c({ kind: 'weekly', weekdays: [2] }), { siteName: 'G', url: 'u' });
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 4);
  assert.match(ics, /DTSTART:20261103T050000/);
  assert.match(ics, /DTEND:20261103T060000/);
  assert.match(ics, /TRIGGER:-PT10M/);
  const late = S.buildICS(c({ hour: 23, kind: 'dates', dates: [30] }), { siteName: 'G', url: '' });
  assert.match(late, /DTEND:20261201T000000/);
});

console.log(`\n${passed} groups passed.`);
