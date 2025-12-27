/**
 * Task Generator Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseContractAbi } from '../src/parser.js';
import { generateTasks } from '../src/task-generator.js';
import type { Abi } from 'abitype';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadAbi(filename: string): Abi {
  const path = join(__dirname, '../../test', filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as Abi;
}

describe('Task Generator', () => {
  it('should generate task code from contract ABI', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // Basic checks
    assert.ok(code.length > 0, 'Should generate code');
    assert.ok(code.includes('task('), 'Should have task definitions');
  });

  it('should generate tasks with correct names', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // Should have tasks for all functions
    assert.ok(code.includes('task("fhecounter:confidentialProtocolId"'), 'Should have confidentialProtocolId task');
    assert.ok(code.includes('task("fhecounter:decrement"'), 'Should have decrement task');
    assert.ok(code.includes('task("fhecounter:getCount"'), 'Should have getCount task');
    assert.ok(code.includes('task("fhecounter:increment"'), 'Should have increment task');
  });

  it('should generate decrypt tasks for encrypted outputs', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // getCount returns euint32, should have decrypt task
    assert.ok(code.includes('task("fhecounter:decrypt-getCount"'), 'Should have decrypt-getCount task');
    assert.ok(code.includes('userDecryptEuint'), 'Should call userDecryptEuint');
  });

  it('should add parameters for functions with inputs', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // increment has inputEuint32 parameter
    assert.ok(code.includes('addParam("inputEuint32"'), 'Should add inputEuint32 parameter');
  });

  it('should generate encryption logic for external encrypted inputs', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // increment function should have encryption logic
    assert.ok(code.includes('createEncryptedInput'), 'Should call createEncryptedInput');
    assert.ok(code.includes('.add32('), 'Should call add32 for euint32');
    assert.ok(code.includes('.encrypt()'), 'Should call encrypt()');
    assert.ok(code.includes('encrypted.handles'), 'Should use encrypted handles');
    assert.ok(code.includes('encrypted.inputProof'), 'Should use inputProof');
  });

  it('should not add encryption for functions without external inputs', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // confidentialProtocolId has no encrypted inputs
    const taskMatch = code.match(/task\("fhecounter:confidentialProtocolId"[\s\S]+?\.setAction[\s\S]+?\}\);/);
    assert.ok(taskMatch, 'Should find confidentialProtocolId task');

    const taskCode = taskMatch[0];
    assert.ok(!taskCode.includes('createEncryptedInput'), 'Should not have encryption for non-encrypted function');
  });

  it('should handle view functions correctly', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // getCount is a view function
    const taskMatch = code.match(/task\("fhecounter:getCount"[\s\S]+?\.setAction[\s\S]+?\}\);/);
    assert.ok(taskMatch, 'Should find getCount task');

    const taskCode = taskMatch[0];
    assert.ok(taskCode.includes('await contract.getCount'), 'Should call contract method');
    assert.ok(!taskCode.includes('tx.wait()'), 'View function should not wait for transaction');
  });

  it('should handle transaction functions correctly', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // increment is a transaction function
    const taskMatch = code.match(/task\("fhecounter:increment"[\s\S]+?\.setAction[\s\S]+?\}\);/);
    assert.ok(taskMatch, 'Should find increment task');

    const taskCode = taskMatch[0];
    assert.ok(taskCode.includes('const tx = await contract.increment'), 'Should send transaction');
    assert.ok(taskCode.includes('await tx.wait()'), 'Should wait for transaction');
    assert.ok(taskCode.includes('receipt.blockNumber'), 'Should show block number');
    assert.ok(taskCode.includes('receipt.gasUsed'), 'Should show gas used');
  });

  it('should generate valid JavaScript code', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    // Basic syntax validity checks
    assert.ok(!code.includes('undefined'), 'Should not have undefined values');
    assert.ok(!code.includes('[object Object]'), 'Should not have unrendered objects');

    // Check for balanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    assert.strictEqual(openBraces, closeBraces, 'Should have balanced braces');

    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    assert.strictEqual(openParens, closeParens, 'Should have balanced parentheses');
  });

  it('should include proper comments', () => {
    const abi = loadAbi('FHECounter.abi.json');
    const functions = parseContractAbi(abi);
    const code = generateTasks('FHECounter', functions);

    assert.ok(code.includes('/**'), 'Should have JSDoc comments');
    assert.ok(code.includes('* Task:'), 'Should have task documentation');
  });
});
