import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { ethers } from "ethers";

/**
 * Execute a command (function call or decrypt) in non-interactive mode
 */
async function executeCommand(cmd: string, context: any) {
  const {
    contract,
    contractABI,
    contractAddress,
    signers,
    iface,
    fhevm,
    ethers: ethersInstance
  } = context;

  const currentSignerIndex = 0; // Use first signer for non-interactive

  // Helper to encrypt values
  async function encryptValue(value: number | bigint, type: string, contractAddr: string, userAddr: string) {
    const input = fhevm.createEncryptedInput(contractAddr, userAddr);

    if (type.includes('32')) {
      input.add32(Number(value));
    } else if (type.includes('64')) {
      input.add64(BigInt(value));
    } else if (type.includes('16')) {
      input.add16(Number(value));
    } else if (type.includes('8')) {
      input.add8(Number(value));
    } else if (type.includes('bool')) {
      input.addBool(Boolean(value));
    }

    return await input.encrypt();
  }

  // Helper to decrypt values
  async function decryptValue(handle: string, type: number, contractAddr: string, signer: any) {
    return await fhevm.userDecryptEuint(type, handle, contractAddr, signer);
  }

  // Helper to detect encrypted types
  function getEncryptionType(paramType: string): { needsEncryption: boolean; encryptionType?: string } {
    if (paramType.startsWith('externalEuint')) {
      const bits = paramType.replace('externalEuint', '');
      return { needsEncryption: true, encryptionType: `uint${bits}` };
    }
    return { needsEncryption: false };
  }

  try {
    // Handle decrypt(...)
    if (cmd.startsWith('decrypt(')) {
      const match = cmd.match(/decrypt\((.+)\)/);
      if (match) {
        const expression = match[1];

        console.log("");

        // Execute the inner expression to get the handle
        let handle: string;
        let returnType: string | undefined;

        if (expression.includes('(')) {
          // It's a function call
          const funcMatch = expression.match(/^(\w+)\((.*?)\)$/);
          if (funcMatch) {
            const [, funcName, argsStr] = funcMatch;
            const args = argsStr ? argsStr.split(',').map((a: string) => {
              const trimmed = a.trim();
              if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
              return trimmed;
            }) : [];

            // Get the return type from ABI
            const func = iface.getFunction(funcName);
            if (func && func.outputs.length > 0) {
              const abiFragment = contractABI.find((item: any) =>
                item.type === 'function' && item.name === funcName
              );
              if (abiFragment && abiFragment.outputs && abiFragment.outputs[0]) {
                returnType = abiFragment.outputs[0].internalType || abiFragment.outputs[0].type;
              } else {
                returnType = func.outputs[0].type;
              }
            }

            handle = await contract.getFunction(funcName)(...args);
          } else {
            throw new Error('Invalid function call');
          }
        } else {
          handle = expression;
        }

        // Map return type to FhevmType enum value
        let fhevmTypeValue = 4; // default to euint32
        if (returnType) {
          if (returnType === 'ebool') fhevmTypeValue = 0;
          else if (returnType === 'euint4') fhevmTypeValue = 1;
          else if (returnType === 'euint8') fhevmTypeValue = 2;
          else if (returnType === 'euint16') fhevmTypeValue = 3;
          else if (returnType === 'euint32') fhevmTypeValue = 4;
          else if (returnType === 'euint64') fhevmTypeValue = 5;
          else if (returnType === 'euint128') fhevmTypeValue = 6;
          else if (returnType === 'eaddress') fhevmTypeValue = 7;
          else if (returnType === 'euint256') fhevmTypeValue = 8;
        }

        console.log("\x1b[90m◇  Decrypting...\x1b[0m");

        const decrypted = await decryptValue(handle, fhevmTypeValue, contractAddress, signers[currentSignerIndex]);

        console.log("");
        console.log("\x1b[32m✅ Decrypted value:\x1b[0m \x1b[37m" + decrypted + "\x1b[0m");
        console.log("");

        return;
      }
    }

    // Handle function calls
    const functionMatch = cmd.match(/^(\w+)\s*\(\s*(.*?)\s*\)$/);
    if (functionMatch) {
      const [, functionName, argsStr] = functionMatch;

      // Get function from ABI
      const func = iface.getFunction(functionName);
      if (!func) {
        throw new Error(`Function '${functionName}' not found`);
      }

      // Parse arguments
      const args = argsStr ? argsStr.split(',').map((a: string) => {
        const trimmed = a.trim();
        if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
        if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return trimmed;
        if (/^["'].*["']$/.test(trimmed)) return trimmed.slice(1, -1);
        return trimmed;
      }) : [];

      // Check if this is a view function
      const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';

      if (isView) {
        // Call view function
        const result = await contract.getFunction(functionName)(...args);

        console.log("");
        console.log(`\x1b[32m✅\x1b[0m \x1b[37mHandle: ${result}\x1b[0m`);

        const outputType = func.outputs[0]?.internalType || func.outputs[0]?.type;
        if (outputType && (outputType.startsWith('euint') || outputType.startsWith('ebool'))) {
          console.log(`\x1b[90m   Type: ${outputType}\x1b[0m`);
          console.log(`\x1b[90m   To decrypt, run:\x1b[0m \x1b[36mzcraft call --function decrypt --args "${functionName}()"\x1b[0m`);
        }
        console.log("");
      } else {
        // Prepare arguments with encryption
        const preparedArgs: any[] = [];
        let argIndex = 0;

        for (let i = 0; i < func.inputs.length; i++) {
          const param = func.inputs[i];

          const abiFragment = contractABI.find((item: any) =>
            item.type === 'function' && item.name === functionName
          );

          let paramType = param.type;
          if (abiFragment && abiFragment.inputs && abiFragment.inputs[i]) {
            paramType = abiFragment.inputs[i].internalType || abiFragment.inputs[i].type;
          }

          const encInfo = getEncryptionType(paramType);

          if (encInfo.needsEncryption) {
            const value = args[argIndex];

            console.log("");
            console.log(`\x1b[90m◇  Encrypting ${param.name || 'value'}: ${value}\x1b[0m`);

            const signerAddr = await signers[currentSignerIndex].getAddress();
            const encrypted = await encryptValue(value, encInfo.encryptionType!, contractAddress, signerAddr);

            console.log(`\x1b[32m   ✓\x1b[0m \x1b[90mEncrypted successfully\x1b[0m`);

            preparedArgs.push(encrypted.handles[0]);

            if (i + 1 < func.inputs.length) {
              const nextParam = func.inputs[i + 1];
              const nextType = nextParam.internalType || nextParam.type;
              if (nextType === 'bytes' && nextParam.name === 'inputProof') {
                (preparedArgs as any).pendingProof = encrypted.inputProof;
              }
            }

            argIndex++;
          } else if (paramType === 'bytes' && param.name === 'inputProof') {
            const pendingProof = (preparedArgs as any).pendingProof;
            if (pendingProof) {
              preparedArgs.push(pendingProof);
              delete (preparedArgs as any).pendingProof;
            } else {
              preparedArgs.push(args[argIndex]);
              argIndex++;
            }
          } else {
            preparedArgs.push(args[argIndex]);
            argIndex++;
          }
        }

        delete (preparedArgs as any).pendingProof;

        console.log("\x1b[90m◇  Sending transaction...\x1b[0m");

        const connectedContract = contract.connect(signers[currentSignerIndex]);
        const contractFunction = connectedContract.getFunction(functionName);

        if (!contractFunction) {
          throw new Error(`Function ${functionName} not found on contract`);
        }

        const tx = await contractFunction(...preparedArgs);
        console.log(`\x1b[90m◇  Wait for tx:${tx.hash.slice(0, 10)}...\x1b[0m`);

        const receipt = await tx.wait();

        console.log("");
        console.log("\x1b[32m✅ Transaction Successful\x1b[0m");
        console.log(`\x1b[90m   Tx Hash:    ${tx.hash.slice(0, 12)}...\x1b[0m`);
        console.log(`\x1b[90m   Block:      ${receipt.blockNumber}\x1b[0m`);
        console.log(`\x1b[90m   Gas Used:   ${receipt.gasUsed.toString()}\x1b[0m`);
        console.log("");
      }

      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } catch (error: any) {
    console.log("");
    console.log(`\x1b[31m✗ Error:\x1b[0m ${error.message}`);
    console.log("");
    throw error;
  }
}

/**
 * Interactive REPL task for calling FHEVM contracts
 *
 * Usage:
 *   Interactive:
 *     npx hardhat repl --network localhost
 *     npx hardhat repl --network sepolia --contract 0x1234...
 *
 *   Non-interactive:
 *     npx hardhat repl --function increment --args "10" --network localhost
 *     npx hardhat repl --function decrypt --args "getCount()" --network localhost
 */
task("repl", "Launch interactive REPL for calling FHEVM contracts")
  .addOptionalParam("contract", "Contract address (if multiple deployments)")
  .addOptionalParam("function", "Function to call (non-interactive mode)")
  .addOptionalParam("args", "Function arguments (comma-separated, non-interactive mode)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm, network } = hre;

    // Initialize FHEVM CLI API
    await fhevm.initializeCLIApi();

    // Get contract deployment
    let contractAddress: string;
    let contractName: string;
    let contractABI: any[];

    if (taskArguments.contract) {
      contractAddress = taskArguments.contract;
      // Try to find contract name from deployments
      const allDeployments = await deployments.all();
      const found = Object.entries(allDeployments).find(
        ([, deployment]) => deployment.address.toLowerCase() === contractAddress.toLowerCase()
      );

      if (found) {
        contractName = found[0];
        contractABI = found[1].abi;
      } else {
        // Ask user for contract name
        contractName = "Contract";
        // Would need to load ABI somehow - for now just error
        throw new Error("Please specify contract name or deploy the contract first");
      }
    } else {
      // Get first deployed contract
      const allDeployments = await deployments.all();
      const deploymentNames = Object.keys(allDeployments);

      if (deploymentNames.length === 0) {
        throw new Error("No contracts deployed. Run 'npx hardhat deploy' first.");
      }

      // Use FHECounter if available, otherwise first deployment
      contractName = deploymentNames.includes("FHECounter") ? "FHECounter" : deploymentNames[0];
      const deployment = allDeployments[contractName];
      contractAddress = deployment.address;
      contractABI = deployment.abi;
    }

    // Get signers
    const signers = await ethers.getSigners();

    // Create contract instance
    const contract = await ethers.getContractAt(contractName, contractAddress);

    // Get network info
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const networkName = network.name;

    console.log("");
    console.log("\x1b[32m┌──\x1b[0m \x1b[1mZCraft\x1b[0m : \x1b[90mCall Contract\x1b[0m");
    console.log("\x1b[32m│\x1b[0m");
    console.log("\x1b[32m└──\x1b[0m \x1b[32m✅ Connected to\x1b[0m \x1b[37m" + contractName + "\x1b[0m");
    console.log("");

    const shortAddr = `${contractAddress.slice(0, 8)}...${contractAddress.slice(-4)}`;
    const mode = networkName === "localhost" || networkName === "hardhat" ? "mock" : "gateway";

    console.log(`\x1b[1m${contractName}\x1b[0m@\x1b[90m${shortAddr}\x1b[0m [\x1b[36m${networkName}\x1b[0m] [\x1b[33m${mode}\x1b[0m] >`);
    console.log("");

    console.log(`\x1b[1mMode:\x1b[0m \x1b[33m${mode.toUpperCase()}\x1b[0m encryption (instant)`);
    console.log(`\x1b[1mNetwork:\x1b[0m \x1b[36m${networkName}\x1b[0m \x1b[90m(chainId: ${chainId})\x1b[0m`);
    const signerAddr = await signers[0].getAddress();
    console.log(`\x1b[1mSigner:\x1b[0m \x1b[90m${signerAddr.slice(0, 10)}...${signerAddr.slice(-4)}\x1b[0m`);
    console.log("");

    // Display available functions
    console.log("\x1b[1mAvailable functions:\x1b[0m");
    const iface = contract.interface;
    const functions = iface.fragments.filter((f: any) => f.type === 'function');

    functions.forEach((func: any) => {
      const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';
      const icon = isView ? '📖' : '📝';
      const params = func.inputs
        .map((input: any) => `${input.internalType || input.type} ${input.name}`)
        .join(', ');
      const returnType = func.outputs.length > 0
        ? ` → ${func.outputs[0].internalType || func.outputs[0].type}`
        : '';
      console.log(`  ${icon} \x1b[37m${func.name}\x1b[0m(\x1b[90m${params}\x1b[0m)\x1b[36m${returnType}\x1b[0m`);
    });

    console.log("");
    console.log("\x1b[36m💡 Tip:\x1b[0m Type \x1b[33m'help'\x1b[0m to see all available commands");
    console.log("\x1b[90m      (signer switching, balance checks, gas stats, encryption tools, and more!)\x1b[0m");
    console.log("");

    // Check if non-interactive mode is requested
    if (taskArguments.function) {
      // Non-interactive mode - execute function and exit
      const functionName = taskArguments.function;
      const argsStr = taskArguments.args || '';

      // Build command string
      let command: string;
      if (functionName === 'decrypt') {
        command = `decrypt(${argsStr})`;
      } else {
        command = `${functionName}(${argsStr})`;
      }

      console.log(`\x1b[90m◇  Executing: ${command}\x1b[0m`);
      console.log("");

      // Execute the command (we'll need to extract the command execution logic)
      await executeCommand(command, {
        contract,
        contractABI,
        contractAddress,
        signers,
        iface,
        fhevm,
        ethers
      });

      return; // Exit after execution
    }

    // Now launch the actual REPL
    // Import readline for interactive input
    const readline = require('readline');

    // Keep process alive
    process.stdin.setRawMode(false);
    process.stdin.resume();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\x1b[32m>\x1b[0m ',
      terminal: true
    });

    let currentSignerIndex = 0;
    const history: any[] = [];
    let historyIndex = 1;
    let totalGasUsed = BigInt(0);
    let totalTransactions = 0;

    // Helper to encrypt values
    async function encryptValue(value: number | bigint, type: string, contractAddr: string, userAddr: string) {
      const input = fhevm.createEncryptedInput(contractAddr, userAddr);

      if (type.includes('32')) {
        input.add32(Number(value));
      } else if (type.includes('64')) {
        input.add64(BigInt(value));
      } else if (type.includes('16')) {
        input.add16(Number(value));
      } else if (type.includes('8')) {
        input.add8(Number(value));
      } else if (type.includes('bool')) {
        input.addBool(Boolean(value));
      }

      return await input.encrypt();
    }

    // Helper to decrypt values
    async function decryptValue(handle: string, type: number, contractAddr: string, signer: any) {
      return await fhevm.userDecryptEuint(type, handle, contractAddr, signer);
    }

    // Helper to detect encrypted types
    function getEncryptionType(paramType: string): { needsEncryption: boolean; encryptionType?: string } {
      if (paramType.startsWith('externalEuint')) {
        const bits = paramType.replace('externalEuint', '');
        return { needsEncryption: true, encryptionType: `uint${bits}` };
      }
      return { needsEncryption: false };
    }

    rl.on('line', async (input: string) => {
      const cmd = input.trim();

      if (!cmd) {
        rl.prompt();
        return;
      }

      try {
        // Handle special commands
        if (cmd === 'exit' || cmd === 'quit') {
          console.log('\x1b[90mGoodbye!\x1b[0m');
          process.exit(0);
        }

        if (cmd === 'help') {
          console.log("");
          console.log("\x1b[32m┌────────────────────────────────────────────────────────────┐\x1b[0m");
          console.log("\x1b[32m│\x1b[0m  \x1b[1m\x1b[33mZCraft Interactive REPL - Command Reference\x1b[0m             \x1b[32m│\x1b[0m");
          console.log("\x1b[32m└────────────────────────────────────────────────────────────┘\x1b[0m");
          console.log("");
          console.log("\x1b[36m📞 FUNCTION CALLS:\x1b[0m");
          console.log("  \x1b[37mfunctionName(arg1, arg2)\x1b[0m     Call contract function");
          console.log("  \x1b[37mdecrypt(getCount())\x1b[0m          Decrypt encrypted handle");
          console.log("  \x1b[37mencrypt <value> <type>\x1b[0m       Manually encrypt a value");
          console.log("    \x1b[90mExample: encrypt 42 euint32\x1b[0m");
          console.log("");
          console.log("\x1b[36m👤 ACCOUNT & NETWORK:\x1b[0m");
          console.log("  \x1b[37msigner <index>\x1b[0m               Switch to different signer");
          console.log("  \x1b[37mbalance [address]\x1b[0m            Check account balance");
          console.log("  \x1b[37mnetwork\x1b[0m                      Show network details");
          console.log("");
          console.log("\x1b[36m📊 ANALYSIS & MONITORING:\x1b[0m");
          console.log("  \x1b[37mhistory\x1b[0m                      Show transaction history");
          console.log("  \x1b[37mgas\x1b[0m                          Show gas usage statistics");
          console.log("  \x1b[37manalyze\x1b[0m                      Show FHE operation analysis");
          console.log("  \x1b[37mreset\x1b[0m                        Clear transaction history");
          console.log("");
          console.log("\x1b[36m🔧 UTILITY:\x1b[0m");
          console.log("  \x1b[37mhelp\x1b[0m                         Show this help");
          console.log("  \x1b[37mexit\x1b[0m                         Exit REPL");
          console.log("");
          console.log("\x1b[90m─────────────────────────────────────────────────────────────\x1b[0m");
          console.log("\x1b[33m💡 Quick Examples:\x1b[0m");
          console.log("  \x1b[90m• Call function:\x1b[0m       \x1b[36mincrement(10)\x1b[0m");
          console.log("  \x1b[90m• Decrypt result:\x1b[0m     \x1b[36mdecrypt(getCount())\x1b[0m");
          console.log("  \x1b[90m• Switch account:\x1b[0m     \x1b[36msigner 1\x1b[0m");
          console.log("  \x1b[90m• Check balance:\x1b[0m      \x1b[36mbalance\x1b[0m");
          console.log("  \x1b[90m• View stats:\x1b[0m         \x1b[36mgas\x1b[0m \x1b[90mor\x1b[0m \x1b[36manalyze\x1b[0m");
          console.log("");
          rl.prompt();
          return;
        }

        if (cmd === 'history') {
          console.log("");
          console.log("\x1b[1mTransaction History:\x1b[0m");
          console.log("");
          history.forEach((entry) => {
            console.log(`\x1b[37m${entry.index}. ${entry.command}\x1b[0m`);
            if (entry.txHash) {
              console.log(`\x1b[90m   Tx: ${entry.txHash.slice(0, 10)}...\x1b[0m`);
              console.log(`\x1b[90m   Block: ${entry.blockNumber}\x1b[0m`);
              console.log(`\x1b[32m   Status: ✅ Success\x1b[0m`);
            } else if (entry.result !== undefined) {
              console.log(`\x1b[90m   Value: ${entry.result}\x1b[0m`);
            }
            console.log("");
          });
          rl.prompt();
          return;
        }

        // Handle signer command
        if (cmd.startsWith('signer')) {
          const match = cmd.match(/^signer\s+(\d+)$/);
          if (!match) {
            console.log("");
            console.log("\x1b[31m✗ Usage:\x1b[0m signer <index>");
            console.log("");
            console.log("\x1b[90mAvailable signers:\x1b[0m");
            for (let i = 0; i < signers.length; i++) {
              const addr = await signers[i].getAddress();
              const current = i === currentSignerIndex ? ' \x1b[32m(current)\x1b[0m' : '';
              console.log(`  \x1b[37m${i}.\x1b[0m \x1b[90m${addr}\x1b[0m${current}`);
            }
            console.log("");
            rl.prompt();
            return;
          }

          const newIndex = parseInt(match[1]);
          if (newIndex < 0 || newIndex >= signers.length) {
            console.log("");
            console.log(`\x1b[31m✗ Error:\x1b[0m Invalid signer index. Must be between 0 and ${signers.length - 1}`);
            console.log("");
            rl.prompt();
            return;
          }

          currentSignerIndex = newIndex;
          const newAddr = await signers[currentSignerIndex].getAddress();
          console.log("");
          console.log(`\x1b[32m✓\x1b[0m Switched to signer ${newIndex}: \x1b[37m${newAddr}\x1b[0m`);
          console.log("");
          rl.prompt();
          return;
        }

        // Handle balance command
        if (cmd === 'balance' || cmd.startsWith('balance ')) {
          const match = cmd.match(/^balance(?:\s+(.+))?$/);
          let address: string;

          if (match && match[1]) {
            address = match[1].trim();
          } else {
            address = await signers[currentSignerIndex].getAddress();
          }

          console.log("");
          const balance = await ethers.provider.getBalance(address);
          const balanceEth = ethers.formatEther(balance);

          console.log(`\x1b[1mBalance:\x1b[0m \x1b[37m${balanceEth} ETH\x1b[0m`);
          console.log(`\x1b[90mAddress: ${address}\x1b[0m`);
          console.log("");
          rl.prompt();
          return;
        }

        // Handle gas command
        if (cmd === 'gas') {
          console.log("");
          console.log("\x1b[1mGas Usage Statistics:\x1b[0m");
          console.log("");
          console.log(`\x1b[37mTotal Transactions:\x1b[0m ${totalTransactions}`);
          console.log(`\x1b[37mTotal Gas Used:\x1b[0m     ${totalGasUsed.toString()}`);
          if (totalTransactions > 0) {
            const avgGas = totalGasUsed / BigInt(totalTransactions);
            console.log(`\x1b[37mAverage Gas/Tx:\x1b[0m     ${avgGas.toString()}`);
          }
          console.log("");
          rl.prompt();
          return;
        }

        // Handle network command
        if (cmd === 'network') {
          console.log("");
          console.log("\x1b[1mNetwork Information:\x1b[0m");
          console.log("");
          const networkInfo = await ethers.provider.getNetwork();
          const blockNumber = await ethers.provider.getBlockNumber();
          const feeData = await ethers.provider.getFeeData();

          console.log(`\x1b[37mName:\x1b[0m           ${network.name}`);
          console.log(`\x1b[37mChain ID:\x1b[0m       ${networkInfo.chainId.toString()}`);
          console.log(`\x1b[37mBlock Number:\x1b[0m   ${blockNumber}`);
          console.log(`\x1b[37mGas Price:\x1b[0m      ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'N/A'}`);
          console.log(`\x1b[37mFHEVM Mode:\x1b[0m     ${fhevm.isMock ? 'Mock (Local)' : 'Gateway (Live)'}`);
          console.log("");
          rl.prompt();
          return;
        }

        // Handle reset command
        if (cmd === 'reset') {
          history.length = 0;
          historyIndex = 1;
          totalGasUsed = BigInt(0);
          totalTransactions = 0;

          console.log("");
          console.log("\x1b[32m✓\x1b[0m Transaction history cleared");
          console.log("");
          rl.prompt();
          return;
        }

        // Handle encrypt command
        if (cmd.startsWith('encrypt ')) {
          const match = cmd.match(/^encrypt\s+(\d+)\s+(euint\d+|ebool)$/);
          if (!match) {
            console.log("");
            console.log("\x1b[31m✗ Usage:\x1b[0m encrypt <value> <type>");
            console.log("\x1b[90mExample:\x1b[0m encrypt 42 euint32");
            console.log("\x1b[90mTypes:\x1b[0m euint8, euint16, euint32, euint64, euint128, euint256, ebool");
            console.log("");
            rl.prompt();
            return;
          }

          const [, valueStr, type] = match;
          const value = parseInt(valueStr);

          console.log("");
          console.log(`\x1b[90m◇  Encrypting ${value} as ${type}...\x1b[0m`);

          const signerAddr = await signers[currentSignerIndex].getAddress();
          const encrypted = await encryptValue(value, type, contractAddress, signerAddr);

          const handleHex = '0x' + Buffer.from(encrypted.handles[0]).toString('hex');
          const proofHex = '0x' + Buffer.from(encrypted.inputProof).toString('hex');

          console.log("");
          console.log("\x1b[32m✓ Encrypted successfully\x1b[0m");
          console.log("");
          console.log(`\x1b[37mHandle:\x1b[0m`);
          console.log(`\x1b[90m${handleHex}\x1b[0m`);
          console.log("");
          console.log(`\x1b[37mInput Proof:\x1b[0m`);
          console.log(`\x1b[90m${proofHex.slice(0, 100)}...\x1b[0m`);
          console.log("");
          rl.prompt();
          return;
        }

        // Handle analyze command
        if (cmd === 'analyze') {
          console.log("");
          console.log("\x1b[1mFHE Operations Analysis:\x1b[0m");
          console.log("");

          // Count different operation types from history
          let encryptOps = 0;
          let decryptOps = 0;
          let txOps = 0;
          let viewOps = 0;

          history.forEach((entry) => {
            if (entry.command.includes('decrypt(')) {
              decryptOps++;
            } else if (entry.txHash) {
              txOps++;
              // Count encryptions (approximate based on function calls with encrypted params)
              if (entry.functionName) {
                encryptOps++;
              }
            } else if (entry.result !== undefined) {
              viewOps++;
            }
          });

          console.log(`\x1b[37mEncryptions:\x1b[0m      ${encryptOps}`);
          console.log(`\x1b[37mDecryptions:\x1b[0m      ${decryptOps}`);
          console.log(`\x1b[37mTransactions:\x1b[0m     ${txOps}`);
          console.log(`\x1b[37mView Calls:\x1b[0m       ${viewOps}`);
          console.log("");
          console.log(`\x1b[90mFHEVM Mode:\x1b[0m ${fhevm.isMock ? 'Mock (instant encryption/decryption)' : 'Gateway (async with coprocessor)'}`);
          console.log("");
          rl.prompt();
          return;
        }

        // Handle decrypt(...)
        if (cmd.startsWith('decrypt(')) {
          const match = cmd.match(/decrypt\((.+)\)/);
          if (match) {
            const expression = match[1];

            console.log("");

            // Execute the inner expression to get the handle
            let handle: string;
            let returnType: string | undefined;

            if (expression.includes('(')) {
              // It's a function call
              const funcMatch = expression.match(/^(\w+)\((.*?)\)$/);
              if (funcMatch) {
                const [, funcName, argsStr] = funcMatch;
                const args = argsStr ? argsStr.split(',').map((a: string) => {
                  const trimmed = a.trim();
                  if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
                  return trimmed;
                }) : [];

                // Get the return type from ABI
                const func = iface.getFunction(funcName);
                if (func && func.outputs.length > 0) {
                  // Try to get internalType from raw ABI
                  const abiFragment = contractABI.find((item: any) =>
                    item.type === 'function' && item.name === funcName
                  );
                  if (abiFragment && abiFragment.outputs && abiFragment.outputs[0]) {
                    returnType = abiFragment.outputs[0].internalType || abiFragment.outputs[0].type;
                  } else {
                    returnType = func.outputs[0].type;
                  }
                }

                handle = await contract.getFunction(funcName)(...args);
              } else {
                throw new Error('Invalid function call');
              }
            } else {
              handle = expression;
            }

            // Map return type to FhevmType enum value
            // FhevmType enum: ebool=0, euint4=1, euint8=2, euint16=3, euint32=4, euint64=5, euint128=6, eaddress=7, euint256=8
            let fhevmTypeValue = 4; // default to euint32
            if (returnType) {
              if (returnType === 'ebool') fhevmTypeValue = 0;
              else if (returnType === 'euint4') fhevmTypeValue = 1;
              else if (returnType === 'euint8') fhevmTypeValue = 2;
              else if (returnType === 'euint16') fhevmTypeValue = 3;
              else if (returnType === 'euint32') fhevmTypeValue = 4;
              else if (returnType === 'euint64') fhevmTypeValue = 5;
              else if (returnType === 'euint128') fhevmTypeValue = 6;
              else if (returnType === 'eaddress') fhevmTypeValue = 7;
              else if (returnType === 'euint256') fhevmTypeValue = 8;
            }

            console.log("\x1b[90m◇  Decrypting...\x1b[0m");

            const decrypted = await decryptValue(handle, fhevmTypeValue, contractAddress, signers[currentSignerIndex]);

            console.log("");
            console.log("\x1b[32m✅ Decrypted value:\x1b[0m \x1b[37m" + decrypted + "\x1b[0m");
            console.log("");

            history.push({
              index: historyIndex++,
              command: cmd,
              result: decrypted,
              timestamp: new Date()
            });
          }
          rl.prompt();
          return;
        }

        // Handle function calls
        const functionMatch = cmd.match(/^(\w+)\s*\(\s*(.*?)\s*\)$/);
        if (functionMatch) {
          const [, functionName, argsStr] = functionMatch;

          // Get function from ABI
          const func = iface.getFunction(functionName);
          if (!func) {
            throw new Error(`Function '${functionName}' not found`);
          }

          // Parse arguments
          const args = argsStr ? argsStr.split(',').map((a: string) => {
            const trimmed = a.trim();
            if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
            if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return trimmed;
            if (/^["'].*["']$/.test(trimmed)) return trimmed.slice(1, -1);
            return trimmed;
          }) : [];

          // Check if this is a view function
          const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';

          if (isView) {
            // Call view function
            const result = await contract.getFunction(functionName)(...args);

            console.log("");
            console.log(`\x1b[32m✅\x1b[0m \x1b[37mHandle: ${result}\x1b[0m`);

            const outputType = func.outputs[0]?.internalType || func.outputs[0]?.type;
            if (outputType && (outputType.startsWith('euint') || outputType.startsWith('ebool'))) {
              console.log(`\x1b[90m   Type: ${outputType}\x1b[0m`);
              console.log(`\x1b[90m   To decrypt: \x1b[0m\x1b[36mdecrypt(${functionName}())\x1b[0m`);
            }
            console.log("");

            history.push({
              index: historyIndex++,
              command: cmd,
              result,
              timestamp: new Date()
            });
          } else {
            // Prepare arguments with encryption
            const preparedArgs: any[] = [];
            let argIndex = 0;

            for (let i = 0; i < func.inputs.length; i++) {
              const param = func.inputs[i];

              // Try to get the real type from the ABI
              const abiFragment = contractABI.find((item: any) =>
                item.type === 'function' && item.name === functionName
              );

              let paramType = param.type;
              if (abiFragment && abiFragment.inputs && abiFragment.inputs[i]) {
                paramType = abiFragment.inputs[i].internalType || abiFragment.inputs[i].type;
              }

              const encInfo = getEncryptionType(paramType);

              if (encInfo.needsEncryption) {
                const value = args[argIndex];

                console.log("");
                console.log(`\x1b[90m◇  Encrypting ${param.name || 'value'}: ${value}\x1b[0m`);

                const signerAddr = await signers[currentSignerIndex].getAddress();
                const encrypted = await encryptValue(value, encInfo.encryptionType!, contractAddress, signerAddr);

                console.log(`\x1b[32m   ✓\x1b[0m \x1b[90mEncrypted successfully\x1b[0m`);

                // Only push the handle for THIS parameter
                preparedArgs.push(encrypted.handles[0]);

                // Store the proof to use for the NEXT parameter (inputProof)
                // Check if next parameter is the inputProof
                if (i + 1 < func.inputs.length) {
                  const nextParam = func.inputs[i + 1];
                  const nextType = nextParam.internalType || nextParam.type;
                  if (nextType === 'bytes' && nextParam.name === 'inputProof') {
                    // The next iteration will handle the proof
                    (preparedArgs as any).pendingProof = encrypted.inputProof;
                  }
                }

                argIndex++;
              } else if (paramType === 'bytes' && param.name === 'inputProof') {
                // This is the inputProof parameter - use the stored proof
                const pendingProof = (preparedArgs as any).pendingProof;
                if (pendingProof) {
                  preparedArgs.push(pendingProof);
                  delete (preparedArgs as any).pendingProof;
                } else {
                  // User provided proof directly
                  preparedArgs.push(args[argIndex]);
                  argIndex++;
                }
              } else {
                preparedArgs.push(args[argIndex]);
                argIndex++;
              }
            }

            // Clean up the pending proof property
            delete (preparedArgs as any).pendingProof;

            console.log("\x1b[90m◇  Sending transaction...\x1b[0m");

            // Connect contract to signer
            const connectedContract = contract.connect(signers[currentSignerIndex]);

            // Get the function from the contract
            const contractFunction = connectedContract.getFunction(functionName);

            if (!contractFunction) {
              throw new Error(`Function ${functionName} not found on contract`);
            }

            // Call the function
            const tx = await contractFunction(...preparedArgs);
            console.log(`\x1b[90m◇  Wait for tx:${tx.hash.slice(0, 10)}...\x1b[0m`);

            const receipt = await tx.wait();

            // Track gas usage
            totalGasUsed += receipt.gasUsed;
            totalTransactions++;

            console.log("");
            console.log("\x1b[32m✅ Transaction Successful\x1b[0m");
            console.log(`\x1b[90m   Tx Hash:    ${tx.hash.slice(0, 12)}...\x1b[0m`);
            console.log(`\x1b[90m   Block:      ${receipt.blockNumber}\x1b[0m`);
            console.log(`\x1b[90m   Gas Used:   ${receipt.gasUsed.toString()}\x1b[0m`);
            console.log("");

            history.push({
              index: historyIndex++,
              command: cmd,
              functionName,
              args,
              txHash: tx.hash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              timestamp: new Date()
            });
          }

          rl.prompt();
          return;
        }

        throw new Error(`Unknown command: ${cmd}`);
      } catch (error: any) {
        console.log("");
        console.log(`\x1b[31m✗ Error:\x1b[0m ${error.message}`);
        console.log("");
        rl.prompt();
      }
    });

    // Return a promise that resolves when the REPL closes
    return new Promise<void>((resolve) => {
      rl.on('close', () => {
        console.log('\x1b[90mGoodbye!\x1b[0m');
        resolve();
      });

      rl.prompt();
    });
  });
