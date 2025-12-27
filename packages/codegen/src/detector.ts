/**
 * FHEVM Type Detector
 * Detects and analyzes FHEVM encrypted types from Solidity internalType
 * Based on relayer-sdk src/sdk/FheType.ts
 */

import type {
  FheTypeName,
  FheTypeId,
  FheTypeNameToIdMap,
  FheTypeIdToNameMap,
  FheTypeIdToEncryptionBitwidthMap,
  FHEVMTypeInfo,
} from './types.js'

////////////////////////////////////////////////////////////////////////////////
// Lookup Maps (from relayer-sdk)
////////////////////////////////////////////////////////////////////////////////

const FheTypeNameToId: FheTypeNameToIdMap = {
  ebool: 0,
  euint8: 2,
  euint16: 3,
  euint32: 4,
  euint64: 5,
  euint128: 6,
  eaddress: 7,
  euint256: 8,
} as const

const FheTypeIdToName: FheTypeIdToNameMap = {
  0: 'ebool',
  2: 'euint8',
  3: 'euint16',
  4: 'euint32',
  5: 'euint64',
  6: 'euint128',
  7: 'eaddress',
  8: 'euint256',
} as const

const FheTypeIdToEncryptionBitwidth: FheTypeIdToEncryptionBitwidthMap = {
  0: 2,
  2: 8,
  3: 16,
  4: 32,
  5: 64,
  6: 128,
  7: 160,
  8: 256,
} as const

Object.freeze(FheTypeNameToId)
Object.freeze(FheTypeIdToName)
Object.freeze(FheTypeIdToEncryptionBitwidth)

////////////////////////////////////////////////////////////////////////////////
// Type Guards
////////////////////////////////////////////////////////////////////////////////

/**
 * Checks if a value is a valid FheTypeId.
 * @example isFheTypeId(2) // true (euint8)
 * @example isFheTypeId(1) // false (euint4 is deprecated)
 */
export function isFheTypeId(value: unknown): value is FheTypeId {
  switch (value as FheTypeId) {
    case 0:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return true
    default:
      return false
  }
}

/**
 * Checks if a value is a valid FheTypeName.
 * @example isFheTypeName('euint8') // true
 * @example isFheTypeName('euint4') // false (deprecated)
 */
export function isFheTypeName(value: unknown): value is FheTypeName {
  if (typeof value !== 'string') {
    return false
  }
  return value in FheTypeNameToId
}

////////////////////////////////////////////////////////////////////////////////
// FheTypeId extractors
////////////////////////////////////////////////////////////////////////////////

/**
 * Converts an FheTypeName to its corresponding FheTypeId.
 * @example fheTypeIdFromName('euint8') // 2
 */
export function fheTypeIdFromName(name: FheTypeName): FheTypeId {
  return FheTypeNameToId[name]
}

/**
 * Converts an FheTypeId to its corresponding FheTypeName.
 * @example fheTypeNameFromId(2) // 'euint8'
 */
export function fheTypeNameFromId(id: FheTypeId): FheTypeName {
  return FheTypeIdToName[id]
}

/**
 * Returns the encryption bit width for an FheTypeId.
 * @example encryptionBitsFromFheTypeId(2) // 8 (euint8)
 * @example encryptionBitsFromFheTypeId(7) // 160 (eaddress)
 */
export function encryptionBitsFromFheTypeId(typeId: FheTypeId): number {
  return FheTypeIdToEncryptionBitwidth[typeId]
}

/**
 * Returns the encryption bit width for an FheType name.
 * @example encryptionBitsFromFheTypeName('ebool') // 2
 * @example encryptionBitsFromFheTypeName('euint32') // 32
 * @example encryptionBitsFromFheTypeName('eaddress') // 160
 */
export function encryptionBitsFromFheTypeName(name: FheTypeName): number {
  return FheTypeIdToEncryptionBitwidth[FheTypeNameToId[name]]
}

////////////////////////////////////////////////////////////////////////////////
// FHEVM Type Detection
////////////////////////////////////////////////////////////////////////////////

/**
 * Detect if a Solidity type is an FHEVM encrypted type
 *
 * @param internalType - The Solidity internalType from ABI (e.g., 'externalEuint32', 'euint64', 'ebool')
 * @returns FHEVMTypeInfo if it's an FHEVM type, null otherwise
 *
 * @example
 * detectFHEVMType('externalEuint32') // { isEncrypted: true, isExternal: true, bits: 32, ... }
 * detectFHEVMType('euint64') // { isEncrypted: true, isExternal: false, bits: 64, ... }
 * detectFHEVMType('uint256') // null
 */
export function detectFHEVMType(internalType: string | undefined): FHEVMTypeInfo | null {
  if (!internalType) {
    return null
  }

  // Check if it's an external type (needs client-side encryption)
  const isExternal = internalType.startsWith('external')
  let typeName = isExternal ? internalType.substring(8).toLowerCase() : internalType // Remove 'external' prefix and lowercase

  // Check if it's a valid FHEVM type
  if (!isFheTypeName(typeName)) {
    return null
  }

  const fhevmTypeName = typeName as FheTypeName
  const fhevmTypeId = fheTypeIdFromName(fhevmTypeName)
  const bits = encryptionBitsFromFheTypeName(fhevmTypeName)

  const typeInfo: FHEVMTypeInfo = {
    isEncrypted: true,
    isExternal,
    bits,
    fhevmTypeName,
    fhevmTypeId,
    solType: internalType,
  }

  return typeInfo
}

/**
 * Check if a Solidity type is an FHEVM encrypted type
 *
 * @param internalType - The Solidity internalType from ABI
 * @returns true if it's an FHEVM type, false otherwise
 */
export function isFHEVMType(internalType: string | undefined): boolean {
  return detectFHEVMType(internalType) !== null
}
