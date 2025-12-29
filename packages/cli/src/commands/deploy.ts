// Deploy command - Interactive deployment script runner
// Detects and runs deployment scripts from scripts/ or deploy/ directory

import { Command, Flags } from '@oclif/core';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execa } from 'execa';

interface DeployScript {
  name: string;
  path: string;
  type: 'hardhat' | 'script';
}

export default class Deploy extends Command {
  static override description = 'Deploy contracts interactively using project deployment scripts';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --network localhost',
    '<%= config.bin %> <%= command.id %> --network sepolia',
    '<%= config.bin %> <%= command.id %> --script deploy-counter.ts',
  ];

  static override flags = {
    network: Flags.string({
      char: 'n',
      description: 'Network to deploy to',
      required: false,
    }),
    script: Flags.string({
      char: 's',
      description: 'Specific deployment script to run',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Deploy);

    try {
      // Find project directory
      const projectDir = await this.findProjectDir();

      // Display banner
      this.log('');
      this.log(chalk.green('⚡') + ' ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Deploy Contracts'));
      this.log('');

      // Detect deployment scripts
      const spinner = ora('Detecting deployment scripts...').start();
      const scripts = await this.detectDeployScripts(projectDir, flags.script);

      if (scripts.length === 0) {
        spinner.fail(chalk.red('No deployment scripts found'));
        this.log('');
        this.log(chalk.yellow('No deployment scripts found in:'));
        this.log(chalk.gray('  - scripts/'));
        this.log(chalk.gray('  - deploy/'));
        this.log('');
        this.log(chalk.gray('Create a deployment script or use the template defaults.'));
        return;
      }

      spinner.succeed(chalk.green(`Found ${scripts.length} deployment script${scripts.length !== 1 ? 's' : ''}`));

      // List scripts
      for (const script of scripts) {
        this.log(chalk.gray(`  - ${script.name}`));
      }
      this.log('');

      // Select script if multiple
      let selectedScript: DeployScript;

      if (scripts.length === 1) {
        selectedScript = scripts[0];
      } else {
        const { scriptName } = await inquirer.prompt<{ scriptName: string }>([
          {
            type: 'list',
            name: 'scriptName',
            message: 'Select deployment script:',
            choices: scripts.map(s => ({
              name: s.name,
              value: s.name,
            })),
          },
        ]);

        selectedScript = scripts.find(s => s.name === scriptName)!;
        this.log('');
      }

      // Select network if not provided
      let network = flags.network;

      if (!network) {
        const networks = await this.detectNetworks(projectDir);

        if (networks.length > 0) {
          const { selectedNetwork } = await inquirer.prompt<{ selectedNetwork: string }>([
            {
              type: 'list',
              name: 'selectedNetwork',
              message: 'Select network:',
              choices: networks,
              default: 'localhost',
            },
          ]);

          network = selectedNetwork;
          this.log('');
        } else {
          network = 'localhost';
        }
      }

      // Run deployment
      await this.runDeployScript(projectDir, selectedScript, network);

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

    return process.cwd();
  }

  /**
   * Detect deployment scripts in scripts/ or deploy/ directories
   */
  private async detectDeployScripts(
    projectDir: string,
    specificScript?: string
  ): Promise<DeployScript[]> {
    const scripts: DeployScript[] = [];
    const searchDirs = [
      { dir: join(projectDir, 'scripts'), type: 'hardhat' as const },
      { dir: join(projectDir, 'deploy'), type: 'script' as const },
    ];

    for (const { dir, type } of searchDirs) {
      if (!existsSync(dir)) continue;

      try {
        const files = readdirSync(dir);

        for (const file of files) {
          const fullPath = join(dir, file);
          const stat = statSync(fullPath);

          if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
            // Skip if specific script requested and this isn't it
            if (specificScript && file !== specificScript) {
              continue;
            }

            scripts.push({
              name: file,
              path: fullPath,
              type,
            });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return scripts;
  }

  /**
   * Detect networks from hardhat config
   */
  private async detectNetworks(projectDir: string): Promise<string[]> {
    const networks = ['localhost', 'hardhat'];

    // Common network names
    const commonNetworks = [
      'sepolia',
      'mainnet',
      'goerli',
      'polygon',
      'mumbai',
      'arbitrum',
      'optimism',
    ];

    // Check hardhat config for defined networks
    const configFiles = ['hardhat.config.ts', 'hardhat.config.js'];

    for (const configFile of configFiles) {
      const configPath = join(projectDir, configFile);

      if (existsSync(configPath)) {
        try {
          const content = require('fs').readFileSync(configPath, 'utf-8');

          // Simple regex to find network definitions
          for (const network of commonNetworks) {
            if (content.includes(`${network}:`)) {
              networks.push(network);
            }
          }
        } catch {
          // Ignore errors
        }
        break;
      }
    }

    return [...new Set(networks)];
  }

  /**
   * Run deployment script
   */
  private async runDeployScript(
    projectDir: string,
    script: DeployScript,
    network: string
  ): Promise<void> {
    const spinner = ora(`Running ${script.name} on ${network}...`).start();

    try {
      let command: string;
      let args: string[];

      if (script.type === 'hardhat') {
        // Use hardhat run for scripts in scripts/ directory
        command = 'npx';
        args = ['hardhat', 'run', script.path, '--network', network];
      } else {
        // Direct execution for deploy/ directory scripts
        command = 'npx';
        args = ['ts-node', script.path];
      }

      const result = await execa(command, args, {
        cwd: projectDir,
        env: {
          ...process.env,
          HARDHAT_NETWORK: network,
        },
      });

      spinner.succeed(chalk.green('Deployment completed!'));

      // Show output
      this.log('');
      if (result.stdout) {
        this.log(result.stdout);
      }
      this.log('');
      this.log(chalk.green('✨ Done!'));
      this.log('');

    } catch (error: any) {
      spinner.fail(chalk.red('Deployment failed'));

      this.log('');
      if (error.stdout) {
        this.log(error.stdout);
      }
      if (error.stderr) {
        this.log(chalk.red(error.stderr));
      }
      this.log('');

      throw error;
    }
  }
}
