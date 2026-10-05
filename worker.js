// Cloudflare Worker: relays receipt and text reading to Claude.
// Your Anthropic API key lives here as a secret, never on anyone's phone.
// Settings > Variables: ANTHROPIC_API_KEY (secret), APP_KEY (secret, same as config.js),
// ALLOWED_ORIGIN (e.g. https://yourname.github.io), optional MODEL.
export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : (allowed[0] || ""),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-app-key",
      "Vary": "Origin"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || !ok) return new Response("Forbidden", { status: 403, headers: cors });
    if (env.APP_KEY && req.headers.get("x-app-key") !== env.APP_KEY) return new Response("Forbidden", { status: 403, headers: cors });
    let body;
    try { body = await req.json(); } catch { return new Response("Bad request", { status: 400, headers: cors }); }
    if (!Array.isArray(body.messages) || JSON.stringify(body).length > 8_000_000) return new Response("Bad request", { status: 400, headers: cors });
    const payload = {
      model: env.MODEL || "claude-sonnet-5-5",
      max_tokens: Math.min(+body.max_tokens || 2000, 4000),
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
