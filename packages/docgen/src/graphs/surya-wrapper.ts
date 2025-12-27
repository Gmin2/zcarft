/**
 * Surya integration for generating contract graphs
 */

import { graph, inheritance } from 'surya';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Generate function call graph using surya
 */
export async function generateCallGraph(solPath: string): Promise<string> {
  try {
    // Generate DOT format graph
    const dotGraph = graph([solPath], {
      importer: true,
      libraries: false,
      enableModifierEdges: true,
    });

    return dotGraph;
  } catch (error) {
    throw new Error(`Failed to generate call graph: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate inheritance diagram using surya
 */
export async function generateInheritanceGraph(solPath: string): Promise<string> {
  try {
    // Generate DOT format inheritance diagram
    const dotGraph = inheritance([solPath], {
      importer: true,
    });

    return dotGraph;
  } catch (error) {
    throw new Error(`Failed to generate inheritance graph: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert DOT format to SVG using graphviz
 */
export async function convertDotToSvg(dotContent: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary file for DOT content
    const tmpFile = join(tmpdir(), `graph-${Date.now()}.dot`);

    writeFile(tmpFile, dotContent, 'utf-8')
      .then(() => {
        // Spawn dot process to convert to SVG
        const dot = spawn('dot', ['-Tsvg', tmpFile]);

        let svgOutput = '';
        let errorOutput = '';

        dot.stdout.on('data', (data) => {
          svgOutput += data.toString();
        });

        dot.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        dot.on('close', async (code) => {
          // Clean up temp file
          await unlink(tmpFile).catch(() => {});

          if (code === 0) {
            resolve(svgOutput);
          } else {
            reject(new Error(`dot command failed: ${errorOutput}`));
          }
        });

        dot.on('error', async (error) => {
          await unlink(tmpFile).catch(() => {});
          reject(new Error(`Failed to spawn dot command: ${error.message}`));
        });
      })
      .catch(reject);
  });
}

/**
 * Generate call graph and convert to SVG
 */
export async function generateCallGraphSvg(solPath: string): Promise<string> {
  const dotGraph = await generateCallGraph(solPath);
  return convertDotToSvg(dotGraph);
}

/**
 * Generate inheritance graph and convert to SVG
 */
export async function generateInheritanceGraphSvg(solPath: string): Promise<string> {
  const dotGraph = await generateInheritanceGraph(solPath);
  return convertDotToSvg(dotGraph);
}
