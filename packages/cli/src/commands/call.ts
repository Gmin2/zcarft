// Call command - Interactive REPL for FHEVM contract interaction
// Provides a command-line interface for calling encrypted contract functions

import { Command, Flags } from '@oclif/core';
import { ethers } from 'ethers';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs/promises';
import { FHEVMRepl, type ReplConfig } from '../repl/repl.js';
import { loadFHEVMFromProject } from '../helpers/load-fhevm.js';

export default class Call extends Command {
  static override description = 'Call deployed FHEVM contract interactively';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --address 0x5FbDB2315678afecb367f032d93F642f64180aa3',
    '<%= config.bin %> <%= command.id %> --function increment --args "[5]"',
    '<%= config.bin %> <%= command.id %> --function getCount --decrypt',
  ];

  static override flags = {
    address: Flags.string({
      char: 'a',
      description: 'Contract address',
      required: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network name',
      default: 'localhost',
    }),
    signer: Flags.string({
      char: 's',
      description: 'Signer index or private key',
      default: '0',
    }),
    function: Flags.string({
      char: 'f',
      description: 'Function to call (non-interactive)',
      required: false,
    }),
    args: Flags.string({
      description: 'Function arguments as JSON array',
      required: false,
    }),
    decrypt: Flags.boolean({
      char: 'd',
      description: 'Auto-decrypt result',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Call);

    try {
      // Find project directory
      const projectDir = await this.findProjectDir();

      // Check if this is a Hardhat project with the REPL task
      const isHardhatProject = await this.isHardhatProject(projectDir);

      if (isHardhatProject) {
        // Use the Hardhat task instead
        this.log(chalk.gray('Launching Hardhat REPL task...'));

        const { spawn } = await import('child_process');
        const hardhatArgs = ['hardhat', 'repl', '--network', flags.network];

        if (flags.address) {
          hardhatArgs.push('--contract', flags.address);
        }

        if (flags.function) {
          hardhatArgs.push('--function', flags.function);
        }

        if (flags.args) {
          hardhatArgs.push('--args', flags.args);
        }

        const hardhat = spawn('npx', hardhatArgs, {
          cwd: projectDir,
          stdio: 'inherit',
        });

        return new Promise((resolve, reject) => {
          hardhat.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Hardhat task exited with code ${code}`));
            }
          });
        });
      }

      // Display banner
      this.printBanner();

      // Get network configuration
      const networkConfig = await this.getNetworkConfig(flags.network, projectDir);

      // Get contract information
      const contractInfo = await this.getContractInfo(
        flags.address,
        projectDir,
        flags.network,
      );

      // Setup providers and signers
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const signers = await this.getSigners(provider, flags.signer);

      // Initialize FHEVM
      const fhevm = await this.initializeFHEVM(projectDir);

      // Load contract
      const contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        provider,
      );

      // Get chain ID
      const network = await provider.getNetwork();

      // Create REPL config
      const config: ReplConfig = {
        contract,
        contractName: contractInfo.name,
        contractAddress: contractInfo.address,
        signers,
        currentSignerIndex: 0,
        network: flags.network,
        chainId: Number(network.chainId),
        fhevm,
        mode: flags.network === 'localhost' ? 'MOCK' : 'GATEWAY',
      };

      // Check if non-interactive mode
      if (flags.function) {
        await this.executeNonInteractive(config, flags);
      } else {
        // Launch interactive REPL
        const repl = new FHEVMRepl(config);
        await repl.start();
      }
    } catch (error) {
      this.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Print banner
   */
  private printBanner(): void {
    this.log('');
    this.log(chalk.green('T') + '   ' + chalk.bold.white('ZCraft') + ' : ' + chalk.gray('Call Contract'));
    this.log(chalk.green('|'));
  }

  /**
   * Check if this is a Hardhat project
   */
  private async isHardhatProject(projectDir: string): Promise<boolean> {
    try {
      const files = await fs.readdir(projectDir);
      return files.some((f) => f === 'hardhat.config.ts' || f === 'hardhat.config.js');
    } catch {
      return false;
    }
  }

  /**
   * Find project directory
   */
  private async findProjectDir(): Promise<string> {
    let currentDir = process.cwd();

    // Look for hardhat.config.ts or hardhat.config.js
    while (currentDir !== '/') {
      try {
        const files = await fs.readdir(currentDir);
        const hasHardhatConfig = files.some(
          (f) => f === 'hardhat.config.ts' || f === 'hardhat.config.js',
        );

        if (hasHardhatConfig) {
          return currentDir;
        }
      } catch {
        // Ignore errors and continue
      }

      currentDir = path.dirname(currentDir);
    }

    // Default to current working directory
    return process.cwd();
  }

  /**
   * Get network configuration
   */
  private async getNetworkConfig(
    network: string,
    projectDir: string,
  ): Promise<{ rpcUrl: string; chainId?: number }> {
    const configs: Record<string, { rpcUrl: string; chainId?: number }> = {
      localhost: {
        rpcUrl: 'http://localhost:8545',
        chainId: 31337,
      },
      sepolia: {
        rpcUrl: 'https://rpc.sepolia.org',
        chainId: 11155111,
      },
    };

    if (configs[network]) {
      return configs[network];
    }

    // Try to read from hardhat config
    // For now, return localhost as default
    return {
      rpcUrl: network.startsWith('http') ? network : 'http://localhost:8545',
    };
  }

  /**
   * Get contract information
   */
  private async getContractInfo(
    address: string | undefined,
    projectDir: string,
    network: string,
  ): Promise<{ name: string; address: string; abi: any[] }> {
    // If address provided, try to find deployment file
    if (address) {
      const contractName = await this.findContractName(address, projectDir, network);
      const abi = await this.loadContractABI(contractName, projectDir);

      return {
        name: contractName,
        address,
        abi,
      };
    }

    // Try to find deployments
    const deploymentsDir = path.join(projectDir, 'deployments', network);

    try {
      const files = await fs.readdir(deploymentsDir);
      const deployments = files.filter((f) => f.endsWith('.json') && !f.includes('solcInput'));

      if (deployments.length === 0) {
        throw new Error(`No deployments found for network: ${network}`);
      }

      // If only one deployment, use it
      if (deployments.length === 1) {
        const contractName = deployments[0].replace('.json', '');
        const deployment = await this.loadDeployment(contractName, deploymentsDir);

        return {
          name: contractName,
          address: deployment.address,
          abi: deployment.abi,
        };
      }

      // Multiple deployments, prompt user
      const { selectedContract } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedContract',
          message: 'Select deployed contract',
          choices: deployments.map((f) => {
            const name = f.replace('.json', '');
            return { name, value: name };
          }),
        },
      ]);

      const deployment = await this.loadDeployment(selectedContract, deploymentsDir);

      return {
        name: selectedContract,
        address: deployment.address,
        abi: deployment.abi,
      };
    } catch (error) {
      // No deployments found, prompt for address
      const { contractAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'contractAddress',
          message: 'Enter contract address:',
          validate: (input) => {
            if (!ethers.isAddress(input)) {
              return 'Invalid Ethereum address';
            }
            return true;
          },
        },
      ]);

      const { contractName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'contractName',
          message: 'Enter contract name:',
          default: 'Contract',
        },
      ]);

      const abi = await this.loadContractABI(contractName, projectDir);

      return {
        name: contractName,
        address: contractAddress,
        abi,
      };
    }
  }

  /**
   * Find contract name from address
   */
  private async findContractName(
    address: string,
    projectDir: string,
    network: string,
  ): Promise<string> {
    const deploymentsDir = path.join(projectDir, 'deployments', network);

    try {
      const files = await fs.readdir(deploymentsDir);

      for (const file of files) {
        if (!file.endsWith('.json') || file.includes('solcInput')) continue;

        const deployment = await this.loadDeployment(file.replace('.json', ''), deploymentsDir);

        if (deployment.address.toLowerCase() === address.toLowerCase()) {
          return file.replace('.json', '');
        }
      }
    } catch {
      // Ignore errors
    }

    // Prompt user for contract name
    const { contractName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'contractName',
        message: 'Enter contract name:',
        default: 'Contract',
      },
    ]);

    return contractName;
  }

  /**
   * Load deployment file
   */
  private async loadDeployment(
    contractName: string,
    deploymentsDir: string,
  ): Promise<{ address: string; abi: any[] }> {
    const deploymentPath = path.join(deploymentsDir, `${contractName}.json`);
    const content = await fs.readFile(deploymentPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Load contract ABI
   */
  private async loadContractABI(contractName: string, projectDir: string): Promise<any[]> {
    // Try to load from artifacts
    const artifactPath = path.join(
      projectDir,
      'artifacts',
      'contracts',
      `${contractName}.sol`,
      `${contractName}.json`,
    );

    try {
      const content = await fs.readFile(artifactPath, 'utf-8');
      const artifact = JSON.parse(content);
      return artifact.abi;
    } catch {
      // Try deployments
      try {
        const deploymentsDir = path.join(projectDir, 'deployments', 'localhost');
        const deployment = await this.loadDeployment(contractName, deploymentsDir);
        return deployment.abi;
      } catch {
        throw new Error(`Could not find ABI for contract: ${contractName}`);
      }
    }
  }

  /**
   * Get signers
   */
  private async getSigners(
    provider: ethers.JsonRpcProvider,
    signerFlag: string,
  ): Promise<any[]> {
    // For localhost, use Hardhat's default accounts
    const accounts = await provider.listAccounts();

    if (accounts.length === 0) {
      throw new Error('No signers available');
    }

    // Convert to ethers.Wallet-like objects
    const signers = await Promise.all(
      accounts.map(async (_, index) => await provider.getSigner(index))
    );

    return signers;
  }

  /**
   * Initialize FHEVM
   */
  private async initializeFHEVM(projectDir: string): Promise<any> {
    // Try to load FHEVM from Hardhat project
    try {
      const fhevm = await loadFHEVMFromProject(projectDir);
      this.log(chalk.green('✅ Loaded Hardhat FHEVM plugin'));
      return fhevm;
    } catch (error) {
      this.warn(
        chalk.yellow(
          'Could not load Hardhat FHEVM plugin. Using mock encryption (limited functionality).',
        ),
      );
      this.warn(chalk.gray(`Tip: Make sure you're running from a Hardhat project with @fhevm/hardhat-plugin installed.`));
    }

    // Return a mock FHEVM instance for basic functionality
    const mockInput = {
      add8: function() { return this; },
      add16: function() { return this; },
      add32: function() { return this; },
      add64: function() { return this; },
      add128: function() { return this; },
      add256: function() { return this; },
      addBool: function() { return this; },
      addAddress: function() { return this; },
      encrypt: async () => ({
        handles: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
        inputProof: '0x',
      }),
    };

    return {
      createEncryptedInput: () => mockInput,
      userDecryptEuint: async () => 0n,
      userDecryptEbool: async () => false,
      userDecryptEaddress: async () => '0x0000000000000000000000000000000000000000',
    };
  }

  /**
   * Execute non-interactive function call
   */
  private async executeNonInteractive(config: ReplConfig, flags: any): Promise<void> {
    this.error(
      chalk.yellow('Non-interactive mode with encryption is not yet fully implemented.\n') +
      chalk.gray('Please use interactive mode by running: ') +
      chalk.cyan('zcraft call') +
      chalk.gray('\nThen call functions like: ') +
      chalk.white('increment(5)')
    );
  }
}
