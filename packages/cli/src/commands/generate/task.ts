// Generate command - Generate Hardhat tasks from contract ABIs
// Automatically generates task definitions for FHEVM contracts

import { Command, Flags, Args } from '@oclif/core';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { basename, join, resolve, extname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseContractAbi, generateTasks } from '@zcraft/codegen';
import type { Abi } from 'abitype';
import inquirer from 'inquirer';

/**
 * Helper function to add import statement to hardhat.config file
 */
function addImportToHardhatConfig(
  projectDir: string,
  contractName: string,
  taskFileRelativePath: string
): { success: boolean; message: string } {
  // Try both .ts and .js extensions
  const configFiles = ['hardhat.config.ts', 'hardhat.config.js'];
  let configPath: string | null = null;

  for (const configFile of configFiles) {
    const path = join(projectDir, configFile);
    if (existsSync(path)) {
      configPath = path;
      break;
    }
  }

  if (!configPath) {
    return {
      success: false,
      message: 'hardhat.config.ts or hardhat.config.js not found',
    };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const importStatement = `import "${taskFileRelativePath}";`;

    // Check if import already exists
    if (content.includes(importStatement)) {
      return {
        success: true,
        message: 'Import already exists in config',
      };
    }

    // Find the last import statement and add after it
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      // Add import after the last import statement
      lines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
      // No imports found, add at the beginning
      lines.unshift(importStatement);
    }

    writeFileSync(configPath, lines.join('\n'), 'utf-8');

    return {
      success: true,
      message: `Added import to ${basename(configPath)}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export default class Task extends Command {
  static override description = 'Generate Hardhat tasks from contract ABI (auto-detects contracts if no path provided)';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --contract FHECounter',
    '<%= config.bin %> <%= command.id %> ./FHECounter.abi.json',
    '<%= config.bin %> <%= command.id %> ./artifacts/contracts/MyContract.sol/MyContract.json',
    '<%= config.bin %> <%= command.id %> --output ./custom-tasks',
  ];

  static override args = {
    abiPath: Args.string({
      description: 'Path to contract ABI file (optional - auto-detects if not provided)',
      required: false,
    }),
  };

  static override flags = {
    contract: Flags.string({
      char: 'c',
      description: 'Specific contract name to generate tasks for (when auto-detecting)',
      required: false,
    }),
    name: Flags.string({
      char: 'n',
      description: 'Contract name (defaults to filename without extension)',
      required: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory (defaults to ./tasks)',
      required: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Generate tasks for all detected contracts',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Task);

    try {
      // Display banner
      this.log('');
      this.log(chalk.green('⚡') + ' ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Generate Tasks'));
      this.log('');

      // Auto-detect or manual path
      if (!args.abiPath) {
        await this.runAutoDetect(flags);
        return;
      }

      // Manual path mode
      const abiPath = resolve(args.abiPath);

      // Determine contract name
      let contractName = flags.name;
      if (!contractName) {
        const filename = basename(abiPath);
        contractName = filename.replace(/\.(abi\.)?json$/i, '');
      }

      this.log(chalk.gray(`Contract: ${contractName}`));
      this.log('');

      // Read ABI file
      const spinner = ora('Reading ABI file...').start();
      let abi: Abi;
      try {
        const content = readFileSync(abiPath, 'utf-8');
        const parsed = JSON.parse(content);

        // Handle both raw ABI arrays and Hardhat artifact format
        if (Array.isArray(parsed)) {
          abi = parsed;
        } else if (parsed.abi && Array.isArray(parsed.abi)) {
          abi = parsed.abi;
        } else {
          throw new Error('Invalid ABI format. Expected array or object with "abi" field.');
        }

        spinner.succeed(chalk.green('ABI file loaded'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to read ABI file'));
        this.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
        );
      }

      // Parse ABI
      spinner.start('Parsing contract ABI...');
      let functions;
      try {
        functions = parseContractAbi(abi);
        spinner.succeed(
          chalk.green(`Parsed ${functions.length} function${functions.length !== 1 ? 's' : ''}`)
        );
      } catch (error) {
        spinner.fail(chalk.red('Failed to parse ABI'));
        this.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
        );
      }

      // Generate tasks code
      spinner.start('Generating Hardhat tasks...');
      let code: string;
      try {
        code = generateTasks(contractName, functions);
        spinner.succeed(chalk.green('Hardhat tasks generated'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to generate tasks'));
        this.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
        );
      }

      // Determine output directory (default to tasks/)
      const projectDir = process.cwd();
      const outputDir = flags.output ? resolve(flags.output) : join(projectDir, 'tasks');

      // Create output directory if it doesn't exist
      spinner.start('Creating output directory...');
      try {
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
          spinner.succeed(chalk.green(`Created directory: ${outputDir}`));
        } else {
          spinner.succeed(chalk.green('Output directory exists'));
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to create output directory'));
        this.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
        );
      }

      // Write output file
      const outputPath = join(outputDir, `${contractName}.tasks.ts`);

      spinner.start(`Writing to ${outputPath}...`);
      try {
        writeFileSync(outputPath, code, 'utf-8');
        spinner.succeed(chalk.green(`Tasks written to ${outputPath}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to write output file'));
        this.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
        );
      }

      // Add import to hardhat.config.ts
      spinner.start('Updating hardhat.config...');
      const taskFileRelativePath = `./tasks/${contractName}.tasks`;
      const configResult = addImportToHardhatConfig(
        projectDir,
        contractName,
        taskFileRelativePath
      );

      if (configResult.success) {
        spinner.succeed(chalk.green(configResult.message));
      } else {
        spinner.warn(chalk.yellow(configResult.message));
      }

      // Summary
      this.log('');
      this.log(chalk.green('✨ Done!'));
      this.log('');

      // Show usage examples
      this.log(chalk.gray('Usage:'));
      this.log(chalk.white(`  Interactive REPL:`));
      this.log(chalk.cyan(`    zcraft call --network localhost`));
      this.log('');
      this.log(chalk.white(`  Direct task execution:`));

      if (functions.length > 0) {
        // Show example for first function with external inputs (if any)
        const fnWithInputs = functions.find(f =>
          f.inputs.some(input => input.fhevmInfo?.isExternal)
        );
        if (fnWithInputs) {
          const exampleParam = fnWithInputs.inputs.find(input => input.fhevmInfo?.isExternal);
          if (exampleParam) {
            const paramName = (exampleParam.name || 'value').toLowerCase();
            this.log(chalk.cyan(
              `    npx hardhat ${contractName.toLowerCase()}:${fnWithInputs.name} --${paramName} 5 --network localhost`
            ));
          }
        }

        // Show example for decrypt task (if any encrypted output exists)
        const fnWithEncryptedOutput = functions.find(f =>
          (f.stateMutability === 'view' || f.stateMutability === 'pure') &&
          f.outputs.some(output => output.fhevmInfo && !output.fhevmInfo.isExternal)
        );
        if (fnWithEncryptedOutput) {
          this.log(chalk.cyan(
            `    npx hardhat ${contractName.toLowerCase()}:decrypt-${fnWithEncryptedOutput.name} --network localhost`
          ));
        }
      }

      this.log('');
    } catch (error) {
      this.error(
        chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`)
      );
    }
  }

  /**
   * Auto-detect contracts and generate tasks
   */
  private async runAutoDetect(flags: any): Promise<void> {
    const projectDir = await this.findProjectDir();

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

    // Determine which contracts to process
    let contractsToProcess = contracts;

    if (!flags.all && !flags.contract && contracts.length > 1) {
      // Interactive selection
      const { selectedContracts } = await inquirer.prompt<{ selectedContracts: string[] }>([
        {
          type: 'checkbox',
          name: 'selectedContracts',
          message: 'Select contracts to generate tasks for:',
          choices: contracts.map(c => ({ name: c.name, value: c.name, checked: true })),
        },
      ]);

      contractsToProcess = contracts.filter(c => selectedContracts.includes(c.name));
    }

    if (contractsToProcess.length === 0) {
      this.log(chalk.yellow('No contracts selected'));
      return;
    }

    // Generate tasks for each contract
    for (const contract of contractsToProcess) {
      this.log(chalk.cyan(`\nGenerating tasks for ${contract.name}...`));
      await this.generateTasksForContract(contract.abiPath, contract.name, flags.output);
    }

    this.log('');
    this.log(chalk.green('✨ All tasks generated!'));
    this.log('');
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
  ): Promise<Array<{ name: string; abiPath: string }>> {
    const artifactsDir = join(projectDir, 'artifacts', 'contracts');

    if (!existsSync(artifactsDir)) {
      return [];
    }

    const contracts: Array<{ name: string; abiPath: string }> = [];

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

          contracts.push({
            name: contractName,
            abiPath: fullPath,
          });
        }
      }
    };

    findContracts(artifactsDir);

    return contracts;
  }

  /**
   * Generate tasks for a single contract
   */
  private async generateTasksForContract(
    abiPath: string,
    contractName: string,
    outputDirFlag?: string
  ): Promise<void> {
    // Read ABI file
    let abi: Abi;
    try {
      const content = readFileSync(abiPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle both raw ABI arrays and Hardhat artifact format
      if (Array.isArray(parsed)) {
        abi = parsed;
      } else if (parsed.abi && Array.isArray(parsed.abi)) {
        abi = parsed.abi;
      } else {
        throw new Error('Invalid ABI format');
      }
    } catch (error) {
      this.log(chalk.red(`  ✗ Failed to read ABI: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    // Parse ABI
    let functions;
    try {
      functions = parseContractAbi(abi);
      this.log(chalk.gray(`  Parsed ${functions.length} function${functions.length !== 1 ? 's' : ''}`));
    } catch (error) {
      this.log(chalk.red(`  ✗ Failed to parse ABI: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    // Generate tasks code
    let code: string;
    try {
      code = generateTasks(contractName, functions);
    } catch (error) {
      this.log(chalk.red(`  ✗ Failed to generate tasks: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    // Determine output directory
    const projectDir = process.cwd();
    const outputDir = outputDirFlag ? resolve(outputDirFlag) : join(projectDir, 'tasks');

    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    const outputPath = join(outputDir, `${contractName}.tasks.ts`);
    try {
      writeFileSync(outputPath, code, 'utf-8');
      this.log(chalk.green(`  ✓ Tasks written to ${outputPath}`));
    } catch (error) {
      this.log(chalk.red(`  ✗ Failed to write file: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    // Add import to hardhat.config.ts
    const taskFileRelativePath = `./tasks/${contractName}.tasks`;
    const configResult = addImportToHardhatConfig(
      projectDir,
      contractName,
      taskFileRelativePath
    );

    if (configResult.success) {
      this.log(chalk.green(`  ✓ ${configResult.message}`));
    } else {
      this.log(chalk.yellow(`  ⚠ ${configResult.message}`));
    }
  }
}
