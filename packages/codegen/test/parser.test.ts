/**
 * Parser Tests
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseContractAbi } from '../src/parser.js'
import type { Abi } from 'abitype'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadAbi(filename: string): Abi {
  // Read from source test directory, not lib/test
  const path = join(__dirname, '../../test', filename)
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content) as Abi
}

describe('ABI Parser', () => {
  it('should parse FHECounter ABI and return 4 functions', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)

    assert.strictEqual(functions.length, 4, 'Should parse 4 functions')
  })

  it('should extract correct function names', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)

    const expectedNames = ['confidentialProtocolId', 'decrement', 'getCount', 'increment']
    const actualNames = functions.map((f) => f.name)

    assert.deepStrictEqual(actualNames, expectedNames, 'Function names should match')
  })

  it('should parse increment function with correct structure', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)
    const increment = functions.find((f) => f.name === 'increment')

    assert.ok(increment, 'increment function should exist')
    assert.strictEqual(increment.inputs.length, 2, 'Should have 2 inputs')
    assert.strictEqual(increment.outputs.length, 0, 'Should have 0 outputs')
    assert.strictEqual(increment.stateMutability, 'nonpayable', 'Should be nonpayable')
  })

  it('should parse input parameters with internalType', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)
    const increment = functions.find((f) => f.name === 'increment')

    const firstInput = increment!.inputs[0]
    assert.strictEqual(firstInput.name, 'inputEuint32', 'First input name should be inputEuint32')
    assert.strictEqual(firstInput.type, 'bytes32', 'First input type should be bytes32')
    assert.strictEqual(
      firstInput.internalType,
      'externalEuint32',
      'First input internalType should be externalEuint32'
    )
  })

  it('should parse getCount function output', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)
    const getCount = functions.find((f) => f.name === 'getCount')

    assert.ok(getCount, 'getCount function should exist')
    assert.strictEqual(getCount.outputs.length, 1, 'Should have 1 output')

    const output = getCount.outputs[0]
    assert.strictEqual(output.type, 'bytes32', 'Output type should be bytes32')
    assert.strictEqual(output.internalType, 'euint32', 'Output internalType should be euint32')
  })
})
