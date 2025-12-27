/**
 * Tests for documentation generator
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { buildSummary } from '../src/gitbook/summary-builder.js';
import { extractFhevmTypes } from '../src/parsers/contract-analyzer.js';
import type { SummarySection, ContractInput } from '../src/types.js';
import type { ParsedFunction } from '@zcraft/codegen';

test('buildSummary generates correct SUMMARY.md content', () => {
  const sections: SummarySection[] = [
    {
      title: 'Getting Started',
      pages: ['getting-started/installation.md'],
    },
    {
      title: 'Contracts',
      auto: true,
    },
  ];

  const contracts: ContractInput[] = [
    {
      abiPath: '/path/to/Counter.json',
      solPath: '/path/to/Counter.sol',
      name: 'Counter',
    },
  ];

  const summary = buildSummary(sections, contracts);

  assert.ok(summary.includes('# Summary'));
  assert.ok(summary.includes('## Getting Started'));
  assert.ok(summary.includes('## Contracts'));
  assert.ok(summary.includes('[Counter](contracts/Counter.md)'));
  assert.ok(summary.includes('[Overview](contracts/README.md)'));
});

test('extractFhevmTypes returns unique types from functions', () => {
  const functions: ParsedFunction[] = [
    {
      name: 'increment',
      stateMutability: 'nonpayable',
      inputs: [
        {
          name: 'value',
          type: 'bytes32',
          fhevmInfo: {
            fhevmTypeName: 'euint32',
            fhevmTypeId: 4,
            bits: 32,
            isExternal: true,
            isEncrypted: true,
            solType: 'externalEuint32',
          },
        },
      ],
      outputs: [],
    },
    {
      name: 'getCount',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        {
          name: '',
          type: 'euint32',
          fhevmInfo: {
            fhevmTypeName: 'euint32',
            fhevmTypeId: 4,
            bits: 32,
            isExternal: false,
            isEncrypted: true,
            solType: 'euint32',
          },
        },
      ],
    },
  ];

  const types = extractFhevmTypes(functions);

  assert.deepStrictEqual(types, ['euint32']);
});

test('extractFhevmTypes handles multiple types', () => {
  const functions: ParsedFunction[] = [
    {
      name: 'add',
      stateMutability: 'nonpayable',
      inputs: [
        {
          name: 'a',
          type: 'bytes32',
          fhevmInfo: {
            fhevmTypeName: 'euint64',
            fhevmTypeId: 5,
            bits: 64,
            isExternal: true,
            isEncrypted: true,
            solType: 'externalEuint64',
          },
        },
      ],
      outputs: [],
    },
    {
      name: 'compare',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        {
          name: '',
          type: 'ebool',
          fhevmInfo: {
            fhevmTypeName: 'ebool',
            fhevmTypeId: 0,
            bits: 2,
            isExternal: false,
            isEncrypted: true,
            solType: 'ebool',
          },
        },
      ],
    },
  ];

  const types = extractFhevmTypes(functions);

  assert.deepStrictEqual(types, ['ebool', 'euint64']);
});
