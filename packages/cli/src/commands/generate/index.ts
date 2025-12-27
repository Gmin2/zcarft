// Generate command - Base command that shows available generators

import { Command } from '@oclif/core';
import chalk from 'chalk';

export default class Generate extends Command {
  static override description = 'Generate code from contracts (tasks, docs, etc.)';

  static override examples = [
    '<%= config.bin %> <%= command.id %> task ./FHECounter.json',
    '<%= config.bin %> <%= command.id %> docs --output ./documentation',
  ];

  async run(): Promise<void> {
    this.log('');
    this.log(chalk.green('⚡') + ' ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Generate'));
    this.log('');
    this.log(chalk.bold('Available generators:'));
    this.log('');
    this.log(chalk.cyan('  task') + '  ' + chalk.gray('Generate Hardhat tasks from contract ABI'));
    this.log(chalk.cyan('  docs') + '  ' + chalk.gray('Generate GitBook documentation from contracts'));
    this.log('');
    this.log(chalk.gray('Usage:'));
    this.log(chalk.white('  zcraft generate task <abi-file>'));
    this.log(chalk.white('  zcraft generate docs [options]'));
    this.log('');
    this.log(chalk.gray('Run "zcraft generate <command> --help" for more information'));
    this.log('');
  }
}
