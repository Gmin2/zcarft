/**
 * FHEVM Type Detector Tests
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  detectFHEVMType,
  isFHEVMType,
  isFheTypeName,
  isFheTypeId,
  fheTypeIdFromName,
  fheTypeNameFromId,
  encryptionBitsFromFheTypeName,
  encryptionBitsFromFheTypeId,
} from '../src/detector.js'

describe('FHEVM Type Detector', () => {
  describe('detectFHEVMType', () => {
    it('should detect externalEuint32 as external encrypted type', () => {
      const result = detectFHEVMType('externalEuint32')

      assert.ok(result, 'Should detect as FHEVM type')
      assert.strictEqual(result.isEncrypted, true)
      assert.strictEqual(result.isExternal, true)
      assert.strictEqual(result.fhevmTypeName, 'euint32')
      assert.strictEqual(result.fhevmTypeId, 4)
      assert.strictEqual(result.bits, 32)
      assert.strictEqual(result.solType, 'externalEuint32')
    })

    it('should detect euint32 as internal encrypted type', () => {
      const result = detectFHEVMType('euint32')

      assert.ok(result, 'Should detect as FHEVM type')
      assert.strictEqual(result.isEncrypted, true)
      assert.strictEqual(result.isExternal, false)
      assert.strictEqual(result.fhevmTypeName, 'euint32')
      assert.strictEqual(result.fhevmTypeId, 4)
      assert.strictEqual(result.bits, 32)
      assert.strictEqual(result.solType, 'euint32')
    })

    it('should detect ebool type', () => {
      const result = detectFHEVMType('ebool')

      assert.ok(result, 'Should detect as FHEVM type')
      assert.strictEqual(result.fhevmTypeName, 'ebool')
      assert.strictEqual(result.fhevmTypeId, 0)
      assert.strictEqual(result.bits, 2)
      assert.strictEqual(result.isExternal, false)
    })

    it('should detect eaddress type', () => {
      const result = detectFHEVMType('eaddress')

      assert.ok(result, 'Should detect as FHEVM type')
      assert.strictEqual(result.fhevmTypeName, 'eaddress')
      assert.strictEqual(result.fhevmTypeId, 7)
      assert.strictEqual(result.bits, 160)
    })

    it('should detect all euint sizes', () => {
      const sizes = [
        { type: 'euint8', id: 2, bits: 8 },
        { type: 'euint16', id: 3, bits: 16 },
        { type: 'euint32', id: 4, bits: 32 },
        { type: 'euint64', id: 5, bits: 64 },
        { type: 'euint128', id: 6, bits: 128 },
        { type: 'euint256', id: 8, bits: 256 },
      ]

      sizes.forEach(({ type, id, bits }) => {
        const result = detectFHEVMType(type)
        assert.ok(result, `Should detect ${type}`)
        assert.strictEqual(result.fhevmTypeId, id)
        assert.strictEqual(result.bits, bits)
      })
    })

    it('should return null for non-FHEVM types', () => {
      const nonFhevmTypes = ['uint256', 'address', 'bytes', 'string', 'bool']

      nonFhevmTypes.forEach((type) => {
        const result = detectFHEVMType(type)
        assert.strictEqual(result, null, `${type} should not be detected as FHEVM type`)
      })
    })

    it('should return null for undefined', () => {
      const result = detectFHEVMType(undefined)
      assert.strictEqual(result, null)
    })
  })

  describe('isFHEVMType', () => {
    it('should return true for FHEVM types', () => {
      assert.strictEqual(isFHEVMType('euint32'), true)
      assert.strictEqual(isFHEVMType('externalEuint64'), true)
      assert.strictEqual(isFHEVMType('ebool'), true)
    })

    it('should return false for non-FHEVM types', () => {
      assert.strictEqual(isFHEVMType('uint256'), false)
      assert.strictEqual(isFHEVMType('address'), false)
      assert.strictEqual(isFHEVMType(undefined), false)
    })
  })

  describe('Type Guards', () => {
    it('isFheTypeName should validate type names', () => {
      assert.strictEqual(isFheTypeName('euint32'), true)
      assert.strictEqual(isFheTypeName('ebool'), true)
      assert.strictEqual(isFheTypeName('eaddress'), true)
      assert.strictEqual(isFheTypeName('uint256'), false)
      assert.strictEqual(isFheTypeName('euint4'), false) // deprecated
    })

    it('isFheTypeId should validate type IDs', () => {
      assert.strictEqual(isFheTypeId(0), true) // ebool
      assert.strictEqual(isFheTypeId(4), true) // euint32
      assert.strictEqual(isFheTypeId(8), true) // euint256
      assert.strictEqual(isFheTypeId(1), false) // deprecated euint4
      assert.strictEqual(isFheTypeId(99), false)
    })
  })

  describe('Type Conversions', () => {
    it('should convert type name to ID', () => {
      assert.strictEqual(fheTypeIdFromName('ebool'), 0)
      assert.strictEqual(fheTypeIdFromName('euint32'), 4)
      assert.strictEqual(fheTypeIdFromName('eaddress'), 7)
      assert.strictEqual(fheTypeIdFromName('euint256'), 8)
    })

    it('should convert type ID to name', () => {
      assert.strictEqual(fheTypeNameFromId(0), 'ebool')
      assert.strictEqual(fheTypeNameFromId(4), 'euint32')
      assert.strictEqual(fheTypeNameFromId(7), 'eaddress')
      assert.strictEqual(fheTypeNameFromId(8), 'euint256')
    })

    it('should get encryption bits from type name', () => {
      assert.strictEqual(encryptionBitsFromFheTypeName('ebool'), 2)
      assert.strictEqual(encryptionBitsFromFheTypeName('euint8'), 8)
      assert.strictEqual(encryptionBitsFromFheTypeName('euint32'), 32)
      assert.strictEqual(encryptionBitsFromFheTypeName('eaddress'), 160)
      assert.strictEqual(encryptionBitsFromFheTypeName('euint256'), 256)
    })

    it('should get encryption bits from type ID', () => {
      assert.strictEqual(encryptionBitsFromFheTypeId(0), 2) // ebool
      assert.strictEqual(encryptionBitsFromFheTypeId(4), 32) // euint32
      assert.strictEqual(encryptionBitsFromFheTypeId(7), 160) // eaddress
      assert.strictEqual(encryptionBitsFromFheTypeId(8), 256) // euint256
    })
  })
})
