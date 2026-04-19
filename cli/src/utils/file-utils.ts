import { glob } from "glob";
import { promises as fs } from "fs";
import { resolve, dirname } from "path";

/**
 * Find files matching glob patterns
 */
export async function findFiles(
  patterns: string[],
  basePath: string = ".",
  excludePatterns: string[] = []
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: basePath,
      absolute: false,
      ignore: excludePatterns,
      nodir: true,
    });
    allFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(allFiles)].sort();
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Read JSON file safely
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Write file ensuring directory exists
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}