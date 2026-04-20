import { existsSync } from "fs";
import { systemPrompt } from "./system.js";
import { query } from "@anthropic-ai/claude-code";
import { inputs } from "../utils/args.js";
import type { TestCase } from "../types/test-case.js";

/**
 * Initiates a Claude Code query to start a test execution.
 * @param testCase - The test case to start.
 * @returns The Claude Code query.
 * @throws {Error} If Claude is not found on path.
 */
export const startTest = (testCase: TestCase) => {
    // Use the local claude-code CLI since the global installation doesn't have the native binary
    const projectRoot = process.cwd();
    const claudePath = `${projectRoot}/node_modules/@anthropic-ai/claude-code/cli.js`;

    if (!existsSync(claudePath)) {
        throw new Error(`Claude not found at ${claudePath}. Did you run \`bun install\`?`);
    }

    return query({
        prompt: "Query the test plan from mcp__testState__get_test_plan MCP tool to get started.",
        options: {
            customSystemPrompt: systemPrompt(),
            maxTurns: inputs.maxTurns,
            pathToClaudeCodeExecutable: claudePath,
            model: inputs.model,
            mcpServers: {
                "playwright": {
                    command: "/home/fqs/.bun/bin/bunx",
                    args: [
                        "@playwright/mcp@v0.0.31",
                        "--output-dir",
                        `${inputs.resultsPath}/${testCase.id}/playwright`,
                        "--save-trace",
                        "--image-responses",
                        "omit",
                    ],
                },
                "cctr-state": {
                    type: "http",
                    url: "http://localhost:3001/",
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            },
            // Temporarily remove allowedTools to see all available tools
            // allowedTools: [],
        },
    });
};
