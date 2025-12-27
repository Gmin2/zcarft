/**
 * GitBook asset manager for handling images and graphs
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Initialize .gitbook/assets/graphs directory
 */
export async function initializeAssetDirectories(outputDir: string): Promise<void> {
  const assetsDir = join(outputDir, '.gitbook', 'assets');
  const graphsDir = join(assetsDir, 'graphs');

  await mkdir(graphsDir, { recursive: true });
}

/**
 * Save graph to assets directory
 */
export async function saveGraph(
  outputDir: string,
  contractName: string,
  graphType: 'call-graph' | 'inheritance',
  content: string,
  format: 'svg' | 'png' | 'dot' = 'svg'
): Promise<string> {
  const filename = `${contractName}-${graphType}.${format}`;
  const graphPath = join(outputDir, '.gitbook', 'assets', 'graphs', filename);

  await writeFile(graphPath, content, 'utf-8');

  // Return relative path for markdown
  return `../.gitbook/assets/graphs/${filename}`;
}

/**
 * Get relative path for graph in markdown
 */
export function getGraphPath(contractName: string, graphType: 'call-graph' | 'inheritance'): string {
  return `../.gitbook/assets/graphs/${contractName}-${graphType}.svg`;
}
