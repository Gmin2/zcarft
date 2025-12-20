// Helper to load FHEVM from Hardhat project
// This runs in the context of the Hardhat project

import { createRequire } from 'module';
import path from 'path';

export async function loadFHEVMFromProject(projectDir: string): Promise<any> {
  // Create a require function from the project directory
  const projectRequire = createRequire(path.join(projectDir, 'package.json'));

  // Change to project directory so Hardhat can find its config
  const originalCwd = process.cwd();
  process.chdir(projectDir);

  try {
    // Require hardhat from the project's node_modules
    const hre = projectRequire('hardhat');

    // Initialize FHEVM CLI API
    if (hre.fhevm) {
      await hre.fhevm.initializeCLIApi();
      return hre.fhevm;
    }

    throw new Error('FHEVM plugin not found in Hardhat config');
  } finally {
    process.chdir(originalCwd);
  }
}
