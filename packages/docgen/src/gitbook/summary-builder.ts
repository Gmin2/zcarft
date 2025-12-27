/**
 * SUMMARY.md builder for GitBook navigation
 */

import type { SummaryItem, SummarySection, ContractInput } from '../types.js';

/**
 * Build SUMMARY.md content from configuration
 */
export function buildSummary(
  sections: SummarySection[],
  contracts: ContractInput[]
): string {
  let content = '# Summary\n\n';

  for (const section of sections) {
    content += `## ${section.title}\n\n`;

    if (section.auto && section.title === 'Contracts') {
      // Auto-generate contract navigation
      content += `- [Overview](contracts/README.md)\n`;
      for (const contract of contracts) {
        content += `- [${contract.name}](contracts/${contract.name}.md)\n`;
      }
    } else if (section.pages) {
      // Manual pages
      for (const page of section.pages) {
        const title = extractTitleFromPath(page);
        content += `- [${title}](${page})\n`;
      }
    }

    content += '\n';
  }

  return content;
}

/**
 * Build summary items tree structure
 */
export function buildSummaryTree(
  sections: SummarySection[],
  contracts: ContractInput[]
): SummaryItem[] {
  const items: SummaryItem[] = [];

  for (const section of sections) {
    const sectionItem: SummaryItem = {
      title: section.title,
      children: [],
    };

    if (section.auto && section.title === 'Contracts') {
      // Auto-generate contract navigation
      sectionItem.children!.push({
        title: 'Overview',
        path: 'contracts/README.md',
      });

      for (const contract of contracts) {
        sectionItem.children!.push({
          title: contract.name,
          path: `contracts/${contract.name}.md`,
        });
      }
    } else if (section.pages) {
      // Manual pages
      for (const page of section.pages) {
        sectionItem.children!.push({
          title: extractTitleFromPath(page),
          path: page,
        });
      }
    }

    items.push(sectionItem);
  }

  return items;
}

/**
 * Extract title from file path
 * e.g., "getting-started/installation.md" -> "Installation"
 */
function extractTitleFromPath(path: string): string {
  const filename = path.split('/').pop() || path;
  const nameWithoutExt = filename.replace(/\.md$/, '');

  // Convert kebab-case to Title Case
  return nameWithoutExt
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Render summary items as markdown
 */
export function renderSummaryItems(items: SummaryItem[], indent = 0): string {
  let content = '';
  const indentStr = '  '.repeat(indent);

  for (const item of items) {
    if (item.path) {
      content += `${indentStr}- [${item.title}](${item.path})\n`;
    } else {
      content += `${indentStr}- ${item.title}\n`;
    }

    if (item.children && item.children.length > 0) {
      content += renderSummaryItems(item.children, indent + 1);
    }
  }

  return content;
}
