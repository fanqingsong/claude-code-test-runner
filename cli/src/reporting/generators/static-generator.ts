import { mkdirSync, writeFileSync } from "fs";
import { DatabaseManager } from "../../db/manager";
import { DataProcessor } from "./data-processor";
import ejs from "ejs";
import { readFileSync } from "fs";

export interface StaticGeneratorOptions {
  outputPath: string;
  days?: number;
}

export class StaticGenerator {
  constructor(private dbManager: DatabaseManager) {}

  async generate(options: StaticGeneratorOptions): Promise<void> {
    const { outputPath, days = 30 } = options;

    const processor = new DataProcessor(this.dbManager.getConnection());
    const data = processor.processDashboardData(days);

    const templatePath = new URL("../templates/dashboard.ejs", import.meta.url).pathname;
    const template = readFileSync(templatePath, "utf-8");

    const html = await ejs.render(template, { data });

    const outputDir = outputPath.split("/").slice(0, -1).join("/");
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(outputPath, html);

    console.log(`Dashboard generated: ${outputPath}`);
    console.log(`File size: ${(html.length / 1024).toFixed(2)} KB`);
  }
}