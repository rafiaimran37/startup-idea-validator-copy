const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const mcpRoutes = require("./routes/mcpRoutes");

const chatRoutes = require("./routes/chatRoutes");
const { ensureUsersTable, ensureIdeasTable, hasDatabaseConfig } = require("./config/db");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// NOTE: This line is intentionally added to create a small, trackable change for git commit/push flow.
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/chat", chatRoutes);
app.use("/mcp", mcpRoutes);

const geminiApiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
  "";
const hasGeminiKey = Boolean(geminiApiKey);
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
const preferredGeminiModels = (process.env.GEMINI_MODEL_PRIORITY?.trim()
  ? process.env.GEMINI_MODEL_PRIORITY.split(",")
  : ["gemma-4-31b-it", "gemini-flash-latest", geminiModel, "gemini-2.5-flash", "gemini-pro-latest"])
  .map((model) => model.trim())
  .filter(Boolean)
  .filter((model, index, array) => array.indexOf(model) === index)
  .filter((model) => /^(gemini-(?:.*flash.*|pro-latest)|gemma-)/i.test(model))
  .slice(0, 4);

if (!hasGeminiKey) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not set. The /api/analyze endpoint will return an error until you configure it."
  );
}

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

  // Quick attempt
  try {
    return JSON.parse(text);
  } catch (_) {
    // continue to fallbacks
  }

  // Try to extract a balanced JSON object from the text (handles extra text before/after)
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;

  // Walk the string to find the matching closing brace taking quotes and escapes into account
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
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const maybeJson = text.slice(firstBrace, i + 1);
        try {
          return JSON.parse(maybeJson);
        } catch (_) {
          // If parsing fails, attempt to sanitize common issues (trailing commas)
          try {
            const sanitized = maybeJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
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

  // If a model returned competitors as a JSON string, try to parse it.
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed) {
      return normalizeCompetitors(parsed);
    }
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
  const obj = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    marketDemand: normalizeTextField(obj.marketDemand),
    competitors: normalizeCompetitors(obj.competitors),
    revenueModel: normalizeTextField(obj.revenueModel),
    swot: normalizeSwot(obj.swot),
    suggestions: normalizeTextField(obj.suggestions),
  };
}

// Cache for available models
let cachedModels = null;

// Get list of available models
async function getAvailableModels(apiKey) {
  if (cachedModels) return cachedModels;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models && Array.isArray(data.models)) {
      cachedModels = data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      
      console.log('Available models:', cachedModels);
      return cachedModels;
    }
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
  
  // Fallback to a short real-model list so failures don't exhaust the timeout.
  return ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
}

async function generateWithGemini({ prompt, temperature = 0.7 }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const maxOutputTokens = 2048;
  const requestTimeoutMs = Number.parseInt(
    process.env.GEMINI_TIMEOUT_MS || "60000",
    10
  );
  const timeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 60000;

  const baseBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const jsonModeBody = {
    ...baseBody,
    generationConfig: {
      ...baseBody.generationConfig,
      responseMimeType: "application/json",
    },
  };

  // Try only a short real-model list to avoid long failover loops and timeout churn.
  const models = preferredGeminiModels.length
    ? preferredGeminiModels
    : ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];

  if (!models.length) {
    throw new Error("No usable Gemini models are available.");
  }
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

    async function callGemini(body) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            (data && data.error && data.error.message) ||
            `Gemini request failed (${response.status}).`;
          const error = new Error(message);
          error.status = response.status;
          error.data = data;
          throw error;
        }

        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts;
        const text = Array.isArray(parts)
          ? parts
              .map((p) => (typeof p?.text === "string" ? p.text : ""))
              .filter(Boolean)
              .join("")
              .trim()
          : "";

        if (!text) {
          const blockReason = data?.promptFeedback?.blockReason;
          const finishReason = candidate?.finishReason;
          if (blockReason) {
            throw new Error(`Gemini blocked the response (blockReason=${blockReason}).`);
          }
          throw new Error(
            `Gemini returned empty content${finishReason ? ` (finishReason=${finishReason})` : ""}.`
          );
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
      console.log(`🔄 Trying model: ${model}`);
      const result = await callGemini(jsonModeBody);
      console.log(`✅ Success with model: ${model}`);
      return result;
    } catch (error) {
      console.log(`❌ Model ${model} failed:`, error.message);
      
      // If json mode failed, try without it
      if (error.message.includes("responseMimeType")) {
        try {
          console.log(`🔄 Retrying ${model} without JSON mode...`);
          const result = await callGemini(baseBody);
          console.log(`✅ Success with model: ${model} (without JSON mode)`);
          return result;
        } catch (retryError) {
          console.log(`❌ Retry failed for ${model}`);
        }
      }
      
      // Continue to next model
      continue;
    }
  }
  
  throw new Error(`All available models failed. Tried: ${models.join(', ')}`);
}

