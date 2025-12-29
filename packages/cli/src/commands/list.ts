import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CatalogExample {
  category: string;
  title: string;
  description: string;
  tags: string[];
  keyConcepts: string[];
  difficulty: number;
  estimatedTime: string;
}

interface CatalogCategory {
  name: string;
  description: string;
  icon: string;
  order: number;
}

interface Catalog {
  version: string;
  categories: Record<string, CatalogCategory>;
  examples: Record<string, CatalogExample>;
}

/**
 * Command to list all available FHEVM templates from catalog
 *
 * Instant listing using bundled catalog.json.
 * Templates download from GitHub when you run `zcraft init <template>`.
 *
 * @example
 * ```bash
 * zcraft list
 * zcraft list --category defi
 * zcraft list --detailed
 * ```
 */
export default class List extends Command {
  static override description = 'Browse and select FHEVM templates interactively';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --no-interactive',
    '<%= config.bin %> <%= command.id %> --category defi',
    '<%= config.bin %> <%= command.id %> --detailed',
  ];

  static override flags = {
    category: Flags.string({
      char: 'c',
      description: 'Filter by category (basic, encryption, defi, gaming, governance, advanced)',
      required: false,
    }),
    detailed: Flags.boolean({
      char: 'd',
      description: 'Show detailed information',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode (default)',
      default: true,
      allowNo: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);

    try {
      // Load catalog.json
      const catalogPath = path.join(__dirname, '../../../..', 'catalog.json');

      if (!(await fs.pathExists(catalogPath))) {
        this.error('Catalog not found.');
      }

      const catalog: Catalog = await fs.readJson(catalogPath);
      const allExamples = Object.entries(catalog.examples);

      // Interactive mode
      if (flags.interactive && !flags.category && !flags.detailed) {
        await this.runInteractive(catalog, allExamples);
        return;
      }

      // Non-interactive mode (original behavior)
      // Filter by category
      const filteredExamples = flags.category
        ? allExamples.filter(([, ex]) => ex.category === flags.category)
        : allExamples;

      if (filteredExamples.length === 0) {
        this.log(chalk.yellow(`No templates found${flags.category ? ` in category "${flags.category}"` : ''}`));
        this.log('');
        this.log('Available categories: ' + Object.keys(catalog.categories).join(', '));
        return;
      }

      // Print header
      this.printHeader(filteredExamples.length, flags.category);

      // Group by category
      const groupedByCategory: Record<string, [string, CatalogExample][]> = {};
      for (const [key, example] of filteredExamples) {
        if (!groupedByCategory[example.category]) {
          groupedByCategory[example.category] = [];
        }
        groupedByCategory[example.category].push([key, example]);
      }

      // Print each category
      for (const [categoryKey, examples] of Object.entries(groupedByCategory).sort(
        ([keyA], [keyB]) => (catalog.categories[keyA]?.order || 0) - (catalog.categories[keyB]?.order || 0)
      )) {
        const category = catalog.categories[categoryKey];
        if (!category) continue;

        this.printCategory(category.icon, category.name, category.description, examples.length);

        for (const [key, example] of examples) {
          if (flags.detailed) {
            this.printDetailedExample(key, example);
          } else {
            this.printCompactExample(key, example);
          }
        }

        this.log(chalk.green('|'));
      }

      // Print footer
      this.printFooter();

    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Interactive mode - select category and template
   */
  private async runInteractive(
    catalog: Catalog,
    allExamples: [string, CatalogExample][]
  ): Promise<void> {
    // Print banner
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft Templates'));
    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.gray('Interactive template browser'));
    this.log(chalk.green('|'));
    this.log('');

    // Loop to allow going back
    while (true) {
      // Step 1: Select category
      const categoryChoices = Object.entries(catalog.categories)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([key, cat]) => ({
          name: `${cat.icon}  ${cat.name} - ${cat.description}`,
          value: key,
        }));

      const { selectedCategory } = await inquirer.prompt<{ selectedCategory: string }>([
        {
          type: 'list',
          name: 'selectedCategory',
          message: 'Choose a category:',
          choices: categoryChoices,
          default: 'basic',
        },
      ]);

      // Filter examples by category
      const categoryExamples = allExamples.filter(([, ex]) => ex.category === selectedCategory);

      if (categoryExamples.length === 0) {
        this.log(chalk.yellow('No templates found in this category.'));
        continue;
      }

      // Step 2: Select template
      const category = catalog.categories[selectedCategory];
      this.log('');
      this.log(chalk.dim('───') + ' ' + category.icon + '  ' + chalk.bold(category.name));
      this.log('');

      const templateChoices = [
        new inquirer.Separator(),
        {
          name: chalk.gray('← Go back to categories'),
          value: '__BACK__',
          short: 'Back',
        },
        new inquirer.Separator(),
        ...categoryExamples.map(([key, example]) => ({
          name: `${chalk.cyan(key.padEnd(30))} ${this.getDifficultyBadge(example.difficulty)} ${chalk.dim(example.estimatedTime)}\n     ${chalk.gray(example.description)}`,
          value: key,
          short: key,
        })),
      ];

      const { selectedTemplate } = await inquirer.prompt<{ selectedTemplate: string }>([
        {
          type: 'list',
          name: 'selectedTemplate',
          message: 'Choose a template:',
          choices: templateChoices,
          pageSize: 10,
        },
      ]);

      // Handle go back
      if (selectedTemplate === '__BACK__') {
        this.log('');
        continue;
      }

      const example = categoryExamples.find(([key]) => key === selectedTemplate)?.[1];
      if (!example) continue;

    // Step 3: Show template details
    this.log('');
    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.bold.cyan(selectedTemplate));
    this.log(chalk.green('|') + '  ' + chalk.gray(example.description));
    this.log(chalk.green('|'));
    this.log(chalk.green('|') + '  ' + chalk.gray('Key Concepts:'));
    for (const concept of example.keyConcepts.slice(0, 3)) {
      this.log(chalk.green('|') + '    ' + chalk.cyan('•') + ' ' + chalk.gray(concept));
    }
    this.log(chalk.green('|'));
    this.log('');

      // Step 4: Ask if user wants to initialize
      const { shouldInit } = await inquirer.prompt<{ shouldInit: boolean }>([
        {
          type: 'confirm',
          name: 'shouldInit',
          message: 'Initialize this template now?',
          default: true,
        },
      ]);

      if (!shouldInit) {
        this.log('');
        this.log(chalk.gray(`To initialize later, run: ${chalk.cyan(`zcraft init ${selectedTemplate}`)}`));
        this.log('');
        return;
      }

      // Step 5: Ask for project name
      const { projectName } = await inquirer.prompt<{ projectName: string }>([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: selectedTemplate,
        },
      ]);

      // Step 6: Run init command
      this.log('');
      await this.config.runCommand('init', [selectedTemplate, projectName]);

      // Exit after successful initialization
      break;
    }
  }

  private printHeader(count: number, categoryFilter?: string): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft Templates'));
    this.log(chalk.green('|'));

    if (categoryFilter) {
      this.log(chalk.green('o') + '  ' + chalk.gray(`${count} template${count === 1 ? '' : 's'} in "${categoryFilter}"`));
    } else {
      this.log(chalk.green('o') + '  ' + chalk.gray(`${count} template${count === 1 ? '' : 's'} available`));
    }

    this.log(chalk.green('|'));
  }

  private printCategory(icon: string, name: string, description: string, count: number): void {
    this.log(chalk.dim('───') + ' ' + icon + '  ' + chalk.bold(name) + chalk.dim(` (${count})`));
    this.log(chalk.green('|') + '   ' + chalk.gray(description));
    this.log(chalk.green('|'));
  }

  private printCompactExample(key: string, example: CatalogExample): void {
    const difficulty = this.getDifficultyBadge(example.difficulty);
    const time = chalk.dim(example.estimatedTime);

    this.log(
      chalk.green('|') + '   ' +
      chalk.cyan(key.padEnd(28)) + '  ' +
      difficulty + '  ' +
      time
    );
    this.log(chalk.green('|') + '   ' + chalk.gray(example.description));
    this.log(chalk.green('|'));
  }

  private printDetailedExample(key: string, example: CatalogExample): void {
    const difficulty = this.getDifficultyBadge(example.difficulty);
    const tags = example.tags.slice(0, 5).map(t => chalk.dim(`#${t}`)).join(' ');

    this.log(chalk.green('|') + '   ' + chalk.bold.cyan(key) + '  ' + difficulty + '  ' + chalk.dim(example.estimatedTime));
    this.log(chalk.green('|') + '   ' + chalk.bold(example.title));
    this.log(chalk.green('|') + '   ' + chalk.gray(example.description));
    this.log(chalk.green('|'));
    this.log(chalk.green('|') + '   ' + chalk.gray('Key Concepts:'));

    for (const concept of example.keyConcepts.slice(0, 3)) {
      this.log(chalk.green('|') + '     ' + chalk.cyan('•') + ' ' + chalk.gray(concept));
    }

    this.log(chalk.green('|'));
    this.log(chalk.green('|') + '   ' + tags);
    this.log(chalk.green('|'));
  }

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

  private printFooter(): void {
    this.log(chalk.dim('───'));
    this.log('');
    this.log(chalk.gray('Usage:'));
    this.log('  ' + chalk.cyan('zcraft list') + chalk.gray('                   Interactive template browser'));
    this.log('  ' + chalk.cyan('zcraft init <template>') + chalk.gray('        Create project from template'));
    this.log('  ' + chalk.cyan('zcraft init <template> <name>') + chalk.gray('  Create with custom name'));
    this.log('');
    this.log(chalk.gray('Examples:'));
    this.log('  ' + chalk.dim('zcraft list'));
    this.log('  ' + chalk.dim('zcraft init fhe-counter'));
    this.log('  ' + chalk.dim('zcraft init confidential-token my-token'));
    this.log('');
    this.log(chalk.dim('Templates auto-download from GitHub on first use'));
    this.log('');
  }
}
