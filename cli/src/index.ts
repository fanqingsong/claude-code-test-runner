import { Command } from "commander";
import { MCPStateServer } from "./mcp/test-state/server.js";
import { inputs, parseArgs, setupLogger, configLoader } from "./utils/args.js";
import { startTest } from "./prompts/start-test.js";
import { logger } from "./utils/logger.js";
import { TestReporter } from "./utils/test-reporter.js";
import { DatabaseIngestion, createTestResult } from "./utils/database-ingestion.js";
import { DatabaseManager } from "./db/manager.js";
import { configCommands } from "./commands/config.js";
import { dashboardCommands } from "./commands/dashboard.js";

// Check which command is being used
const args = process.argv.slice(2);
const isConfigCommand = args[0] === 'config';
const isDashboardCommand = args[0] === 'dashboard';

if (isDashboardCommand) {
  // Only parse dashboard commands
  const program = new Command()
    .name("cc-test-runner")
    .description("Claude Code Test Runner")
    .version("1.0.0");

  program.addCommand(dashboardCommands);
  program.parse(process.argv);
} else if (isConfigCommand) {
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

  // Initialize database ingestion if results path is configured
  let dbIngestion: DatabaseIngestion | null = null;
  if (inputs.resultsPath) {
    const dbManager = new DatabaseManager(inputs.resultsPath);
    dbIngestion = new DatabaseIngestion(dbManager);

    // Perform database health check
    const dbHealthy = await dbIngestion.healthCheck();
    if (!dbHealthy) {
      logger.warn('Database health check failed, proceeding without database ingestion');
      dbIngestion = null;
    } else {
      logger.info('Database ingestion enabled');
    }
  }

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
    const testResults = [];

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

      // Store test result for database ingestion
      testResults.push(createTestResult(testState, startTime, endTime));
    }

    // Generate and save test reports
    reporter.saveResults(inputs.resultsPath);

    // Save test results to database if ingestion is enabled
    if (dbIngestion && testResults.length > 0) {
      try {
        // Combine all test results into a single run
        const combinedRun = {
          runId: `combined_run_${Date.now()}`,
          startTime: testResults[0].startTime,
          endTime: testResults[testResults.length - 1].endTime,
          testCases: testResults.flatMap(r => r.testCases),
          environment: process.env.NODE_ENV || 'development',
        };

        await dbIngestion.saveTestRun(combinedRun);
        logger.info('Test results saved to database successfully');
      } catch (error) {
        logger.error('Failed to save test results to database:', error);
        // Continue with execution even if database ingestion fails
      }
    }

    server.stop();
  }

  runTests().catch(error => {
    logger.error('Test execution failed:', error);
    process.exit(1);
  });
}