function generateMockAnalysis({ title, description, targetAudience }) {
  return {
    marketDemand: `There is a healthy market interest in '${title}' from ${targetAudience}, especially for solutions that ${description.slice(0, 120)}...`,
    competitors: `Competitors are likely existing products and services in the same market niche, including established players and indirect alternatives.`,
    revenueModel: `A strong revenue model could include subscriptions, premium features, or consulting services that address the needs of ${targetAudience}.`,
    swot: {
      strengths: [
        `Clear problem focus based on the idea description`,
        `Product could appeal to ${targetAudience}`,
      ],
      weaknesses: [
        `May need strong differentiation from competitors`,
        `Initial traction may require targeted marketing`,
      ],
      opportunities: [
        `Expand into adjacent audiences once product-market fit is found`,
        `Use customer feedback to refine the core offering`,
      ],
      threats: [
        `Established competitors with more resources`,
        `Potential challenges in acquiring early users`,
      ],
    },
    suggestions: `Validate the core idea with early users, focus on a narrow target segment, and iterate on the product based on feedback.`,
  };
}

app.post("/api/analyze", async (req, res) => {
  const { title, description, targetAudience } = req.body;

  if (!title || !description || !targetAudience) {
    return res.status(400).json({
      error: "Please provide title, description, and targetAudience in the request body.",
    });
  }

  if (!hasGeminiKey) {
    return res.status(400).json({
      error: "GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable.",
    });
  }

  try {
    const prompt = buildAnalysisPrompt({ title, description, targetAudience });

    // Allow callers or environment to influence randomness.
    const reqTemp = Number(req.body.temperature);
    const envTemp = Number.parseFloat(process.env.GEMINI_TEMPERATURE || "");
    const temperature = Number.isFinite(reqTemp) && reqTemp > 0 ? reqTemp : (Number.isFinite(envTemp) ? envTemp : 0.7);

    const { text } = await generateWithGemini({ prompt, temperature });

    const parsed = tryParseJson(text);
    if (parsed) {
      return res.json({
        ...normalizeAnalysis(parsed),
        raw: text,
        provider: "gemini",
        model: geminiModel,
      });
    }

    // Fallback: attempt to heuristically extract specific fields from the raw text
    const fallback = {};
    try {
      // marketDemand / revenueModel / suggestions as simple string fields
      const strField = (key) => {
        const re = new RegExp('"' + key + '"\\s*:\\s*"([\\s\\S]*?)"', 'i');
        const m = text.match(re);
        return m ? m[1].replace(/\\n/g, '\\n').trim() : undefined;
      };

      const arrayField = (key) => {
        const idx = text.indexOf('"' + key + '"');
        if (idx === -1) return undefined;
        const start = text.indexOf('[', idx);
        if (start === -1) return undefined;
        // find matching bracket
        let inString = false;
        let escape = false;
        let depth = 0;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\') { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '[') depth++;
          if (ch === ']') {
            depth--;
            if (depth === 0) {
              let slice = text.slice(start, i + 1);
              // sanitize trailing commas
              slice = slice.replace(/,\\s*]/g, ']');
              slice = slice.replace(/,\\s*}/g, '}');
              try {
                return JSON.parse(slice);
              } catch (e) {
                return undefined;
              }
            }
          }
        }
        return undefined;
      };

      const objField = (key) => {
        const idx = text.indexOf('"' + key + '"');
        if (idx === -1) return undefined;
        const start = text.indexOf('{', idx);
        if (start === -1) return undefined;
        // find matching brace
        let inString = false;
        let escape = false;
        let depth = 0;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\') { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          if (ch === '}') {
            depth--;
            if (depth === 0) {
              let slice = text.slice(start, i + 1);
              slice = slice.replace(/,\\s*}/g, '}');
              try {
                return JSON.parse(slice);
              } catch (e) {
                return undefined;
              }
            }
          }
        }
        return undefined;
      };

      const md = strField('marketDemand') || strField('market_demand');
      const rm = strField('revenueModel') || strField('revenue_model');
      const sug = strField('suggestions');
      const comps = arrayField('competitors');
      const sw = objField('swot');

      if (md) fallback.marketDemand = md;
      if (rm) fallback.revenueModel = rm;
      if (sug) fallback.suggestions = sug;
      if (comps) fallback.competitors = comps;
      if (sw) fallback.swot = sw;
    } catch (e) {
      console.warn('Fallback parsing failed:', e.message);
    }

    // If fallback produced useful data, return normalized result
    if (Object.keys(fallback).length) {
      return res.json({
        ...normalizeAnalysis(fallback),
        raw: text,
        provider: 'gemini',
        model: geminiModel,
        warning: 'Gemini returned malformed JSON; heuristically extracted fields.'
      });
    }

    // Last resort: return raw with warning
    return res.json({
      raw: text,
      warning: 'Gemini returned non-JSON output. Please review the raw response.',
      provider: 'gemini',
      model: geminiModel,
    });
  } catch (error) {
    console.error(error);
    const message =
      error && typeof error.message === "string" && error.message.trim()
        ? error.message
        : "Failed to analyze idea with Gemini.";
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (hasDatabaseConfig()) {
    try {
      await ensureUsersTable();
      await ensureIdeasTable();
      console.log("Users and ideas tables are ready.");
    } catch (error) {
      console.warn("Database initialization warning:", error.message);
    }
  } else {
    console.warn(
      "Database config is incomplete. Set DB_USER, DB_PASSWORD, and DB_NAME to enable auth routes."
    );
  }

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer();
