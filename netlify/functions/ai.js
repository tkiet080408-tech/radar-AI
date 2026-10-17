// Netlify Function: calls Gemini with Google Search grounding.
// The API key stays on the server (environment variable), never in the browser.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const LIMIT = parseInt(process.env.RATE_LIMIT || "20", 10); // requests per IP per hour (best effort)
const hits = new Map();
const reply = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const clip = (s, n = 200) => String(s == null ? "" : s).slice(0, n);

function buildPrompt(step, lang, i, co) {
  const L = lang === "en" ? "English" : "Vietnamese";
  const base = `You are an export market development assistant. Use Google Search to find real, current information. Write all values in ${L} (the sales email is always in English). Only name companies that appear in your search results; never invent companies, websites, people, emails or phone numbers. If unsure, return fewer items. Return ONLY valid JSON, no markdown.`;
  const ctx = `Exporter: product=${i.product}; target market=${i.market}; buyer type=${i.type}; first shipment=${i.size}; strengths=${i.strengths}.`;
  const who = `Target company: ${co.name} (${co.city}) ${co.site}.`;
  if (step === 1) return `${base}\n${ctx}\nFind up to 5 real companies in the target market that could buy this product. JSON: {"leads":[{"company":"","type":"","city":"","website":"official site found in search","signal":"recent buying signal found","why":"1-2 sentences","score":0-100,"demand":0-25,"match":0-25,"barrier":0-25,"access":0-25,"check":"what to verify"}]}. For "barrier", a higher number means fewer regulatory barriers. Sort by score, highest first.`;
  if (step === 2) return `${base}\n${ctx}\n${who}\nUsing search results about this company, list 3 job titles of the people who decide on purchasing this product, and 3 LinkedIn search keyword phrases to find them. Do not give personal names, emails or phone numbers. JSON: {"titles":["","",""],"keywords":["","",""]}`;
  return `${base}\n${ctx}\n${who}\nProfile this company from search results (recent news, products, sourcing, certifications). JSON: {"verdict":"one of: Pursue / Consider / Not a fit (in ${L})","summary":"3 sentences","risks":["",""],"timing":"best timing to reach out","email":{"subject":"","body":"sales email in English, under 150 words, with [Recipient name] as placeholder"},"verify":["things to verify before sending"]}`;
}

function parseJson(t) {
  const s = t.replace(/```json|```/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no json");
  return JSON.parse(s.slice(a, b + 1));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(503, { error: "Server is not configured (missing GEMINI_API_KEY)." });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad request." }); }

  const h = event.headers || {};
  const ip = h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0] || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= LIMIT) return reply(429, { error: "Too many requests. Please try again later." });
  recent.push(now);
  hits.set(ip, recent);

  const need = process.env.ACCESS_CODE;
  if (need && b.code !== need) return reply(401, { error: "Wrong or missing access code." });

  const step = Number(b.step);
  if (![1, 2, 3].includes(step)) return reply(400, { error: "Invalid step." });
  const inp = b.inputs || {}, c = b.company || {};
  const i = { product: clip(inp.product), market: clip(inp.market), type: clip(inp.type), size: clip(inp.size), strengths: clip(inp.strengths, 400) };
  const co = { name: clip(c.name), city: clip(c.city), site: clip(c.site) };
  if (step > 1 && !co.name) return reply(400, { error: "Missing company." });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(step, b.lang, i, co) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const j = await r.json();
    if (!r.ok) return reply(502, { error: `AI service error (${r.status}).` });
    const cand = j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("");
    const gm = (cand && cand.groundingMetadata) || {};
    const sources = (gm.groundingChunks || []).map((x) => x.web).filter(Boolean).map((w) => ({ uri: w.uri, title: w.title }));
    return reply(200, { data: parseJson(text), sources, suggestions: (gm.searchEntryPoint || {}).renderedContent || "" });
  } catch (e) {
    return reply(500, { error: "Could not read the AI response. Please try again." });
  }
};
