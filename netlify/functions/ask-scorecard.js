exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const { images, question, history } = JSON.parse(event.body);
    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "No question provided" }) };
    }
    if (!images || images.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No scorecard photos provided" }) };
    }

    // First user turn carries the card photos. Prior Q&A turns come through as plain text.
    // The API is stateless so the full context is rebuilt on every request.
    const firstContent = images.slice(0, 2).map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.media_type || "image/jpeg", data: img.data }
    }));

    const messages = [];
    const priorTurns = Array.isArray(history) ? history : [];
    if (priorTurns.length > 0) {
      // History already contains the first question - attach the photos to that first turn
      priorTurns.forEach((t, i) => {
        if (i === 0 && t.role === "user") {
          messages.push({ role: "user", content: [...firstContent, { type: "text", text: t.content }] });
        } else {
          messages.push({ role: t.role === "assistant" ? "assistant" : "user", content: t.content });
        }
      });
      messages.push({ role: "user", content: question });
    } else {
      messages.push({ role: "user", content: [...firstContent, { type: "text", text: question }] });
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
        system: `You are a golf scorecard analyst. You have been given photos of a completed golf scorecard. Answer the user's questions about it accurately and conversationally, like a knowledgeable playing partner.

READING THE CARD:
- Read player names, handicaps, hole pars, stroke indexes, and hole-by-hole scores directly from the photos.
- If handwriting is ambiguous on a hole, say which hole you're unsure about and give your best reading.
- If two photos are provided they may be front 9 and back 9 of the same card, or two angles - combine them.

CALCULATIONS YOU CAN BE ASKED FOR:
- Totals: front 9, back 9, and 18-hole gross totals per player. Always add carefully hole by hole.
- To par: gross total minus total par of holes played.
- Net scores: a player's handicap gives one stroke on each hole where stroke index <= handicap (a handicap over 18 gives 2 strokes where SI <= handicap-18, and 1 stroke elsewhere). A PLUS handicap (e.g. +2) means the player gives strokes back: add one stroke to their score on the easiest holes (highest stroke indexes - a +2 adds a stroke on SI 18 and SI 17).
- Stableford points per hole: points = par - (gross - handicap strokes on that hole) + 2, minimum 0. So net par = 2 pts, net birdie = 3, net bogey = 1, net double bogey or worse = 0. Total the 18 holes for the round score.
- Match play: compare net scores hole by hole if asked who won a match.
- If the card does not show a handicap for a player and the question needs one, ask the user for it rather than guessing.

STYLE:
- Be concise and direct. Show brief working for totals (e.g. "F9 42 + B9 40 = 82") so the user can verify.
- If asked to double-check a hole or total, re-read the photo carefully and say what you see.`,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || "API error" }) };
    }

    const answer = data.content?.[0]?.text || "No answer received.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    console.error("ask-scorecard error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Failed to analyse scorecard" })
    };
  }
};
