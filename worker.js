// Ted's Tab relay, v2 (Nov 14, 2026). base: the Oct 6 worker.js in the GitHub repo.
// Cloudflare Worker: relays receipt and text reading to Claude. The Anthropic API key lives here as a secret, never on a phone.
// v2 adds: proof that the caller is signed in to the app (Firebase sign-in token), a daily cap per person and for everyone
// together, and tighter checks on what may be sent. Nothing about how receipts are read changes.
//
// Settings > Variables and Secrets:
//   ANTHROPIC_API_KEY (secret), APP_KEY (secret, same as config.js), ALLOWED_ORIGIN (https://ginge-apps.github.io)
//   FIREBASE_PROJECT   text, triptab-a23ec
//   REQUIRE_AUTH       text, "1" to refuse callers without a valid sign-in token. Leave unset until app v2.4.12 is live.
//   DAILY_PER_PERSON   text, optional, default 60 reads a day per person
//   DAILY_TOTAL        text, optional, default 400 reads a day for everyone together
//   MODEL              text, optional
// Settings > Bindings: KV namespace bound as USAGE (optional; without it the daily caps are off).
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwks = { keys: {}, until: 0 };

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const json = bytes => JSON.parse(new TextDecoder().decode(bytes));

async function signingKey(kid) {
  if (!jwks.keys[kid] || Date.now() > jwks.until) {
    const r = await fetch(JWKS_URL);
    if (!r.ok) throw new Error("keys unavailable");
    const age = +(/max-age=(\d+)/.exec(r.headers.get("cache-control") || "") || [0, 3600])[1];
    const keys = {};
    for (const k of (await r.json()).keys || []) keys[k.kid] = await crypto.subtle.importKey("jwk", k, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    jwks = { keys, until: Date.now() + Math.min(age, 21600) * 1000 };
  }
  return jwks.keys[kid] || null;
}

// Returns the person's sign-in id when the token is a genuine, unexpired Firebase token for this project; otherwise null.
async function verifyToken(token, project) {
  try {
    const [h, p, sig] = String(token || "").split(".");
    if (!h || !p || !sig) return null;
    const head = json(b64u(h)), claims = json(b64u(p)), now = Math.floor(Date.now() / 1000);
    if (head.alg !== "RS256" || !head.kid) return null;
    if (claims.aud !== project || claims.iss !== "https://securetoken.google.com/" + project) return null;
    if (!(claims.exp > now) || !(claims.iat <= now + 300) || typeof claims.sub !== "string" || !claims.sub) return null;
    const key = await signingKey(head.kid);
    if (!key) return null;
    const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
    return good ? claims.sub : null;
  } catch { return null; }
}

// Only what the app sends is passed on: one user message holding text and JPEG images.
function okMessages(m) {
  if (!Array.isArray(m) || m.length !== 1 || m[0]?.role !== "user") return false;
  const c = m[0].content;
  if (typeof c === "string") return c.length <= 60000;
  return Array.isArray(c) && c.length <= 4 && c.every(b =>
    (b?.type === "text" && typeof b.text === "string" && b.text.length <= 60000) ||
    (b?.type === "image" && b.source?.type === "base64" && /^image\/(jpeg|png|webp)$/.test(b.source.media_type) && typeof b.source.data === "string"));
}

async function overLimit(env, uid) {
  if (!env.USAGE) return false;
  const day = new Date().toISOString().slice(0, 10), keys = ["all:" + day, "u:" + (uid || "anon") + ":" + day];
  const caps = [+env.DAILY_TOTAL || 400, +env.DAILY_PER_PERSON || 60];
  const counts = await Promise.all(keys.map(k => env.USAGE.get(k).then(v => +v || 0)));
  if (counts[0] >= caps[0] || counts[1] >= caps[1]) return true;
  await Promise.all(keys.map((k, i) => env.USAGE.put(k, String(counts[i] + 1), { expirationTtl: 172800 })));
  return false;
}

export default {
  verifyToken,  // exposed for the test script only
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : (allowed[0] || ""),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-app-key, authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const say = (status, text) => new Response(text, { status, headers: cors });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || !ok) return say(403, "Forbidden");
    if (env.APP_KEY && req.headers.get("x-app-key") !== env.APP_KEY) return say(403, "Forbidden");

    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = bearer ? await verifyToken(bearer, env.FIREBASE_PROJECT || "triptab-a23ec") : null;
    if (env.REQUIRE_AUTH === "1" && !uid) return say(401, "Sign-in required");

    if (+(req.headers.get("content-length") || 0) > 6_000_000) return say(413, "Too large");
    let body;
    try { const raw = await req.text(); if (raw.length > 6_000_000) return say(413, "Too large"); body = JSON.parse(raw); }
    catch { return say(400, "Bad request"); }
    if (!okMessages(body.messages)) return say(400, "Bad request");
    if (await overLimit(env, uid)) return say(429, "Daily limit reached");

    const payload = {
      model: env.MODEL || "claude-sonnet-5-5",
      max_tokens: Math.min(+body.max_tokens || 2000, 3000),
      messages: body.messages
    };
    if (body.system) payload.system = String(body.system).slice(0, 8000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "content-type": "application/json" } });
  }
};
