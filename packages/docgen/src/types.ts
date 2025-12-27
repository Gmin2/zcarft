/**
 * Types for GitBook-compatible FHEVM documentation generation
 */

import type { ParsedFunction } from '@zcraft/codegen';

/**
 * Contract input for documentation generation
 */
export interface ContractInput {
  /** Path to contract ABI file (Hardhat artifact JSON) */
  abiPath: string;
  /** Path to Solidity source file (for surya graphs) */
  solPath: string;
  /** Contract name */
  name: string;
  /** Optional deployed address */
  address?: string;
  /** Optional test file path */
  testPath?: string;
}

/**
 * SUMMARY.md section configuration
 */
export interface SummarySection {
  /** Section title (e.g., "Getting Started", "Contracts") */
  title: string;
  /** Manual pages (optional) */
  pages?: string[];
  /** Auto-generate from contracts (for "Contracts" section) */
  auto?: boolean;
}

/**
 * Documentation generation configuration
 */
export interface DocGenConfig {
  /** Input contracts */
  contracts: ContractInput[];
  /** Output directory */
  outputDir: string;
  /** Include surya graphs */
  includeGraphs?: boolean;
  /** Include test files in tabs */
  includeTests?: boolean;
  /** Include usage examples */
  includeUsageExamples?: boolean;
  /** Network name for usage examples */
  network?: string;
  /** SUMMARY.md configuration */
  summaryConfig?: {
    sections: SummarySection[];
  };
}

/**
 * Parsed contract documentation data
 */
export interface ContractDocumentation {
  /** Contract name */
  name: string;
  /** Contract description */
  description?: string;
  /** Contract address (if deployed) */
  address?: string;
  /** Network */
  network?: string;
  /** Parsed functions */
  functions: ParsedFunction[];
  /** FHEVM types used */
  fhevmTypes: string[];
  /** FHE operations used */
  fheOperations: FHEOperation[];
  /** Solidity source code */
  solidityCode?: string;
  /** TypeScript test code */
  testCode?: string;
  /** Graph file paths */
  graphs?: {
    callGraph?: string;
    inheritance?: string;
  };
}

/**
 * FHE operation information
 */
export interface FHEOperation {
  /** Operation name (e.g., "FHE.add", "FHE.allowThis") */
  name: string;
  /** Description */
  description: string;
  /** Number of times used in contract */
  count?: number;
}

/**
 * Generated page information
 */
export interface GeneratedPage {
  /** File path relative to outputDir */
  path: string;
  /** Markdown content */
  content: string;
}

/**
 * SUMMARY.md navigation item
 */
export interface SummaryItem {
  /** Link text */
  title: string;
  /** File path */
  path?: string;
  /** Children items (for nested navigation) */
  children?: SummaryItem[];
}
