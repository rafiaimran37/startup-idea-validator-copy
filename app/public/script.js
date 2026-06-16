// --- AI Chat Assistant Modal Logic ---

// localStorage key for storing startup idea context
const STARTUP_IDEA_STORAGE_KEY = 'startup_idea_context';
const STARTUP_ANALYSIS_STORAGE_KEY = 'startup_analysis_result';

const form = document.getElementById("idea-form");
const resultSection = document.getElementById("result");
const statusEl = document.getElementById("status");
const spinner = document.getElementById("spinner");
const submitBtn = document.getElementById("submit-btn");
const mcpTestBtn = document.getElementById("mcp-test-btn");
const resetBtn = document.getElementById("reset-btn");
const clearBtn = document.getElementById("clear-btn");
const saveBtn = document.getElementById("save-idea-btn");
const mcpSpinner = document.getElementById("mcp-spinner");
const mcpResultSection = document.getElementById("mcp-result");
const mcpClearBtn = document.getElementById("mcp-clear-btn");

function getStoredToken() {
  return localStorage.getItem("startup_ai_token") || "";
}

// Save startup idea context to localStorage
function saveStartupIdeaContext(title, description, targetAudience) {
  const context = { title, description, targetAudience };
  localStorage.setItem(STARTUP_IDEA_STORAGE_KEY, JSON.stringify(context));
}

// Get startup idea context from localStorage
function getStartupIdeaContext() {
  const stored = localStorage.getItem(STARTUP_IDEA_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

window.getStartupIdeaContext = getStartupIdeaContext;

// Save analysis result to localStorage
function saveAnalysisResult(data) {
  // Ensure we're saving the complete data object
  const toSave = {
    ...data,
    // Make sure we preserve the raw response
    raw: data.raw || JSON.stringify(data, null, 2)
  };
  localStorage.setItem(STARTUP_ANALYSIS_STORAGE_KEY, JSON.stringify(toSave));
}

// Get analysis result from localStorage
function getAnalysisResult() {
  const stored = localStorage.getItem(STARTUP_ANALYSIS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

window.getAnalysisResult = getAnalysisResult;

function getIdeaInputPayload() {
  return {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    targetAudience: document.getElementById("targetAudience").value.trim(),
  };
}

// Restore page state on load
function restorePageState() {
  const ideaContext = getStartupIdeaContext();
  if (ideaContext) {
    document.getElementById("title").value = ideaContext.title || "";
    document.getElementById("description").value = ideaContext.description || "";
    document.getElementById("targetAudience").value = ideaContext.targetAudience || "";
  }

  const analysisResult = getAnalysisResult();
  if (analysisResult) {
    displayAnalysisResult(analysisResult);
    resultSection.classList.remove("hidden");
    if (getStoredToken()) {
      saveBtn.style.display = "inline-block";
    }
  }
}

// Display analysis result from stored data
function displayAnalysisResult(data) {
  console.log("📊 displayAnalysisResult called with data:", data);
  
  let analysisData = data;
  
  // If any expected top-level field is missing, attempt to parse `raw` and merge
  const missingField = !(data && data.marketDemand && data.competitors && data.swot && data.suggestions);
  if (missingField && data.raw && typeof data.raw === "string") {
    console.log("⚠️ One or more parsed fields missing, attempting to parse raw response...");
    const parsed = tryParseJson(data.raw);
    if (parsed && typeof parsed === "object") {
      console.log("✅ Successfully parsed raw response:", parsed);
      // Merge parsed fields into analysisData but keep any existing top-level fields
      analysisData = {
        ...analysisData,
        ...parsed,
      };
    } else {
      console.log("❌ Failed to parse raw response");
    }
  }

  const marketDemand = analysisData.marketDemand || analysisData.market_demand;
  const competitors = analysisData.competitors;
  const revenueModel = analysisData.revenueModel || analysisData.revenue_model;
  const swot = analysisData.swot;
  const suggestions = analysisData.suggestions;
  const raw = data.raw || analysisData.raw;
  
  console.log("📊 Extracted fields:", { marketDemand, competitors, revenueModel, swot, suggestions });

  // Display text fields with better error handling
  const marketDemandText = getDisplayValue(marketDemand);
  const competitorsText = formatCompetitors(competitors);
  const revenueModelText = getDisplayValue(revenueModel);
  const suggestionsText = getDisplayValue(suggestions);
  
  console.log("📊 Formatted text:", { marketDemandText, competitorsText, revenueModelText, suggestionsText });

  document.querySelector("#market-demand .content").textContent = marketDemandText || "(no output)";
  document.querySelector("#competitors .content").textContent = competitorsText || "(no output)";
  document.querySelector("#revenue-model .content").textContent = revenueModelText || "(no output)";
  document.querySelector("#suggestions .content").textContent = suggestionsText || "(no output)";

  // Display SWOT analysis
  const maybeSwot = swot || {};
  // If swot is missing or empty, try to heuristically extract it from raw text
  const isSwotEmpty = !(maybeSwot && (Array.isArray(maybeSwot.strengths) && maybeSwot.strengths.length));
  if (isSwotEmpty && raw && typeof raw === 'string') {
    const heur = extractSwotAndSuggestionsFromRaw(raw);
    if (heur.swot) {
      maybeSwot.strengths = maybeSwot.strengths && maybeSwot.strengths.length ? maybeSwot.strengths : heur.swot.strengths || [];
      maybeSwot.weaknesses = maybeSwot.weaknesses && maybeSwot.weaknesses.length ? maybeSwot.weaknesses : heur.swot.weaknesses || [];
      maybeSwot.opportunities = maybeSwot.opportunities && maybeSwot.opportunities.length ? maybeSwot.opportunities : heur.swot.opportunities || [];
      maybeSwot.threats = maybeSwot.threats && maybeSwot.threats.length ? maybeSwot.threats : heur.swot.threats || [];
    }
    if ((!suggestionsText || suggestionsText === '(no output)') && heur.suggestions) {
      document.querySelector("#suggestions .content").textContent = heur.suggestions;
    }
  }
  const fillList = (selector, items) => {
    const ul = document.querySelector(selector);
    ul.innerHTML = "";
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return;
    }
    (Array.isArray(items) ? items : [items]).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = typeof item === "object" && item !== null && item.description 
        ? item.description 
        : (typeof item === "string" ? item : "(no output)");
      ul.appendChild(li);
    });
  };

  fillList("#strengths", maybeSwot.strengths);
  fillList("#weaknesses", maybeSwot.weaknesses);
  fillList("#opportunities", maybeSwot.opportunities);
  fillList("#threats", maybeSwot.threats);

  if (window.updateAnalyticsCharts) {
    window.updateAnalyticsCharts(analysisData, getStartupIdeaContext() || {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      targetAudience: document.getElementById("targetAudience").value.trim(),
    });
  }

  document.getElementById("rawOutput").textContent = raw || JSON.stringify(data, null, 2);
}

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
};

