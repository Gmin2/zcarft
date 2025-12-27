/**
 * ABI Parser
 * Parses contract ABIs and extracts function information
 */

import type { Abi, AbiFunction, AbiParameter } from 'abitype'
import type { ParsedParameter, ParsedFunction } from './types.js'
import { detectFHEVMType } from './detector.js'

/**
 * Parse ABI parameter into structured format
 */
function parseParameter(param: AbiParameter): ParsedParameter {
  const parsed: ParsedParameter = {
    name: param.name || '',
    type: param.type,
  }

  // Add internalType if present
  if (param.internalType) {
    parsed.internalType = param.internalType

    // Detect FHEVM types and add metadata
    const fhevmInfo = detectFHEVMType(param.internalType)
    if (fhevmInfo) {
      parsed.fhevmInfo = fhevmInfo
    }
  }

  return parsed
}

/**
 * Parse ABI function into structured format
 */
function parseFunction(abiFunction: AbiFunction): ParsedFunction {
  const inputs = (abiFunction.inputs || []).map(parseParameter)
  const outputs = (abiFunction.outputs || []).map(parseParameter)

  const parsed: ParsedFunction = {
    name: abiFunction.name,
    inputs,
    outputs,
    stateMutability: abiFunction.stateMutability,
  }

  return parsed
}

/**
 * Parse contract ABI and extract all functions
 */
export function parseContractAbi(abi: Abi): ParsedFunction[] {
  // Filter for functions only
  const functions = abi.filter(
    (item): item is AbiFunction => item.type === 'function'
  )

  // Parse each function
  const parsedFunctions = functions.map(parseFunction)

  return parsedFunctions
}
