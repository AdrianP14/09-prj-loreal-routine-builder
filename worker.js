const allowedOrigins = new Set([
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

function getCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (!allowedOrigins.has(origin)) {
        return jsonResponse({ error: "Origin not allowed." }, 403, corsHeaders);
      }

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!allowedOrigins.has(origin)) {
      return jsonResponse({ error: "Origin not allowed." }, 403, corsHeaders);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST for chat requests." }, 405, corsHeaders);
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        { error: "The OPENAI_API_KEY Worker secret is not configured." },
        500,
        corsHeaders
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400, corsHeaders);
    }

    const validMessages =
      body &&
      typeof body === "object" &&
      Array.isArray(body.messages) &&
      body.messages.length > 0 &&
      body.messages.every(
        (message) =>
          message &&
          ["system", "user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      );

    if (!validMessages) {
      return jsonResponse(
        { error: "messages must be a non-empty array of chat messages." },
        400,
        corsHeaders
      );
    }

    let openAIResponse;
    try {
      openAIResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-6.2-astra",
          tools: [{ type: "web_search", search_context_size: "medium" }],
          input: body.messages,
          store: false,
        }),
      });
    } catch (error) {
      console.error("Could not reach the OpenAI API.");
      return jsonResponse(
        { error: "The AI service could not be reached." },
        502,
        corsHeaders
      );
    }

    if (!openAIResponse.ok) {
      console.error("OpenAI API returned status:", openAIResponse.status);
      return jsonResponse(
        { error: "The AI service could not complete the request." },
        502,
        corsHeaders
      );
    }

    let result;
    try {
      result = await openAIResponse.json();
    } catch (error) {
      return jsonResponse(
        { error: "The AI service returned invalid JSON." },
        502,
        corsHeaders
      );
    }

    const answerParts = [];
    const citationsByUrl = new Map();

    for (const item of result.output || []) {
      if (item.type !== "message" || item.role !== "assistant") continue;

      for (const content of item.content || []) {
        if (content.type !== "output_text") continue;

        answerParts.push(content.text);
        for (const annotation of content.annotations || []) {
          if (annotation.type === "url_citation" && annotation.url) {
            citationsByUrl.set(annotation.url, {
              title: annotation.title || annotation.url,
              url: annotation.url,
            });
          }
        }
      }
    }

    const answer = answerParts.join("\n").trim();
    if (!answer) {
      return jsonResponse(
        { error: "The AI service did not return an answer." },
        502,
        corsHeaders
      );
    }

    return jsonResponse(
      {
        choices: [{ message: { content: answer } }],
        citations: Array.from(citationsByUrl.values()),
      },
      200,
      corsHeaders
    );
  },
};
