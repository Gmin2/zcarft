// Interactive REPL engine for FHEVM contract interaction
// Provides command-line interface for calling encrypted contract functions

import { createInterface, type Interface as ReadlineInterface } from 'readline';
import { Contract, type Signer } from 'ethers';
import { spawn } from 'child_process';
import chalk from 'chalk';
import {
  parseCommand,
  type ParsedCommand,
} from './parser.js';

/**
 * Transaction history entry
 */
export interface HistoryEntry {
  index: number;
  command: string;
  functionName?: string;
  args?: any[];
  txHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  status?: string;
  timestamp: Date;
  result?: any;
}

/**
 * REPL configuration
 */
export interface ReplConfig {
  contract: Contract;
  contractName: string;
  contractAddress: string;
  signers: Signer[];
  currentSignerIndex: number;
  network: string;
  chainId: number;
  projectDir: string; // Project directory
}

/**
 * Interactive REPL for FHEVM contract interaction
 */
export class FHEVMRepl {
  private rl: ReadlineInterface | null;
  private history: HistoryEntry[];
  private historyIndex: number;
  private isRunning: boolean;
  private config: ReplConfig;

  constructor(config: ReplConfig) {
    this.config = config;
    this.rl = null;
    this.history = [];
    this.historyIndex = 1;
    this.isRunning = false;
  }

  /**
   * Start the REPL
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Display welcome message
    await this.displayWelcome();

    // Create readline interface
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
    });

    // Handle line input
    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim());
      if (this.isRunning && this.rl) {
        this.rl.setPrompt(this.getPrompt());
        this.rl.prompt();
      }
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('\n');
      this.exit();
    });

    // Display prompt
    this.rl.prompt();
  }

  /**
   * Stop the REPL
   */
  stop(): void {
    this.isRunning = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Display welcome message
   */
  private async displayWelcome(): Promise<void> {
    const { contractName, contractAddress, network, signers, currentSignerIndex } =
      this.config;
    const currentSigner = signers[currentSignerIndex];
    const signerAddress = await currentSigner.getAddress();
    const shortAddr = `${contractAddress.slice(0, 8)}...${contractAddress.slice(-4)}`;

    console.log('');
    console.log(
      chalk.green('┌──') +
        ' ' +
        chalk.bold.white('ZCraft') +
        ' : ' +
        chalk.gray('Call Contract'),
    );
    console.log(chalk.green('│'));
    console.log(
      chalk.green('└──') + ' ' + chalk.green('✅ Connected to ') + chalk.white(contractName),
    );
    console.log('');

    console.log(
      `${chalk.bold(contractName)}@${chalk.gray(shortAddr)} [${chalk.cyan(network)}] >`,
    );
    console.log('');

    console.log(
      chalk.bold('Network: ') +
        chalk.cyan(network) +
        chalk.gray(` (chainId: ${this.config.chainId})`),
    );
    console.log(
      chalk.bold('Signer: ') +
        chalk.gray(`${signerAddress.slice(0, 10)}...${signerAddress.slice(-4)}`),
    );
    console.log('');

    this.displayFunctions();

    console.log(chalk.gray("Type 'help' for commands, 'exit' to quit"));
    console.log('');
  }

  /**
   * Display available functions
   */
  private displayFunctions(): void {
    const abi = this.config.contract.interface;
    const functions = abi.fragments.filter((f: any) => f.type === 'function');

    if (functions.length === 0) {
      return;
    }

    console.log(chalk.bold('Available functions:'));

    functions.forEach((func: any) => {
      const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';
      const tag = isView ? chalk.cyan('[read]   ') : chalk.yellow('[mutates]');

      const params = func.inputs
        .filter((input: any) => input.name !== 'inputProof')
        .map((input: any) => input.name)
        .join(', ');

      const returnType = func.outputs.length > 0
        ? ` -> ${func.outputs[0].internalType || func.outputs[0].type}`
        : '';

      console.log(`  ${tag} ${chalk.white(func.name)}(${chalk.gray(params)})${chalk.dim(returnType)}`);
    });

    console.log('');
  }

  /**
   * Get current prompt string
   */
  private getPrompt(): string {
    return chalk.green('> ');
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    if (!input) {
      return;
    }

    try {
      const parsed = parseCommand(input);
      await this.executeCommand(parsed, input);
    } catch (error) {
      this.displayError(error);
    }
  }

  /**
   * Execute a parsed command
   */
  private async executeCommand(parsed: ParsedCommand, rawInput: string): Promise<void> {
    switch (parsed.type) {
      case 'function_call':
        await this.callFunction(parsed, rawInput);
        break;

      case 'decrypt':
        await this.handleDecrypt(parsed);
        break;

      case 'signer':
        await this.switchSigner(parsed);
        break;

      case 'signers':
        await this.listSigners();
        break;

      case 'functions':
        this.displayFunctions();
        break;

      case 'history':
        this.displayHistory(parsed);
        break;

      case 'network':
        this.displayNetwork();
        break;

      case 'help':
        this.displayHelp(parsed.command);
        break;

      case 'clear':
        console.clear();
        this.displayWelcome();
        break;

      case 'exit':
        this.exit();
        break;

      default:
        throw new Error(`Unknown command type: ${parsed.type}`);
    }
  }

  /**
   * Call a contract function
   */
  private async callFunction(parsed: ParsedCommand, rawInput: string): Promise<void> {
    if (!parsed.functionName || !parsed.args) {
      throw new Error('Invalid function call');
    }

    const { functionName, args } = parsed;
    const { contract } = this.config;

    // Get function fragment from ABI
    const func = contract.interface.getFunction(functionName);
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }

    // Execute using npx hardhat task
    await this.executeHardhatTask(functionName, args, rawInput, func);
  }

