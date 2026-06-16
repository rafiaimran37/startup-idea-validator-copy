const { analyzeStartupIdea } = require("../utils/analysisEngine");

async function analyze(input = {}) {
  const { title, description, targetAudience, temperature } = input;
  return analyzeStartupIdea({ title, description, targetAudience, temperature });
}

module.exports = {
  analyze,
};