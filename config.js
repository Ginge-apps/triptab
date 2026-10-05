// Trip Tab settings. Fill these in once during setup (see README).
// Leave firebase empty to run in single-phone mode (data stays on this device).
window.TRIPTAB_CONFIG = {
  appName: "Trip Tab",

  // Firebase console > Project settings > General > Your apps > Web app > Config
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },

  // Cloudflare Worker URL that relays to Claude (receipt and text reading)
  claudeProxy: "",

  // Must match APP_KEY set on the Cloudflare Worker
  appKey: ""
};