const showSpinner = (show) => {
  if (show) {
    spinner.classList.remove("hidden");
  } else {
    spinner.classList.add("hidden");
  }
};

const showMcpSpinner = (show) => {
  if (!mcpSpinner) return;
  if (show) {
    mcpSpinner.classList.remove("hidden");
  } else {
    mcpSpinner.classList.add("hidden");
  }
};

const ANALYZE_TIMEOUT_MS = 60_000;

function getDisplayValue(val) {
  // Handle null/undefined
  if (val === null || val === undefined) return "(no output)";
  
  // Handle string values
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed || "(no output)";
  }
  
  // Handle objects with description property
  if (typeof val === "object" && val !== null) {
    if (val.description && typeof val.description === "string") {
      return val.description.trim();
    }
    // Try to stringify
    try {
      const str = JSON.stringify(val, null, 2);
      return str && str.trim() !== "{}" ? str : "(no output)";
    } catch (_) {
      return "(no output)";
    }
  }
  
  // Fallback
  return String(val).trim() || "(no output)";
}

function tryParseJson(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  
  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // Continue to fallback
  }
  
  // Try to extract JSON from text
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  
  const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(maybeJson);
  } catch (_) {
    return null;
  }
}

function toText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (typeof value.description === "string") return value.description;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

function formatCompetitorItem(item, fallbackName) {
  if (typeof item === "string") {
    return item.trim();
  }

  const obj = item && typeof item === "object" ? item : {};
  const name = toText(obj.name || obj.competitor || obj.title || fallbackName || "Competitor").trim();
  const details = toText(obj.details || obj.summary || obj.description || obj.whatTheyDo || obj.overview).trim();
  const businessModel = toText(obj.businessModel || obj.business_model || obj.model).trim();

  const lines = [name];
  lines.push(`- Details: ${details || "(not provided)"}`);
  lines.push(`- Business model: ${businessModel || "(not provided)"}`);

  // If the object contains other fields, show them as extra details.
  const knownKeys = new Set([
    "name",
    "competitor",
    "title",
    "details",
    "summary",
    "description",
    "whatTheyDo",
    "overview",
    "businessModel",
    "business_model",
    "model",
  ]);
  const extra = Object.keys(obj)
    .filter((k) => !knownKeys.has(k))
    .reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
  if (Object.keys(extra).length) {
    lines.push(`- Other: ${toText(extra).replace(/\s+/g, " ").trim()}`);
  }

  return lines.join("\n");
}

