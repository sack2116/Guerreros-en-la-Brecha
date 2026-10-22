# 🔥 Guerreros en la Brecha — Orando en todo tiempo 24/7

A month-by-month prayer calendar in Spanish. People open a link (shared by WhatsApp or SMS), type their name, pick one of the 24 one-hour slots, with the **Matutino** (5–7 am) first, and choose which days. Everyone sees who prays at each hour, so pairings show up on their own.

Built for people who aren't comfortable with technology: one question per screen, big buttons, a larger-text button (A A), no passwords and no app to install.

## Pages

| Page | What it does |
|---|---|
| **Inicio** | Today's Matutino, whether next month's sign-up is open, "Apuntarme para orar", "Repetir mi horario" |
| **Apuntarme** | Step by step: name → month (when next month is open) → hour → days (every day, Mon–Fri, days of the week, or specific dates) → confirm |
| **Calendario** | Month grid colored by coverage (🌅 = Matutino covered), then the 24 hours of the chosen day with names. Tap an empty hour to sign up for it |
| **Mis horas** | The hours signed up from this phone: set a phone alarm (.ics file, reminder 10 minutes before) or cancel ("Ya no puedo") |
| **Imprimir** | One page per month: each hour with names and days, for the church bulletin board |
| **Coordinador** (`#/admin`, link at the bottom) | Add or change someone's hours (for people who don't use phones), remove entries, copy last month's whole schedule, daily WhatsApp message to copy, invitation message |

## Rules of the calendar

- Sign-up for a month opens **7 days before it starts** (`OPEN_DAYS_BEFORE` in `js/config.js`). The current month stays open so gaps can be filled.
- A sign-up is stored once with its pattern ("todos los martes"), not as one entry per day.
- Everyone is in the same time zone; calendar alarms use the phone's local time.

## Settings (`js/config.js`)

- `FIREBASE_CONFIG`: `null` runs **demo mode** (saved only in this browser). Set it to the Firebase web config to go live.
- `COORDINATOR_WHATSAPP`: the coordinator's number with country code (e.g. `15551234567`), which shows a "¿Necesitas ayuda?" button. Leave `''` to hide it.

## How the data is protected (`firestore.rules`)

- Every phone gets an invisible anonymous sign-in, which is what lets a person cancel their own hour.
- Anyone can read the calendar and add hours. Only the phone that created an hour can cancel it.
- The coordinator types user **admin** and the PIN. They are checked against the private document `secret/admin` (`{ user: "admin", pin: "…" }`), which nobody can read, so the PIN never appears in this code. To change the PIN, edit that document in the Firebase console. To sign every coordinator phone out, delete the `admins` collection.

## Develop

```bash
node tests/check-schedule.mjs
python -m http.server 8160
```

In demo mode the coordinator login is `admin` / `DEMO`, and `?hoy=2026-10-26` in the URL pretends today is another date (to test the sign-up window).

Every push to `main` runs the test and publishes to GitHub Pages (`.github/workflows/pages.yml`).
