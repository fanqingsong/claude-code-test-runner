import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { DatabaseManager } from '../src/db/manager';
import { DatabaseIngestion, createTestResult, generateRunId } from '../src/utils/database-ingestion';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Database Ingestion Integration Tests', () => {
  let dbManager: DatabaseManager;
  let dbIngestion: DatabaseIngestion;
  let testDbPath: string;

  beforeAll(() => {
    // Create test database directory
    testDbPath = './test-results-db-integration';
    mkdirSync(testDbPath, { recursive: true });

    // Initialize database manager and ingestion
    dbManager = new DatabaseManager(testDbPath);
    dbIngestion = new DatabaseIngestion(dbManager);
  });

  afterAll(() => {
    rmSync(testDbPath, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up database before each test
    const connection = dbManager.getConnection();
    connection.exec('DELETE FROM test_steps');
    connection.exec('DELETE FROM test_cases');
    connection.exec('DELETE FROM test_runs');
  });

  test('should generate unique run IDs', () => {
    const id1 = generateRunId();
    const id2 = generateRunId();

    expect(id1).toMatch(/^run_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^run_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  test('should create test result from test case', () => {
    const startTime = new Date('2023-01-01T10:00:00.000Z');
    const endTime = new Date('2023-01-01T10:01:00.000Z');
    const testCase = {
      id: 'test-1',
      description: 'Test case description',
      steps: [
        { id: 1, description: 'Step 1', status: 'passed' as const, startTime: new Date(startTime.getTime()), endTime: new Date(endTime.getTime() - 30000) },
        { id: 2, description: 'Step 2', status: 'failed' as const, error: 'Step failed', startTime: new Date(endTime.getTime() - 30000), endTime: new Date(endTime.getTime()) },
      ],
    };

    const testResult = createTestResult(testCase, startTime, endTime);

    expect(testResult.runId).toMatch(/^run_\d+_[a-z0-9]+$/);
    expect(testResult.startTime).toEqual(startTime);
    expect(testResult.endTime).toEqual(endTime);
    expect(testResult.testCases).toHaveLength(1);
    expect(testResult.testCases[0]).toEqual(testCase);
    expect(testResult.environment).toBe(process.env.NODE_ENV || 'development');
  });

  test('should save test run to database', async () => {
    const testCase = {
      id: 'test-1',
      description: 'First test case',
      steps: [
        { id: 1, description: 'Step 1', status: 'passed' as const },
        { id: 2, description: 'Step 2', status: 'passed' as const },
      ],
    };

    const startTime = new Date('2023-01-01T10:00:00.000Z');
    const endTime = new Date('2023-01-01T10:01:00.000Z');

    const testRun = createTestResult(testCase, startTime, endTime);

    await dbIngestion.saveTestRun(testRun);

    // Verify test run was saved
    const recentRuns = dbManager.getRecentTestRuns(1);
    expect(recentRuns).toHaveLength(1);
    const savedRun = recentRuns[0];
    expect(savedRun.run_id).toBe(testRun.runId);
    expect(savedRun.total_tests).toBe(1);
    expect(savedRun.passed).toBe(1);
    expect(savedRun.failed).toBe(0);
    expect(savedRun.start_time).toBe(startTime.getTime());
    expect(savedRun.end_time).toBe(endTime.getTime());

    // Verify test case was saved
    const testCases = dbManager.getTestCasesForRun(savedRun.id);
    expect(testCases).toHaveLength(1);
    const savedCase = testCases[0];
    expect(savedCase.test_id).toBe('test-1');
    expect(savedCase.description).toBe('First test case');
    expect(savedCase.status).toBe('passed');
    expect(savedCase.duration).toBeGreaterThan(0);
  });

  test('should save failed test run to database', async () => {
    const testCase = {
      id: 'test-1',
      description: 'Failed test case',
      steps: [
        { id: 1, description: 'Step 1', status: 'passed' as const },
        { id: 2, description: 'Step 2', status: 'failed' as const, error: 'Assertion failed' },
        { id: 3, description: 'Step 3', status: 'pending' as const },
      ],
    };

    const startTime = new Date('2023-01-01T11:00:00.000Z');
    const endTime = new Date('2023-01-01T11:02:00.000Z');

    const testRun = createTestResult(testCase, startTime, endTime);

    await dbIngestion.saveTestRun(testRun);

    // Verify test run was saved correctly
    const recentRuns = dbManager.getRecentTestRuns(1);
    const savedRun = recentRuns[0];
    expect(savedRun.passed).toBe(0);
    expect(savedRun.failed).toBe(1);

    // Verify test case was saved with correct status
    const testCases = dbManager.getTestCasesForRun(savedRun.id);
    const savedCase = testCases[0];
    expect(savedCase.status).toBe('failed');
    expect(savedCase.message).toContain('Step 2: Assertion failed');
  });

  test('should handle multiple test cases in single run', async () => {
    const testRun = {
      runId: generateRunId(),
      startTime: new Date('2023-01-01T12:00:00.000Z'),
      endTime: new Date('2023-01-01T13:00:00.000Z'),
      testCases: [
        {
          id: 'test-1',
          description: 'First test',
          steps: [
            { id: 1, description: 'Step 1', status: 'passed' as const },
            { id: 2, description: 'Step 2', status: 'passed' as const },
          ],
        },
        {
          id: 'test-2',
          description: 'Second test',
          steps: [
            { id: 1, description: 'Step 1', status: 'passed' as const },
            { id: 2, description: 'Step 2', status: 'failed' as const, error: 'Error message' },
          ],
        },
      ],
      environment: 'test',
    };

    await dbIngestion.saveTestRun(testRun);

    // Verify test run was saved
    const recentRuns = dbManager.getRecentTestRuns(1);
    const savedRun = recentRuns[0];
    expect(savedRun.total_tests).toBe(2);
    expect(savedRun.passed).toBe(1);
    expect(savedRun.failed).toBe(1);
    expect(savedRun.environment).toBe('test');

    // Verify test cases were saved
    const testCases = dbManager.getTestCasesForRun(savedRun.id);
    expect(testCases).toHaveLength(2);

    const testCase1 = testCases.find(tc => tc.test_id === 'test-1');
    expect(testCase1?.status).toBe('passed');

    const testCase2 = testCases.find(tc => tc.test_id === 'test-2');
    expect(testCase2?.status).toBe('failed');
    expect(testCase2?.message).toContain('Step 2: Error message');
  });

  test('should batch save multiple test runs', async () => {
    const startTime1 = new Date('2023-01-01T14:00:00.000Z');
    const endTime1 = new Date('2023-01-01T14:01:00.000Z');
    const testRun1 = createTestResult({
      id: 'test-1',
      description: 'First test',
      steps: [{ id: 1, description: 'Step 1', status: 'passed' as const, startTime: startTime1, endTime: endTime1 }],
    }, startTime1, endTime1);

    const startTime2 = new Date('2023-01-01T14:02:00.000Z');
    const endTime2 = new Date('2023-01-01T14:03:00.000Z');
    const testRun2 = createTestResult({
      id: 'test-2',
      description: 'Second test',
      steps: [{ id: 1, description: 'Step 1', status: 'failed' as const, error: 'Failed', startTime: startTime2, endTime: endTime2 }],
    }, startTime2, endTime2);

    await dbIngestion.batchSaveTestRuns([testRun1, testRun2]);

    // Verify both test runs were saved
    const recentRuns = dbManager.getRecentTestRuns(10);
    expect(recentRuns).toHaveLength(2);

    const passedRuns = recentRuns.filter(run => run.passed > 0);
    const failedRuns = recentRuns.filter(run => run.failed > 0);

    expect(passedRuns).toHaveLength(1);
    expect(failedRuns).toHaveLength(1);
  });

  test('should perform health check successfully', async () => {
    const isHealthy = await dbIngestion.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should handle test case with error message correctly', async () => {
    const testCase = {
      id: 'test-1',
      description: 'Test with error',
      steps: [
        { id: 1, description: 'Step 1', status: 'passed' as const },
        { id: 2, description: 'Step 2', status: 'failed' as const, error: 'Error message' },
      ],
    };

    const testRun = createTestResult(testCase, new Date(), new Date());

    await dbIngestion.saveTestRun(testRun);

    const recentRuns = dbManager.getRecentTestRuns(1);
    const savedRun = recentRuns[0];
    const testCases = dbManager.getTestCasesForRun(savedRun.id);
    const savedCase = testCases[0];

    expect(savedCase.message).toBe('Step 2: Error message');
  });

  test('should handle test case without error message', async () => {
    const testCase = {
      id: 'test-1',
      description: 'Test without error',
      steps: [
        { id: 1, description: 'Step 1', status: 'passed' as const },
        { id: 2, description: 'Step 2', status: 'passed' as const },
      ],
    };

    const testRun = createTestResult(testCase, new Date(), new Date());

    await dbIngestion.saveTestRun(testRun);

    const recentRuns = dbManager.getRecentTestRuns(1);
    const savedRun = recentRuns[0];
    const testCases = dbManager.getTestCasesForRun(savedRun.id);
    const savedCase = testCases[0];

    expect(savedCase.message).toBeNull();
  });
});