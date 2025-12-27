/**
 * Contract analyzer for extracting FHEVM operations and types
 */

import { readFile } from 'fs/promises';
import type { ParsedFunction } from '@zcraft/codegen';
import type { FHEOperation } from '../types.js';

/**
 * Analyze contract for FHEVM types used
 */
export function extractFhevmTypes(functions: ParsedFunction[]): string[] {
  const types = new Set<string>();

  for (const func of functions) {
    // Check inputs
    for (const input of func.inputs) {
      if (input.fhevmInfo) {
        types.add(input.fhevmInfo.fhevmTypeName);
      }
    }

    // Check outputs
    for (const output of func.outputs) {
      if (output.fhevmInfo) {
        types.add(output.fhevmInfo.fhevmTypeName);
      }
    }
  }

  return Array.from(types).sort();
}

/**
 * Analyze Solidity source for FHE operations
 */
export async function analyzeFheOperations(solPath: string): Promise<FHEOperation[]> {
  try {
    const source = await readFile(solPath, 'utf-8');
    const operations: Map<string, FHEOperation> = new Map();

    // Common FHE operations and their descriptions
    const fheOps: Record<string, string> = {
      'FHE.add': 'Addition of encrypted values',
      'FHE.sub': 'Subtraction of encrypted values',
      'FHE.mul': 'Multiplication of encrypted values',
      'FHE.div': 'Division of encrypted values',
      'FHE.eq': 'Equality comparison of encrypted values',
      'FHE.ne': 'Not-equal comparison of encrypted values',
      'FHE.lt': 'Less-than comparison of encrypted values',
      'FHE.lte': 'Less-than-or-equal comparison of encrypted values',
      'FHE.gt': 'Greater-than comparison of encrypted values',
      'FHE.gte': 'Greater-than-or-equal comparison of encrypted values',
      'FHE.min': 'Minimum of encrypted values',
      'FHE.max': 'Maximum of encrypted values',
      'FHE.and': 'Logical AND of encrypted booleans',
      'FHE.or': 'Logical OR of encrypted booleans',
      'FHE.xor': 'Logical XOR of encrypted booleans',
      'FHE.not': 'Logical NOT of encrypted boolean',
      'FHE.select': 'Conditional selection (ternary operator)',
      'FHE.asEuint8': 'Convert to euint8',
      'FHE.asEuint16': 'Convert to euint16',
      'FHE.asEuint32': 'Convert to euint32',
      'FHE.asEuint64': 'Convert to euint64',
      'FHE.asEuint128': 'Convert to euint128',
      'FHE.asEuint256': 'Convert to euint256',
      'FHE.asEbool': 'Convert to ebool',
      'FHE.allow': 'Grant user permission to decrypt',
      'FHE.allowThis': 'Grant contract permission to use encrypted value',
      'FHE.allowTransient': 'Grant transient permission',
      'FHE.isSenderAllowed': 'Check if sender has permission',
    };

    // Count occurrences of each operation
    for (const [opName, description] of Object.entries(fheOps)) {
      const regex = new RegExp(`\\b${opName.replace('.', '\\.')}\\(`, 'g');
      const matches = source.match(regex);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        operations.set(opName, {
          name: opName,
          description,
          count,
        });
      }
    }

    return Array.from(operations.values()).sort((a, b) => {
      // Sort by count (descending), then by name
      if (b.count !== a.count) {
        return (b.count || 0) - (a.count || 0);
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    // If file doesn't exist or can't be read, return empty array
    return [];
  }
}

/**
 * Count encrypted state variables in contract
 */
export async function countEncryptedStateVariables(solPath: string): Promise<number> {
  try {
    const source = await readFile(solPath, 'utf-8');

    // Match encrypted type declarations (euint8, euint16, etc., ebool, eaddress)
    const regex = /\b(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\s+(?:public|private|internal)?\s*\w+/g;
    const matches = source.match(regex);

    return matches ? matches.length : 0;
  } catch (error) {
    return 0;
  }
}