function formatCompetitors(value) {
  // Handle null/undefined
  if (!value) return "(no output)";

  let v = value;
  
  // If it's a string, try to parse it as JSON
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return "(no output)";
    
    const parsed = tryParseJson(trimmed);
    if (parsed) {
      v = parsed;
    } else {
      // It's a plain string, return it
      return trimmed;
    }
  }

  // Handle array
  if (Array.isArray(v)) {
    if (v.length === 0) return "(no output)";
    const formatted = v.map((item) => formatCompetitorItem(item)).filter(Boolean);
    return formatted.length > 0 ? formatted.join("\n\n") : "(no output)";
  }

  // Handle object
  if (typeof v === "object" && v !== null) {
    const entries = Object.entries(v);
    if (entries.length === 0) return "(no output)";
    
    const formatted = entries
      .map(([name, details]) => {
        if (details && typeof details === "object") {
          return formatCompetitorItem({ name, ...details }, name);
        }
        return formatCompetitorItem({ name, details }, name);
      })
      .filter(Boolean);
    
    return formatted.length > 0 ? formatted.join("\n\n") : "(no output)";
  }

  return getDisplayValue(value);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

const clearResults = () => {
  resultSection.classList.add("hidden");
  form.reset();
  setStatus("");
  showSpinner(false);
};

const clearMcpResults = () => {
  if (mcpResultSection) {
    mcpResultSection.classList.add("hidden");
  }
  const fields = [
    "#mcp-market-analysis .content",
    "#mcp-revenue-suggestions .content",
    "#mcp-ai-recommendations .content",
  ];
  fields.forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = "";
  });
  ["#mcp-strengths", "#mcp-weaknesses", "#mcp-opportunities", "#mcp-threats"].forEach((selector) => {
    const ul = document.querySelector(selector);
    if (ul) ul.innerHTML = "";
  });
  const rawOutput = document.getElementById("mcp-raw-output");
  if (rawOutput) rawOutput.textContent = "";
};

// Reset everything - clear inputs, storage, and results
const resetAll = () => {
  // Clear form inputs
  form.reset();
  
  // Clear all localStorage
  localStorage.removeItem(STARTUP_IDEA_STORAGE_KEY);
  localStorage.removeItem(STARTUP_ANALYSIS_STORAGE_KEY);
  
  // Hide results
  resultSection.classList.add("hidden");
  
  // Clear status
  setStatus("");
  showSpinner(false);
};

clearBtn.addEventListener("click", clearResults);
mcpClearBtn?.addEventListener("click", clearMcpResults);
resetBtn.addEventListener("click", resetAll);

function fillListItems(selector, items) {
  const ul = document.querySelector(selector);
  if (!ul) return;
  ul.innerHTML = "";
  if (!items || (Array.isArray(items) && items.length === 0)) {
    return;
  }
  (Array.isArray(items) ? items : [items]).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = typeof item === "object" && item !== null && item.description
      ? item.description
      : (typeof item === "string" ? item : "(no output)");
    ul.appendChild(li);
  });
}

function renderMcpResult(payload) {
  const data = payload?.data || payload || {};
  const analysis = data.marketDemand || data.competitors || data.swot ? data : data.analysis || data.result || {};
  const marketAnalysis = analysis.marketDemand || analysis.market_demand || "(no output)";
  const swot = analysis.swot || {};
  const revenueSuggestions = analysis.revenueModel || analysis.suggestions || "(no output)";
  const aiRecommendations = analysis.suggestions || "(no output)";

  document.querySelector("#mcp-market-analysis .content").textContent = getDisplayValue(marketAnalysis);
  document.querySelector("#mcp-revenue-suggestions .content").textContent = getDisplayValue(revenueSuggestions);
  document.querySelector("#mcp-ai-recommendations .content").textContent = getDisplayValue(aiRecommendations);

  fillListItems("#mcp-strengths", swot.strengths);
  fillListItems("#mcp-weaknesses", swot.weaknesses);
  fillListItems("#mcp-opportunities", swot.opportunities);
  fillListItems("#mcp-threats", swot.threats);

  const rawOutput = document.getElementById("mcp-raw-output");
  if (rawOutput) {
    rawOutput.textContent = typeof payload?.raw === "string" ? payload.raw : JSON.stringify(payload, null, 2);
  }

  mcpResultSection?.classList.remove("hidden");
}

