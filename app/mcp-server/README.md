# MCP Server Integration

This folder contains a beginner-friendly MCP-style integration for the AI Startup Idea Validator app.

## What it does

- Registers reusable tools for PostgreSQL, file storage, and Gemini-based startup analysis.
- Exposes Express routes under `/mcp`.
- Can run inside the main app or as a standalone server.

## Available routes

- `GET /mcp/status`
- `GET /mcp/health`
- `GET /mcp/tools`
- `POST /mcp/analyze`
- `POST /mcp/save-report`
- `GET /mcp/reports`
- `GET /mcp/users`
- `POST /mcp/tools/:toolName`

## Frontend example

```javascript
const response = await fetch('/mcp/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'smart grocery app',
    description: 'user can buy online',
    targetAudience: 'busy people'
  })
});

const data = await response.json();
console.log(data);
```

## Standalone run

```bash
npm run mcp
```

Set `MCP_PORT` to change the port.