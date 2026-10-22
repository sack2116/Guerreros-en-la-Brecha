// Site settings.
//
// FIREBASE: the web app config from the Firebase console (Project settings > Your apps).
// These values are public by design; the Firestore rules (firestore.rules) protect the data.
// Set it to null to run in "demo mode", where sign-ups are saved only in this browser.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDxuX8oArrBpXTy5p-GReNSDQbvZly6B2k',
  authDomain: 'guerreros-en-la-brecha.firebaseapp.com',
  projectId: 'guerreros-en-la-brecha',
  storageBucket: 'guerreros-en-la-brecha.firebasestorage.app',
  messagingSenderId: '1018993767174',
  appId: '1:1018993767174:web:adc017218a8aa9ad63e487',
};

// Only for demo mode (local testing). The real admin user and PIN live in the private
// Firestore document secret/admin and never appear in this code.
export const DEMO_ADMIN = { user: 'admin', pin: 'DEMO' };

export const SITE_NAME = 'Guerreros en la Brecha';
export const SITE_TAGLINE = 'Orando en todo tiempo · 24/7';

// Sign-up for next month opens this many days before it starts.
export const OPEN_DAYS_BEFORE = 7;
// Months opened early by hand, before their usual day (e.g. '2026-11').
export const OPENED_EARLY = ['2026-11'];

// Coordinator's WhatsApp number with country code and no symbols (e.g. '15551234567'),
// shown as a "¿Necesitas ayuda?" button. Leave '' to hide the button.
export const COORDINATOR_WHATSAPP = '';
