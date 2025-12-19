import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import ora from 'ora';

/**
 * Command to start a local FHEVM Hardhat node
 *
 * Starts a persistent local Hardhat node with mock encryption
 * for testing and development
 *
 * @example
 * ```bash
 * # Start node in current project
 * zcraft node start
 *
 * # Start node in specific directory
 * zcraft node start --cwd ./my-project
 *
 * # Start node with custom port
 * zcraft node start --port 8546
 * ```
 */
export default class NodeStart extends Command {
  static override description = 'Start a local FHEVM Hardhat node';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --cwd ./my-project',
    '<%= config.bin %> <%= command.id %> --port 8546',
  ];

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      description: 'Project directory',
      default: process.cwd(),
    }),
    port: Flags.integer({
      char: 'p',
      description: 'Port number',
      default: 8545,
    }),
    detach: Flags.boolean({
      char: 'd',
      description: 'Run in background (detached mode)',
      default: false,
    }),
  };

  private nodeProcess?: ChildProcess;
  private pidFile?: string;

  public async run(): Promise<void> {
    const { flags } = await this.parse(NodeStart);

    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('FHEVM Node Manager'));
    this.log(chalk.green('|'));

    // Check if project has Hardhat
    const projectDir = path.resolve(flags.cwd);
    const packageJsonPath = path.join(projectDir, 'package.json');
    const hardhatConfigPath = path.join(projectDir, 'hardhat.config.ts');

    if (!await fs.pathExists(packageJsonPath)) {
      this.log(chalk.green('|'));
      this.log(chalk.red('!') + '  ' + chalk.red('No package.json found in project directory'));
      this.log(chalk.green('|') + '  ' + chalk.gray(`Directory: ${projectDir}`));
      this.log(chalk.green('|'));
      this.error('');
    }

    if (!await fs.pathExists(hardhatConfigPath)) {
      this.log(chalk.green('|'));
      this.log(chalk.red('!') + '  ' + chalk.red('No Hardhat project found'));
      this.log(chalk.green('|') + '  ' + chalk.gray('This directory does not appear to be a Hardhat project'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('To create a new FHEVM project:'));
      this.log(chalk.green('|') + '    ' + chalk.cyan('zcraft new'));
      this.log(chalk.green('|'));
      this.error('');
    }

    // Check if node is already running
    this.pidFile = path.join(projectDir, '.zcraft-node.pid');
    if (await this.isNodeRunning()) {
      this.log(chalk.green('|'));
      this.log(chalk.yellow('!') + '  ' + chalk.yellow('Node is already running'));
      this.log(chalk.green('|') + '  ' + chalk.gray('Use') + ' ' + chalk.cyan('zcraft node stop') + ' ' + chalk.gray('to stop it first'));
      this.log(chalk.green('|'));
      this.log('');
      return;
    }

    this.log(chalk.green('o') + '  ' + chalk.gray('Starting local FHEVM node'));
    this.log(chalk.green('|'));

    const spinner = ora({
      text: 'Checking Hardhat installation...',
      color: 'green',
      prefixText: chalk.green('|'),
    }).start();

    try {
      // Check if node_modules exists
      const nodeModulesPath = path.join(projectDir, 'node_modules');
      if (!await fs.pathExists(nodeModulesPath)) {
        spinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.yellow('!') + ' Dependencies not installed');
        this.log(chalk.green('|'));

        const installSpinner = ora({
          text: 'Installing dependencies...',
          color: 'green',
          prefixText: chalk.green('|'),
        }).start();

        await this.installDependencies(projectDir);
        installSpinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Dependencies installed');
      } else {
        spinner.stop();
        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Hardhat found');
      }

      // Start the node
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('Starting Hardhat node...'));
      this.log(chalk.green('|') + '  ' + chalk.dim(`Port: ${flags.port}`));
      this.log(chalk.green('|') + '  ' + chalk.dim(`Directory: ${path.relative(process.cwd(), projectDir) || '.'}`));
      this.log(chalk.green('|'));

      await this.startNode(projectDir, flags.port, flags.detach);

    } catch (error) {
      spinner.stop();
      this.log(chalk.green('|') + '  ' + chalk.red('✗') + ' Failed to start node');
      this.log(chalk.green('|'));
      throw error;
    }
  }

  /**
   * Check if node is already running
   */
  private async isNodeRunning(): Promise<boolean> {
    if (!this.pidFile || !await fs.pathExists(this.pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
      // Check if process exists
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, remove stale PID file
      await fs.remove(this.pidFile);
      return false;
    }
  }

  /**
   * Install dependencies
   */
  private async installDependencies(projectDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: projectDir,
        stdio: 'ignore',
      });

      npm.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });

      npm.on('error', reject);
    });
  }

  /**
   * Start the Hardhat node
   */
  private async startNode(projectDir: string, port: number, detach: boolean): Promise<void> {
    const args = ['hardhat', 'node', '--port', port.toString()];

    if (detach) {
      // Start in background
      const logFile = path.join(projectDir, '.zcraft-node.log');
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      this.nodeProcess = spawn('npx', args, {
        cwd: projectDir,
        detached: true,
        stdio: ['ignore', logStream, logStream],
      });

      // Save PID
      if (this.pidFile && this.nodeProcess.pid) {
        await fs.writeFile(this.pidFile, this.nodeProcess.pid.toString());
      }

      this.nodeProcess.unref();

      // Wait a bit to check if it started successfully
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Node started in background');
      this.log(chalk.green('|'));
      this.log(chalk.green('✓') + '   ' + chalk.bold('Node is running'));
      this.log('');
      this.printNodeInfo(port, projectDir);
    } else {
      // Start in foreground
      this.log(chalk.green('|') + '  ' + chalk.gray('Node starting... (Press Ctrl+C to stop)'));
      this.log(chalk.green('|'));
      this.log(chalk.dim('─'.repeat(60)));
      this.log('');

      this.nodeProcess = spawn('npx', args, {
        cwd: projectDir,
        stdio: 'inherit',
      });

      // Save PID
      if (this.pidFile && this.nodeProcess.pid) {
        await fs.writeFile(this.pidFile, this.nodeProcess.pid.toString());
      }

      // Handle process exit
      this.nodeProcess.on('close', async (code) => {
        if (this.pidFile) {
          await fs.remove(this.pidFile);
        }
        this.log('');
        this.log(chalk.dim('─'.repeat(60)));
        this.log('');
        this.log(chalk.green('|') + '  ' + chalk.gray('Node stopped'));
        this.log('');
        process.exit(code || 0);
      });

      // Handle Ctrl+C
      process.on('SIGINT', async () => {
        this.log('');
        this.log('');
        this.log(chalk.green('|') + '  ' + chalk.gray('Stopping node...'));
        if (this.nodeProcess) {
          this.nodeProcess.kill('SIGINT');
        }
        if (this.pidFile) {
          await fs.remove(this.pidFile);
        }
      });
    }
  }

  /**
   * Print node information
   */
  private printNodeInfo(port: number, projectDir: string): void {
    this.log(chalk.bold('Node Information:'));
    this.log('');
    this.log('  ' + chalk.gray('RPC URL:       ') + chalk.cyan(`http://localhost:${port}`));
    this.log('  ' + chalk.gray('Chain ID:      ') + chalk.cyan('31337'));
    this.log('  ' + chalk.gray('Network:       ') + chalk.cyan('Hardhat'));
    this.log('  ' + chalk.gray('Encryption:    ') + chalk.yellow('Mock (not real FHE)'));
    this.log('');
    this.log(chalk.bold('Pre-funded Accounts:'));
    this.log('');
    this.log('  ' + chalk.dim('Account #0:  ') + chalk.gray('10000 ETH'));
    this.log('  ' + chalk.dim('Account #1:  ') + chalk.gray('10000 ETH'));
    this.log('  ' + chalk.dim('...and more'));
    this.log('');
    this.log(chalk.bold('Next steps:'));
    this.log('');
    this.log('  ' + chalk.cyan('npx hardhat test --network localhost'));
    this.log('  ' + chalk.cyan('npx hardhat deploy --network localhost'));
    this.log('');
    this.log(chalk.gray('Logs: ') + path.join(path.relative(process.cwd(), projectDir) || '.', '.zcraft-node.log'));
    this.log(chalk.gray('Stop: ') + chalk.cyan('zcraft node stop'));
    this.log('');
  }
}
