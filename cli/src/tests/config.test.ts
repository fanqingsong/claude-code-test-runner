import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "fs";
import { resolve } from "path";
import { ConfigLoader } from "../config/loader";
import { configFileSchema } from "../types/config";

const TEST_CONFIG_DIR = resolve(__dirname, "../../test-config");
const TEST_CONFIG_PATH = resolve(TEST_CONFIG_DIR, "test.yaml");

describe("ConfigLoader", () => {
  beforeEach(() => {
    // Create test config directory
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test config
    try {
      unlinkSync(TEST_CONFIG_PATH);
    } catch {}
    try {
      rmdirSync(TEST_CONFIG_DIR);
    } catch {}
  });

  describe("environment detection", () => {
    it("should use provided environment parameter", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH, "production");
      expect(loader.getEnvironment()).toBe("production");
    });

    it("should detect environment from CC_TEST_ENV", () => {
      process.env.CC_TEST_ENV = "testing";
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(loader.getEnvironment()).toBe("testing");
      delete process.env.CC_TEST_ENV;
    });

    it("should default to development", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(loader.getEnvironment()).toBe("development");
    });
  });

  describe("configuration loading", () => {
    it("should return empty config when file does not exist", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      const config = loader.load();
      expect(config).toEqual({});
    });

    it("should load valid YAML configuration", () => {
      const configContent = `
default:
  execution:
    verbose: true
    maxTurns: 50
`;
      writeFileSync(TEST_CONFIG_PATH, configContent);

      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      const config = loader.load();

      expect(config.execution?.verbose).toBe(true);
      expect(config.execution?.maxTurns).toBe(50);
    });

    it("should merge default and environment configs", () => {
      const configContent = `
default:
  execution:
    verbose: false
    maxTurns: 30

environments:
  development:
    execution:
      verbose: true
`;
      writeFileSync(TEST_CONFIG_PATH, configContent);

      const loader = new ConfigLoader(TEST_CONFIG_PATH, "development");
      const config = loader.load();

      expect(config.execution?.verbose).toBe(true);
      expect(config.execution?.maxTurns).toBe(30);
    });

    it("should throw error for invalid YAML", () => {
      const invalidYaml = `
default:
  execution:
    verbose: true
    bad_syntax: [
`;
      writeFileSync(TEST_CONFIG_PATH, invalidYaml);

      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(() => loader.load()).toThrow();
    });
  });
});
