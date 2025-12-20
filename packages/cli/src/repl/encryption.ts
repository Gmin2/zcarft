// Encryption and decryption helpers for FHEVM contracts
// Handles automatic encryption of function parameters and decryption of results

import type { Signer } from 'ethers';

// Type definitions for FHEVM
export type FhevmType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const FhevmType = {
  euint8: 0 as FhevmType,
  euint16: 1 as FhevmType,
  euint32: 2 as FhevmType,
  euint64: 3 as FhevmType,
  euint128: 4 as FhevmType,
  euint256: 5 as FhevmType,
  ebool: 6 as FhevmType,
  eaddress: 7 as FhevmType,
} as const;

/**
 * Helper class for encrypting and decrypting FHEVM data
 */
export class EncryptionHelper {
  private fhevm: any;

  constructor(fhevm: any) {
    this.fhevm = fhevm;
  }

  /**
   * Encrypt a value using FHEVM
   * @param value The value to encrypt
   * @param type The encrypted type (uint8, uint16, uint32, etc.)
   * @param contractAddress The contract address
   * @param userAddress The user address
   * @returns Encrypted input with handle and proof
   */
  async encrypt(
    value: number | boolean | bigint,
    type: 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256' | 'bool' | 'address',
    contractAddress: string,
    userAddress: string,
  ): Promise<{ handle: string; inputProof: string }> {
    const input = this.fhevm.createEncryptedInput(contractAddress, userAddress);

    // Add the value with the appropriate type
    switch (type) {
      case 'uint8':
        input.add8(Number(value));
        break;
      case 'uint16':
        input.add16(Number(value));
        break;
      case 'uint32':
        input.add32(Number(value));
        break;
      case 'uint64':
        input.add64(BigInt(value));
        break;
      case 'uint128':
        input.add128(BigInt(value));
        break;
      case 'uint256':
        input.add256(BigInt(value));
        break;
      case 'bool':
        input.addBool(Boolean(value));
        break;
      case 'address':
        input.addAddress(String(value));
        break;
      default:
        throw new Error(`Unsupported encryption type: ${type}`);
    }

    const encrypted = await input.encrypt();

    return {
      handle: encrypted.handles[0],
      inputProof: encrypted.inputProof,
    };
  }

  /**
   * Decrypt an encrypted handle using user decryption
   * @param handle The encrypted handle to decrypt
   * @param type The FHEVM type (euint8, euint32, ebool, etc.)
   * @param contractAddress The contract address
   * @param signer The signer to use for decryption
   * @returns The decrypted value
   */
  async decrypt(
    handle: string,
    type: FhevmType,
    contractAddress: string,
    signer: Signer,
  ): Promise<number | boolean | bigint> {
    // Map type to appropriate decryption method
    switch (type) {
      case 0: // euint8
      case 1: // euint16
      case 2: // euint32
      case 3: // euint64
      case 4: // euint128
      case 5: // euint256
        return await this.fhevm.userDecryptEuint(type, handle, contractAddress, signer);

      case 6: // ebool
        return await this.fhevm.userDecryptEbool(handle, contractAddress, signer);

      case 7: // eaddress
        return await this.fhevm.userDecryptEaddress(handle, contractAddress, signer);

      default:
        throw new Error(`Unsupported decryption type: ${type}`);
    }
  }

  /**
   * Detect if a function parameter requires encryption based on type
   * @param paramType The Solidity parameter type from ABI
   * @returns Object with encryption info
   */
  static detectEncryptionType(
    paramType: string,
  ): { needsEncryption: boolean; encryptionType?: string; fhevmType?: FhevmType } {
    // Check for external encrypted types (used as function parameters)
    if (paramType.startsWith('externalEuint')) {
      const bits = paramType.replace('externalEuint', '');
      switch (bits) {
        case '8':
          return { needsEncryption: true, encryptionType: 'uint8', fhevmType: 0 };
        case '16':
          return { needsEncryption: true, encryptionType: 'uint16', fhevmType: 1 };
        case '32':
          return { needsEncryption: true, encryptionType: 'uint32', fhevmType: 2 };
        case '64':
          return { needsEncryption: true, encryptionType: 'uint64', fhevmType: 3 };
        case '128':
          return { needsEncryption: true, encryptionType: 'uint128', fhevmType: 4 };
        case '256':
          return { needsEncryption: true, encryptionType: 'uint256', fhevmType: 5 };
      }
    }

    // Check for encrypted types (used as return values and state)
    if (paramType.startsWith('euint')) {
      const bits = paramType.replace('euint', '');
      switch (bits) {
        case '8':
          return { needsEncryption: false, encryptionType: 'uint8', fhevmType: 0 };
        case '16':
          return { needsEncryption: false, encryptionType: 'uint16', fhevmType: 1 };
        case '32':
          return { needsEncryption: false, encryptionType: 'uint32', fhevmType: 2 };
        case '64':
          return { needsEncryption: false, encryptionType: 'uint64', fhevmType: 3 };
        case '128':
          return { needsEncryption: false, encryptionType: 'uint128', fhevmType: 4 };
        case '256':
          return { needsEncryption: false, encryptionType: 'uint256', fhevmType: 5 };
      }
    }

    if (paramType === 'externalEbool') {
      return { needsEncryption: true, encryptionType: 'bool', fhevmType: 6 };
    }

    if (paramType === 'ebool') {
      return { needsEncryption: false, encryptionType: 'bool', fhevmType: 6 };
    }

    if (paramType === 'externalEaddress') {
      return { needsEncryption: true, encryptionType: 'address', fhevmType: 7 };
    }

    if (paramType === 'eaddress') {
      return { needsEncryption: false, encryptionType: 'address', fhevmType: 7 };
    }

    return { needsEncryption: false };
  }

  /**
   * Get human-readable type name from FhevmType enum
   * @param type FhevmType enum value
   * @returns Human-readable type name
   */
  static getTypeName(type: FhevmType): string {
    const typeNames = [
      'euint8',
      'euint16',
      'euint32',
      'euint64',
      'euint128',
      'euint256',
      'ebool',
      'eaddress',
    ];
    return typeNames[type] || 'unknown';
  }

  /**
   * Get the maximum value for a given encrypted integer type
   * @param type The encrypted type
   * @returns Maximum value as a string
   */
  static getTypeMaxValue(type: string): string {
    const maxValues: Record<string, string> = {
      euint8: '255',
      euint16: '65,535',
      euint32: '4,294,967,295',
      euint64: '18,446,744,073,709,551,615',
      euint128: '340,282,366,920,938,463,463,374,607,431,768,211,455',
      euint256:
        '115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,935',
      ebool: '1 (true)',
      eaddress: '0xffffffffffffffffffffffffffffffffffffffff',
    };
    return maxValues[type] || 'N/A';
  }
}
