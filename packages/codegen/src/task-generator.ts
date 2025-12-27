/**
 * Task Generator
 * Generates Hardhat task definitions from parsed ABI
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ParsedFunction, ParsedParameter } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get templates directory
// In src: src/task-generator.ts → src/templates
// In lib: lib/src/task-generator.js → lib/templates (go up one level)
const templatesDir = join(__dirname, '../templates');

/**
 * Load and compile a Handlebars template
 */
function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const templatePath = join(templatesDir, `${name}.hbs`);
  const templateSource = readFileSync(templatePath, 'utf-8');
  return Handlebars.compile(templateSource);
}

/**
 * Generate Hardhat tasks code from parsed contract functions
 */
export function generateTasks(
  contractName: string,
  functions: ParsedFunction[]
): string {
  // Load templates
  const taskTemplate = loadTemplate('task');
  const decryptTaskTemplate = loadTemplate('decryptTask');

  const taskCodes: string[] = [];

  // Add import statement
  taskCodes.push('import { task } from "hardhat/config";');
  taskCodes.push('');

  // Generate task for each function
  functions.forEach((fn) => {
    // Generate main function task
    const taskData = generateFunctionTaskData(contractName, fn);
    const taskCode = taskTemplate(taskData);
    taskCodes.push(taskCode);

    // Generate decrypt task if function returns encrypted value
    const decryptTaskData = generateDecryptTaskData(contractName, fn);
    if (decryptTaskData) {
      const decryptCode = decryptTaskTemplate(decryptTaskData);
      taskCodes.push(decryptCode);
    }
  });

  return taskCodes.join('\n\n');
}

/**
 * Generate data for function task template
 */
function generateFunctionTaskData(
  contractName: string,
  fn: ParsedFunction
) {
  const hasExternalInputs = fn.inputs.some((input) => input.fhevmInfo?.isExternal);

  // Build parameters list (exclude inputProof)
  const params = fn.inputs
    .filter((input) => input.name !== 'inputProof')
    .map((input) => ({
      name: (input.name || 'arg').toLowerCase(),
      description: getParamDescription(input),
    }));

  // Build encryption calls for external inputs
  const encryptionCalls: Array<{ method: string; param: string }> = [];
  const callArgs: Array<{ value: string }> = [];
  let handleIndex = 0;

  fn.inputs.forEach((input) => {
    if (input.fhevmInfo?.isExternal) {
      const method = getEncryptionMethod(input.fhevmInfo.bits);
      const paramName = (input.name || 'arg').toLowerCase();
      encryptionCalls.push({
        method,
        param: paramName,
      });
      callArgs.push({ value: `encrypted.handles[${handleIndex}]` });
      handleIndex++;
    } else if (input.name !== 'inputProof') {
      const paramName = (input.name || 'arg').toLowerCase();
      callArgs.push({ value: `taskArgs.${paramName}` });
    }
  });

  // Add inputProof if there are external inputs
  if (hasExternalInputs) {
    callArgs.push({ value: 'encrypted.inputProof' });
  }

  return {
    name: fn.name,
    taskName: `${contractName.toLowerCase()}:${fn.name}`,
    description: `Call ${fn.name} function on ${contractName}`,
    contractName,
    functionName: fn.name,
    params,
    hasExternalInputs,
    encryptionCalls,
    callArgs,
    isView: fn.stateMutability === 'view' || fn.stateMutability === 'pure',
  };
}

/**
 * Generate data for decrypt task template
 */
function generateDecryptTaskData(
  contractName: string,
  fn: ParsedFunction
) {
  // Only generate decrypt tasks for view/pure functions that return encrypted values
  if (fn.stateMutability !== 'view' && fn.stateMutability !== 'pure') {
    return null;
  }

  // Check if the function returns an encrypted value
  const encryptedOutput = fn.outputs.find((output) => output.fhevmInfo && !output.fhevmInfo.isExternal);

  if (!encryptedOutput || !encryptedOutput.fhevmInfo) {
    return null;
  }

  const typeName = encryptedOutput.fhevmInfo.fhevmTypeName;
  const typeId = encryptedOutput.fhevmInfo.fhevmTypeId;

  return {
    taskName: `${contractName.toLowerCase()}:decrypt-${fn.name}`,
    description: `Get and decrypt ${fn.name} from ${contractName}`,
    contractName,
    functionName: fn.name,
    fhevmTypeName: typeName,
    fhevmTypeId: typeId,
  };
}

/**
 * Get the encryption method name for a FHEVM type
 */
function getEncryptionMethod(bits: number): string {
  switch (bits) {
    case 2:
      return 'addBool'; // ebool
    case 8:
      return 'add8';
    case 16:
      return 'add16';
    case 32:
      return 'add32';
    case 64:
      return 'add64';
    case 128:
      return 'add128';
    case 160:
      return 'addAddress'; // eaddress
    case 256:
      return 'add256';
    default:
      return 'add32';
  }
}

/**
 * Get parameter description
 */
function getParamDescription(param: ParsedParameter): string {
  if (param.fhevmInfo?.isExternal) {
    return `${param.fhevmInfo.fhevmTypeName} value (will be encrypted)`;
  }
  return `${param.type} value`;
}
