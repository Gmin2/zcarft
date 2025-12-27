// Docs command - Generate GitBook-compatible documentation from contracts
// Automatically detects contracts and generates comprehensive documentation

import { Command, Flags } from '@oclif/core';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { generateDocs } from '@zcraft/docgen';
import type { ContractInput } from '@zcraft/docgen';

export default class Docs extends Command {
  static override description = 'Generate GitBook-compatible documentation from contracts';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output ./docs',
    '<%= config.bin %> <%= command.id %> --network localhost --graphs',
    '<%= config.bin %> <%= command.id %> --contract FHECounter',
  ];

  static override flags = {
    output: Flags.string({
      char: 'o',
      description: 'Output directory for documentation',
      default: './docs',
    }),
    contract: Flags.string({
      char: 'c',
      description: 'Specific contract name to document (otherwise all contracts)',
      required: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network name for usage examples',
      default: 'localhost',
    }),
    graphs: Flags.boolean({
      char: 'g',
      description: 'Generate contract graphs (requires graphviz)',
      default: true,
    }),
    tests: Flags.boolean({
      char: 't',
      description: 'Include test files in documentation',
      default: true,
    }),
    examples: Flags.boolean({
      char: 'e',
      description: 'Include usage examples',
      default: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Docs);

    try {
      // Find project directory
      const projectDir = await this.findProjectDir();

      // Display banner
      this.log('');
      this.log(chalk.green('⚡') + ' ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Generate Documentation'));
      this.log('');

      // Detect contracts
      const spinner = ora('Detecting contracts...').start();
      const contracts = await this.detectContracts(projectDir, flags.contract);

      if (contracts.length === 0) {
        spinner.fail(chalk.red('No contracts found'));
        this.error('No contracts found in artifacts directory. Run `npx hardhat compile` first.');
      }

      spinner.succeed(chalk.green(`Found ${contracts.length} contract${contracts.length !== 1 ? 's' : ''}`));

      // List contracts
      for (const contract of contracts) {
        this.log(chalk.gray(`  - ${contract.name}`));
      }
      this.log('');

      // Generate documentation
      spinner.start('Generating documentation...');

      await generateDocs({
        contracts,
        outputDir: resolve(flags.output),
        includeGraphs: flags.graphs,
        includeTests: flags.tests,
        includeUsageExamples: flags.examples,
        network: flags.network,
        summaryConfig: {
          sections: [
            {
              title: 'Contracts',
              auto: true,
            },
          ],
        },
      });

      spinner.succeed(chalk.green('Documentation generated'));

      // Summary
      this.log('');
      this.log(chalk.green('✨ Done!'));
      this.log('');
      this.log(chalk.gray('Output directory:'));
      this.log(chalk.cyan(`  ${resolve(flags.output)}`));
      this.log('');
      this.log(chalk.gray('Generated files:'));
      this.log(chalk.white('  - SUMMARY.md (GitBook navigation)'));
      this.log(chalk.white('  - contracts/README.md (overview)'));
      for (const contract of contracts) {
        this.log(chalk.white(`  - contracts/${contract.name}.md`));
      }
      if (flags.graphs) {
        this.log(chalk.white('  - .gitbook/assets/graphs/*.svg'));
      }
      this.log('');
    } catch (error) {
      this.error(
        chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
      );
    }
  }

  /**
   * Find project directory (with hardhat.config)
   */
  private async findProjectDir(): Promise<string> {
    let currentDir = process.cwd();

    while (currentDir !== '/') {
      try {
        const files = readdirSync(currentDir);
        const hasHardhatConfig = files.some(
          (f) => f === 'hardhat.config.ts' || f === 'hardhat.config.js'
        );

        if (hasHardhatConfig) {
          return currentDir;
        }
      } catch {
        // Ignore errors and continue
      }

      currentDir = resolve(currentDir, '..');
    }

    // Default to current working directory
    return process.cwd();
  }

  /**
   * Detect contracts from Hardhat artifacts
   */
  private async detectContracts(
    projectDir: string,
    specificContract?: string
  ): Promise<ContractInput[]> {
    const artifactsDir = join(projectDir, 'artifacts', 'contracts');

    if (!existsSync(artifactsDir)) {
      return [];
    }

    const contracts: ContractInput[] = [];

    // Walk through artifacts directory
    const findContracts = (dir: string): void => {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Recursively search subdirectories
          findContracts(fullPath);
        } else if (entry.endsWith('.json') && !entry.includes('.dbg.json')) {
          // Extract contract name from filename
          const contractName = basename(entry, '.json');

          // Skip if specific contract requested and this isn't it
          if (specificContract && contractName !== specificContract) {
            continue;
          }

          // Find corresponding .sol file
          const solFile = entry.replace('.json', '.sol');
          const solPath = join(dirname(fullPath), solFile);

          if (existsSync(solPath)) {
            // Try to find test file
            const testPath = this.findTestFile(projectDir, contractName);

            contracts.push({
              name: contractName,
              abiPath: fullPath,
              solPath,
              testPath,
            });
          }
        }
      }
    };

    findContracts(artifactsDir);

    return contracts;
  }

  /**
   * Find test file for contract
   */
  private findTestFile(projectDir: string, contractName: string): string | undefined {
    const testDir = join(projectDir, 'test');

    if (!existsSync(testDir)) {
      return undefined;
    }

    // Common test file naming patterns
    const patterns = [
      `${contractName}.test.ts`,
      `${contractName}.ts`,
      `${contractName}.test.js`,
      `${contractName}.js`,
      `${contractName.toLowerCase()}.test.ts`,
      `${contractName.toLowerCase()}.ts`,
    ];

    for (const pattern of patterns) {
      const testPath = join(testDir, pattern);
      if (existsSync(testPath)) {
        return testPath;
      }
    }

    return undefined;
  }
}

function dirname(fullPath: string): string {
  return resolve(fullPath, '..');
}
