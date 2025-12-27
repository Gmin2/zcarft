/**
 * TypeScript declarations for surya package
 */

declare module 'surya' {
  export interface SuryaOptions {
    importer?: boolean;
    libraries?: boolean;
    enableModifierEdges?: boolean;
    contentsInFilePath?: boolean;
    jsonOutput?: boolean;
    deepness?: number;
    negModifiers?: boolean;
  }

  export function graph(files: string[], options?: SuryaOptions): string;
  export function inheritance(files: string[], options?: SuryaOptions): string;
  export function ftrace(
    functionIdentifier: string,
    visibility: 'all' | 'internal' | 'external',
    files: string[],
    options?: SuryaOptions
  ): string;
  export function describe(files: string[], options?: SuryaOptions): void;
  export function dependencies(
    files: string[],
    contractName: string,
    options?: SuryaOptions
  ): string[];
  export function parse(file: string, options?: SuryaOptions): any;
  export function mdreport(files: string[], options?: SuryaOptions): string;
  export function flatten(files: string[]): string;
}
