const tools = new Map();

function registerTool(name, handler, description = "") {
  tools.set(name, { name, handler, description });
}

function getTool(name) {
  return tools.get(name) || null;
}

function listTools() {
  return Array.from(tools.values()).map(({ name, description }) => ({ name, description }));
}

async function executeTool(name, input = {}) {
  const tool = getTool(name);
  if (!tool) {
    throw new Error(`Unknown MCP tool: ${name}`);
  }

  return tool.handler(input);
}

module.exports = {
  registerTool,
  getTool,
  listTools,
  executeTool,
};