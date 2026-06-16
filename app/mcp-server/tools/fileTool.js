const fs = require("fs/promises");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "..", "reports");

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

function makeSafeFileName(name) {
  return String(name || `report-${Date.now()}`)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toReportObject(input = {}) {
  if (input.report && typeof input.report === "object") {
    return input.report;
  }

  return {
    title: input.title || "Untitled Report",
    description: input.description || "",
    targetAudience: input.targetAudience || "",
    analysis: input.analysis || null,
    savedAt: new Date().toISOString(),
  };
}

async function saveReport(input = {}) {
  await ensureReportsDir();

  const report = toReportObject(input);
  const fileName = makeSafeFileName(input.fileName || input.reportName || `${report.title}-${Date.now()}`);
  const finalName = fileName.endsWith(".json") ? fileName : `${fileName}.json`;
  const filePath = path.join(REPORTS_DIR, finalName);

  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf8");

  return {
    saved: true,
    fileName: finalName,
    path: filePath,
    report,
  };
}

async function readReport(input = {}) {
  await ensureReportsDir();

  if (!input.fileName) {
    throw new Error("fileName is required to read a report.");
  }

  const safeName = makeSafeFileName(input.fileName);
  const finalName = safeName.endsWith(".json") ? safeName : `${safeName}.json`;
  const filePath = path.join(REPORTS_DIR, finalName);
  const content = await fs.readFile(filePath, "utf8");

  return {
    fileName: finalName,
    path: filePath,
    report: JSON.parse(content),
  };
}

async function listReports() {
  await ensureReportsDir();

  const files = await fs.readdir(REPORTS_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));
  const reports = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(REPORTS_DIR, fileName);
      const stats = await fs.stat(filePath);
      return {
        fileName,
        path: filePath,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      };
    })
  );

  return {
    reports,
    count: reports.length,
  };
}

module.exports = {
  REPORTS_DIR,
  ensureReportsDir,
  saveReport,
  readReport,
  listReports,
};