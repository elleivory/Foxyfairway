exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const { images } = JSON.parse(event.body);
    if (!images || images.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No images provided" }) };
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
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            ...images.map(img => ({
              type: "image",
              source: { type: "base64", media_type: img.media_type, data: img.data }
            })),
            {
              type: "text",
              text: "Read this golf scorecard. Return ONLY valid JSON, no other text. Format: {\"name\": \"Course Name\", \"holes\": [{\"hole_number\": 1, \"par\": 4, \"stroke_index\": 11}]} for all 18 holes. Use the official course name from the scorecard header. Include all 18 holes with correct par and stroke_index (SI) values."
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (!parsed.name || !parsed.holes || parsed.holes.length !== 18) {
      return { statusCode: 422, body: JSON.stringify({ error: "Could not read all 18 holes from scorecard" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };

  } catch (e) {
    console.error("Scan error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to read scorecard: " + e.message }) };
  }
};
