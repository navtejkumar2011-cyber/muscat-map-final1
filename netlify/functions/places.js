// Netlify function: fetches places from OpenStreetMap (Overpass) on the server side.
// Tries several public servers and identifies the app, which is far more reliable than calling from the browser.
const QUERIES = {
  tourism: '["tourism"~"attraction|museum|viewpoint|gallery|zoo"]',
  food:    '["amenity"~"restaurant|cafe|fast_food"]',
  health:  '["amenity"~"hospital|clinic|pharmacy"]',
  edu:     '["amenity"~"school|university|college"]',
  mosque:  '["amenity"="place_of_worship"]',
  shop:    '["shop"~"mall|supermarket"]'
};
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const json = (code, obj, extra = {}) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", ...extra },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const q = QUERIES[p.cat];
  const b = String(p.bbox || "").split(",").map(Number);
  if (!q || b.length !== 4 || b.some(isNaN)) return json(400, { error: "Bad request" });
  const [s, w, n, e] = b;
  if (n - s > 0.25 || e - w > 0.25 || s < 15 || n > 30 || w < 50 || e > 62) return json(400, { error: "Area too large" });

  const data = `[out:json][timeout:20];nwr${q}(${s},${w},${n},${e});out center 120;`;
  let last = "";
  for (const url of SERVERS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AskTheMap-SchoolProject/1.0 (student project, Muscat)",
          "Accept": "application/json"
        },
        body: "data=" + encodeURIComponent(data),
        signal: AbortSignal.timeout(20000)
      });
      if (!r.ok) { last = url + " HTTP " + r.status; continue; }
      const j = await r.json();
      return json(200, { elements: j.elements || [] }, { "Cache-Control": "public, max-age=300" });
    } catch (err) { last = url + " " + err.message; }
  }
  return json(502, { error: "All servers failed", detail: last });
};
