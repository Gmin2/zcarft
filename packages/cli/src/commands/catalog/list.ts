import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { CatalogManager, type ExampleMetadata } from '@zcraft/core';

/**
 * Command to list all available FHEVM example templates
 *
 * Supports filtering by category and displays templates in a clean format
 *
 * @example
 * ```bash
 * # List all templates
 * zcraft catalog list
 *
 * # Filter by category
 * zcraft catalog list --category basic
 *
 * # Show detailed information
 * zcraft catalog list --detailed
 * ```
 */
export default class CatalogList extends Command {
  static override description = 'List all available FHEVM example templates';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --category basic',
    '<%= config.bin %> <%= command.id %> --detailed',
  ];

  static override flags = {
    category: Flags.string({
      char: 'c',
      description: 'Filter by category',
      required: false,
    }),
    detailed: Flags.boolean({
      char: 'd',
      description: 'Show detailed information',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(CatalogList);

    const catalogManager = new CatalogManager();

    // Validate catalog
    const validation = await catalogManager.validate();
    if (!validation.valid) {
      this.error(`Catalog validation failed:\n${validation.errors.join('\n')}`);
    }

    const categories = await catalogManager.getCategories();
    const allExamples = await catalogManager.getAllExamples();

    // Filter by category if specified
    const filteredExamples = flags.category
      ? Object.entries(allExamples).filter(([, ex]) => ex.category === flags.category)
      : Object.entries(allExamples);

    if (filteredExamples.length === 0) {
      this.log(chalk.green('|'));
      this.log(chalk.yellow('!') + '  ' + chalk.yellow(`No templates found${flags.category ? ` in category "${flags.category}"` : ''}`));
      return;
    }

    // Print header
    this.printHeader(filteredExamples.length, flags.category);

    // Group examples by category
    const groupedExamples = this.groupByCategory(filteredExamples);

    // Print each category
    for (const [categoryKey, examples] of Object.entries(groupedExamples).sort(
      ([keyA], [keyB]) => (categories[keyA]?.order || 0) - (categories[keyB]?.order || 0)
    )) {
      const category = categories[categoryKey];
      if (!category) continue;

      this.printCategory(category.icon, category.name, category.description, examples.length);

      for (const [key, example] of examples) {
        if (flags.detailed) {
          this.printDetailedExample(example);
        } else {
          this.printCompactExample(example);
        }
      }

      this.log(chalk.green('|'));
    }

    // Print footer with stats
    this.printFooter(filteredExamples.length);
  }

  /**
   * Print the header banner
   */
  private printHeader(count: number, categoryFilter?: string): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Browse Example Templates'));
    this.log(chalk.green('|'));

    if (categoryFilter) {
      this.log(chalk.green('o') + '  ' + chalk.gray(`Showing ${count} template${count === 1 ? '' : 's'} in category "${categoryFilter}"`));
    } else {
      this.log(chalk.green('o') + '  ' + chalk.gray(`${count} template${count === 1 ? '' : 's'} available`));
    }

    this.log(chalk.green('|'));
  }

  /**
   * Print category header
   */
  private printCategory(icon: string, name: string, description: string, count: number): void {
    this.log(chalk.dim('───') + ' ' + icon + '  ' + chalk.bold(name) + chalk.dim(` (${count})`));
    this.log(chalk.green('|') + '   ' + chalk.gray(description));
    this.log(chalk.green('|'));
  }

  /**
   * Print example in compact format
   */
  private printCompactExample(example: ExampleMetadata): void {
    const difficulty = this.getDifficultyBadge(example.difficulty);
    const time = chalk.dim(example.estimatedTime);

    this.log(
      chalk.green('|') + '   ' +
      chalk.bold(example.title) + '  ' +
      difficulty + '  ' +
      time
    );
    this.log(chalk.green('|') + '   ' + chalk.gray(example.description));
    this.log(chalk.green('|'));
  }

  /**
   * Print example in detailed format
   */
  private printDetailedExample(example: ExampleMetadata): void {
    const difficulty = this.getDifficultyBadge(example.difficulty);
    const tags = example.tags.map(t => chalk.dim(`#${t}`)).join(' ');

    this.log(chalk.green('|') + '   ' + chalk.bold(example.title) + '  ' + difficulty + '  ' + chalk.dim(example.estimatedTime));
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

  /**
   * Print footer with additional info
   */
  private printFooter(count: number): void {
    this.log(chalk.dim('───'));
    this.log('');
    this.log(chalk.gray('Use') + ' ' + chalk.cyan('zcraft new') + ' ' + chalk.gray('to create a new project'));
    this.log(chalk.gray('Use') + ' ' + chalk.cyan('zcraft catalog search <query>') + ' ' + chalk.gray('to search templates'));
    this.log('');
  }

  /**
   * Group examples by category
   */
  private groupByCategory(examples: [string, ExampleMetadata][]): Record<string, [string, ExampleMetadata][]> {
    const grouped: Record<string, [string, ExampleMetadata][]> = {};

    for (const [key, example] of examples) {
      if (!grouped[example.category]) {
        grouped[example.category] = [];
      }
      grouped[example.category].push([key, example]);
    }

    return grouped;
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
}
