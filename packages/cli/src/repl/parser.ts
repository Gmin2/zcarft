// Command parser for FHEVM REPL
// Parses user input into structured commands

export type CommandType =
  | 'function_call'
  | 'decrypt'
  | 'encrypt'
  | 'signer'
  | 'signers'
  | 'functions'
  | 'info'
  | 'fhe'
  | 'history'
  | 'replay'
  | 'network'
  | 'mode'
  | 'help'
  | 'clear'
  | 'exit'
  | 'estimate'
  | 'watch'
  | 'batch';

export interface ParsedCommand {
  type: CommandType;
  functionName?: string;
  args?: any[];
  expression?: string;
  command?: string;
  index?: number;
  options?: Record<string, any>;
}

/**
 * Parse user input into a structured command
 * @param input Raw user input string
 * @returns Parsed command object
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Empty command');
  }

  // Handle special commands
  if (trimmed === 'help') return { type: 'help' };
  if (trimmed === 'exit' || trimmed === 'quit') return { type: 'exit' };
  if (trimmed === 'clear' || trimmed === 'cls') return { type: 'clear' };
  if (trimmed === 'functions') return { type: 'functions' };
  if (trimmed === 'signers') return { type: 'signers' };
  if (trimmed === 'info') return { type: 'info' };
  if (trimmed === 'fhe') return { type: 'fhe' };
  if (trimmed === 'history') return { type: 'history' };
  if (trimmed === 'network') return { type: 'network' };
  if (trimmed === 'mode') return { type: 'mode' };

  // Handle help with specific command
  if (trimmed.startsWith('help ')) {
    const command = trimmed.substring(5).trim();
    return { type: 'help', command };
  }

  // Handle history clear
  if (trimmed === 'history clear') {
    return { type: 'history', options: { clear: true } };
  }

  // Handle signer switching: signer(0) or signer("0xPrivateKey")
  const signerMatch = trimmed.match(/^signer\s*\(\s*(.+?)\s*\)$/);
  if (signerMatch) {
    const indexOrKey = signerMatch[1];
    // Check if it's a number or a string (private key)
    const isNumber = /^\d+$/.test(indexOrKey);
    return {
      type: 'signer',
      index: isNumber ? parseInt(indexOrKey) : undefined,
      options: isNumber ? undefined : { privateKey: parseValue(indexOrKey) },
    };
  }

  // Handle decrypt: decrypt(getCount()) or decrypt(0xhandle...)
  const decryptMatch = trimmed.match(/^decrypt\s*\(\s*(.+?)\s*\)$/);
  if (decryptMatch) {
    return {
      type: 'decrypt',
      expression: decryptMatch[1],
    };
  }

  // Handle encrypt: encrypt(5)
  const encryptMatch = trimmed.match(/^encrypt\s*\(\s*(.+?)\s*\)$/);
  if (encryptMatch) {
    return {
      type: 'encrypt',
      expression: encryptMatch[1],
    };
  }

  // Handle replay: replay(1)
  const replayMatch = trimmed.match(/^replay\s*\(\s*(\d+)\s*\)$/);
  if (replayMatch) {
    return {
      type: 'replay',
      index: parseInt(replayMatch[1]),
    };
  }

  // Handle estimate: estimate(increment(5))
  const estimateMatch = trimmed.match(/^estimate\s*\(\s*(.+?)\s*\)$/);
  if (estimateMatch) {
    const innerCommand = parseCommand(estimateMatch[1]);
    return {
      type: 'estimate',
      options: { command: innerCommand },
    };
  }

  // Handle watch: watch getCount() or watch decrypt(getCount())
  const watchMatch = trimmed.match(/^watch\s+(.+)$/);
  if (watchMatch) {
    return {
      type: 'watch',
      expression: watchMatch[1],
    };
  }

  // Handle batch: batch { increment(1), increment(2) }
  const batchMatch = trimmed.match(/^batch\s*\{(.+)\}$/);
  if (batchMatch) {
    const commands = batchMatch[1]
      .split(',')
      .map((cmd) => parseCommand(cmd.trim()));
    return {
      type: 'batch',
      options: { commands },
    };
  }

  // Handle function calls: functionName(arg1, arg2, ...)
  const functionMatch = trimmed.match(/^(\w+)\s*\(\s*(.*?)\s*\)$/);
  if (functionMatch) {
    const [, functionName, argsStr] = functionMatch;
    const args = parseArguments(argsStr);

    return {
      type: 'function_call',
      functionName,
      args,
    };
  }

  throw new Error(`Unknown command: ${trimmed}`);
}

/**
 * Parse function arguments from a comma-separated string
 * Handles: numbers, strings, booleans, addresses, encrypt() calls
 * @param argsStr Arguments string from function call
 * @returns Array of parsed argument values
 */
function parseArguments(argsStr: string): any[] {
  if (!argsStr.trim()) return [];

  // Split by commas (handle nested parens)
  const args = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    const prevChar = i > 0 ? argsStr[i - 1] : '';

    // Track string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Track parenthesis depth (only outside strings)
    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }

    // Split on comma only at depth 0 and outside strings
    if (char === ',' && depth === 0 && !inString) {
      args.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }

  // Add last argument
  if (current.trim()) {
    args.push(parseValue(current.trim()));
  }

  return args;
}

/**
 * Parse a single argument value
 * Supports: numbers, hex values, strings, booleans, encrypt() wrapper
 * @param value String representation of the value
 * @returns Parsed value
 */
function parseValue(value: string): any {
  value = value.trim();

  // Handle encrypt() wrapper: encrypt(5) -> 5 (will be encrypted later)
  const encryptMatch = value.match(/^encrypt\s*\(\s*(.+?)\s*\)$/);
  if (encryptMatch) {
    return {
      __encrypted: true,
      value: parseValue(encryptMatch[1]),
    };
  }

  // Number (integer or float)
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.includes('.') ? parseFloat(value) : parseInt(value);
  }

  // Hex value (address or bytes)
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return value;
  }

  // String (with quotes)
  if (/^["'].*["']$/.test(value)) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null/undefined
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;

  // If we can't parse it, return as string
  return value;
}

/**
 * Check if a value was explicitly marked for encryption with encrypt()
 * @param value The parsed value
 * @returns True if value should be encrypted
 */
export function shouldEncrypt(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__encrypted' in value &&
    value.__encrypted === true
  );
}

/**
 * Extract the actual value from an encrypt() wrapper
 * @param value The parsed value
 * @returns The unwrapped value
 */
export function unwrapEncrypted(value: any): any {
  if (shouldEncrypt(value)) {
    return value.value;
  }
  return value;
}
