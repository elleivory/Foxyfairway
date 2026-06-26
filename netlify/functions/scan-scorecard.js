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
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            ...images.map(img => ({
              type: "image",
              source: { type: "base64", media_type: img.media_type, data: img.data }
            })),
            {
              type: "text",
              text: `You are reading a golf scorecard. Extract the course name and hole data.
Return ONLY a JSON object with no other text, no markdown, no explanation.
The JSON must have this exact structure:
{"name":"Course Name","holes":[{"hole_number":1,"par":4,"stroke_index":11},{"hole_number":2,"par":3,"stroke_index":7}]}
Include all 18 holes. Use the official course name from the scorecard header.`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      return { statusCode: 500, body: JSON.stringify({ error: "No response from Claude API: " + JSON.stringify(data) }) };
    }

    const text = data.content[0].text || "";

    // Extract JSON from response - find first { to last }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { statusCode: 422, body: JSON.stringify({ error: "No JSON found in response: " + text.substring(0, 200) }) };
    }

    const jsonStr = text.substring(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    if (!parsed.name || !parsed.holes || parsed.holes.length !== 18) {
      return { statusCode: 422, body: JSON.stringify({ error: "Invalid data - got " + (parsed.holes?.length || 0) + " holes, need 18" }) };
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
