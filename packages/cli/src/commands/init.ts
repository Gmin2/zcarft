import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import { TemplateManager } from '../utils/template-manager.js';

/**
 * Command to initialize a new FHEVM project from zplate templates
 *
 * Templates are automatically downloaded from GitHub on first use
 * and cached locally at ~/.zcraft/templates for faster subsequent use.
 *
 * @example
 * ```bash
 * # List available templates first
 * zcraft list
 *
 * # Initialize with a template
 * zcraft init fhe-counter
 * zcraft init fhe-voting my-voting-app
 * zcraft init confidential-token --output ./my-token --skip-install
 * ```
 */
export default class Init extends Command {
  static override description = 'Initialize a new FHEVM project from a template';

  static override examples = [
    '<%= config.bin %> <%= command.id %> fhe-counter',
    '<%= config.bin %> <%= command.id %> fhe-voting my-voting-app',
    '<%= config.bin %> <%= command.id %> confidential-token --skip-install',
  ];

  static override flags = {
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
    'use-yarn': Flags.boolean({
      description: 'Use yarn instead of pnpm',
      default: false,
    }),
  };

  static override args = {
    template: Args.string({
      description: 'Template name (run "zcraft list" to see available templates)',
      required: true,
    }),
    name: Args.string({
      description: 'Project name (defaults to template name)',
      required: false,
    }),
  };

  private templateManager = new TemplateManager();

  /**
   * Main command execution
   */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Init);

    const selectedTemplate = args.template;
    const projectName = args.name || selectedTemplate;
    const outputDir = flags.output || path.join(process.cwd(), projectName);

    try {
      // Print banner
      this.printBanner(selectedTemplate, projectName);

      // Create project (will download template from GitHub)
      await this.createProject({
        templateName: selectedTemplate,
        projectName,
        outputDir,
        skipInstall: flags['skip-install'],
        useNpm: flags['use-npm'],
        useYarn: flags['use-yarn'],
        force: flags.force,
      });

    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Print welcome banner
   */
  private printBanner(templateName: string, projectName: string): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft Init'));
    this.log(chalk.green('|'));
    this.log(chalk.green('o') + '  ' + chalk.gray('Template: ') + chalk.cyan(templateName));
    this.log(chalk.green('o') + '  ' + chalk.gray('Project: ') + chalk.cyan(projectName));
    this.log(chalk.green('|'));
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
    useYarn: boolean;
    force: boolean;
  }): Promise<void> {
    const { templateName, projectName, outputDir, skipInstall, useNpm, useYarn, force } = options;

    let spinner: any;

    try {
      // Step 1: Copy template
      spinner = ora({
        text: 'Copying template files...',
        color: 'green',
        prefixText: chalk.green('|'),
      }).start();

      await this.templateManager.copyTemplate(templateName, outputDir, {
        force,
        onProgress: (message) => {
          spinner.text = message;
        },
      });

      spinner.succeed('Template copied');

      // Step 2: Update package.json
      spinner = ora({
        text: 'Configuring package.json...',
        color: 'green',
        prefixText: chalk.green('|'),
      }).start();

      await this.templateManager.updatePackageJson(outputDir, projectName);
      spinner.succeed('Package metadata updated');

      // Step 3: Clean up
      spinner = ora({
        text: 'Cleaning up...',
        color: 'green',
        prefixText: chalk.green('|'),
      }).start();

      await this.templateManager.cleanupProject(outputDir);
      spinner.succeed('Project cleaned');

      // Step 4: Install dependencies
      if (!skipInstall) {
        const packageManager = useYarn ? 'yarn' : useNpm ? 'npm' : 'pnpm';

        spinner = ora({
          text: `Installing dependencies with ${packageManager} (this may take a minute)...`,
          color: 'green',
          prefixText: chalk.green('|'),
        }).start();

        await this.templateManager.installDependencies(outputDir, packageManager);
        spinner.succeed('Dependencies installed');
      }

      this.log(chalk.green('|'));
      this.log(chalk.green('✓') + '   ' + chalk.bold('Project created successfully!'));
      this.log('');

      // Print success message
      this.printSuccessMessage(projectName, outputDir, skipInstall, useNpm, useYarn);

    } catch (error) {
      if (spinner) {
        spinner.fail('Failed to create project');
      }
      throw error;
    }
  }

  /**
   * Print success message with next steps
   */
  private printSuccessMessage(
    projectName: string,
    outputDir: string,
    skipInstall: boolean,
    useNpm: boolean,
    useYarn: boolean
  ): void {
    const relativePath = path.relative(process.cwd(), outputDir);
    const cdCommand = relativePath ? `cd ${relativePath}` : '.';
    const pm = useYarn ? 'yarn' : useNpm ? 'npm' : 'pnpm';

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
    this.log(chalk.dim('Documentation: ') + path.join(relativePath, 'README.md'));
    this.log(chalk.dim('FHEVM Guides: https://docs.zama.ai/fhevm'));
    this.log('');
    this.log(chalk.dim('Templates cache: ') + this.templateManager.getCacheDir());
    this.log('');
  }
}
