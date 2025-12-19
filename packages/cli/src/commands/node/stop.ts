import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Command to stop a running FHEVM Hardhat node
 *
 * @example
 * ```bash
 * # Stop node in current project
 * zcraft node stop
 *
 * # Stop node in specific directory
 * zcraft node stop --cwd ./my-project
 * ```
 */
export default class NodeStop extends Command {
  static override description = 'Stop the running FHEVM Hardhat node';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --cwd ./my-project',
  ];

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      description: 'Project directory',
      default: process.cwd(),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(NodeStop);

    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Stop FHEVM Node'));
    this.log(chalk.green('|'));

    const projectDir = path.resolve(flags.cwd);
    const pidFile = path.join(projectDir, '.zcraft-node.pid');

    // Check if PID file exists
    if (!await fs.pathExists(pidFile)) {
      this.log(chalk.green('|'));
      this.log(chalk.yellow('!') + '  ' + chalk.yellow('No running node found'));
      this.log(chalk.green('|') + '  ' + chalk.gray('The node is not running or was started outside ZCraft'));
      this.log(chalk.green('|'));
      this.log('');
      return;
    }

    try {
      // Read PID
      const pid = parseInt(await fs.readFile(pidFile, 'utf-8'));

      this.log(chalk.green('o') + '  ' + chalk.gray('Stopping node...'));
      this.log(chalk.green('|'));

      // Try to kill the process
      try {
        process.kill(pid, 'SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if still running
        try {
          process.kill(pid, 0);
          // Still running, force kill
          this.log(chalk.green('|') + '  ' + chalk.gray('Forcing shutdown...'));
          process.kill(pid, 'SIGKILL');
        } catch {
          // Process is dead, good
        }

        this.log(chalk.green('|') + '  ' + chalk.green('✓') + ' Node stopped');
      } catch (error: any) {
        if (error.code === 'ESRCH') {
          // Process doesn't exist
          this.log(chalk.green('|') + '  ' + chalk.yellow('!') + ' Process not found (may have already stopped)');
        } else {
          throw error;
        }
      }

      // Remove PID file
      await fs.remove(pidFile);

      this.log(chalk.green('|'));
      this.log(chalk.green('✓') + '   ' + chalk.bold('Node stopped successfully'));
      this.log('');

    } catch (error) {
      this.log(chalk.green('|') + '  ' + chalk.red('✗') + ' Failed to stop node');
      this.log(chalk.green('|'));
      throw error;
    }
  }
}
