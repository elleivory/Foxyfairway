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
              text: `You are reading a completed golf scorecard photo. Your job is to extract one player's name, handicap, and their gross stroke score for each of the 18 holes.

IMPORTANT RULES:
- Return ONLY a valid JSON object. No markdown, no explanation, no text before or after.
- All JSON keys must be quoted strings.
- Scores must be GROSS strokes per hole only (the raw number of shots). Do NOT read net scores, stableford points, or any calculated column.
- Ignore any totals rows (OUT, IN, TOTAL) - only read individual hole scores 1 through 18.
- If the card shows multiple players in columns, read only the first player column with a name on it.
- The handicap may be labelled as: Handicap, HCP, Playing HCP, Course HCP, Index, or GA Index.
- If the player name is not visible, use an empty string for player_name.
- If the handicap is not visible or unclear, use null for handicap.
- If a hole score is not visible, illegible, or missing, use null for that hole number.

Return this exact JSON structure:
{"player_name":"John Smith","handicap":14,"scores":{"1":4,"2":5,"3":3,"4":6,"5":4,"6":5,"7":3,"8":4,"9":5,"10":4,"11":3,"12":5,"13":4,"14":6,"15":3,"16":4,"17":5,"18":4}}`
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
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { statusCode: 422, body: JSON.stringify({ error: "No JSON found in response: " + text.substring(0, 200) }) };
    }

    const jsonStr = text.substring(start, end + 1);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return { statusCode: 422, body: JSON.stringify({ error: "Claude returned invalid JSON: " + parseErr.message + " | Raw: " + jsonStr.substring(0, 300) }) };
    }

    if (parsed.scores === undefined) {
      return { statusCode: 422, body: JSON.stringify({ error: "No scores found. Claude said: " + text.substring(0, 300) }) };
    }

    // Normalise: replace null hole scores with 0 so the grid shows blank not "null"
    const normalisedScores = {};
    for (let i = 1; i <= 18; i++) {
      const val = parsed.scores[String(i)] ?? parsed.scores[i] ?? null;
      normalisedScores[i] = val !== null ? val : null;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_name: parsed.player_name || "",
        handicap: parsed.handicap != null ? parsed.handicap : null,
        scores: normalisedScores
      })
    };

  } catch (e) {
    console.error("Scan player error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to read player scorecard: " + e.message }) };
  }
};