  /**
   * Execute Hardhat task via npx hardhat
   */
  private async executeHardhatTask(
    functionName: string,
    args: any[],
    rawInput: string,
    func: any
  ): Promise<void> {
    // Build task name
    const taskName = `${this.config.contractName.toLowerCase()}:${functionName}`;

    // Build command arguments
    const cmdArgs = ['hardhat', taskName];

    // Add function parameters
    func.inputs.forEach((input: any, index: number) => {
      if (input.name && input.name !== 'inputProof' && index < args.length) {
        const paramName = input.name.toLowerCase();
        cmdArgs.push(`--${paramName}`, String(args[index]));
      }
    });

    // Add network
    cmdArgs.push('--network', this.config.network);

    return new Promise((resolve, reject) => {
      console.log('');

      const child = spawn('npx', cmdArgs, {
        cwd: this.config.projectDir,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        console.log('');
        if (code === 0) {
          this.addToHistory({
            command: rawInput,
            functionName,
            args,
          });
          resolve();
        } else {
          reject(new Error(`Task exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Handle decrypt command
   */
  private async handleDecrypt(parsed: ParsedCommand): Promise<void> {
    if (!parsed.expression) {
      throw new Error('Missing expression to decrypt');
    }

    // Parse function name from decrypt expression
    let functionName: string;

    if (parsed.expression.includes('(')) {
      const funcParsed = parseCommand(parsed.expression);
      if (funcParsed.type !== 'function_call') {
        throw new Error('Invalid decrypt expression');
      }
      functionName = funcParsed.functionName!;
    } else {
      throw new Error('Decrypt requires a function call, e.g., decrypt(getCount())');
    }

    // Build decrypt task name
    const decryptTaskName = `${this.config.contractName.toLowerCase()}:decrypt-${functionName}`;

    // Build command arguments
    const cmdArgs = ['hardhat', decryptTaskName, '--network', this.config.network];

    return new Promise((resolve, reject) => {
      console.log('');

      const child = spawn('npx', cmdArgs, {
        cwd: this.config.projectDir,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        console.log('');
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Decrypt task exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Switch to a different signer
   */
  private async switchSigner(parsed: ParsedCommand): Promise<void> {
    if (parsed.index !== undefined) {
      // Switch by index
      if (parsed.index < 0 || parsed.index >= this.config.signers.length) {
        throw new Error(`Signer index out of range (0-${this.config.signers.length - 1})`);
      }

      this.config.currentSignerIndex = parsed.index;
      const signer = this.config.signers[parsed.index];
      const signerAddress = await signer.getAddress();

      console.log('');
      console.log(
        chalk.green('✅ ') +
          chalk.white(`Switched to signer ${parsed.index}: `) +
          chalk.gray(signerAddress),
      );
      console.log('');
    } else if (parsed.options?.privateKey) {
      // TODO: Support custom private key
      throw new Error('Custom private key not yet supported');
    }
  }

  /**
   * List available signers
   */
  private async listSigners(): Promise<void> {
    console.log('');
    console.log(chalk.bold('Available signers:'));

    for (let index = 0; index < this.config.signers.length; index++) {
      const signer = this.config.signers[index];
      const signerAddress = await signer.getAddress();
      const isCurrent = index === this.config.currentSignerIndex;
      const marker = isCurrent ? chalk.green('●') : chalk.gray('○');
      const suffix = isCurrent ? chalk.green(' [current]') : '';

      console.log(
        `  ${marker} ${index}. ${chalk.white(signerAddress)} ${chalk.gray('(10000 ETH)')}${suffix}`,
      );
    }

    console.log('');
  }

  /**
   * Display transaction history
   */
  private displayHistory(parsed: ParsedCommand): void {
    if (parsed.options?.clear) {
      this.history = [];
      console.log('');
      console.log(chalk.green('✅ ') + 'History cleared');
      console.log('');
      return;
    }

    if (this.history.length === 0) {
      console.log('');
      console.log(chalk.gray('No transaction history'));
      console.log('');
      return;
    }

    console.log('');
    console.log(chalk.bold('Transaction History:'));
    console.log('');

    this.history.forEach((entry) => {
      console.log(chalk.white(`${entry.index}. ${entry.command}`));

      if (entry.txHash) {
        console.log(chalk.gray(`   Tx: ${entry.txHash.slice(0, 10)}...`));
        console.log(chalk.gray(`   Block: ${entry.blockNumber}`));
        console.log(chalk.gray(`   Gas: ${entry.gasUsed?.toString()}`));
        console.log(
          `   Status: ${entry.status === 'Success' ? chalk.green('✅ Success') : chalk.red('✗ Failed')}`,
        );
      } else if (entry.result !== undefined) {
        console.log(chalk.gray(`   Value: ${entry.result}`));
      }

      console.log('');
    });
  }

  /**
   * Replay a transaction from history
   */
  private async replayTransaction(parsed: ParsedCommand): Promise<void> {
    if (parsed.index === undefined) {
      throw new Error('Missing transaction index');
    }

    const entry = this.history.find((e) => e.index === parsed.index);
    if (!entry) {
      throw new Error(`Transaction ${parsed.index} not found in history`);
    }

    console.log('');
    console.log(chalk.gray(`◇  Replaying: ${entry.command}`));
    console.log('');

    // Re-execute the command
    await this.handleInput(entry.command);
  }

  /**
   * Display network information
   */
  private displayNetwork(): void {
    console.log('');
    console.log(chalk.bold('Network:'));
    console.log(`  Name:     ${chalk.cyan(this.config.network)}`);
    console.log(`  Chain ID: ${this.config.chainId}`);
    console.log('');
  }

  /**
   * Display help
   */
  private displayHelp(command?: string): void {
    if (command) {
      // Show help for specific command
      this.displayCommandHelp(command);
      return;
    }

    // Show general help
    console.log('');
    console.log(chalk.bold('ZCraft Interactive REPL'));
    console.log('');

    console.log(chalk.cyan('FUNCTION CALLS:'));
    console.log('  functionName(arg1, arg2)     Call contract function');
    console.log('  encrypt(value)               Encrypt plaintext value');
    console.log('  decrypt(handle)              Decrypt encrypted handle');
    console.log('');

    console.log(chalk.cyan('SIGNERS:'));
    console.log('  signer(index)                Switch to signer at index');
    console.log('  signers                      List all available signers');
    console.log('');

    console.log(chalk.cyan('INTROSPECTION:'));
    console.log('  functions                    List all contract functions');
    console.log('  info                         Show contract information');
    console.log('  fhe                          Analyze FHE operations');
    console.log('');

    console.log(chalk.cyan('HISTORY:'));
    console.log('  history                      Show transaction history');
    console.log('  history clear                Clear history');
    console.log('  replay(index)                Replay transaction');
    console.log('');

    console.log(chalk.cyan('UTILITY:'));
    console.log('  clear                        Clear screen');
    console.log('  help [command]               Show help');
    console.log('  exit                         Exit REPL');
    console.log('');
  }

  /**
   * Display help for a specific command
   */
  private displayCommandHelp(command: string): void {
    const helps: Record<string, string> = {
      decrypt: `decrypt(handle, options)

Decrypt an encrypted handle via Gateway or mock mode.

Examples:
  decrypt(encryptedValue())
  decrypt(balance, signer: 1)
  decrypt(0xabc123...)

Options:
  signer: <index>     Use specific signer (default: current)`,

      encrypt: `encrypt(value)

Encrypt a plaintext value for use in function calls.

Examples:
  encrypt(5)
  myFunction(encrypt(10))`,
    };

    const helpText = helps[command];
    if (helpText) {
      console.log('');
      console.log(chalk.white(helpText));
      console.log('');
    } else {
      console.log('');
      console.log(chalk.yellow(`No detailed help available for: ${command}`));
      console.log(chalk.gray("Try 'help' for a list of commands"));
      console.log('');
    }
  }

  /**
   * Display error message
   */
  private displayError(error: any): void {
    const message = error?.message || String(error);

    console.log('');
    console.log(chalk.red('✗ Error: ') + chalk.white(message));
    console.log('');
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: Omit<HistoryEntry, 'index' | 'timestamp'>): void {
    this.history.push({
      index: this.historyIndex++,
      timestamp: new Date(),
      ...entry,
    });
  }

  /**
   * Exit the REPL
   */
  private exit(): void {
    console.log(chalk.gray('Goodbye!'));
    this.stop();
    process.exit(0);
  }
}
