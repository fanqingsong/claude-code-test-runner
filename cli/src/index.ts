import { Command } from "commander";
import { MCPStateServer } from "./mcp/test-state/server.js";
import { inputs, parseArgs, setupLogger, configLoader } from "./utils/args.js";
import { startTest } from "./prompts/start-test.js";
import { logger } from "./utils/logger.js";
import { TestReporter } from "./utils/test-reporter.js";
import { configCommands } from "./commands/config.js";

// Check if config subcommand is being used
const args = process.argv.slice(2);
const isConfigCommand = args[0] === 'config';

if (isConfigCommand) {
  // Only parse config commands
  const program = new Command()
    .name("cc-test-runner")
    .description("Claude Code Test Runner")
    .version("1.0.0");

  program.addCommand(configCommands);
  program.parse(process.argv);
} else {
  // Parse CLI options for test execution
  parseArgs();

  // Setup logger with loaded configuration
  setupLogger(configLoader.getRawConfig());

  // Run the default test execution
  /**
   * Runs all test cases using the MCP state server.
   * Starts the server, executes each test case, and generates reports.
   */
  async function runTests() {
    // Start the MCP state server.
    // This manages the state for the active test case.
    const server = new MCPStateServer(3001);
    await server.start();

    const reporter = new TestReporter();

    logger.info(`Detected ${inputs.testCases.length} test cases.`);
    for (const testCase of inputs.testCases) {
      const startTime = new Date();
      logger.info("Starting test case", {
        test_id: testCase.id,
      });
      server.setTestState(testCase);

      for await (const message of startTest(testCase)) {
        logger.debug("Received Claude Code message", {
          test_id: testCase.id,
          message: JSON.stringify(message),
        });
      }

      const testState = server.getState();
      if (!testState) {
        logger.error("test_state_not_found", {
          test_id: testCase.id,
        });
        throw new Error(`Test state not found for '${testCase.id}'`);
      }

      const endTime = new Date();
      reporter.addTestResult(testState, startTime, endTime);

      logger.info("completed_test_case", {
        ...testState,
        succeeded: testState?.steps.every((step) => step.status === "passed"),
      });
    }

    // Generate and save test reports
    reporter.saveResults(inputs.resultsPath);

    server.stop();
  }

  runTests().catch(error => {
    logger.error('Test execution failed:', error);
    process.exit(1);
  });
}