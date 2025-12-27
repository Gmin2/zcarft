/**
 * GitBook page builder using Handlebars templates
 */

import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ContractDocumentation, GeneratedPage } from '../types.js';
import { registerHelpers } from '../templates/helpers.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let compiledTemplate: HandlebarsTemplateDelegate | null = null;
let compiledFunctionPartial: HandlebarsTemplateDelegate | null = null;

/**
 * Initialize Handlebars templates
 */
async function initializeTemplates(): Promise<void> {
  if (compiledTemplate && compiledFunctionPartial) {
    return;
  }

  // Register helpers
  registerHelpers(Handlebars);

  // Load and compile main template
  const templatePath = join(__dirname, '..', 'templates', 'contract-page.hbs');
  const templateSource = await readFile(templatePath, 'utf-8');
  compiledTemplate = Handlebars.compile(templateSource);

  // Load and compile function section partial
  const functionTemplatePath = join(__dirname, '..', 'templates', 'function-section.hbs');
  const functionTemplateSource = await readFile(functionTemplatePath, 'utf-8');
  compiledFunctionPartial = Handlebars.compile(functionTemplateSource);

  // Register partial
  Handlebars.registerPartial('function-section', compiledFunctionPartial);
}

/**
 * Build contract documentation page
 */
export async function buildContractPage(
  contract: ContractDocumentation,
  includeUsageExamples: boolean = true
): Promise<GeneratedPage> {
  await initializeTemplates();

  if (!compiledTemplate) {
    throw new Error('Template not initialized');
  }

  // Prepare template data
  const data = {
    ...contract,
    contractName: contract.name,
    includeUsageExamples,
  };

  // Render template
  const content = compiledTemplate(data);

  return {
    path: `contracts/${contract.name}.md`,
    content,
  };
}

/**
 * Build contracts overview page (README.md)
 */
export async function buildContractsOverview(
  contracts: ContractDocumentation[]
): Promise<GeneratedPage> {
  let content = '# Contracts Overview\n\n';
  content += 'Documentation for all FHEVM smart contracts in this project.\n\n';

  content += '## Contracts\n\n';
  for (const contract of contracts) {
    const encryptedCount = contract.fhevmTypes.length;
    const fheOpCount = contract.fheOperations.length;

    content += `### [${contract.name}](${contract.name}.md)\n\n`;
    if (contract.description) {
      content += `${contract.description}\n\n`;
    }
    content += `- **FHEVM Types:** ${contract.fhevmTypes.join(', ') || 'None'}\n`;
    content += `- **FHE Operations:** ${fheOpCount} operation${fheOpCount !== 1 ? 's' : ''}\n`;
    content += `- **Functions:** ${contract.functions.length}\n\n`;
  }

  return {
    path: 'contracts/README.md',
    content,
  };
}
