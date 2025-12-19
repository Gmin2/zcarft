import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'fs-extra';
import { spawn } from 'node:child_process';

/**
 * Command to check FHEVM Hardhat node status
 *
 * @example
 * ```bash
 * # Check node status
 * zcraft node status
 *
 * # Check node in specific directory
 * zcraft node status --cwd ./my-project
 * ```
 */
export default class NodeStatus extends Command {
  static override description = 'Check FHEVM Hardhat node status';

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
    const { flags } = await this.parse(NodeStatus);

    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Node Status'));
    this.log(chalk.green('|'));

    const projectDir = path.resolve(flags.cwd);
    const pidFile = path.join(projectDir, '.zcraft-node.pid');

    this.log(chalk.green('o') + '  ' + chalk.gray('Checking node status...'));
    this.log(chalk.green('|'));

    // Check if PID file exists
    if (!await fs.pathExists(pidFile)) {
      this.log(chalk.green('|') + '  ' + chalk.red('●') + ' ' + chalk.bold('Not Running'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('The node is not currently running'));
      this.log(chalk.green('|'));
      this.log(chalk.green('|') + '  ' + chalk.gray('Start with: ') + chalk.cyan('zcraft node start'));
      this.log(chalk.green('|'));
      this.log('');
      return;
    }

    try {
      // Read PID
      const pid = parseInt(await fs.readFile(pidFile, 'utf-8'));

      // Check if process is running
      try {
        process.kill(pid, 0);

        // Process is running, try to connect to RPC
        const isResponding = await this.checkRPCConnection();

        if (isResponding) {
          this.log(chalk.green('|') + '  ' + chalk.green('●') + ' ' + chalk.bold('Running'));
        } else {
          this.log(chalk.green('|') + '  ' + chalk.yellow('●') + ' ' + chalk.bold('Starting'));
        }

        this.log(chalk.green('|'));
        this.log(chalk.green('|') + '  ' + chalk.gray('Process ID:    ') + chalk.cyan(pid));
        this.log(chalk.green('|') + '  ' + chalk.gray('RPC URL:       ') + chalk.cyan('http://localhost:8545'));
        this.log(chalk.green('|') + '  ' + chalk.gray('Network:       ') + chalk.cyan('Hardhat'));
        this.log(chalk.green('|') + '  ' + chalk.gray('Encryption:    ') + chalk.yellow('Mock'));

        if (isResponding) {
          const blockNumber = await this.getBlockNumber();
          if (blockNumber !== null) {
            this.log(chalk.green('|') + '  ' + chalk.gray('Block Number:  ') + chalk.cyan(blockNumber));
          }
        }

        this.log(chalk.green('|'));
        this.log(chalk.green('|') + '  ' + chalk.gray('View logs:  ') + chalk.cyan('zcraft node logs'));
        this.log(chalk.green('|') + '  ' + chalk.gray('Stop node:  ') + chalk.cyan('zcraft node stop'));
        this.log(chalk.green('|'));
        this.log('');

      } catch {
        // Process doesn't exist
        this.log(chalk.green('|') + '  ' + chalk.red('●') + ' ' + chalk.bold('Not Running'));
        this.log(chalk.green('|'));
        this.log(chalk.green('|') + '  ' + chalk.yellow('!') + ' Stale PID file found (process not running)');
        this.log(chalk.green('|'));

        // Clean up stale PID file
        await fs.remove(pidFile);

        this.log(chalk.green('|') + '  ' + chalk.gray('Start with: ') + chalk.cyan('zcraft node start'));
        this.log(chalk.green('|'));
        this.log('');
      }

    } catch (error) {
      this.log(chalk.green('|') + '  ' + chalk.red('✗') + ' Failed to check status');
      this.log(chalk.green('|'));
      throw error;
    }
  }

  /**
   * Check if RPC is responding
   */
  private async checkRPCConnection(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current block number
   */
  private async getBlockNumber(): Promise<number | null> {
    try {
      const response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      const data = await response.json() as { result: string };
      return parseInt(data.result, 16);
    } catch {
      return null;
    }
  }
}
