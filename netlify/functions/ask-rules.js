exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const { question } = JSON.parse(event.body);
    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "No question provided" }) };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: `You are a golf rules expert and on-course rules official. When answering a rules question, always respond in exactly this two-part format:

PART 1 - PLAIN ENGLISH (label it with the emoji 🏌️):
Explain the answer in simple, practical terms as if you are a knowledgeable playing partner standing next to the golfer on the course. Use plain language, no jargon. Tell them exactly what they should do next, what their options are, and any important things to watch out for. Make it conversational and helpful. If there are multiple options, explain each one clearly and which is most practical.

PART 2 - OFFICIAL RULE (label it with the emoji 📖):
Cite the exact USGA Rule number and sub-section (e.g. Rule 17.1d). Then quote the most relevant portion of the official USGA Rules of Golf 2023 text that supports your answer.

Only use the official USGA Rules of Golf 2023. Never reference local rules or unofficial interpretations. At the very end, on a new line write: IMAGE_SEARCH: followed by 2-3 specific search terms for a relevant golf rules diagram.`,
        messages: [{ role: "user", content: question }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || "API error" }) };
    }

    const fullText = data.content?.[0]?.text || "No answer received.";
    const imageSearchMatch = fullText.match(/IMAGE_SEARCH:\s*(.+)$/m);
    const cleanAnswer = fullText.replace(/IMAGE_SEARCH:.*$/m, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: cleanAnswer,
        imageSearch: imageSearchMatch ? imageSearchMatch[1].trim() : null
      })
    };
  } catch (err) {
    console.error("ask-rules error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Failed to get rules answer" })
    };
  }
};
