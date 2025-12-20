# ZCraft - Interactive CLI for FHEVM Development

Build, deploy, and interact with fully homomorphic encrypted smart contracts using the Zama FHEVM protocol.

## Features

- **Project Scaffolding**: Create standalone FHEVM example projects from curated templates
- **12 Example Templates**: From beginner-friendly counters to advanced DeFi protocols
- **Interactive Wizard**: Guided project creation with category filtering
- **Documentation Generation**: Auto-generate GitBook-compatible docs (coming soon)
- **Contract REPL**: Interactive contract testing and debugging (coming soon)

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Usage

```bash
# Interactive mode - guided wizard
pnpm --filter @zcraft/cli dev new

# Non-interactive mode - direct template
pnpm --filter @zcraft/cli dev new my-counter --template fhe-counter

# Skip dependency installation
pnpm --filter @zcraft/cli dev new my-auction --template blind-auction --skip-install
```

## Project Structure

```
zcraft/
├── packages/
│   ├── cli/              # Main CLI package (@zcraft/cli)
│   │   ├── src/
│   │   │   ├── commands/  # Command implementations
│   │   │   └── utils/     # CLI utilities
│   │   └── bin/run.js    # Executable entry point
│   │
│   ├── core/             # Core utilities (@zcraft/core)
│   │   └── src/
│   │       ├── types.ts   # TypeScript type definitions
│   │       ├── catalog.ts # Catalog manager
│   │       └── index.ts
│   │
│   └── templates/        # Example contract templates
│       ├── contracts/     # Solidity contracts
│       └── test/          # Test files
│
├── catalog.json          # Example catalog metadata
├── pnpm-workspace.yaml  # pnpm workspace config
├── tsconfig.json        # Root TypeScript config
├── biome.json           # Biome linter/formatter config
└── package.json         # Root package.json
```

## Available Templates

### Basic (2 examples)
- **fhe-counter** - Simple encrypted counter (15 min)
- **fhe-if-then-else** - Conditional logic with FHE.select (20 min)

### Encryption & Decryption (1 example)
- **encrypt-decrypt-values** - Complete encryption/decryption guide (25 min)

### Key Concepts (2 examples)
- **access-control** - FHE permission management (25 min)
- **input-proofs** - Security and attack prevention (25 min)

### Applications (2 examples)
- **blind-auction** - Sealed-bid NFT auction (60 min)
- **confidential-voting** - Secret ballot voting (45 min)

### OpenZeppelin (5 examples)
- **erc7984-token** - Confidential ERC-20 token (45 min)
- **erc20-wrapper** - Wrap public tokens as confidential (40 min)
- **vesting-wallet** - Token vesting with encrypted schedules (40 min)
- **confidential-swap** - Fully private token exchange (45 min)
- **erc7984-rwa** - Real-world asset compliance (60 min)

## Development

### Commands

```bash
# Development mode
pnpm dev

# Build all packages
pnpm build

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm typecheck

# Clean build artifacts
pnpm clean
```

### Adding New Examples

1. Add example metadata to `catalog.json`
2. Create contract in `packages/templates/contracts/`
3. Create test in `packages/templates/test/`
4. Run `pnpm build` to regenerate types

## Architecture

### Catalog System

The catalog (`catalog.json`) defines all available examples with:
- Category organization
- Difficulty levels (1-5)
- Source attribution (docs/openzeppelin/custom)
- Contract and test file paths
- Key concepts and learning highlights

### Template Cloning

Projects are created by:
1. Cloning the base `fhevm-hardhat-template` from Zama
2. Injecting the selected contract and test files
3. Generating a customized README
4. Installing dependencies (optional)

### Type Safety

All catalog data is type-checked using TypeScript interfaces:
- `ExampleMetadata` - Individual example definition
- `Category` - Category metadata
- `ExampleCatalog` - Complete catalog structure

## Roadmap

- [x] Project scaffolding with `zcraft new`
- [x] Example catalog with 12 templates
- [x] Interactive wizard
- [x] TypeScript type safety
- [ ] Documentation generation with `zcraft docs`
- [ ] Interactive contract REPL with `zcraft call`
- [ ] Template validation and testing
- [ ] Custom example creation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm lint:fix` and `pnpm typecheck`
5. Submit a pull request

## License

MIT

## Acknowledgments

Built for the Zama Bounty Track December 2025
