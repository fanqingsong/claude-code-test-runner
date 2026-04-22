import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { Database } from "bun:sqlite";
import { DataProcessor } from "./data-processor";
import ejs from "ejs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface StaticGeneratorOptions {
  outputPath: string;
  days?: number;
}

export class StaticGenerator {
  constructor(private dbManager: any) {} // Use any for compatibility with DatabaseManager

  async generate(options: StaticGeneratorOptions): Promise<void> {
    const days = options.days || 30;
    logger.info('Generating static dashboard...');

    // Get database connection
    const db = this.dbManager.getConnection();

    // Process dashboard data
    const processor = new DataProcessor(db);
    const data = processor.processDashboardData(days);

    // Generate CSS and JavaScript files
    await this.generateAssets(options);

    // Render main dashboard
    const templatePath = join(__dirname, '../templates/dashboard.ejs');
    const template = readFileSync(templatePath, 'utf-8');
    const html = await ejs.render(template, { data });

    logger.info(`Writing HTML to: ${options.outputPath}`);
    logger.info(`HTML length: ${html.length}`);

    // Write index.html to the specified output path
    const outputPath = options.outputPath;
    const outputDir = dirname(outputPath);

    // Double-check that output path is not a directory
    if (existsSync(outputPath)) {
      const stats = require('fs').statSync(outputPath);
      if (stats.isDirectory()) {
        throw new Error(`Output path ${outputPath} is already a directory`);
      }
    }

    // Ensure the parent directory exists
    if (outputDir !== '.' && outputDir !== '/') {
      mkdirSync(outputDir, { recursive: true });
      logger.info(`Created directory: ${outputDir}`);
    }

    writeFileSync(outputPath, html);
    logger.info(`File written successfully: ${outputPath}`);

    logger.info(`Dashboard generated: ${outputPath}`);
    logger.info(`File size: ${(html.length / 1024).toFixed(2)} KB`);
  }

  private async generateAssets(options: StaticGeneratorOptions): Promise<void> {
    const assetsDir = join(dirname(options.outputPath), 'assets');
    mkdirSync(assetsDir, { recursive: true });

    // Generate CSS
    const css = `
/* Dashboard Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card h3 {
  margin-top: 0;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-card h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  opacity: 0.9;
}

.stat-card .value {
  font-size: 28px;
  font-weight: bold;
  margin: 0;
}

.chart-container {
  height: 300px;
  margin: 20px 0;
}

.test-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.test-table th,
.test-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.test-table th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.test-table tr:hover {
  background-color: #f8f9fa;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-passed {
  background-color: #d4edda;
  color: #155724;
}

.status-failed {
  background-color: #f8d7da;
  color: #721c24;
}

.status-pending {
  background-color: #fff3cd;
  color: #856404;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin: 20px 0;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .container {
    padding: 10px;
  }
}
`;

    // Generate JavaScript
    const js = `
// Dashboard JavaScript
class Dashboard {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadDashboardData();
    this.setupEventListeners();
  }

  async loadDashboardData() {
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      this.renderDashboard(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  renderDashboard(data) {
    this.renderSummary(data.summary);
    this.renderCharts(data);
  }

  renderSummary(summary) {
    const summaryContainer = document.querySelector('.stats-grid');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = \`
      <div class="stat-card">
        <h4>Total Tests</h4>
        <div class="value">\${summary.total_tests}</div>
      </div>
      <div class="stat-card">
        <h4>Pass Rate</h4>
        <div class="value">\${summary.pass_rate.toFixed(1)}%</div>
      </div>
      <div class="stat-card">
        <h4>Avg Duration</h4>
        <div class="value">\${summary.avg_duration.toFixed(0)}ms</div>
      </div>
      <div class="stat-card">
        <h4>Flaky Tests</h4>
        <div class="value">\${summary.flaky_count}</div>
      </div>
    \`;
  }

  renderCharts(data) {
    // Initialize Chart.js if available
    if (typeof Chart !== 'undefined') {
      this.renderPassRateChart(data.passRateTrend);
      this.renderDurationChart(data.durationTrend);
    }
  }

  renderPassRateChart(data) {
    const ctx = document.getElementById('passRateChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Pass Rate %',
          data: data.map(d => d.pass_rate),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Pass Rate Trend'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }

  renderDurationChart(data) {
    const ctx = document.getElementById('durationChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Avg Duration (ms)',
          data: data.map(d => d.avg_duration),
          backgroundColor: '#764ba2'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Test Duration Trends'
          }
        }
      }
    });
  }

  setupEventListeners() {
    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
`;

    // Write assets
    writeFileSync(join(assetsDir, 'style.css'), css);
    writeFileSync(join(assetsDir, 'dashboard.js'), js);

    logger.info('Generated assets: style.css, dashboard.js');
  }
}

// Import logger
import { logger } from '../../utils/logger';