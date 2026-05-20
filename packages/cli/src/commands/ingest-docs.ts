import chalk from 'chalk';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { DocsIngester } from '@imayuur/contexthub-docs-ingest';

export interface IngestDocsOptions {
  patterns?: string[];
}

export async function ingestDocsCommand(options: IngestDocsOptions = {}): Promise<void> {
  const currentDir = process.cwd();
  
  console.log(chalk.blue('ContextHub: Ingesting documentation...'));

  const vectorEngine = new VectorEngine(currentDir);
  const graphManager = new CodeGraphManager(currentDir);
  const docsIngester = new DocsIngester(currentDir, vectorEngine, graphManager);

  const patterns = options.patterns && options.patterns.length > 0 ? options.patterns : ['**/*.md'];

  try {
    const count = await docsIngester.ingestMarkdown(patterns);
    
    if (count > 0) {
      console.log(chalk.green(`\n✓ Successfully ingested ${count} document(s)`));
    } else {
      console.log(chalk.yellow('\n⚠ No matching documents found or ingested'));
    }
  } catch (error: any) {
    console.error(chalk.red(`\n✖ Failed to ingest docs: ${error.message}`));
    process.exit(1);
  }
}
