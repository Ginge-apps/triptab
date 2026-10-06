// Trip Tab settings. Fill these in once during setup (see README).
// Leave firebase empty to run in single-phone mode (data stays on this device).
window.TRIPTAB_CONFIG = {
  appName: "Trip Tab",

  // Firebase console > Settings > General > Your apps > Web app > Config
  firebase: {
    apiKey: "AIzaSyCpwoH0yvH76aRyKnY4JaCP2mcXffzDqmw",
    authDomain: "triptab-a23ec.firebaseapp.com",
    projectId: "triptab-a23ec",
    storageBucket: "triptab-a23ec.firebasestorage.app",
    messagingSenderId: "901696505551",
    appId: "1:901696505551:web:8a4bc055e8daa0c5d159ba"
  },

  // Cloudflare Worker URL that relays to Claude (receipt and text reading). Filled in at the relay step.
  claudeProxy: "",

  // Must match APP_KEY set on the Cloudflare Worker. Filled in at the relay step.
  appKey: ""
};
