import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { downloadTemplate } from 'giget';
import { execa } from 'execa';
import ora from 'ora';

const GITHUB_REPO = 'github:Gmin2/zplate';
const CACHE_DIR = path.join(os.homedir(), '.zcraft', 'templates');

/**
 * Manages template downloading and copying from GitHub
 * Downloads templates on-demand and caches them locally
 */
export class TemplateManager {
  private cacheDir: string;

  constructor(cacheDir: string = CACHE_DIR) {
    this.cacheDir = cacheDir;
  }

  /**
   * Download a specific template from GitHub
   */
  async downloadTemplate(templateName: string): Promise<string> {
    const templateCacheDir = path.join(this.cacheDir, templateName);

    // Check if already cached
    if (await fs.pathExists(templateCacheDir)) {
      return templateCacheDir;
    }

    const spinner = ora({
      text: `Downloading ${templateName} from GitHub...`,
      color: 'cyan',
    }).start();

    try {
      // Download specific subdirectory from GitHub
      await downloadTemplate(`${GITHUB_REPO}/${templateName}`, {
        dir: templateCacheDir,
        force: true,
        offline: false,
      });

      spinner.succeed(`Template ${templateName} downloaded`);
      return templateCacheDir;

    } catch (error) {
      spinner.fail(`Failed to download template ${templateName}`);
      throw new Error(
        `Failed to download template '${templateName}' from GitHub.\n` +
        `Make sure the template exists at https://github.com/Gmin2/zplate/tree/main/${templateName}`
      );
    }
  }

  /**
   * Copy template to destination
   * Downloads from GitHub if not cached
   */
  async copyTemplate(
    templateName: string,
    destination: string,
    options: {
      force?: boolean;
      onProgress?: (message: string) => void;
    } = {}
  ): Promise<void> {
    // Check if destination exists
    if (await fs.pathExists(destination)) {
      if (!options.force) {
        throw new Error(`Directory '${destination}' already exists. Use --force to overwrite.`);
      }
      await fs.remove(destination);
    }

    // Download template (uses cache if available)
    options.onProgress?.(`Fetching template ${templateName}...`);
    const templatePath = await this.downloadTemplate(templateName);

    options.onProgress?.('Copying template files...');

    // Copy template to destination
    await fs.copy(templatePath, destination, {
      filter: (src) => {
        const basename = path.basename(src);
        // Exclude node_modules and build artifacts
        return !basename.match(/^(node_modules|\.git|dist|artifacts|cache|coverage|types|fhevmTemp)$/);
      },
    });
  }

  /**
   * Update package.json in copied template
   */
  async updatePackageJson(projectPath: string, projectName: string): Promise<void> {
    const pkgPath = path.join(projectPath, 'package.json');

    if (!(await fs.pathExists(pkgPath))) {
      return;
    }

    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;

    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  /**
   * Clean up project (remove lock files)
   */
  async cleanupProject(projectPath: string): Promise<void> {
    const filesToRemove = [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
    ];

    for (const file of filesToRemove) {
      const filePath = path.join(projectPath, file);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    }

    // Create .npmrc to prevent workspace interference if inside a workspace
    const npmrcPath = path.join(projectPath, '.npmrc');
    const npmrcContent = `# Prevent interference from parent pnpm workspace
link-workspace-packages=false
shared-workspace-lockfile=false
`;
    await fs.writeFile(npmrcPath, npmrcContent, 'utf-8');
  }

  /**
   * Install dependencies
   */
  async installDependencies(
    projectPath: string,
    packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm'
  ): Promise<void> {
    await execa(packageManager, ['install'], {
      cwd: projectPath,
      stdio: 'ignore',
    });
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Clear entire template cache
   */
  async clearCache(): Promise<void> {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir);
    }
  }

  /**
   * Clear specific template from cache
   */
  async clearTemplateCache(templateName: string): Promise<void> {
    const templateCacheDir = path.join(this.cacheDir, templateName);
    if (await fs.pathExists(templateCacheDir)) {
      await fs.remove(templateCacheDir);
    }
  }
}