async function runMcpAnalysis() {
  const { title, description, targetAudience } = getIdeaInputPayload();

  if (!title || !description || !targetAudience) {
    setStatus("Please fill in all required fields before testing MCP.", true);
    return;
  }

  console.log("Using MCP Route");
  setStatus("Testing MCP analysis...", false);
  showMcpSpinner(true);
  mcpTestBtn.disabled = true;

  try {
    const response = await fetchWithTimeout(
      "/mcp/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, targetAudience }),
      },
      ANALYZE_TIMEOUT_MS
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `MCP analysis failed (${response.status}).`);
    }
    if (!payload) {
      throw new Error("MCP server returned an invalid JSON response.");
    }

    renderMcpResult(payload);
    setStatus("MCP analysis complete.");
  } catch (error) {
    setStatus(error.message || "MCP test failed.", true);
    console.error(error);
  } finally {
    showMcpSpinner(false);
    mcpTestBtn.disabled = false;
  }
}

mcpTestBtn?.addEventListener("click", runMcpAnalysis);

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const token = getStoredToken();
    if (!token) {
      setStatus("You must be logged in to save ideas.", true);
      return;
    }
    // Get the last analysis result from the UI
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const targetAudience = document.getElementById("targetAudience").value.trim();
    const analysis = document.getElementById("rawOutput").textContent;
    if (!title || !description || !targetAudience || !analysis) {
      setStatus("Missing analysis data.", true);
      return;
    }
    try {
      saveBtn.disabled = true;
      setStatus("Saving idea...");
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, targetAudience, analysis }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to save idea.");
      setStatus("Idea saved to your account!");
      saveBtn.style.display = "none";
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { title, description, targetAudience } = getIdeaInputPayload();

  if (!title || !description || !targetAudience) {
    setStatus("Please fill in all required fields.", true);
    return;
  }

  // Save startup idea context to localStorage
  saveStartupIdeaContext(title, description, targetAudience);

  console.log("Using OLD API Route");
  setStatus("Analyzing... This may take a few seconds.");
  showSpinner(true);
  submitBtn.disabled = true;

  try {
    const response = await fetchWithTimeout(
      "/api/analyze",
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description, targetAudience }),
      },
      ANALYZE_TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Analysis failed (${response.status}).`);
    }
    if (!data) {
      throw new Error("Server returned an invalid JSON response.");
    }

    // Save analysis result to localStorage
    saveAnalysisResult(data);

    displayAnalysisResult(data);

    resultSection.classList.remove("hidden");
    setStatus("Analysis complete.");
    // Show save button if logged in
    if (getStoredToken()) {
      saveBtn.style.display = "inline-block";
    } else {
      saveBtn.style.display = "none";
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
    console.error(error);
  } finally {
    showSpinner(false);
    submitBtn.disabled = false;
  }
});

// Restore page state when page loads
window.addEventListener('DOMContentLoaded', () => {
  restorePageState();
});

function extractSwotAndSuggestionsFromRaw(text) {
  const res = { swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, suggestions: null };
  if (typeof text !== 'string') return res;
  const normalized = text.replace(/\r\n/g, '\n');

  // Helper to capture section lines until next heading
  function capture(name) {
    const re = new RegExp(name + '\\s*[:\\n\\r]+([\\s\\S]*?)(?=\\n\\s*(Strengths|Weaknesses|Opportunities|Threats|Suggestions|$))', 'i');
    const m = normalized.match(re);
    if (!m) return null;
    return m[1].trim();
  }

  const strengthsBlock = capture('Strengths') || capture('strengths');
  const weaknessesBlock = capture('Weaknesses') || capture('weaknesses');
  const opportunitiesBlock = capture('Opportunities') || capture('opportunities');
  const threatsBlock = capture('Threats') || capture('threats');
  const suggestionsBlock = capture('Suggestions') || capture('suggestions');

  function splitItems(block) {
    if (!block) return [];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    lines.forEach(l => {
      const isList = /^[-*\u2022]|^\d+\./.test(l);
      if (isList) {
        items.push(l.replace(/^[-*\u2022]\s*/,'').replace(/^\d+\.\s*/,'').trim());
      } else if (items.length === 0 && l.length > 0) {
        items.push(l);
      } else if (!isList && items.length > 0) {
        items[items.length-1] = items[items.length-1] + ' ' + l;
      }
    });
    return items.map(s => s.trim()).filter(Boolean);
  }

  res.swot.strengths = splitItems(strengthsBlock);
  res.swot.weaknesses = splitItems(weaknessesBlock);
  res.swot.opportunities = splitItems(opportunitiesBlock);
  res.swot.threats = splitItems(threatsBlock);
  res.suggestions = suggestionsBlock ? suggestionsBlock.split('\n').map(s => s.trim()).join(' ').trim() : null;
  return res;
}
