const geminiApiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
  "";

const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
const preferredModels = (process.env.GEMINI_MODEL_PRIORITY?.trim()
  ? process.env.GEMINI_MODEL_PRIORITY.split(",")
  : ["gemma-4-31b-it", "gemini-flash-latest", geminiModel, "gemini-2.5-flash", "gemini-pro-latest"])
  .map((model) => model.trim())
  .filter(Boolean)
  .filter((model, index, array) => array.indexOf(model) === index)
  .filter((model) => /^(gemini-(?:.*flash.*|pro-latest)|gemma-)/i.test(model))
  .slice(0, 4);

function buildAnalysisPrompt({ title, description, targetAudience }) {
  return [
    "You are an analyst helping validate startup ideas.",
    "Return ONLY valid JSON (no markdown, no code fences, no extra text).",
    "The JSON MUST have these keys:",
    "- marketDemand (string)",
    "- competitors (array of 3-6 objects; each object MUST have: name (string), details (string), businessModel (string))",
    "  - details: what they offer + who they serve + why they compete with this idea",
    "  - businessModel: how they make money (e.g., commissions, subscriptions, ads, usage fees)",
    "- revenueModel (string)",
    "- swot (object with arrays: strengths, weaknesses, opportunities, threats)",
    "- suggestions (string)",
    "Keep each field concise but specific.",
    "",
    `Title: ${title}`,
    `Description: ${description}`,
    `Target Audience: ${targetAudience}`,
  ].join("\n");
}

function tryParseJson(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    // continue to fallback parsing
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;

  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const maybeJson = text.slice(firstBrace, i + 1);
        try {
          return JSON.parse(maybeJson);
        } catch (_) {
          const sanitized = maybeJson.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
          try {
            return JSON.parse(sanitized);
          } catch (__)
          {
            return null;
          }
        }
      }
    }
  }

  return null;
}

function normalizeTextField(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.description === "string") return value.description;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }
  if (value == null) return "";
  return String(value);
}

function normalizeList(value) {
  if (!value) return [];
  const array = Array.isArray(value) ? value : [value];
  return array
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof item.description === "string") {
        return item.description;
      }
      if (item == null) return "";
      return String(item);
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSwot(value) {
  const swot = value && typeof value === "object" ? value : {};
  return {
    strengths: normalizeList(swot.strengths),
    weaknesses: normalizeList(swot.weaknesses),
    opportunities: normalizeList(swot.opportunities),
    threats: normalizeList(swot.threats),
  };
}

function normalizeCompetitorItem(value, fallbackName) {
  if (typeof value === "string") {
    const name = value.trim();
    return {
      name: name || (fallbackName ? String(fallbackName) : ""),
      details: "",
      businessModel: "",
    };
  }

  const obj = value && typeof value === "object" ? value : {};
  const name = normalizeTextField(obj.name || fallbackName).trim();
  const details = normalizeTextField(
    obj.details || obj.summary || obj.description || obj.whatTheyDo || obj.overview
  ).trim();
  const businessModel = normalizeTextField(
    obj.businessModel || obj.business_model || obj.model
  ).trim();
  return { name, details, businessModel };
}

function normalizeCompetitors(value) {
  if (!value) return [];

  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed) return normalizeCompetitors(parsed);
    const details = value.trim();
    if (!details) return [];
    return [{ name: "Competitors", details, businessModel: "" }];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCompetitorItem(item))
      .filter((c) => c.name || c.details || c.businessModel);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([name, details]) => {
        if (details && typeof details === "object") {
          return normalizeCompetitorItem({ name, ...details }, name);
        }
        return normalizeCompetitorItem({ name, details }, name);
      })
      .filter((c) => c.name || c.details || c.businessModel);
  }

  return [];
}

function normalizeAnalysis(parsed) {
  const obj = parsed && typeof parsed === "object" ? parsed : {};
  return {
    marketDemand: normalizeTextField(obj.marketDemand),
    competitors: normalizeCompetitors(obj.competitors),
    revenueModel: normalizeTextField(obj.revenueModel),
    swot: normalizeSwot(obj.swot),
    suggestions: normalizeTextField(obj.suggestions),
  };
}

async function generateWithGemini({ prompt, temperature = 0.7 }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const maxOutputTokens = 2048;
  const requestTimeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "30000", 10);
  const timeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 60000;

  const baseBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  const jsonModeBody = {
    ...baseBody,
    generationConfig: {
      ...baseBody.generationConfig,
      responseMimeType: "application/json",
    },
  };

  const models = preferredModels.length ? preferredModels : ["gemini-2.5-flash", "gemini-flash-latest", "gemma-4-31b-it", "gemini-pro-latest"];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

    async function callGemini(body) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = (data && data.error && data.error.message) || `Gemini request failed (${response.status}).`;
          const error = new Error(message);
          error.status = response.status;
          error.data = data;
          throw error;
        }

        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts;
        const text = Array.isArray(parts)
          ? parts.map((part) => (typeof part?.text === "string" ? part.text : "")).filter(Boolean).join("").trim()
          : "";

        if (!text) {
          const blockReason = data?.promptFeedback?.blockReason;
          const finishReason = candidate?.finishReason;
          if (blockReason) {
            throw new Error(`Gemini blocked the response (blockReason=${blockReason}).`);
          }
          throw new Error(`Gemini returned empty content${finishReason ? ` (finishReason=${finishReason})` : ""}.`);
        }

        return { text, data };
      } catch (error) {
        if (error && error.name === "AbortError") {
          throw new Error(`Gemini request timed out after ${timeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    try {
      const result = await callGemini(jsonModeBody);
      return result;
    } catch (error) {
      if (error.message.includes("responseMimeType")) {
        try {
          return await callGemini(baseBody);
        } catch (_) {
          // continue to next model
        }
      }
    }
  }

  throw new Error(`All available models failed. Tried: ${models.join(", ")}`);
}

async function analyzeStartupIdea({ title, description, targetAudience, temperature = 0.7 }) {
  if (!title || !description || !targetAudience) {
    throw new Error("Please provide title, description, and targetAudience.");
  }

  const prompt = buildAnalysisPrompt({ title, description, targetAudience });
  const { text } = await generateWithGemini({ prompt, temperature });
  const parsed = tryParseJson(text);

  if (parsed) {
    return {
      ...normalizeAnalysis(parsed),
      raw: text,
      provider: "gemini",
      model: geminiModel,
    };
  }

  return {
    raw: text,
    provider: "gemini",
    model: geminiModel,
    warning: "Gemini returned non-JSON output. Please review the raw response.",
  };
}

module.exports = {
  analyzeStartupIdea,
  buildAnalysisPrompt,
  generateWithGemini,
  normalizeAnalysis,
  tryParseJson,
};