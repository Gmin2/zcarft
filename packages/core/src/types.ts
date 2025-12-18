/**
 * Metadata for a single FHEVM example
 */
export interface ExampleMetadata {
  /** Category identifier (e.g., 'basic', 'applications', 'openzeppelin') */
  category: string;
  /** Human-readable title of the example */
  title: string;
  /** Detailed description of what the example demonstrates */
  description: string;
  /** Source of the example template */
  source: 'docs' | 'openzeppelin' | 'custom';
  /** Relative path to the contract file */
  contract: string;
  /** Relative path to the test file */
  test: string;
  /** Searchable tags for filtering */
  tags: string[];
  /** Key FHE concepts demonstrated in this example */
  keyConcepts: string[];
  /** Difficulty level from 1 (beginner) to 5 (expert) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Estimated time to complete the example */
  estimatedTime: string;
  /** Optional learning path identifier */
  learnPath?: string;
  /** Key highlights about this example */
  highlights?: string[];
}

/**
 * Category definition for organizing examples
 */
export interface Category {
  /** Display name of the category */
  name: string;
  /** Description of what this category contains */
  description: string;
  /** Icon or emoji representing this category */
  icon: string;
  /** Sort order for displaying categories */
  order: number;
}

/**
 * Curated learning path combining multiple examples
 */
export interface LearningPath {
  /** Name of the learning path */
  name: string;
  /** Description of what this path teaches */
  description: string;
  /** Ordered list of example identifiers */
  examples: string[];
}

/**
 * Statistics about the example catalog
 */
export interface CatalogStats {
  /** Total number of examples in the catalog */
  totalExamples: number;
  /** Count of examples by difficulty level */
  byDifficulty: Record<string, number>;
  /** Count of examples by category */
  byCategory: Record<string, number>;
  /** Total estimated time to complete all examples */
  estimatedTotalTime: string;
  /** Count of examples by source */
  sources: Record<string, number>;
}

/**
 * Complete example catalog structure
 */
export interface ExampleCatalog {
  /** Catalog version for compatibility tracking */
  version: string;
  /** All available categories */
  categories: Record<string, Category>;
  /** All available examples indexed by identifier */
  examples: Record<string, ExampleMetadata>;
  /** Optional curated learning paths */
  learningPaths?: Record<string, LearningPath>;
  /** Optional catalog statistics */
  stats?: CatalogStats;
}

/**
 * Options for creating a new example project
 */
export interface CreateOptions {
  /** Template identifier from catalog */
  template?: string;
  /** Category filter for template selection */
  category?: string;
  /** Output directory path */
  output?: string;
  /** Skip automatic dependency installation */
  skipInstall?: boolean;
  /** Generate full GitBook documentation */
  withDocs?: boolean;
  /** Overwrite existing directory */
  force?: boolean;
}
