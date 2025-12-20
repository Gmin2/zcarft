// Interactive REPL engine for FHEVM contract interaction
// Provides command-line interface for calling encrypted contract functions

import { createInterface, type Interface as ReadlineInterface } from 'readline';
import { Contract, type TransactionReceipt, type Signer } from 'ethers';
import chalk from 'chalk';
import {
  parseCommand,
  shouldEncrypt,
  unwrapEncrypted,
  type ParsedCommand,
} from './parser.js';
import { EncryptionHelper, FhevmType } from './encryption.js';
import { FHEOperationAnalyzer, type FHEAnalysis } from './fhe-analyzer.js';

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
  fhevm: any; // FhevmInstance from Hardhat plugin
  mode: 'MOCK' | 'GATEWAY';
}

/**
 * Interactive REPL for FHEVM contract interaction
 */
export class FHEVMRepl {
  private rl: ReadlineInterface | null;
  private history: HistoryEntry[];
  private historyIndex: number;
  private encryptionHelper: EncryptionHelper;
  private analyzer: FHEOperationAnalyzer;
  private isRunning: boolean;
  private config: ReplConfig;

  constructor(config: ReplConfig) {
    this.config = config;
    this.rl = null;
    this.history = [];
    this.historyIndex = 1;
    this.isRunning = false;
    this.encryptionHelper = new EncryptionHelper(config.fhevm);
    this.analyzer = new FHEOperationAnalyzer();
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
    const { contractName, contractAddress, network, mode, signers, currentSignerIndex } =
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
      `${chalk.bold(contractName)}@${chalk.gray(shortAddr)} [${chalk.cyan(network)}] [${chalk.yellow(mode.toLowerCase())}] >`,
    );
    console.log('');

    console.log(chalk.bold('Mode: ') + chalk.yellow(mode) + ' encryption (instant)');
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
      const icon = isView ? '📖' : '📝';

      const params = func.inputs
        .map((input: any) => `${input.internalType || input.type} ${input.name}`)
        .join(', ');
      const returnType = func.outputs.length > 0
        ? ` → ${func.outputs[0].internalType || func.outputs[0].type}`
        : '';

      console.log(`  ${icon} ${chalk.white(func.name)}(${chalk.gray(params)})${chalk.cyan(returnType)}`);
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

      case 'info':
        this.displayInfo();
        break;

      case 'fhe':
        this.displayFHEAnalysis();
        break;

      case 'history':
        this.displayHistory(parsed);
        break;

      case 'replay':
        await this.replayTransaction(parsed);
        break;

      case 'network':
        this.displayNetwork();
        break;

      case 'mode':
        this.displayMode();
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
    const { contract, fhevm, currentSignerIndex, signers, contractAddress } = this.config;

