// Cloudflare Pages Function: POST /token mints a short-lived Reactor session JWT for the viewer.
// Project secrets: REACTOR_API_KEY (required), DEMO_PASSCODE (recommended), WORLDGYM_MODEL (optional).

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!env.REACTOR_API_KEY) return json({ error: "REACTOR_API_KEY not set" }, 500);
  if (env.DEMO_PASSCODE && body.passcode !== env.DEMO_PASSCODE) return json({ error: "wrong passcode" }, 401);

  const model = typeof body.model === "string" && body.model.startsWith("reactor/")
    ? body.model
    : env.WORLDGYM_MODEL || "reactor/lingbot-world-2";
  const res = await fetch("https://api.reactor.inc/tokens", {
    method: "POST",
    headers: { "Reactor-API-Key": env.REACTOR_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      authorization_details: [{ type: "session", resources: { models: { match: [model] } } }],
      expires_after: 3600,
    }),
  });
  const text = await res.text();
  if (!res.ok) return json({ error: text.slice(0, 500) }, res.status);
  return json({ jwt: JSON.parse(text).jwt, model });
}
