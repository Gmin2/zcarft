import fs from 'fs-extra';
import path from 'node:path';
import type { ExampleCatalog, ExampleMetadata } from './types.js';

/**
 * Manages loading and querying the example catalog
 *
 * The catalog contains metadata about all available FHEVM examples,
 * including their categories, difficulty levels, and file paths.
 */
export class CatalogManager {
  private catalog: ExampleCatalog | null = null;
  private catalogPath: string;

  /**
   * Creates a new catalog manager
   *
   * @param catalogPath - Optional path to catalog.json. Defaults to finding it relative to package root
   */
  constructor(catalogPath?: string) {
    if (catalogPath) {
      this.catalogPath = catalogPath;
    } else {
      // Try to find catalog.json by looking up from current directory
      // This handles both development (from packages/cli) and installed scenarios
      let currentDir = process.cwd();

      // First try current directory
      let attemptPath = path.join(currentDir, 'catalog.json');
      if (fs.existsSync(attemptPath)) {
        this.catalogPath = attemptPath;
        return;
      }

      // Then try parent directories up to 3 levels
      for (let i = 0; i < 3; i++) {
        currentDir = path.dirname(currentDir);
        attemptPath = path.join(currentDir, 'catalog.json');
        if (fs.existsSync(attemptPath)) {
          this.catalogPath = attemptPath;
          return;
        }
      }

      // Fallback to relative path
      this.catalogPath = path.join(process.cwd(), '../../catalog.json');
    }
  }

  /**
   * Loads the catalog from disk
   *
   * The catalog is cached after first load to avoid repeated file reads.
   *
   * @returns The parsed catalog data
   * @throws Error if catalog file cannot be read or parsed
   */
  async load(): Promise<ExampleCatalog> {
    if (this.catalog) {
      return this.catalog;
    }

    try {
      const catalogData = await fs.readFile(this.catalogPath, 'utf-8');
      this.catalog = JSON.parse(catalogData) as ExampleCatalog;
      return this.catalog;
    } catch (error) {
      throw new Error(
        `Failed to load catalog from ${this.catalogPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retrieves metadata for a specific example
   *
   * @param name - Example identifier (e.g., 'fhe-counter')
   * @returns Example metadata or null if not found
   */
  async getExample(name: string): Promise<ExampleMetadata | null> {
    const catalog = await this.load();
    return catalog.examples[name] || null;
  }

  /**
   * Retrieves all examples from the catalog
   *
   * @returns Map of example identifiers to their metadata
   */
  async getAllExamples(): Promise<Record<string, ExampleMetadata>> {
    const catalog = await this.load();
    return catalog.examples;
  }

  /**
   * Retrieves all examples in a specific category
   *
   * @param category - Category identifier (e.g., 'basic', 'applications')
   * @returns Map of example identifiers to their metadata, filtered by category
   */
  async getExamplesByCategory(category: string): Promise<Record<string, ExampleMetadata>> {
    const catalog = await this.load();
    const filtered: Record<string, ExampleMetadata> = {};

    for (const [key, example] of Object.entries(catalog.examples)) {
      if (example.category === category) {
        filtered[key] = example;
      }
    }

    return filtered;
  }

  /**
   * Retrieves all category definitions
   *
   * @returns Map of category identifiers to their metadata
   */
  async getCategories(): Promise<
    Record<string, { name: string; description: string; icon: string; order: number }>
  > {
    const catalog = await this.load();
    return catalog.categories;
  }

  /**
   * Validates the catalog structure and content
   *
   * Checks for:
   * - Required fields (version, categories, examples)
   * - Example references to valid categories
   * - Required example fields (title, contract, test, difficulty)
   * - Valid difficulty ranges (1-5)
   *
   * @returns Validation result with list of errors if any
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const catalog = await this.load();

      // Check version
      if (!catalog.version) {
        errors.push('Missing catalog version');
      }

      // Check categories
      if (!catalog.categories || Object.keys(catalog.categories).length === 0) {
        errors.push('No categories defined');
      }

      // Check examples
      if (!catalog.examples || Object.keys(catalog.examples).length === 0) {
        errors.push('No examples defined');
      } else {
        // Validate each example
        for (const [key, example] of Object.entries(catalog.examples)) {
          if (!example.category) {
            errors.push(`Example '${key}' is missing category`);
          } else if (!catalog.categories[example.category]) {
            errors.push(
              `Example '${key}' references non-existent category '${example.category}'`
            );
          }

          if (!example.title) {
            errors.push(`Example '${key}' is missing title`);
          }

          if (!example.contract) {
            errors.push(`Example '${key}' is missing contract path`);
          }

          if (!example.test) {
            errors.push(`Example '${key}' is missing test path`);
          }

          if (!example.difficulty || example.difficulty < 1 || example.difficulty > 5) {
            errors.push(`Example '${key}' has invalid difficulty`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}
