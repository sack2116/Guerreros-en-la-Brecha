// Sign-ups storage. Two backends with the same shape:
//  - cloud: Firebase anonymous sign-in + Firestore, used when FIREBASE_CONFIG is set.
//    Nobody types a password: each phone gets an invisible id, which is what lets a
//    person cancel their own hour. The coordinator unlocks admin with user + PIN.
//  - demo: everything in this browser's localStorage (for local testing)
import { FIREBASE_CONFIG, DEMO_ADMIN } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';

function safeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: keep going */ }
}

// Only the fields the rules accept, in the right types.
function clean(c) {
  return {
    name: String(c.name).trim().replace(/\s+/g, ' ').slice(0, 60),
    hour: Number(c.hour),
    month: c.month,
    kind: c.kind,
    weekdays: c.kind === 'weekly' ? [...c.weekdays].map(Number) : [],
    dates: c.kind === 'dates' ? [...c.dates].map(Number) : [],
  };
}

export const friendlyError = (e) => {
  const code = e?.code || '';
  if (code.includes('permission-denied')) return 'No se pudo guardar. Revisa los datos e intenta otra vez.';
  if (code.includes('unavailable') || code.includes('network')) return 'No hay conexión. Revisa tu internet e intenta otra vez.';
  if (code.includes('admin-restricted-operation') || code.includes('operation-not-allowed')) return 'El sitio todavía no está listo. Avísale al coordinador.';
  return e?.message || 'Algo salió mal. Intenta otra vez.';
};

// ─────────────── demo backend (this browser only) ───────────────
function demoBackend() {
  const KEY = 'brecha.demo.commitments';
  const ADMIN_KEY = 'brecha.demo.admin';
  let uid = safeGet('brecha.demo.uid');
  if (!uid) { uid = `demo-${Math.random().toString(36).slice(2, 10)}`; safeSet('brecha.demo.uid', uid); }
  const watchers = new Set();
  const all = () => safeGet(KEY) || [];
  const save = (list) => { safeSet(KEY, list); watchers.forEach(w => w()); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) watchers.forEach(w => w()); });

  return {
    mode: 'demo',
    uid,
    watchMonth(month, cb) {
      const run = () => cb(all().filter(c => c.month === month));
      watchers.add(run);
      run();
      return () => watchers.delete(run);
    },
    async add(c, { asAdmin = false } = {}) {
      const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      save([...all(), { ...clean(c), id, owner: uid, cancelled: false, created: new Date().toISOString(), ...(asAdmin ? { addedBy: 'admin' } : {}) }]);
      return id;
    },
    async cancel(id) { save(all().map(c => (c.id === id && c.owner === uid ? { ...c, cancelled: true } : c))); },
    async isAdmin() { return safeGet(ADMIN_KEY) === true; },
    async adminLogin(user, pin) {
      const ok = user.trim().toLowerCase() === DEMO_ADMIN.user && pin.trim().toUpperCase() === DEMO_ADMIN.pin;
      if (ok) safeSet(ADMIN_KEY, true);
      return ok;
    },
    async adminLogout() { safeSet(ADMIN_KEY, false); },
    async adminUpdate(id, c) { save(all().map(x => (x.id === id ? { ...x, ...clean(c) } : x))); },
    async adminRemove(id) { save(all().filter(c => c.id !== id)); },
  };
}

// ─────────────── cloud backend (Firebase) ───────────────
async function cloudBackend() {
  const { initializeApp } = await import(`${FB}/firebase-app.js`);
  const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`${FB}/firebase-auth.js`);
  const fs = await import(`${FB}/firebase-firestore.js`);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db = fs.getFirestore(app);

  const user = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) { stop(); resolve(u); return; }
      signInAnonymously(auth).catch((e) => { stop(); reject(e); });
    });
  });
  const uid = user.uid;
  const col = fs.collection(db, 'commitments');
  const adminDoc = fs.doc(db, 'admins', uid);

  return {
    mode: 'cloud',
    uid,
    watchMonth(month, cb, onError) {
      return fs.onSnapshot(fs.query(col, fs.where('month', '==', month)),
        (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
        (e) => onError?.(e));
    },
    async add(c, { asAdmin = false } = {}) {
      const ref = await fs.addDoc(col, { ...clean(c), owner: uid, cancelled: false, created: fs.serverTimestamp(), ...(asAdmin ? { addedBy: 'admin' } : {}) });
      return ref.id;
    },
    async cancel(id) { await fs.updateDoc(fs.doc(db, 'commitments', id), { cancelled: true }); },
    async isAdmin() {
      try { return (await fs.getDoc(adminDoc)).exists(); } catch { return false; }
    },
    // The rules accept this document only when user and PIN match the private secret/admin.
    async adminLogin(user, pin) {
      try {
        await fs.setDoc(adminDoc, { user: user.trim().toLowerCase(), pin: pin.trim().toUpperCase(), since: fs.serverTimestamp() });
        return true;
      } catch (e) {
        if ((e?.code || '').includes('permission-denied')) return false;
        throw e;
      }
    },
    async adminLogout() { await fs.deleteDoc(adminDoc); },
    async adminUpdate(id, c) { await fs.updateDoc(fs.doc(db, 'commitments', id), clean(c)); },
    async adminRemove(id) { await fs.deleteDoc(fs.doc(db, 'commitments', id)); },
  };
}

export async function openStore() {
  return FIREBASE_CONFIG ? cloudBackend() : demoBackend();
}
