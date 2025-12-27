/**
 * Handlebars template helpers
 */

import type { ParsedFunction } from '@zcraft/codegen';

/**
 * Check if function is a view function
 */
export function isView(func: ParsedFunction): boolean {
  return func.stateMutability === 'view';
}

/**
 * Check if function is a pure function
 */
export function isPure(func: ParsedFunction): boolean {
  return func.stateMutability === 'pure';
}

/**
 * Check if function has encrypted inputs
 */
export function hasEncryptedInput(func: ParsedFunction): boolean {
  return func.inputs.some((input) => input.fhevmInfo?.isExternal);
}

/**
 * Check if function has encrypted outputs
 */
export function hasEncryptedOutput(func: ParsedFunction): boolean {
  return func.outputs.some((output) => output.fhevmInfo && !output.fhevmInfo.isExternal);
}

/**
 * Get FHEVM icon for function (🔐 for encrypted inputs, 🔒 for encrypted outputs)
 */
export function fhevmIcon(func: ParsedFunction): string {
  if (hasEncryptedInput(func)) {
    return '🔐';
  }
  if (hasEncryptedOutput(func)) {
    return '🔒';
  }
  return '';
}

/**
 * Convert string to lowercase
 */
export function toLowerCase(str: string): string {
  return str.toLowerCase();
}

/**
 * Greater than comparison
 */
export function gt(a: number, b: number): boolean {
  return a > b;
}

/**
 * Equality comparison
 */
export function eq(a: any, b: any): boolean {
  return a === b;
}

/**
 * Logical OR
 */
export function or(...args: any[]): boolean {
  // Last argument is Handlebars options object
  const values = args.slice(0, -1);
  return values.some((v) => !!v);
}

/**
 * Register all helpers with Handlebars
 */
export function registerHelpers(handlebars: any): void {
  handlebars.registerHelper('isView', isView);
  handlebars.registerHelper('isPure', isPure);
  handlebars.registerHelper('hasEncryptedInput', hasEncryptedInput);
  handlebars.registerHelper('hasEncryptedOutput', hasEncryptedOutput);
  handlebars.registerHelper('fhevmIcon', fhevmIcon);
  handlebars.registerHelper('toLowerCase', toLowerCase);
  handlebars.registerHelper('gt', gt);
  handlebars.registerHelper('eq', eq);
  handlebars.registerHelper('or', or);
}
