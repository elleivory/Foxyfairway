const Anthropic = require("@anthropic-ai/sdk");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { question } = JSON.parse(event.body);
    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "No question provided" }) };
    }

    const client = new Anthropic({ apiKey: process.env.REACT_APP_ANTHROPIC_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are an official USGA Rules of Golf expert. You ONLY answer using the official USGA Rules of Golf 2023 edition. Never reference any other rulebook, local rules, or unofficial interpretations. Always cite the specific Rule number (e.g. Rule 17.1a). Be practical and clear - explain what the player must do step by step. If a situation is not covered by the USGA Rules, say so explicitly. At the very end of your answer, on a new line, write exactly: IMAGE_SEARCH: followed by 2-3 specific search terms that would find a relevant USGA rules diagram or golf rules illustration for this topic. Example: IMAGE_SEARCH: USGA penalty area relief options diagram`,
      messages: [{ role: "user", content: question }]
    });

    const fullText = response.content?.[0]?.text || "No answer received.";
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
