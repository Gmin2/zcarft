import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import fs from 'fs-extra';
import { execa } from 'execa';

interface TemplateInfo {
  name: string;
  title: string;
  description: string;
  category: string;
  difficulty: number;
}

/**
 * Command to initialize a new FHEVM project from zplate templates
 *
 * Unlike the `new` command which uses catalog, this command uses
 * the standalone templates from the zplate repository.
 *
 * @example
 * ```bash
 * # Interactive mode
 * zcraft init
 *
 * # Non-interactive mode
 * zcraft init my-project --template fhe-counter
 * ```
 */
export default class Init extends Command {
  static override description = 'Initialize a new FHEVM project from templates';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> my-project --template fhe-counter',
    '<%= config.bin %> <%= command.id %> my-voting-app --template fhe-voting --skip-install',
  ];

  static override flags = {
    template: Flags.string({
      char: 't',
      description: 'Template name (fhe-counter, fhe-voting, etc.)',
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
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing directory',
      default: false,
    }),
    'use-npm': Flags.boolean({
      description: 'Use npm instead of pnpm',
      default: false,
    }),
  };

  static override args = {
    name: Args.string({
      description: 'Project name',
      required: false,
    }),
  };

  private templatesDir = path.join(__dirname, '../../../../..', 'zplate');

  /**
   * Main command execution
   */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Init);

    let selectedTemplate: string;
    let projectName: string;
    let outputDir: string;

    // Check if templates directory exists
    if (!(await fs.pathExists(this.templatesDir))) {
      this.error(
        `Templates directory not found at ${this.templatesDir}.\n` +
        'Please ensure zplate templates are available.'
      );
    }

    // Get available templates
    const templates = await this.getAvailableTemplates();
    if (templates.length === 0) {
      this.error('No templates found in zplate directory');
    }

    // Interactive mode
    if (!flags.template) {
      const result = await this.runInteractive(templates, args.name);
      selectedTemplate = result.template;
      projectName = result.projectName;
      outputDir = result.outputDir;
    } else {
      // Non-interactive mode
      selectedTemplate = flags.template;

      // Validate template exists
      if (!templates.find(t => t.name === selectedTemplate)) {
        this.error(
          `Template '${selectedTemplate}' not found.\n` +
          `Available templates: ${templates.map(t => t.name).join(', ')}`
        );
      }

      projectName = args.name || selectedTemplate;
      outputDir = flags.output || path.join(process.cwd(), projectName);
    }

    // Create project
    await this.createProject({
      templateName: selectedTemplate,
      projectName,
      outputDir,
      skipInstall: flags['skip-install'],
      useNpm: flags['use-npm'],
      force: flags.force,
    });
  }

  /**
   * Get available templates from zplate directory
   */
  private async getAvailableTemplates(): Promise<TemplateInfo[]> {
    const templates: TemplateInfo[] = [];

    // Skip base-template, only get actual example templates
    const dirs = await fs.readdir(this.templatesDir);

    for (const dir of dirs) {
      const templatePath = path.join(this.templatesDir, dir);
      const stat = await fs.stat(templatePath);

      if (!stat.isDirectory()) continue;
      if (dir === 'base-template') continue;
      if (dir === 'node_modules') continue;
      if (dir.startsWith('.')) continue;

      // Read package.json to get template info
      const pkgPath = path.join(templatePath, 'package.json');
      if (!(await fs.pathExists(pkgPath))) continue;

      try {
        const pkg = await fs.readJson(pkgPath);
        templates.push({
          name: dir,
          title: this.formatTitle(dir),
          description: pkg.description || 'FHEVM template',
          category: this.categorizeTemplate(dir),
          difficulty: this.estimateDifficulty(dir),
        });
      } catch (error) {
        // Skip templates with invalid package.json
        continue;
      }
    }

    return templates.sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
  }

  /**
   * Format template name to title
   */
  private formatTitle(name: string): string {
    return name
      .replace(/^fhe-/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Categorize template by name
   */
  private categorizeTemplate(name: string): string {
    if (name.includes('counter') || name.includes('operations')) return 'Basics';
    if (name.includes('voting') || name.includes('governance')) return 'Governance';
    if (name.includes('vault') || name.includes('bank') || name.includes('token')) return 'DeFi';
    if (name.includes('random') || name.includes('dice') || name.includes('game')) return 'Gaming';
    return 'Other';
  }

  /**
   * Estimate difficulty by template complexity
   */
  private estimateDifficulty(name: string): number {
    if (name.includes('counter')) return 1;
    if (name.includes('operations')) return 2;
    if (name.includes('vault') || name.includes('random')) return 2;
    if (name.includes('voting')) return 3;
    return 3;
  }

  /**
   * Run interactive wizard for template selection
   */
  private async runInteractive(
    templates: TemplateInfo[],
    providedName?: string
  ): Promise<{
    template: string;
    projectName: string;
    outputDir: string;
  }> {
    // Display welcome banner
    this.printWelcomeBanner();

    // Group templates by category
    const categories = this.groupByCategory(templates);

    // Step 1: Select category
    this.log(chalk.green('o') + '  ' + chalk.gray('Choose a category'));
    this.log(chalk.green('|'));
    const { category } = await inquirer.prompt<{ category: string }>([
      {
        type: 'list',
        name: 'category',
        message: chalk.gray('Which type of example do you want to create?'),
        prefix: chalk.green('?'),
        choices: Object.keys(categories).map(cat => ({
          name: `${this.getCategoryIcon(cat)}  ${chalk.bold(cat)}`,
          value: cat,
        })),
      },
    ]);

    // Step 2: Select template
    const categoryTemplates = categories[category];
    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.gray('Select a template'));
    this.log(chalk.green('|'));
    const { template } = await inquirer.prompt<{ template: string }>([
      {
        type: 'list',
        name: 'template',
        message: chalk.gray('Pick a template to get started:'),
        prefix: chalk.green('?'),
        choices: categoryTemplates.map(t => {
          const difficulty = this.getDifficultyBadge(t.difficulty);
          return {
            name: `${chalk.bold(t.title)} ${difficulty}\n  ${chalk.gray(t.description)}`,
            value: t.name,
            short: t.title,
          };
        }),
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
        transformer: (input: string) => chalk.cyan(input),
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
        transformer: (input: string) => chalk.dim(path.relative(process.cwd(), input) || '.'),
      },
    ]);

    this.log(chalk.green('|'));

    return { template, projectName, outputDir };
  }

  /**
   * Group templates by category
   */
  private groupByCategory(templates: TemplateInfo[]): Record<string, TemplateInfo[]> {
    const groups: Record<string, TemplateInfo[]> = {};

    for (const template of templates) {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    }

    return groups;
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Basics': '📚',
      'DeFi': '💰',
      'Governance': '🗳️',
      'Gaming': '🎮',
      'Other': '📦',
    };
    return icons[category] || '📦';
  }

  /**
   * Display welcome banner
   */
  private printWelcomeBanner(): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft Init') + ' : ' + chalk.gray('Create FHEVM Project'));
    this.log(chalk.green('|'));
    this.log(chalk.green('|') + '  ' + chalk.gray('Initialize from production-ready templates'));
    this.log(chalk.green('|') + '  ' + chalk.gray('with complete examples and tests'));
    this.log(chalk.green('|'));
  }

  /**
   * Get styled difficulty badge
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
   * Create the project from template
   */
  private async createProject(options: {
    templateName: string;
    projectName: string;
    outputDir: string;
    skipInstall: boolean;
    useNpm: boolean;
    force: boolean;
  }): Promise<void> {
    const { templateName, projectName, outputDir, skipInstall, useNpm, force } = options;

    const templatePath = path.join(this.templatesDir, templateName);

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
      text: `Copying ${templateName} template...`,
      color: 'green',
      prefixText: chalk.green('|'),
    }).start();

    try {
      // Step 1: Copy template
      await fs.copy(templatePath, outputDir, {
        filter: (src) => {
          const basename = path.basename(src);
          // Exclude node_modules and build artifacts
          return !basename.match(/^(node_modules|\.git|dist|artifacts|cache|coverage|types)$/);
        },
      });
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Template copied');

      // Step 2: Update package.json
      spinner.prefixText = chalk.green('|');
      spinner.text = 'Configuring package.json...';
      spinner.start();
      await this.updatePackageJson(projectName, outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Package metadata updated');

      // Step 3: Clean up
      spinner.prefixText = chalk.green('|');
      spinner.text = 'Cleaning up...';
      spinner.start();
      await this.cleanupProject(outputDir);
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Project cleaned');

      // Step 4: Install dependencies
      if (!skipInstall) {
        spinner.prefixText = chalk.green('|');
        spinner.text = 'Installing dependencies (this may take a minute)...';
        spinner.start();
        await this.installDependencies(outputDir, useNpm);
        spinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Dependencies installed');
      }

      this.log(chalk.green('|'));
      this.log(chalk.green('✓') + '   ' + chalk.bold('Project created successfully!'));
      this.log('');

      // Print success message
      this.printSuccessMessage(projectName, outputDir, skipInstall, useNpm);
    } catch (error) {
      spinner.stop();
      this.log(chalk.red('|') + '  ' + chalk.red('✗') + ' Failed to create project');
      throw error;
    }
  }

  /**
   * Update package.json with project name
   */
  private async updatePackageJson(projectName: string, outputDir: string): Promise<void> {
    const pkgPath = path.join(outputDir, 'package.json');
    const pkg = await fs.readJson(pkgPath);

    // Update name, keep description and keywords from template
    pkg.name = projectName;

    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  /**
   * Clean up project (remove package-lock if using pnpm, etc.)
   */
  private async cleanupProject(outputDir: string): Promise<void> {
    const lockFile = path.join(outputDir, 'package-lock.json');
    if (await fs.pathExists(lockFile)) {
      await fs.remove(lockFile);
    }

    const pnpmLock = path.join(outputDir, 'pnpm-lock.yaml');
    if (await fs.pathExists(pnpmLock)) {
      await fs.remove(pnpmLock);
    }
  }

  /**
   * Install dependencies
   */
  private async installDependencies(outputDir: string, useNpm: boolean): Promise<void> {
    const packageManager = useNpm ? 'npm' : 'pnpm';

    await execa(packageManager, ['install'], {
      cwd: outputDir,
      stdio: 'ignore',
    });
  }

  /**
   * Print success message with next steps
   */
  private printSuccessMessage(
    projectName: string,
    outputDir: string,
    skipInstall: boolean,
    useNpm: boolean
  ): void {
    const relativePath = path.relative(process.cwd(), outputDir);
    const cdCommand = relativePath ? `cd ${relativePath}` : '.';
    const pm = useNpm ? 'npm' : 'pnpm';

    this.log(chalk.bold('Next steps:'));
    this.log('');
    this.log('  ' + chalk.cyan(cdCommand));
    if (skipInstall) {
      this.log('  ' + chalk.cyan(`${pm} install`));
    }
    this.log('  ' + chalk.cyan(`${pm} test`));
    this.log('  ' + chalk.cyan(`${pm} run compile`));
    this.log('');
    this.log(chalk.dim('Start local node:'));
    this.log('  ' + chalk.cyan(`${pm} run chain`));
    this.log('');
    this.log(chalk.dim('Deploy to local network:'));
    this.log('  ' + chalk.cyan(`${pm} run deploy:localhost`));
    this.log('');
    this.log(chalk.dim('Documentation: ') + relativePath + '/README.md');
    this.log(chalk.dim('FHEVM Guides: https://docs.zama.ai/fhevm'));
    this.log('');
  }
}
