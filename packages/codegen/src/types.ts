/**
 * Type definitions for ZCraft Code Generator
 * Based on relayer-sdk types from src/types/primitives.d.ts
 */

/**
 * Mapping of FHE type names to their type IDs
 */
export interface FheTypeNameToIdMap {
  ebool: 0
  euint8: 2
  euint16: 3
  euint32: 4
  euint64: 5
  euint128: 6
  eaddress: 7
  euint256: 8
}

/**
 * Mapping of FHE type IDs to their names
 */
export interface FheTypeIdToNameMap {
  0: 'ebool'
  2: 'euint8'
  3: 'euint16'
  4: 'euint32'
  5: 'euint64'
  6: 'euint128'
  7: 'eaddress'
  8: 'euint256'
}

/**
 * Mapping of encryption bit widths to FHE type IDs
 */
export interface FheTypeEncryptionBitwidthToIdMap {
  2: FheTypeNameToIdMap['ebool']
  8: FheTypeNameToIdMap['euint8']
  16: FheTypeNameToIdMap['euint16']
  32: FheTypeNameToIdMap['euint32']
  64: FheTypeNameToIdMap['euint64']
  128: FheTypeNameToIdMap['euint128']
  160: FheTypeNameToIdMap['eaddress']
  256: FheTypeNameToIdMap['euint256']
}

/**
 * Mapping of FHE type IDs to encryption bit widths (inverted map)
 */
export type FheTypeIdToEncryptionBitwidthMap = {
  [K in keyof FheTypeEncryptionBitwidthToIdMap as FheTypeEncryptionBitwidthToIdMap[K]]: K
}

/**
 * FHE Type Names (derived from map)
 */
export type FheTypeName = keyof FheTypeNameToIdMap

/**
 * FHE Type IDs (derived from map)
 */
export type FheTypeId = keyof FheTypeIdToNameMap

/**
 * Encryption Bits (valid bit widths)
 */
export type EncryptionBits = keyof FheTypeEncryptionBitwidthToIdMap

/**
 * Solidity primitive type names
 */
export type SolidityPrimitiveTypeName = 'bool' | 'uint256' | 'address'

/**
 * FHEVM Type Information
 * Contains metadata about encrypted types
 */
export interface FHEVMTypeInfo {
  isEncrypted: boolean // true for all FHEVM types
  isExternal: boolean // true for externalEuint* (needs encryption)
  bits: number // Bit width: 2, 8, 16, 32, 64, 128, 160, 256
  fhevmTypeName: FheTypeName // 'ebool', 'euint8', 'euint16', etc.
  fhevmTypeId: FheTypeId // 0, 2, 3, 4, 5, 6, 7, 8
  solType: string // 'euint32', 'externalEuint32', 'ebool', etc.
}

/**
 * Parsed ABI Parameter
 * Extracted from contract ABI
 */
export interface ParsedParameter {
  name: string // Parameter name (can be empty for unnamed params)
  type: string // ABI type (bytes32, uint256, address, etc.)
  internalType?: string // Solidity type (euint32, externalEuint32, struct Foo, etc.)
  fhevmInfo?: FHEVMTypeInfo // Only present if this is an FHEVM type
}

/**
 * Parsed ABI Function
 * Extracted from contract ABI
 */
export interface ParsedFunction {
  name: string // Function name
  inputs: ParsedParameter[] // Input parameters
  outputs: ParsedParameter[] // Output parameters
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable' // State mutability
}

/**
 * Parsed Contract
 * Complete contract ABI with metadata
 */
export interface ParsedContract {
  name: string // Contract name
  address: string // Deployed contract address
  abi: ParsedFunction[] // Parsed functions
}
