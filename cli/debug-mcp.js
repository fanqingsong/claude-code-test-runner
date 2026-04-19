import { query } from "@anthropic-ai/claude-code";

const claudePath = "./node_modules/@anthropic-ai/claude-code/cli.js";

console.log("Testing MCP connection...");

const testQuery = query({
  prompt: "List all available tools that start with 'mcp__'",
  options: {
    pathToClaudeCodeExecutable: claudePath,
    mcpServers: {
      "test-playwright": {
        command: "/home/fqs/.bun/bin/bunx",
        args: [
          "@playwright/mcp@v0.0.31",
          "--output-dir",
          "./debug-output",
          "--image-responses",
          "omit",
        ],
      },
    },
    maxTurns: 2,
  },
});

console.log("Starting query...");

for await (const message of testQuery) {
  console.log("Message type:", message.type);
  if (message.type === "system" && message.subtype === "init") {
    console.log("Available tools:", message.tools.filter(t => t.startsWith('mcp__')));
    console.log("MCP servers:", message.mcp_servers);
  }
}

console.log("Test complete");
