import { DatabaseManager } from '../db/manager';
import type { TestCase } from '../types/test-case';
import { logger } from './logger';

export interface TestRunResult {
  runId: string;
  startTime: Date;
  endTime: Date;
  testCases: TestCase[];
  environment?: string;
}

export class DatabaseIngestion {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Save test results to database
   * @param testRun - The test run results to save
   */
  async saveTestRun(testRun: TestRunResult): Promise<void> {
    try {
      logger.info('Saving test results to database...');

      // Calculate summary statistics
      const totalTests = testRun.testCases.length;
      const passedTests = testRun.testCases.filter(tc => tc.steps.every(step => step.status === 'passed')).length;
      const failedTests = totalTests - passedTests;
      const totalDuration = testRun.endTime.getTime() - testRun.startTime.getTime();

      // Create TestRun record
      const runId = testRun.runId;
      const testRunRecord = {
        run_id: runId,
        start_time: testRun.startTime.getTime(),
        end_time: testRun.endTime.getTime(),
        total_tests: totalTests,
        passed: passedTests,
        failed: failedTests,
        total_duration: totalDuration,
        environment: testRun.environment || undefined,
        created_at: Date.now(),
      };

      const runIdValue = this.dbManager.insertTestRun(testRunRecord);
      logger.info(`Created test run record: ${runId} (${runIdValue})`);

      // Create TestCase records
      for (const testCase of testRun.testCases) {
        const testCaseRecord = {
          run_id: runIdValue,
          test_id: testCase.id,
          description: testCase.description,
          status: testCase.steps.every(step => step.status === 'passed') ? 'passed' : 'failed',
          duration: testCase.steps[0]?.endTime && testCase.steps[testCase.steps.length - 1]?.endTime
            ? testCase.steps[testCase.steps.length - 1].endTime.getTime() - testCase.steps[0].endTime.getTime()
            : testRun.endTime.getTime() - testRun.startTime.getTime(),
          start_time: testCase.steps[0]?.endTime?.getTime() || testRun.startTime.getTime(),
          end_time: testCase.steps[testCase.steps.length - 1]?.endTime?.getTime() || testRun.endTime.getTime(),
          message: this.getTestCaseMessage(testCase),
        };

        const testCaseId = this.dbManager.insertTestCase(testCaseRecord);
        logger.debug(`Created test case record: ${testCase.id} (${testCaseId})`);

        // Create TestStep records
        for (const step of testCase.steps) {
          const stepRecord = {
            test_case_id: testCaseId,
            step_number: step.id,
            description: step.description,
            status: step.status || 'pending',
            error_message: step.error || undefined,
          };

          this.dbManager.insertTestStep(stepRecord);
          logger.debug(`Created test step record: step ${step.id} (${stepRecord.step_number})`);
        }
      }

      logger.info(`Saved ${totalTests} test cases to database`);
    } catch (error) {
      logger.error('Error saving test results to database:', error);
      throw error;
    }
  }

  /**
   * Get the test case message from steps
   * @param testCase - The test case
   * @returns Error message if test failed, undefined if passed
   */
  private getTestCaseMessage(testCase: TestCase): string | undefined {
    const failedSteps = testCase.steps.filter(step => step.status === 'failed' && step.error);
    if (failedSteps.length === 0) {
      return undefined;
    }

    return failedSteps
      .map(step => `Step ${step.id}: ${step.error}`)
      .join('; ');
  }

  /**
   * Batch save test results
   * @param testRuns - Array of test run results to save
   */
  async batchSaveTestRuns(testRuns: TestRunResult[]): Promise<void> {
    try {
      logger.info(`Batch saving ${testRuns.length} test runs to database...`);

      for (const testRun of testRuns) {
        await this.saveTestRun(testRun);
      }

      logger.info(`Batch saved ${testRuns.length} test runs to database`);
    } catch (error) {
      logger.error('Error batch saving test results:', error);
      throw error;
    }
  }

  /**
   * Health check for database
   * @returns True if database is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get recent test runs to verify database connectivity
      this.dbManager.getRecentTestRuns(1);
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

/**
 * Create a test result from test execution data
 * @param testCase - The test case
 * @param startTime - Test start time
 * @param endTime - Test end time
 * @returns Test result for database ingestion
 */
export function createTestResult(
  testCase: TestCase,
  startTime: Date,
  endTime: Date
): TestRunResult {
  return {
    runId: generateRunId(),
    startTime,
    endTime,
    testCases: [testCase],
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * Generate a unique run ID
 * @returns Unique run identifier
 */
export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Enhance existing test case with timing information
 * @param testCase - The test case to enhance
 * @param startTime - Test start time
 * @param endTime - Test end time
 */
export function enhanceTestCaseWithTiming(
  testCase: TestCase,
  startTime: Date,
  endTime: Date
): TestCase {
  const duration = endTime.getTime() - startTime.getTime();

  return {
    ...testCase,
    steps: testCase.steps.map((step, index) => ({
      ...step,
      duration: step.duration || Math.floor(duration / testCase.steps.length),
      startTime: new Date(startTime.getTime() + (index * duration / testCase.steps.length)),
      endTime: new Date(startTime.getTime() + ((index + 1) * duration / testCase.steps.length)),
    })),
  };
}