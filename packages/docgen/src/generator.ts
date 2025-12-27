/**
 * Main documentation generator
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { parseContractAbi } from '@zcraft/codegen';
import type { Abi } from 'abitype';
import type { DocGenConfig, ContractDocumentation, ContractInput } from './types.js';
import { buildSummary } from './gitbook/summary-builder.js';
import { buildContractPage, buildContractsOverview } from './gitbook/page-builder.js';
import { initializeAssetDirectories, saveGraph } from './gitbook/asset-manager.js';
import {
  generateCallGraphSvg,
  generateInheritanceGraphSvg,
} from './graphs/surya-wrapper.js';
import {
  extractFhevmTypes,
  analyzeFheOperations,
} from './parsers/contract-analyzer.js';

/**
 * Generate GitBook-compatible documentation
 */
export async function generateDocs(config: DocGenConfig): Promise<void> {
  // Initialize output directories
  await mkdir(join(config.outputDir, 'contracts'), { recursive: true });

  if (config.includeGraphs) {
    await initializeAssetDirectories(config.outputDir);
  }

  // Process each contract
  const contractDocs: ContractDocumentation[] = [];

  for (const contract of config.contracts) {
    const contractDoc = await processContract(contract, config);
    contractDocs.push(contractDoc);

    // Generate contract page
    const page = await buildContractPage(contractDoc, config.includeUsageExamples);
    const pagePath = join(config.outputDir, page.path);

    await writeFile(pagePath, page.content, 'utf-8');
  }

  // Generate contracts overview page
  const overviewPage = await buildContractsOverview(contractDocs);
  const overviewPath = join(config.outputDir, overviewPage.path);
  await writeFile(overviewPath, overviewPage.content, 'utf-8');

  // Generate SUMMARY.md
  if (config.summaryConfig) {
    const summaryContent = buildSummary(config.summaryConfig.sections, config.contracts);
    const summaryPath = join(config.outputDir, 'SUMMARY.md');
    await writeFile(summaryPath, summaryContent, 'utf-8');
  }
}

/**
 * Process a single contract
 */
async function processContract(
  contract: ContractInput,
  config: DocGenConfig
): Promise<ContractDocumentation> {
  // Load and parse ABI
  const abiContent = await readFile(contract.abiPath, 'utf-8');
  const parsed = JSON.parse(abiContent);

  const abi: Abi = Array.isArray(parsed) ? parsed : parsed.abi;
  const functions = parseContractAbi(abi);

  // Extract FHEVM information
  const fhevmTypes = extractFhevmTypes(functions);
  const fheOperations = await analyzeFheOperations(contract.solPath);

  // Load source code
  const solidityCode = await readFile(contract.solPath, 'utf-8').catch(() => undefined);

  // Load test code if available
  let testCode: string | undefined;
  if (config.includeTests && contract.testPath) {
    testCode = await readFile(contract.testPath, 'utf-8').catch(() => undefined);
  }

  // Generate graphs if enabled
  let graphs: ContractDocumentation['graphs'];
  if (config.includeGraphs) {
    try {
      // Generate call graph
      const callGraphSvg = await generateCallGraphSvg(contract.solPath);
      const callGraphPath = await saveGraph(
        config.outputDir,
        contract.name,
        'call-graph',
        callGraphSvg,
        'svg'
      );

      // Generate inheritance graph
      const inheritanceGraphSvg = await generateInheritanceGraphSvg(contract.solPath);
      const inheritancePath = await saveGraph(
        config.outputDir,
        contract.name,
        'inheritance',
        inheritanceGraphSvg,
        'svg'
      );

      graphs = {
        callGraph: callGraphPath,
        inheritance: inheritancePath,
      };
    } catch (error) {
      // If graph generation fails, continue without graphs
      console.warn(`Warning: Failed to generate graphs for ${contract.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    name: contract.name,
    address: contract.address,
    network: config.network,
    functions,
    fhevmTypes,
    fheOperations,
    solidityCode,
    testCode,
    graphs,
  };
}
