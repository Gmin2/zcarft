# ZCraft
[![CI](https://github.com/Gmin2/zcraft/actions/workflows/ci.yml/badge.svg)](https://github.com/Gmin2/zcraft/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@zcraft/cli.svg)](https://www.npmjs.com/package/@zcraft/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An interactive CLI for FHEVM development - Build, deploy, and interact with fully homomorphic encrypted smart contracts.

## Features

* **12 Curated Templates**: From beginner-friendly counters to advanced DeFi protocols
* **Interactive Wizard**: Guided project creation with category filtering and search
* **Code Generation**: Auto-generate Hardhat tasks from contract ABIs
* **Documentation Generator**: Create GitBook-compatible docs from smart contracts
* **Contract REPL**: Interactive contract testing and debugging environment
* **Type-Safe**: Full TypeScript support with generated types
* **Monorepo Architecture**: Modular packages for CLI, codegen, and docgen
* **Zero Config**: Works out of the box with sensible defaults

## Usage

### Creating a New Project

The simplest way to get started is to use the interactive wizard:

```bash
npx @zcraft/cli new
```

This will prompt you to:
1. Choose a template from 12 available examples
2. Name your project
3. Optionally install dependencies

For a non-interactive experience, specify the template directly:

```bash
npx @zcraft/cli new my-counter --template fhe-counter
```

Skip dependency installation:

```bash
npx @zcraft/cli new my-auction --template blind-auction --skip-install
```

### Generating Code from Contracts

Generate Hardhat tasks from your compiled contract ABIs:

```bash
zcraft generate tasks
```

This will:
- Read all compiled contracts from `artifacts/contracts/`
- Generate type-safe Hardhat task files in `tasks/`
- Support both FHE and non-FHE contract methods
- Include proper error handling and input validation

Options:
```bash
# Specify custom artifacts directory
zcraft generate tasks --artifacts-dir ./build

# Specify custom output directory
zcraft generate tasks --output-dir ./generated-tasks

# Force overwrite existing files
zcraft generate tasks --force
```

### Generating Documentation

Create comprehensive GitBook-compatible documentation:

```bash
zcraft generate docs
```

This will analyze your contracts and generate:
- Contract overview and architecture diagrams
- Function reference with NatSpec comments
- State variable documentation
- Event and error documentation
- Inheritance graphs
- Security considerations

Options:
```bash
# Specify contracts directory
zcraft generate docs --contracts-dir ./src

# Specify output directory
zcraft generate docs --output-dir ./documentation

# Force overwrite existing files
zcraft generate docs --force
```

### Interactive Contract REPL

Launch an interactive environment to test your contracts:

```bash
zcraft call
```

Features:
- Auto-completion of contract methods
- Interactive method execution
- Real-time feedback
- Transaction history
- State inspection

### Managing the Catalog

View available templates:

```bash
zcraft catalog list
```

Get detailed information about a template:

```bash
zcraft catalog show fhe-counter
```

## Installation

### With npm

```bash
npm install -g @zcraft/cli
```

### With pnpm

```bash
pnpm add -g @zcraft/cli
```

### With yarn

```bash
yarn global add @zcraft/cli
```

### From source

Clone the repository and build from source:

```bash
git clone https://github.com/Gmin2/zcraft.git
cd zcraft
pnpm install
pnpm build
pnpm --filter @zcraft/cli link --global
```

### With npx (no installation)

Run commands directly without installing:

```bash
npx @zcraft/cli new my-project
```

## Available Packages

ZCraft is split into multiple packages for modularity:

### @zcraft/cli

The main CLI package that provides the `zcraft` command.

```bash
npm install -g @zcraft/cli
```

### @zcraft/codegen

Code generation utilities for creating Hardhat tasks from ABIs.

```bash
npm install @zcraft/codegen
```

```typescript
import { generateHardhatTasks } from '@zcraft/codegen';

await generateHardhatTasks({
  artifactsDir: './artifacts',
  outputDir: './tasks',
  force: false
});
```

### @zcraft/docgen

Documentation generator for FHEVM smart contracts.

```bash
npm install @zcraft/docgen
```

```typescript
import { generateDocs } from '@zcraft/docgen';

await generateDocs({
  contractsDir: './contracts',
  outputDir: './docs',
  format: 'gitbook'
});
```

### @zcraft/core

Core utilities and types shared across packages.

```bash
npm install @zcraft/core
```

## Available Templates

### Basic (2 examples)
- **fhe-counter** - Simple encrypted counter with increment/decrement (15 min)
- **fhe-if-then-else** - Conditional logic using FHE.select operations (20 min)

### Encryption & Decryption (1 example)
- **encrypt-decrypt-values** - Complete guide to encryption/decryption workflows (25 min)

### Key Concepts (2 examples)
- **access-control** - FHE permission management and access patterns (25 min)
- **input-proofs** - Security best practices and attack prevention (25 min)

### Applications (2 examples)
- **blind-auction** - Sealed-bid NFT auction with encrypted bids (60 min)
- **confidential-voting** - Secret ballot voting system (45 min)

### OpenZeppelin (5 examples)
- **erc7984-token** - Confidential ERC-20 token implementation (45 min)
- **erc20-wrapper** - Wrap public ERC-20 tokens as confidential (40 min)
- **vesting-wallet** - Token vesting with encrypted schedules (40 min)
- **confidential-swap** - Fully private token exchange protocol (45 min)
- **erc7984-rwa** - Real-world asset tokenization with compliance (60 min)

## Project Structure

```
zcraft/
├── packages/
│   ├── cli/              # Main CLI package (@zcraft/cli)
│   │   ├── src/
│   │   │   ├── commands/  # Command implementations
│   │   │   │   ├── new.ts
│   │   │   │   ├── call.ts
│   │   │   │   ├── generate/
│   │   │   │   │   ├── tasks.ts
│   │   │   │   │   └── docs.ts
│   │   │   │   └── catalog/
│   │   │   └── utils/     # CLI utilities
│   │   └── bin/run.js    # Executable entry point
│   │
│   ├── codegen/          # Code generation (@zcraft/codegen)
│   │   ├── src/
│   │   │   ├── generators/
│   │   │   ├── templates/
│   │   │   └── index.ts
│   │   └── test/
│   │
│   ├── docgen/           # Documentation generator (@zcraft/docgen)
│   │   ├── src/
│   │   │   ├── generators/
│   │   │   ├── parsers/
│   │   │   ├── templates/
│   │   │   └── index.ts
│   │   └── test/
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
└── package.json         # Root package.json
```

## Development

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/Gmin2/zcraft.git
cd zcraft

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development Commands

```bash
# Development mode with watch
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check all packages
pnpm typecheck

# Clean build artifacts
pnpm clean
```

### Adding New Templates

1. Add template metadata to `catalog.json`:
```json
{
  "id": "my-template",
  "name": "My Template",
  "description": "Description of the template",
  "category": "basic",
  "difficulty": 2,
  "estimatedTime": "30 min",
  "files": {
    "contract": "MyContract.sol",
    "test": "MyContract.test.ts"
  }
}
```

2. Create contract in `packages/templates/contracts/MyContract.sol`
3. Create test in `packages/templates/test/MyContract.test.ts`
4. Run `pnpm build` to regenerate types

## Integration with Other Tools

**Hardhat**: ZCraft generates Hardhat tasks that integrate seamlessly with your existing Hardhat workflow.

**GitBook**: Documentation generated by ZCraft follows GitBook's structure and can be directly imported.

**TypeScript**: All generated code includes full TypeScript types for better developer experience.

**Zama FHEVM**: Built specifically for the Zama FHEVM protocol with support for encrypted operations.

## Architecture

### Catalog System

The catalog (`catalog.json`) defines all available examples with:
- Category organization (Basic, Applications, OpenZeppelin, etc.)
- Difficulty levels (1-5 stars)
- Source attribution (docs/openzeppelin/custom)
- Contract and test file paths
- Key concepts and learning highlights
- Estimated completion time

### Template Cloning

Projects are created by:
1. Cloning the base `fhevm-hardhat-template` from Zama
2. Injecting the selected contract and test files
3. Generating a customized README
4. Installing dependencies (optional)

### Code Generation

The codegen package (`@zcraft/codegen`) provides:
- ABI parsing and analysis
- Hardhat task template generation
- Type-safe method wrappers
- Support for FHE-specific operations
- Handlebars-based templating

### Documentation Generation

The docgen package (`@zcraft/docgen`) provides:
- Solidity AST parsing
- NatSpec comment extraction
- Contract inheritance analysis
- Markdown generation
- GitBook-compatible output

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
- [x] Code generation with `zcraft generate tasks`
- [x] Documentation generation with `zcraft generate docs`
- [ ] Interactive contract REPL with `zcraft call`
- [ ] Template validation and testing
- [ ] Custom example creation
- [ ] CI/CD pipeline
- [ ] Automated testing suite

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and type checking (`pnpm lint:fix && pnpm typecheck`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

`zcraft` is licensed under the terms of the MIT License.

See the [LICENSE](LICENSE) file for details.

## Author

**Mintu Gogoi** - [mintugogoi567@gmail.com](mailto:mintugogoi567@gmail.com)

## Acknowledgments

Built for the **Zama Bounty Track December 2025**

Special thanks to:
- [Zama](https://www.zama.ai/) for the FHEVM protocol and excellent documentation
- The FHEVM community for feedback and support
- OpenZeppelin for battle-tested smart contract implementations
