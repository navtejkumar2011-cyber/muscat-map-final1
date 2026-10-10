// Netlify function (Groq version). Keeps your AI key secret on the server.
// Set GROQ_API_KEY (and GROQ_MODEL) in Netlify -> Site configuration -> Environment variables.
exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let data = {};
  try { data = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Bad JSON" }); }
  const { name = "", facts = "", question = "", lang = "en" } = data;
  if (!String(question).trim()) return json(400, { error: "No question" });

  const names = { en: "English", hi: "Hindi", fr: "French" };
  const system =
    "You are a friendly local guide inside a map app for Muscat, Oman. " +
    "Answer in the same language the question is written in (English, Hindi or French); if unclear use " + (names[lang] || "English") + ". " +
    "Use the known facts plus well-established general knowledge. If you are not sure, say so briefly instead of guessing. " +
    "Maximum 3 short sentences. Plain text only, no markdown.";
  const user =
    "Place: " + String(name).slice(0, 200) + "\nKnown facts: " + String(facts).slice(0, 2500) +
    "\n\nQuestion: " + String(question).slice(0, 500);

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"; // check console.groq.com/docs/models for a current model name
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (process.env.GROQ_API_KEY || "")
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: 300
      })
    });
    const j = await r.json();
    const answer = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!answer) return json(502, { error: (j.error && j.error.message) || "No answer" });
    return json(200, { answer: answer.trim() });
  } catch (e) {
    return json(500, { error: "Request failed" });
  }
};
