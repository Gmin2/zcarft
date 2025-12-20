# FHE Counter

> Simple encrypted counter demonstrating basic FHE operations

## What This Example Demonstrates

- euint32 encrypted type
- TFHE.add and TFHE.sub operations
- FHE.allow and FHE.allowThis access control
- Input proof validation with FHE.fromExternal

## Difficulty Level

⭐ **Beginner** - 15 minutes

## Quick Start

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

```bash
npm install
```

### Running Tests

```bash
# Run all tests (mock mode)
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Local Deployment

```bash
# Terminal 1: Start local FHEVM node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat deploy --network localhost
```

### Deployment to Sepolia

```bash
# Configure .env
cp .env.example .env
# Add your DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL

# Deploy
npx hardhat deploy --network sepolia
```

## Key Concepts Explained

### 1. euint32 encrypted type

TODO: Add explanation

### 2. TFHE.add and TFHE.sub operations

TODO: Add explanation

### 3. FHE.allow and FHE.allowThis access control

TODO: Add explanation

### 4. Input proof validation with FHE.fromExternal

TODO: Add explanation


## Further Reading

- [TFHE Operations](https://docs.zama.ai/fhevm/fundamentals/tfhe)
- [Access Control](https://docs.zama.ai/fhevm/guides/access-control)
- [Input Proofs](https://docs.zama.ai/fhevm/guides/input-proof)

## License

MIT
