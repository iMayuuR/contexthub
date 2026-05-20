import * as fs from 'fs';
import * as path from 'path';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import chalk from 'chalk';

export async function blastRadiusCommand(files: string[]): Promise<void> {
  const currentDir = process.cwd();
  const graphManager = new CodeGraphManager(currentDir);

  if (files.length === 0) {
    console.error(chalk.red('Error: No files specified for blast radius analysis.'));
    process.exit(1);
  }

  const reports: string[] = [];
  
  reports.push('# ContextHub PR Blast-Radius Report\n');
  reports.push(`Analyzed **${files.length}** modified file(s).\n`);

  for (const file of files) {
    const relToRepo = path.relative(currentDir, path.resolve(currentDir, file)).replace(/\\/g, '/');
    
    reports.push(`### File: \`${relToRepo}\``);
    
    try {
      const { nodes } = await graphManager.getBlastRadius(relToRepo, 2);
      
      // Filter out files (blast radius returns files and symbol nodes) and ignore the file itself
      const affectedFiles = nodes
        .filter(n => n.kind === 'file' && n.path !== relToRepo)
        .slice(0, 20);
        
      if (affectedFiles.length === 0) {
        reports.push('> No downstream files are affected by changes to this file.\n');
      } else {
        reports.push('| Affected File | Path | Lang |');
        reports.push('|---|---|---|');
        for (const af of affectedFiles) {
          reports.push(`| **${path.basename(af.path)}** | \`${af.path}\` | ${af.lang || 'unknown'} |`);
        }
        reports.push('');
      }
    } catch (e: any) {
      reports.push(`> Failed to analyze blast radius: ${e.message}\n`);
    }
  }

  reports.push('\n*Report generated securely by [ContextHub](https://github.com/iMayuuR/contexthub)*');
  
  console.log(reports.join('\n'));
}
