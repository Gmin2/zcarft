import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'fs-extra';
import { spawn } from 'node:child_process';

/**
 * Command to view FHEVM Hardhat node logs
 *
 * @example
 * ```bash
 * # View logs
 * zcraft node logs
 *
 * # View logs with tail
 * zcraft node logs --follow
 *
 * # View last N lines
 * zcraft node logs --lines 50
 * ```
 */
export default class NodeLogs extends Command {
  static override description = 'View FHEVM Hardhat node logs';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --follow',
    '<%= config.bin %> <%= command.id %> --lines 50',
  ];

  static override flags = {
    cwd: Flags.string({
      char: 'c',
      description: 'Project directory',
      default: process.cwd(),
    }),
    follow: Flags.boolean({
      char: 'f',
      description: 'Follow log output (like tail -f)',
      default: false,
    }),
    lines: Flags.integer({
      char: 'n',
      description: 'Number of lines to show',
      default: 100,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(NodeLogs);

    const projectDir = path.resolve(flags.cwd);
    const logFile = path.join(projectDir, '.zcraft-node.log');

    // Check if log file exists
    if (!await fs.pathExists(logFile)) {
      this.log('');
      this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Node Logs'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|'));
      this.log(chalk.yellow('!') + '  ' + chalk.yellow('No log file found'));
      this.log(chalk.green('|') + '  ' + chalk.gray('The node has not been started yet'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('Start with: ') + chalk.cyan('zcraft node start --detach'));
      this.log(chalk.green('|'));
      this.log('');
      return;
    }

    if (flags.follow) {
      // Follow logs in real-time
      this.log('');
      this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Node Logs (following)'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.dim('Press Ctrl+C to stop'));
      this.log(chalk.green('|'));
      this.log(chalk.dim('─'.repeat(60)));
      this.log('');

      const tail = spawn('tail', ['-f', '-n', flags.lines.toString(), logFile], {
        stdio: 'inherit',
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        tail.kill('SIGINT');
        this.log('');
        this.log(chalk.dim('─'.repeat(60)));
        this.log('');
        process.exit(0);
      });

      await new Promise<void>((resolve) => {
        tail.on('close', () => resolve());
      });

    } else {
      // Show last N lines
      this.log('');
      this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Node Logs'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.dim(`Showing last ${flags.lines} lines`));
      this.log(chalk.green('|'));
      this.log(chalk.dim('─'.repeat(60)));
      this.log('');

      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n');
      const lastLines = lines.slice(-flags.lines);

      for (const line of lastLines) {
        if (line.trim()) {
          this.log(line);
        }
      }

      this.log('');
      this.log(chalk.dim('─'.repeat(60)));
      this.log('');
      this.log(chalk.gray('Follow logs: ') + chalk.cyan('zcraft node logs --follow'));
      this.log('');
    }
  }
}
