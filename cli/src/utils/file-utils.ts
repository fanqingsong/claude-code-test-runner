import { glob } from "glob";
import { promises as fs } from "fs";
import { dirname } from "path";

/**
 * Find files matching glob patterns.
 * @param patterns - Array of glob patterns to match files.
 * @param basePath - Base directory to search from (defaults to ".").
 * @param excludePatterns - Array of glob patterns to exclude.
 * @returns Sorted array of matching file paths.
 */
export async function findFiles(
  patterns: string[],
  basePath: string = ".",
  excludePatterns: string[] = []
): Promise<string[]> {
  if (!patterns || patterns.length === 0) {
    return [];
  }

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
 * Ensure directory exists, create if not.
 * @param dirPath - Directory path to ensure exists.
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
 * Read JSON file safely.
 * @template T - Type of parsed JSON content.
 * @param filePath - Path to JSON file to read.
 * @returns Parsed JSON content.
 * @throws Error if file not found or JSON is invalid.
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath} - ${error.message}`);
    }
    throw error;
  }
}

/**
 * Write file ensuring directory exists.
 * @param filePath - Path to file to write.
 * @param content - Content to write to file.
 * @throws Error if file path is empty.
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error("File path cannot be empty");
  }

  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}