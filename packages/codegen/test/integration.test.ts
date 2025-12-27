/**
 * Integration Tests
 * Tests parser + detector working together
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

describe('Parser + Detector Integration', () => {
  it('should parse ABI and detect FHEVM types in parameters', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)
    const increment = functions.find((f) => f.name === 'increment')

    assert.ok(increment, 'increment function should exist')

    // First parameter should have FHEVM info
    const firstParam = increment.inputs[0]
    assert.ok(firstParam.fhevmInfo, 'First parameter should have fhevmInfo')
    assert.strictEqual(firstParam.fhevmInfo.isExternal, true, 'Should be external')
    assert.strictEqual(firstParam.fhevmInfo.fhevmTypeName, 'euint32')
    assert.strictEqual(firstParam.fhevmInfo.fhevmTypeId, 4)
    assert.strictEqual(firstParam.fhevmInfo.bits, 32)

    // Second parameter should NOT have FHEVM info (it's bytes)
    const secondParam = increment.inputs[1]
    assert.strictEqual(secondParam.fhevmInfo, undefined, 'Second parameter should not have fhevmInfo')
  })

  it('should detect FHEVM types in function outputs', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)
    const getCount = functions.find((f) => f.name === 'getCount')

    assert.ok(getCount, 'getCount function should exist')

    const output = getCount.outputs[0]
    assert.ok(output.fhevmInfo, 'Output should have fhevmInfo')
    assert.strictEqual(output.fhevmInfo.isExternal, false, 'Should be internal')
    assert.strictEqual(output.fhevmInfo.fhevmTypeName, 'euint32')
    assert.strictEqual(output.fhevmInfo.fhevmTypeId, 4)
    assert.strictEqual(output.fhevmInfo.bits, 32)
    assert.strictEqual(output.fhevmInfo.solType, 'euint32')
  })

  it('should correctly identify external vs internal encrypted types', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)

    // Count external and internal FHEVM types
    let externalCount = 0
    let internalCount = 0

    functions.forEach((fn) => {
      fn.inputs.forEach((input) => {
        if (input.fhevmInfo) {
          if (input.fhevmInfo.isExternal) {
            externalCount++
          } else {
            internalCount++
          }
        }
      })
      fn.outputs.forEach((output) => {
        if (output.fhevmInfo) {
          if (output.fhevmInfo.isExternal) {
            externalCount++
          } else {
            internalCount++
          }
        }
      })
    })

    // FHECounter has 2 external inputs (increment and decrement) and 1 internal output (getCount)
    assert.strictEqual(externalCount, 2, 'Should have 2 external FHEVM types')
    assert.strictEqual(internalCount, 1, 'Should have 1 internal FHEVM type')
  })

  it('should not add fhevmInfo to non-FHEVM parameters', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)

    // confidentialProtocolId returns uint256 (not FHEVM)
    const confidential = functions.find((f) => f.name === 'confidentialProtocolId')
    assert.ok(confidential, 'confidentialProtocolId should exist')

    const output = confidential.outputs[0]
    assert.strictEqual(output.internalType, 'uint256')
    assert.strictEqual(output.fhevmInfo, undefined, 'Should not have fhevmInfo for uint256')
  })

  it('should parse complete contract with all type information', () => {
    const abi = loadAbi('FHECounter.abi.json')
    const functions = parseContractAbi(abi)

    // Verify all functions are properly parsed
    functions.forEach((fn) => {
      assert.ok(fn.name, 'Function should have name')
      assert.ok(Array.isArray(fn.inputs), 'Function should have inputs array')
      assert.ok(Array.isArray(fn.outputs), 'Function should have outputs array')
      assert.ok(fn.stateMutability, 'Function should have stateMutability')

      // Verify all parameters have required fields
      ;[...fn.inputs, ...fn.outputs].forEach((param) => {
        assert.ok('name' in param, 'Parameter should have name field')
        assert.ok('type' in param, 'Parameter should have type field')

        // If it has fhevmInfo, verify it's complete
        if (param.fhevmInfo) {
          assert.ok('isEncrypted' in param.fhevmInfo)
          assert.ok('isExternal' in param.fhevmInfo)
          assert.ok('bits' in param.fhevmInfo)
          assert.ok('fhevmTypeName' in param.fhevmInfo)
          assert.ok('fhevmTypeId' in param.fhevmInfo)
          assert.ok('solType' in param.fhevmInfo)
        }
      })
    })
  })
})