    // Get function fragment from ABI
    const func = contract.interface.getFunction(functionName);
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }

    // Prepare arguments with encryption
    const preparedArgs = await this.prepareArguments(func, args);

    // Determine if this is a view/pure function
    const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';

    if (isView) {
      // Call view function
      const contractWithMethods = contract as any;
      const result = await contractWithMethods[functionName](...preparedArgs);

      // Add to history
      this.addToHistory({
        command: rawInput,
        functionName,
        args,
        result,
      });

      // Display result
      console.log('');
      console.log(chalk.green('✅ ') + chalk.white(`Handle: ${result}`));

      // Check if it's an encrypted type
      const outputType = func.outputs[0]?.type;
      if (outputType && this.isEncryptedType(outputType)) {
        console.log(chalk.gray(`   Type: ${outputType}`));
        console.log(chalk.gray('   To decrypt: ') + chalk.cyan(`decrypt(${functionName}())`));
      }

      console.log('');
    } else {
      // Execute transaction
      console.log('');
      console.log(chalk.gray('◇  Sending transaction...'));

      const contractWithMethods = contract.connect(signers[currentSignerIndex]) as any;
      const tx = await contractWithMethods[functionName](...preparedArgs);

      console.log(chalk.gray(`◇  Wait for tx:${tx.hash.slice(0, 10)}...`));

      const receipt = await tx.wait();

      // Add to history
      this.addToHistory({
        command: rawInput,
        functionName,
        args,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        status: receipt.status === 1 ? 'Success' : 'Failed',
      });

      // Display transaction result
      this.displayTransactionResult(receipt);

      // Analyze FHE operations
      const analysis = this.analyzer.analyzeTransaction(receipt, contract.interface);
      if (analysis.operations.length > 0) {
        console.log(chalk.bold('FHE Operations Detected:'));
        this.analyzer.getSummary(analysis).forEach((op) => {
          console.log(`  - ${chalk.white(op)}`);
        });
        console.log('');
      }
    }
  }

  /**
   * Prepare function arguments with encryption
   */
  private async prepareArguments(func: any, args: any[]): Promise<any[]> {
    const { fhevm, currentSignerIndex, signers, contractAddress } = this.config;
    const prepared: any[] = [];
    let argIndex = 0;

    for (let i = 0; i < func.inputs.length; i++) {
      const param = func.inputs[i];
      // Use internalType for FHEVM types, fallback to type
      const paramType = param.internalType || param.type;

      // Check if this parameter needs encryption
      const encryptionInfo = EncryptionHelper.detectEncryptionType(paramType);

      if (encryptionInfo.needsEncryption) {
        // This is an encrypted parameter (e.g., externalEuint32)
        // Need to provide both the handle and the inputProof

        let value = args[argIndex];
        const needsEncryption = !shouldEncrypt(value);

        if (needsEncryption) {
          value = unwrapEncrypted(value);

          // Encrypt the value
          console.log(chalk.gray(`◇  Encrypting ${param.name || `param${i}`}: ${value}`));

          const signerAddress = await signers[currentSignerIndex].getAddress();
          const encrypted = await this.encryptionHelper.encrypt(
            value,
            encryptionInfo.encryptionType! as 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256' | 'bool' | 'address',
            contractAddress,
            signerAddress,
          );

          // Add handle and inputProof
          prepared.push(encrypted.handle);
          prepared.push(encrypted.inputProof);
        } else {
          // Already encrypted, use as-is
          prepared.push(value);
        }

        argIndex++;
      } else if (paramType === 'bytes' && i > 0 && func.inputs[i - 1].type.startsWith('external')) {
        // This is likely the inputProof parameter, skip it (already handled above)
        // Don't increment argIndex
        continue;
      } else {
        // Regular parameter
        prepared.push(args[argIndex]);
        argIndex++;
      }
    }

    return prepared;
  }

  /**
   * Handle decrypt command
   */
  private async handleDecrypt(parsed: ParsedCommand): Promise<void> {
    if (!parsed.expression) {
      throw new Error('Missing expression to decrypt');
    }

    console.log('');
    console.log(chalk.gray('◇  Fetching encrypted handle...'));

    // Check if expression is a function call or a direct handle
    let handle: string;

    if (parsed.expression.includes('(')) {
      // It's a function call like getCount()
      const funcParsed = parseCommand(parsed.expression);
      if (funcParsed.type !== 'function_call') {
        throw new Error('Invalid decrypt expression');
      }

      // Call the function to get the handle
      const contractWithMethods = this.config.contract as any;
      const result = await contractWithMethods[funcParsed.functionName!](
        ...(funcParsed.args || []),
      );
      handle = result;
    } else {
      // It's a direct handle
      handle = parsed.expression;
    }

    console.log(chalk.gray(`   Handle: ${handle.slice(0, 10)}...`));
    console.log(chalk.gray('   Type: euint32')); // TODO: detect type

    console.log('');
    console.log(chalk.gray(`◇  Requesting decryption from ${this.config.mode}...`));

    // Decrypt using the current signer
    const decrypted = await this.encryptionHelper.decrypt(
      handle,
      2, // FhevmType.euint32 - TODO: detect from function
      this.config.contractAddress,
      this.config.signers[this.config.currentSignerIndex],
    );

    // Display result
    console.log('');
    console.log(chalk.green('┌─────────────────────────────────────────┐'));
    console.log(chalk.green('│') + chalk.bold.white('  ✅ Decryption Successful               ') + chalk.green('│'));
    console.log(chalk.green('├─────────────────────────────────────────┤'));
    console.log(
      chalk.green('│') +
        `  Encrypted Handle: ${handle.slice(0, 12)}...`.padEnd(41) +
        chalk.green('│'),
    );
    console.log(
      chalk.green('│') + `  Decrypted Value:  ${decrypted}`.padEnd(41) + chalk.green('│'),
    );
    console.log(chalk.green('│') + `  Type:             euint32`.padEnd(41) + chalk.green('│'));
    console.log(
      chalk.green('│') +
        `  Range:            0 - 4,294,967,295`.padEnd(41) +
        chalk.green('│'),
    );
    console.log(chalk.green('└─────────────────────────────────────────┘'));
    console.log('');

    console.log(chalk.cyan('Privacy Note:'));
    console.log(chalk.gray('  Only you can see this value (FHE.allow granted)'));
    console.log('');

    // Add to history
    this.addToHistory({
      command: `decrypt(${parsed.expression})`,
      result: decrypted,
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
   * Display contract information
   */
  private displayInfo(): void {
    const { contractName, contractAddress, network, chainId, mode } = this.config;

    console.log('');
    console.log(chalk.bold('Contract Information:'));
    console.log(`  Name:    ${chalk.white(contractName)}`);
    console.log(`  Address: ${chalk.white(contractAddress)}`);
    console.log(`  Network: ${chalk.cyan(network)} ${chalk.gray(`(chainId: ${chainId})`)}`);
    console.log(`  Mode:    ${chalk.yellow(mode)}`);
    console.log('');
  }

  /**
   * Display FHE analysis for the contract
   */
  private displayFHEAnalysis(): void {
    const abi = this.config.contract.interface.fragments.filter(
      (f: any) => f.type === 'function',
    );
    this.analyzer.displayContractAnalysis(this.config.contractName, abi);
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
    console.log(`  Mode:     ${chalk.yellow(this.config.mode)} encryption`);
    console.log('');
  }

  /**
   * Display mode information
   */
  private displayMode(): void {
    const { mode } = this.config;

    console.log('');
    console.log(chalk.bold(`Current mode: ${chalk.yellow(mode)}`));

    if (mode === 'MOCK') {
      console.log(chalk.gray('  Encryption: Synchronous (instant)'));
      console.log(chalk.gray('  Decryption: User-side (no Gateway)'));
    } else {
      console.log(chalk.gray('  Encryption: Asynchronous (via Gateway)'));
      console.log(chalk.gray('  Decryption: Gateway-based'));
    }

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
  decrypt(getCount())
  decrypt(balance, signer: 1)
  decrypt(0xabc123...)

Options:
  signer: <index>     Use specific signer (default: current)`,

      encrypt: `encrypt(value)

Encrypt a plaintext value for use in function calls.

Examples:
  encrypt(5)
  increment(encrypt(10))`,
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
   * Display transaction result
   */
  private displayTransactionResult(receipt: TransactionReceipt): void {
    const gasPrice = receipt.gasPrice || 1n;
    const totalCost = receipt.gasUsed * gasPrice;
    const status = receipt.status === 1 ? '✅ Confirmed' : '✗ Failed';

    console.log('');
    console.log(chalk.green('┌─────────────────────────────────────────┐'));
    console.log(chalk.green('│') + chalk.bold.white('  ✅ Transaction Successful              ') + chalk.green('│'));
    console.log(chalk.green('├─────────────────────────────────────────┤'));
    console.log(
      chalk.green('│') +
        `  Tx Hash:    ${receipt.hash.slice(0, 12)}...`.padEnd(41) +
        chalk.green('│'),
    );
    console.log(
      chalk.green('│') +
        `  Block:      ${receipt.blockNumber}`.padEnd(41) +
        chalk.green('│'),
    );
    console.log(
      chalk.green('│') +
        `  Gas Used:   ${receipt.gasUsed.toString()}`.padEnd(41) +
        chalk.green('│'),
    );
    console.log(
      chalk.green('│') +
        `  Status:     ${status}`.padEnd(50) +
        chalk.green('│'),
    );
    console.log(chalk.green('└─────────────────────────────────────────┘'));
    console.log('');
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
   * Check if a type is an encrypted type
   */
  private isEncryptedType(type: string): boolean {
    return (
      type.startsWith('euint') ||
      type === 'ebool' ||
      type === 'eaddress' ||
      type.startsWith('externalEuint') ||
      type === 'externalEbool' ||
      type === 'externalEaddress'
    );
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
