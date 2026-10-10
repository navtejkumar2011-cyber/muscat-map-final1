// Netlify function. Keeps your AI key secret on the server.
// Set GEMINI_API_KEY (and GEMINI_MODEL) in Netlify -> Site configuration -> Environment variables.
exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let data = {};
  try { data = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Bad JSON" }); }
  const { name = "", facts = "", question = "", lang = "en" } = data;
  if (!String(question).trim()) return json(400, { error: "No question" });

  const names = { en: "English", hi: "Hindi", fr: "French" };
  const prompt =
    "You are a friendly local guide inside a map app for Muscat, Oman.\n" +
    "The user selected this place: " + String(name).slice(0, 200) + "\n" +
    "Known facts: " + String(facts).slice(0, 2500) + "\n\n" +
    "Rules: Answer in the same language the question is written in (English, Hindi or French); " +
    "if unclear use " + (names[lang] || "English") + ". Use the known facts plus well-established general " +
    "knowledge. If you are not sure, say so briefly instead of guessing. Maximum 3 short sentences. " +
    "Plain text only, no markdown.\n\nQuestion: " + String(question).slice(0, 500);

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // check Google AI Studio for the current free model name
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const j = await r.json();
    const answer = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
      j.candidates[0].content.parts && j.candidates[0].content.parts[0].text;
    if (!answer) return json(502, { error: (j.error && j.error.message) || "No answer" });
    return json(200, { answer });
  } catch (e) {
    return json(500, { error: "Request failed" });
  }
};
