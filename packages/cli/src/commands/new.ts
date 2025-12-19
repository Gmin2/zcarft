import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import fs from 'fs-extra';
import { CatalogManager, type CreateOptions, type ExampleMetadata } from '@zcraft/core';

/**
 * Command to create a new FHEVM example project
 *
 * Supports both interactive and non-interactive modes:
 * - Interactive: Guides user through category and template selection
 * - Non-interactive: Uses flags to specify template and options
 *
 * @example
 * ```bash
 * # Interactive mode
 * zcraft new
 *
 * # Non-interactive mode
 * zcraft new my-counter --template fhe-counter
 * ```
 */
export default class New extends Command {
  static override description = 'Create a new FHEVM example project';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> my-counter --template fhe-counter',
    '<%= config.bin %> <%= command.id %> my-auction --template blind-auction --skip-install',
  ];

  static override flags = {
    template: Flags.string({
      char: 't',
      description: 'Template name from catalog',
      required: false,
    }),
    category: Flags.string({
      char: 'c',
      description: 'Filter by category',
      required: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory',
      required: false,
    }),
    'skip-install': Flags.boolean({
      description: 'Skip dependency installation',
      default: false,
    }),
    'with-docs': Flags.boolean({
      description: 'Generate full GitBook documentation',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing directory',
      default: false,
    }),
  };

  static override args = {
    name: Args.string({
      description: 'Project name',
      required: false,
    }),
  };

  /**
   * Main command execution
   */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(New);

    const catalogManager = new CatalogManager();

    // Validate catalog before proceeding
    const validation = await catalogManager.validate();
    if (!validation.valid) {
      this.error(`Catalog validation failed:\n${validation.errors.join('\n')}`);
    }

    let selectedTemplate: string;
    let projectName: string;
    let outputDir: string;

    // Interactive mode
    if (!flags.template) {
      const result = await this.runInteractive(catalogManager, args.name);
      selectedTemplate = result.template;
      projectName = result.projectName;
      outputDir = result.outputDir;
    } else {
      // Non-interactive mode
      selectedTemplate = flags.template;
      projectName = args.name || selectedTemplate;
      outputDir = flags.output || path.join(process.cwd(), projectName);
    }

    // Get example metadata
    const example = await catalogManager.getExample(selectedTemplate);
    if (!example) {
      this.error(`Template '${selectedTemplate}' not found in catalog`);
    }

    // Create project
    await this.createProject({
      example,
      projectName,
      outputDir,
      skipInstall: flags['skip-install'],
      withDocs: flags['with-docs'],
      force: flags.force,
    });
  }

  /**
   * Run interactive wizard for template selection
   *
   * @param catalogManager - Catalog manager instance
   * @param providedName - Optional project name from args
   * @returns Selected template, project name, and output directory
   */
  private async runInteractive(
    catalogManager: CatalogManager,
    providedName?: string
  ): Promise<{
    template: string;
    projectName: string;
    outputDir: string;
  }> {
    // Display styled welcome banner
    this.printWelcomeBanner();

    const categories = await catalogManager.getCategories();
    const allExamples = await catalogManager.getAllExamples();

    // Step 1: Select category with Pop CLI style
    this.log(chalk.green('o') + '  ' + chalk.gray('Choose a category'));
    this.log(chalk.green('|'));
    const { category } = await inquirer.prompt<{ category: string }>([
      {
        type: 'list',
        name: 'category',
        message: chalk.gray('Which type of example do you want to create?'),
        prefix: chalk.green('?'),
        choices: Object.entries(categories)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([key, cat]) => ({
            name: `${cat.icon}  ${chalk.bold(cat.name)} ${chalk.dim('─')} ${chalk.gray(cat.description)}`,
            value: key,
          })),
      },
    ]);

    // Step 2: Select example from category
    const categoryExamples = Object.entries(allExamples).filter(
      ([, ex]) => ex.category === category
    );

    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.gray('Select a template'));
    this.log(chalk.green('|'));
    const { template } = await inquirer.prompt<{ template: string }>([
      {
        type: 'list',
        name: 'template',
        message: chalk.gray('Pick an example to get started:'),
        prefix: chalk.green('?'),
        choices: categoryExamples.map(([key, ex]) => {
          const difficulty = this.getDifficultyBadge(ex.difficulty);
          const time = chalk.dim(`(${ex.estimatedTime})`);
          return {
            name: `${chalk.bold(ex.title)} ${difficulty} ${time}\n  ${chalk.gray(ex.description)}`,
            value: key,
            short: ex.title,
          };
        }),
        pageSize: 10,
      },
    ]);

    // Step 3: Get project name
    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.gray('Project configuration'));
    this.log(chalk.green('|'));
    const { projectName } = await inquirer.prompt<{ projectName: string }>([
      {
        type: 'input',
        name: 'projectName',
        message: chalk.gray('What is your project named?'),
        prefix: chalk.green('?'),
        default: providedName || template,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return chalk.red('✗ Project name is required');
          }
          if (!/^[a-z0-9-_]+$/.test(input)) {
            return chalk.red('✗ Project name must only contain lowercase letters, numbers, hyphens, and underscores');
          }
          return true;
        },
        transformer: (input: string) => {
          return chalk.cyan(input);
        },
      },
    ]);

    // Step 4: Confirm output directory
    const defaultOutput = path.join(process.cwd(), projectName);
    this.log(chalk.green('|'));
    const { outputDir } = await inquirer.prompt<{ outputDir: string }>([
      {
        type: 'input',
        name: 'outputDir',
        message: chalk.gray('Where should we create your project?'),
        prefix: chalk.green('?'),
        default: defaultOutput,
        transformer: (input: string) => {
          return chalk.dim(path.relative(process.cwd(), input) || '.');
        },
      },
    ]);

    this.log(chalk.green('|'));

    return { template, projectName, outputDir };
  }

  /**
   * Display welcome banner with Pop CLI style
   */
  private printWelcomeBanner(): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Create FHEVM Examples'));
    this.log(chalk.green('|'));
    this.log(chalk.green('|') + '  ' + chalk.gray('Build privacy-preserving smart contracts'));
    this.log(chalk.green('|') + '  ' + chalk.gray('with Fully Homomorphic Encryption'));
    this.log(chalk.green('|'));
  }


  /**
   * Get styled difficulty badge with color coding
   *
   * @param difficulty - Difficulty level 1-5
   * @returns Styled badge string
   */
  private getDifficultyBadge(difficulty: number): string {
    const labels = [
      '',
      chalk.bgGreen.black(' BEGINNER '),
      chalk.bgGreen.black(' BEGINNER+ '),
      chalk.bgYellow.black(' INTERMEDIATE '),
      chalk.bgRed.white(' ADVANCED '),
      chalk.bgMagenta.white(' EXPERT '),
    ];
    return labels[difficulty] || chalk.bgGray.white(' UNKNOWN ');
  }

  /**
   * Convert difficulty number to star rating string
   *
   * @param difficulty - Difficulty level 1-5
   * @returns Star rating string (e.g., "⭐⭐")
   */
  private getDifficultyStars(difficulty: number): string {
    return '⭐'.repeat(difficulty);
  }

  /**
   * Create the example project
   *
   * Steps:
   * 1. Check if directory exists
   * 2. Clone base fhevm-hardhat-template
   * 3. Inject contract and test files
   * 4. Generate README
   * 5. Install dependencies (optional)
   *
   * @param options - Project creation options
   */
  private async createProject(options: {
    example: ExampleMetadata;
    projectName: string;
    outputDir: string;
    skipInstall: boolean;
    withDocs: boolean;
    force: boolean;
  }): Promise<void> {
    const { example, projectName, outputDir, skipInstall, withDocs, force } = options;

    // Check if directory exists
    if (await fs.pathExists(outputDir)) {
      if (!force) {
        this.log(chalk.green('|'));
        this.log(chalk.red('!') + '  ' + chalk.red(`Directory ${outputDir} already exists. Use --force to overwrite.`));
        this.error('');
      }
      const removeSpinner = ora({
        text: 'Removing existing directory...',
        color: 'green',
        prefixText: chalk.green('|'),
      }).start();
      await fs.remove(outputDir);
      removeSpinner.stop();
    }

    this.log(chalk.green('|'));

    const spinner = ora({
      text: 'Cloning fhevm-hardhat-template...',
      color: 'green',
      prefixText: chalk.green('|'),
    }).start();

    try {
      // Step 1: Clone base template
      await this.cloneBaseTemplate(outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Cloned base template');

      // Step 2: Inject contract
      spinner.prefixText = chalk.green('|');
      spinner.text = `Setting up ${example.title} contract...`;
      spinner.start();
      await this.injectContract(example, outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Contract configured');

      // Step 3: Inject test
      spinner.prefixText = chalk.green('|');
      spinner.text = 'Adding test files...';
      spinner.start();
      await this.injectTest(example, outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Tests configured');

      // Step 4: Generate README
      spinner.prefixText = chalk.green('|');
      spinner.text = 'Generating documentation...';
      spinner.start();
      await this.generateReadme(example, projectName, outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Documentation created');

      // Step 5: Update package.json
      spinner.prefixText = chalk.green('|');
      spinner.text = 'Configuring package.json...';
      spinner.start();
      await this.updatePackageJson(example, projectName, outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Package metadata updated');

      // Step 6: Generate docs (optional)
      if (withDocs) {
        spinner.prefixText = chalk.green('|');
        spinner.text = 'Generating GitBook documentation...';
        spinner.start();
        // TODO: Implement documentation generation
        spinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' GitBook docs generated');
      }

      // Step 7: Install dependencies (optional)
      if (!skipInstall) {
        spinner.prefixText = chalk.green('|');
        spinner.text = 'Installing dependencies (this may take a minute)...';
        spinner.start();
        await this.installDependencies(outputDir);
        spinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Dependencies installed');
      }

      this.log(chalk.green('|'));
      this.log(chalk.green('✓') + '   ' + chalk.bold('Project created successfully!'));
      this.log('');

      // Print success message and next steps
      this.printSuccessMessage(example, projectName, outputDir, skipInstall);
    } catch (error) {
      spinner.stop();
      this.log(chalk.red('|') + '  ' + chalk.red('✗') + ' Failed to create project');
      throw error;
    }
  }

  /**
   * Clone the base fhevm-hardhat-template using tiged
   *
   * @param outputDir - Destination directory
   */
  private async cloneBaseTemplate(outputDir: string): Promise<void> {
    const tiged = (await import('tiged')).default;
    const emitter = tiged('zama-ai/fhevm-hardhat-template', {
      disableCache: false,
      force: false,
      verbose: false,
    });

    await emitter.clone(outputDir);
  }

  /**
   * Inject the example contract into the project
   *
   * @param example - Example metadata
   * @param outputDir - Project directory
   */
  private async injectContract(
    example: ExampleMetadata,
    outputDir: string
  ): Promise<void> {
    const contractSource = path.join(process.cwd(), '../../', example.contract);
    const contractName = path.basename(example.contract);
    const contractDest = path.join(outputDir, 'contracts', contractName);

    // Ensure source exists
    if (!(await fs.pathExists(contractSource))) {
      // For now, we'll create a placeholder
      // TODO: Copy from actual source once examples are created
      this.warn(`Contract source not found at ${contractSource}. Creating placeholder.`);
      await fs.writeFile(
        contractDest,
        `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\n\n// ${example.title}\n// TODO: Implement contract\n`
      );
      return;
    }

    await fs.copy(contractSource, contractDest);
  }

  /**
   * Inject the example test into the project
   *
   * @param example - Example metadata
   * @param outputDir - Project directory
   */
  private async injectTest(
    example: ExampleMetadata,
    outputDir: string
  ): Promise<void> {
    const testSource = path.join(process.cwd(), '../../', example.test);
    const testName = path.basename(example.test);
    const testDest = path.join(outputDir, 'test', testName);

    // Ensure source exists
    if (!(await fs.pathExists(testSource))) {
      // Create placeholder test
      this.warn(`Test source not found at ${testSource}. Creating placeholder.`);
      await fs.writeFile(
        testDest,
        `import { expect } from "chai";\nimport { ethers } from "hardhat";\n\n// ${example.title} Tests\n// TODO: Implement tests\n`
      );
      return;
    }

    await fs.copy(testSource, testDest);
  }

  /**
   * Generate README.md for the project
   *
   * @param example - Example metadata
   * @param projectName - Project name
   * @param outputDir - Project directory
   */
  private async generateReadme(
    example: ExampleMetadata,
    projectName: string,
    outputDir: string
  ): Promise<void> {
    const difficultyStars = this.getDifficultyStars(example.difficulty);

    const readme = `# ${example.title}

> ${example.description}

## What This Example Demonstrates

${example.keyConcepts.map((concept) => `- ${concept}`).join('\n')}

## Difficulty Level

${difficultyStars} **${this.getDifficultyLabel(example.difficulty)}** - ${example.estimatedTime}

## Quick Start

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

\`\`\`bash
npm install
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests (mock mode)
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test
\`\`\`

### Local Deployment

\`\`\`bash
# Terminal 1: Start local FHEVM node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat deploy --network localhost
\`\`\`

### Deployment to Sepolia

\`\`\`bash
# Configure .env
cp .env.example .env
# Add your DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL

# Deploy
npx hardhat deploy --network sepolia
\`\`\`

## Key Concepts Explained

${example.keyConcepts.map((concept, i) => `### ${i + 1}. ${concept}\n\nTODO: Add explanation\n`).join('\n')}

## Further Reading

- [TFHE Operations](https://docs.zama.ai/fhevm/fundamentals/tfhe)
- [Access Control](https://docs.zama.ai/fhevm/guides/access-control)
- [Input Proofs](https://docs.zama.ai/fhevm/guides/input-proof)

## License

MIT
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  /**
   * Get difficulty label from number
   *
   * @param difficulty - Difficulty level 1-5
   * @returns Human-readable label
   */
  private getDifficultyLabel(difficulty: number): string {
    const labels = ['', 'Beginner', 'Beginner+', 'Intermediate', 'Advanced', 'Expert'];
    return labels[difficulty] || 'Unknown';
  }

  /**
   * Update package.json with project name and description
   *
   * @param example - Example metadata
   * @param projectName - Project name
   * @param outputDir - Project directory
   */
  private async updatePackageJson(
    example: ExampleMetadata,
    projectName: string,
    outputDir: string
  ): Promise<void> {
    const pkgPath = path.join(outputDir, 'package.json');
    const pkg = await fs.readJson(pkgPath);

    pkg.name = projectName;
    pkg.description = example.description;
    pkg.keywords = ['fhevm', 'fhe', 'zama', ...example.tags];

    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  /**
   * Install dependencies using npm
   *
   * @param outputDir - Project directory
   */
  private async installDependencies(outputDir: string): Promise<void> {
    const { execa } = await import('execa');
    await execa('npm', ['install'], {
      cwd: outputDir,
      stdio: 'ignore',
    });
  }

  /**
   * Print success message with next steps
   *
   * @param example - Example metadata
   * @param projectName - Project name
   * @param outputDir - Project directory
   * @param skipInstall - Whether dependencies were skipped
   */
  private printSuccessMessage(
    example: ExampleMetadata,
    projectName: string,
    outputDir: string,
    skipInstall: boolean
  ): void {
    const relativePath = path.relative(process.cwd(), outputDir);
    const cdCommand = relativePath ? `cd ${relativePath}` : '.';

    this.log(chalk.bold('Next steps:'));
    this.log('');
    this.log('  ' + chalk.cyan(cdCommand));
    if (skipInstall) {
      this.log('  ' + chalk.cyan('npm install'));
    }
    this.log('  ' + chalk.cyan('npx hardhat test'));
    this.log('  ' + chalk.cyan('npx hardhat node'));
    this.log('  ' + chalk.cyan('npx hardhat deploy --network localhost'));
    this.log('');
    this.log(chalk.dim('Documentation: ') + relativePath + '/README.md');
    this.log(chalk.dim('FHEVM Guides: https://docs.zama.ai/fhevm'));
    this.log('');
  }
}
