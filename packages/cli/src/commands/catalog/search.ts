import { Args, Command } from '@oclif/core';
import chalk from 'chalk';
import { CatalogManager, type ExampleMetadata } from '@zcraft/core';

/**
 * Command to search FHEVM example templates
 *
 * Searches through template titles, descriptions, tags, and key concepts
 *
 * @example
 * ```bash
 * # Search for auction templates
 * zcraft catalog search auction
 *
 * # Search for encryption-related templates
 * zcraft catalog search encrypt
 * ```
 */
export default class CatalogSearch extends Command {
  static override description = 'Search FHEVM example templates';

  static override examples = [
    '<%= config.bin %> <%= command.id %> auction',
    '<%= config.bin %> <%= command.id %> encrypt',
    '<%= config.bin %> <%= command.id %> "access control"',
  ];

  static override args = {
    query: Args.string({
      description: 'Search query',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(CatalogSearch);

    const catalogManager = new CatalogManager();

    // Validate catalog
    const validation = await catalogManager.validate();
    if (!validation.valid) {
      this.error(`Catalog validation failed:\n${validation.errors.join('\n')}`);
    }

    const allExamples = await catalogManager.getAllExamples();
    const query = args.query.toLowerCase();

    // Search through all examples
    const results = Object.entries(allExamples).filter(([key, example]) => {
      return (
        key.toLowerCase().includes(query) ||
        example.title.toLowerCase().includes(query) ||
        example.description.toLowerCase().includes(query) ||
        example.tags.some(tag => tag.toLowerCase().includes(query)) ||
        example.keyConcepts.some(concept => concept.toLowerCase().includes(query))
      );
    });

    // Print header
    this.printHeader(args.query, results.length);

    if (results.length === 0) {
      this.log(chalk.green('|'));
      this.log(chalk.yellow('!') + '  ' + chalk.yellow('No templates found matching your query'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('Try searching for:'));
      this.log(chalk.green('|') + '    ' + chalk.cyan('• counter, auction, voting'));
      this.log(chalk.green('|') + '    ' + chalk.cyan('• encrypt, decrypt, proof'));
      this.log(chalk.green('|') + '    ' + chalk.cyan('• erc20, token, defi'));
      this.log(chalk.green('|'));
      this.log('');
      return;
    }

    // Print results
    for (const [key, example] of results) {
      this.printResult(key, example, query);
    }

    // Print footer
    this.printFooter(results.length);
  }

  /**
   * Print search header
   */
  private printHeader(query: string, count: number): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Search Templates'));
    this.log(chalk.green('|'));
    this.log(
      chalk.green('o') + '  ' +
      chalk.gray(`Found ${count} template${count === 1 ? '' : 's'} matching `) +
      chalk.cyan(`"${query}"`)
    );
    this.log(chalk.green('|'));
  }

  /**
   * Print search result with highlighted matches
   */
  private printResult(key: string, example: ExampleMetadata, query: string): void {
    const difficulty = this.getDifficultyBadge(example.difficulty);
    const tags = example.tags.map(t => chalk.dim(`#${t}`)).join(' ');

    // Highlight matching text
    const titleHighlighted = this.highlightMatch(example.title, query);
    const descHighlighted = this.highlightMatch(example.description, query);

    this.log(chalk.green('|') + '   ' + chalk.bold(titleHighlighted) + '  ' + difficulty + '  ' + chalk.dim(example.estimatedTime));
    this.log(chalk.green('|') + '   ' + chalk.gray(descHighlighted));
    this.log(chalk.green('|'));

    // Show matching key concepts
    const matchingConcepts = example.keyConcepts.filter(c => c.toLowerCase().includes(query));
    if (matchingConcepts.length > 0) {
      this.log(chalk.green('|') + '   ' + chalk.gray('Matching concepts:'));
      for (const concept of matchingConcepts.slice(0, 2)) {
        this.log(chalk.green('|') + '     ' + chalk.cyan('•') + ' ' + chalk.gray(this.highlightMatch(concept, query)));
      }
      this.log(chalk.green('|'));
    }

    // Show matching tags
    const matchingTags = example.tags.filter(t => t.toLowerCase().includes(query));
    if (matchingTags.length > 0) {
      this.log(chalk.green('|') + '   ' + chalk.gray('Tags: ') + tags);
      this.log(chalk.green('|'));
    }

    this.log(chalk.green('|') + '   ' + chalk.dim(`Template ID: ${key}`));
    this.log(chalk.green('|'));
  }

  /**
   * Print footer
   */
  private printFooter(count: number): void {
    this.log(chalk.dim('───'));
    this.log('');
    this.log(chalk.gray('Use') + ' ' + chalk.cyan('zcraft new --template <id>') + ' ' + chalk.gray('to create a project'));
    this.log(chalk.gray('Use') + ' ' + chalk.cyan('zcraft catalog list') + ' ' + chalk.gray('to see all templates'));
    this.log('');
  }

  /**
   * Highlight matching text in a string
   */
  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, chalk.cyan('$1'));
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
