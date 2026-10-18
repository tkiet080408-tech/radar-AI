// Netlify Function: calls Gemini with Google Search grounding.
// The API key stays on the server (environment variable), never in the browser.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const LIMIT = parseInt(process.env.RATE_LIMIT || "20", 10); // requests per IP per hour (best effort)
const hits = new Map();
const reply = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const clip = (s, n = 200) => String(s == null ? "" : s).slice(0, n);

function buildCore(step, lang, i, co, results) {
  const L = lang === "en" ? "English" : "Vietnamese";
  const src = results ? "Use ONLY the web search results provided below as your source of facts." : "Use Google Search to find real, current information.";
  const base = `You are an export market development assistant. ${src} Write all values in ${L} (the sales email is always in English). Only name companies that appear in your search results; never invent companies, websites, people, emails or phone numbers. If unsure, return fewer items. Return ONLY valid JSON, no markdown.`;
  const ctx = `Exporter: product=${i.product}; target market=${i.market}; buyer type=${i.type}; first shipment=${i.size}; strengths=${i.strengths}.`;
  const who = `Target company: ${co.name} (${co.city}) ${co.site}.`;
  if (step === 1) return `${base}\n${ctx}\nFind up to 5 real companies in the target market that could buy this product. JSON: {"leads":[{"company":"","type":"","city":"","website":"official site found in search","signal":"recent buying signal found","why":"1-2 sentences","score":0-100,"demand":0-25,"match":0-25,"barrier":0-25,"access":0-25,"check":"what to verify","source_ids":[numbers of the SEARCH RESULTS you used for this company, e.g. 1,4]}]}. Each company must cite at least one source_id; the numbers refer to the [n] items in SEARCH RESULTS (use [] if no SEARCH RESULTS are given). For "barrier", a higher number means fewer regulatory barriers. Sort by score, highest first.`;
  if (step === 2) return `${base}\n${ctx}\n${who}\nUsing search results about this company, list 3 job titles of the people who decide on purchasing this product, and 3 LinkedIn search keyword phrases to find them. Do not give personal names, emails or phone numbers. JSON: {"titles":["","",""],"keywords":["","",""]}`;
  return `${base}\n${ctx}\n${who}\nProfile this company from search results (recent news, products, sourcing, certifications). JSON: {"verdict":"one of: Pursue / Consider / Not a fit (in ${L})","summary":"3 sentences","risks":["",""],"timing":"best timing to reach out","email":{"subject":"","body":"sales email in English, under 150 words, with [Recipient name] as placeholder"},"verify":["things to verify before sending"]}`;
}

function buildPrompt(step, lang, i, co, results) {
  const p = buildCore(step, lang, i, co, results);
  if (!results) return p;
  return p + "\n\nSEARCH RESULTS:\n" + results.map((x, n) => `[${n + 1}] ${x.title}\n${x.uri}\n${x.text}`).join("\n\n");
}

// Free web search via Tavily (free plan, no card). Used when TAVILY_API_KEY is set.
async function webSearch(q, key) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: q, search_depth: "basic", max_results: 8 }),
  });
  if (!r.ok) throw new Error("search " + r.status);
  const j = await r.json();
  return (j.results || []).map((x) => ({ title: clip(x.title, 150), uri: x.url, text: clip(x.content, 600) }));
}
function searchQuery(step, i, co) {
  if (step === 1) return `${i.product} importers distributors buyers ${i.market}`;
  if (step === 2) return `${co.name} ${co.city} purchasing procurement manager buyer`;
  return `${co.name} ${co.city} products sourcing certifications news`;
}

// Step 1 only: turn the (possibly Vietnamese) inputs into English search queries.
async function makeQueries(key, i) {
  const text = `Turn this into 2 short English web search queries (max 8 words each) to find real companies that could BUY the product in the target market. Product: ${i.product}. Target market: ${i.market}. Buyer type: ${i.type}. Return ONLY JSON: {"queries":["",""]}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0 } }),
  });
  if (!r.ok) throw new Error("q");
  const j = await r.json();
  const t = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((p) => p.text || "").join("");
  const q = (parseJson(t).queries || []).filter((x) => typeof x === "string").slice(0, 2).map((x) => clip(x, 120));
  if (!q.length) throw new Error("q");
  return q;
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

  const tk = process.env.TAVILY_API_KEY;
  let results = null;
  try {
    if (tk) {
      let qs = [searchQuery(step, i, co)];
      if (step === 1) { try { qs = await makeQueries(key, i); } catch (e) { /* fall back to the plain query */ } }
      const lists = await Promise.all(qs.map((q) => webSearch(q, tk)));
      const seen = new Set();
      results = [];
      lists.flat().forEach((x) => { if (!seen.has(x.uri)) { seen.add(x.uri); results.push(x); } });
      results = results.slice(0, 10);
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(step, b.lang, i, co, results) }] }],
        ...(results ? {} : { tools: [{ google_search: {} }] }),
        generationConfig: { temperature: 0.2 },
      }),
    });
    const j = await r.json();
    if (!r.ok) return reply(502, { error: `AI service error (${r.status}): ${clip((j.error && j.error.message) || "", 300)}` });
    const cand = j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("");
    const gm = (cand && cand.groundingMetadata) || {};
    const sources = results ? results.map((w) => ({ uri: w.uri, title: w.title })) : (gm.groundingChunks || []).map((x) => x.web).filter(Boolean).map((w) => ({ uri: w.uri, title: w.title }));
    let data = parseJson(text);
    if (step === 1 && !Array.isArray(data.leads)) {
      const k = Object.keys(data).find((x) => Array.isArray(data[x]));
      data = { leads: k ? data[k] : [] };
    }
    if (step === 1 && results) {
      data.leads.forEach((l) => {
        const ids = Array.isArray(l.source_ids) ? l.source_ids.map(Number) : [];
        l.sources = [...new Set(ids)].filter((n) => Number.isInteger(n) && n >= 1 && n <= results.length).slice(0, 3).map((n) => ({ uri: results[n - 1].uri, title: results[n - 1].title }));
      });
    }
    return reply(200, { data, sources, suggestions: (gm.searchEntryPoint || {}).renderedContent || "" });
  } catch (e) {
    if (String(e.message).startsWith("search")) return reply(502, { error: `Web search failed (${e.message}). Check TAVILY_API_KEY or its free quota.` });
    return reply(500, { error: "Could not read the AI response. Please try again." });
  }
};
