const express = require("express");
const { registerTool, executeTool, listTools } = require("./config/toolRegistry");
const { success, failure } = require("./utils/jsonResponse");
const aiTool = require("./tools/aiTool");
const postgresTool = require("./tools/postgresTool");
const fileTool = require("./tools/fileTool");

let toolsRegistered = false;

function registerDefaultTools() {
  if (toolsRegistered) return;

  registerTool("ai.analyzeIdea", aiTool.analyze, "Analyze a startup idea with Gemini and return structured JSON.");
  registerTool("postgres.getUsers", postgresTool.getUsers, "Fetch users from PostgreSQL.");
  registerTool("postgres.saveAnalysis", postgresTool.saveAnalysis, "Save a startup analysis to PostgreSQL.");
  registerTool("postgres.getAnalysisHistory", postgresTool.getAnalysisHistory, "Load previous startup analyses from PostgreSQL.");
  registerTool("file.saveReport", fileTool.saveReport, "Save a JSON report to disk.");
  registerTool("file.readReport", fileTool.readReport, "Read a JSON report from disk.");
  registerTool("file.listReports", fileTool.listReports, "List saved JSON reports on disk.");

  toolsRegistered = true;
}

async function runTool(toolName, input) {
  registerDefaultTools();
  return executeTool(toolName, input);
}

function createMcpRouter() {
  registerDefaultTools();

  const router = express.Router();

  router.get("/status", (req, res) => {
    res.json(success("MCP server is running.", { status: "running" }, { tools: listTools() }));
  });

  router.get("/health", (req, res) => {
    res.json(success("MCP health check passed.", { healthy: true }));
  });

  router.get("/tools", (req, res) => {
    res.json(success("Registered tools loaded.", { tools: listTools() }));
  });

  router.get("/users", async (req, res) => {
    try {
      const result = await runTool("postgres.getUsers", {});
      res.json(success("Users loaded successfully.", result));
    } catch (error) {
      res.status(500).json(failure(error.message, null, { tool: "postgres.getUsers" }));
    }
  });

  router.get("/reports", async (req, res) => {
    try {
      const fileReports = await runTool("file.listReports", {});
      const history = await runTool("postgres.getAnalysisHistory", {
        limit: req.query.limit,
        userId: req.query.userId,
      });

      res.json(
        success("Reports loaded successfully.", {
          fileReports: fileReports.reports,
          fileReportCount: fileReports.count,
          databaseReports: history.history,
          databaseReportCount: history.count,
        })
      );
    } catch (error) {
      res.status(500).json(failure(error.message, null, { tool: "reports" }));
    }
  });

  router.post("/analyze", async (req, res) => {
    try {
      const analysis = await runTool("ai.analyzeIdea", req.body || {});
      res.json(success("Startup idea analyzed successfully.", analysis));
    } catch (error) {
      res.status(500).json(failure(error.message, null, { tool: "ai.analyzeIdea" }));
    }
  });

  router.post("/save-report", async (req, res) => {
    try {
      const { title, description, targetAudience, analysis, userId, fileName } = req.body || {};
      const fileResult = await runTool("file.saveReport", {
        fileName,
        report: {
          title,
          description,
          targetAudience,
          analysis,
          savedAt: new Date().toISOString(),
        },
      });

      let databaseResult = null;
      if (analysis) {
        databaseResult = await runTool("postgres.saveAnalysis", {
          userId,
          title,
          description,
          targetAudience,
          analysis,
        });
      }

      res.json(success("Report saved successfully.", { file: fileResult, database: databaseResult }));
    } catch (error) {
      res.status(500).json(failure(error.message, null, { tool: "save-report" }));
    }
  });

  router.post("/tools/:toolName", async (req, res) => {
    try {
      const result = await runTool(req.params.toolName, req.body || {});
      res.json(success(`Tool ${req.params.toolName} executed successfully.`, result));
    } catch (error) {
      res.status(500).json(failure(error.message, null, { tool: req.params.toolName }));
    }
  });

  return router;
}

function createMcpServer() {
  const app = express();
  app.use(express.json());
  app.use(createMcpRouter());
  return app;
}

async function startMcpServer() {
  const port = Number(process.env.MCP_PORT || 5055);
  const app = createMcpServer();
  app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startMcpServer().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  createMcpRouter,
  createMcpServer,
  startMcpServer,
  registerDefaultTools,
};