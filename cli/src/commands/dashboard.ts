import { Command } from 'commander';
import { ReportingServer } from '../reporting/server';
import { DatabaseManager } from '../db/manager';
import { runMigrations } from '../db/migrations';
import { StaticGenerator } from '../reporting/generators/static-generator';
import { logger } from '../utils/logger';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const dashboardCommands = new Command()
  .name('dashboard')
  .description('Dashboard and reporting commands')
  .version('1.0.0');

// Generate static HTML command
dashboardCommands
  .command('generate')
  .description('Generate static HTML dashboard')
  .option('-o, --output <path>', 'Output directory for static files', './dist/dashboard')
  .option('-d, --days <number>', 'Number of days to include in dashboard', '30')
  .option('--db-path <path>', 'Database path', './results')
  .action(async (options) => {
    try {
      logger.info('Generating static dashboard...');

      // Ensure output directory exists
      if (!existsSync(options.output)) {
        mkdirSync(options.output, { recursive: true });
      }

      // Initialize database
      const db = new DatabaseManager(options.dbPath);

      // Generate static dashboard
      const generator = new StaticGenerator(db);
      await generator.generate({ outputPath: options.output, days: parseInt(options.days) });

      logger.info(`Static dashboard generated successfully at: ${options.output}/index.html`);
    } catch (error) {
      logger.error('Error generating static dashboard:', error);
      process.exit(1);
    }
  });

// Start dev server command
dashboardCommands
  .command('serve')
  .description('Start development server for dashboard')
  .option('-p, --port <number>', 'Port for the server', '3000')
  .option('-d, --db-path <path>', 'Database path', './results')
  .option('--cleanup', 'Optimize database after startup', false)
  .action(async (options) => {
    try {
      logger.info(`Starting development server on port ${options.port}...`);

      // Initialize database
      const db = new DatabaseManager(options.dbPath);

      // Cleanup database if requested
      if (options.cleanup) {
        logger.info('Cleaning up database...');
        cleanupDatabase(db);
      }

      // Start server
      const server = new ReportingServer(parseInt(options.port), options.dbPath);
      await server.start();

      logger.info(`Dashboard server running at: ${server.getUrl()}`);
      logger.info('Press Ctrl+C to stop the server');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down server...');
        server.stop();
        process.exit(0);
      });

      // Keep the process running
      await new Promise(() => {});
    } catch (error) {
      logger.error('Error starting dev server:', error);
      process.exit(1);
    }
  });

// Database cleanup command
dashboardCommands
  .command('cleanup')
  .description('Optimize database performance')
  .option('-d, --db-path <path>', 'Database path', './results')
  .action(async (options) => {
    try {
      logger.info('Cleaning up database...');
      const db = new DatabaseManager(options.dbPath);
      cleanupDatabase(db);
      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up database:', error);
      process.exit(1);
    }
  });

// Database statistics command
dashboardCommands
  .command('stats')
  .description('Show database statistics')
  .option('-d, --db-path <path>', 'Database path', './results')
  .action(async (options) => {
    try {
      const db = new DatabaseManager(options.dbPath);
      showDatabaseStats(db);
    } catch (error) {
      logger.error('Error showing database stats:', error);
      process.exit(1);
    }
  });

// Initialize database command
dashboardCommands
  .command('init')
  .description('Initialize database with migrations')
  .option('-d, --db-path <path>', 'Database path', './results')
  .action(async (options) => {
    try {
      logger.info('Initializing database...');
      // Use DatabaseManager to initialize the database
      const dbManager = new DatabaseManager(options.dbPath);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Error initializing database:', error);
      process.exit(1);
    }
  });

// Helper functions
function cleanupDatabase(db: DatabaseManager): void {
  const connection = db.getConnection();

  // Clean up old test runs (older than 90 days)
  const cutoffDate = Date.now() - (90 * 24 * 60 * 60 * 1000);
  connection.exec(`
    DELETE FROM test_cases
    WHERE run_id IN (
      SELECT id FROM test_runs WHERE start_time < ${cutoffDate}
    )
  `);

  connection.exec(`
    DELETE FROM test_runs
    WHERE start_time < ${cutoffDate}
  `);

  // Vacuum database to reclaim space
  connection.exec('VACUUM');

  // Update statistics
  connection.exec('ANALYZE');

  logger.info('Database cleanup completed');
}

function showDatabaseStats(db: DatabaseManager): void {
  const connection = db.getConnection();

  // Get test runs count
  const testRuns = connection.prepare('SELECT COUNT(*) as count FROM test_runs').get() as { count: number };
  const testCases = connection.prepare('SELECT COUNT(*) as count FROM test_cases').get() as { count: number };
  const testSteps = connection.prepare('SELECT COUNT(*) as count FROM test_steps').get() as { count: number };

  // Get pass rate
  const passedTests = connection.prepare('SELECT COUNT(*) as count FROM test_cases WHERE status = "passed"').get() as { count: number };
  const passRate = testCases.count > 0 ? ((passedTests.count / testCases.count) * 100).toFixed(2) : '0.00';

  // Get average duration
  const avgDuration = connection.prepare('SELECT AVG(duration) as avg FROM test_cases').get() as { avg: number | null };

  // Get database size
  const dbSize = connection.prepare('SELECT page_count * page_size as size FROM db_page_count()').get() as { size: number };
  const dbSizeMB = (dbSize.size / (1024 * 1024)).toFixed(2);

  logger.info('Database Statistics:');
  logger.info(`  Test Runs: ${testRuns.count}`);
  logger.info(`  Test Cases: ${testCases.count}`);
  logger.info(`  Test Steps: ${testSteps.count}`);
  logger.info(`  Pass Rate: ${passRate}%`);
  logger.info(`  Average Duration: ${avgDuration.avg?.toFixed(2) || '0'}ms`);
  logger.info(`  Database Size: ${dbSizeMB} MB`);
}